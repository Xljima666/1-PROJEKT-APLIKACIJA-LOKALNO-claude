import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.CAD_CONVERTER_PORT || 8791);
const maxBytes = Number(process.env.CAD_CONVERTER_MAX_BYTES || 150 * 1024 * 1024);
const progIds = process.env.CAD_CONVERTER_PROGIDS || "ZWCAD.Application.2026,ZWCAD.Application";

process.on("uncaughtException", (error) => {
  console.error("[cad-converter] uncaughtException", error);
});

process.on("unhandledRejection", (error) => {
  console.error("[cad-converter] unhandledRejection", error);
});

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers,
  });
  res.end(body);
}

function json(res, status, body) {
  send(res, status, JSON.stringify(body), { "Content-Type": "application/json; charset=utf-8" });
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error(`Upload je veci od limita (${Math.round(maxBytes / 1024 / 1024)} MB).`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipartFile(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  const boundary = match?.[1] || match?.[2];
  if (!boundary) throw new Error("Nedostaje multipart boundary.");

  const delimiter = Buffer.from(`--${boundary}`);
  const start = buffer.indexOf(delimiter);
  if (start < 0) throw new Error("Multipart body nije valjan.");

  const headerStart = start + delimiter.length + 2;
  const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), headerStart);
  if (headerEnd < 0) throw new Error("Multipart header nije valjan.");

  const header = buffer.subarray(headerStart, headerEnd).toString("utf8");
  const nameMatch = /name="([^"]+)"/i.exec(header);
  const filenameMatch = /filename="([^"]*)"/i.exec(header);
  if (nameMatch?.[1] !== "file" || !filenameMatch?.[1]) {
    throw new Error("Ocekivan je multipart field `file` s DWG datotekom.");
  }

  const bodyStart = headerEnd + 4;
  const nextBoundary = buffer.indexOf(Buffer.from(`\r\n--${boundary}`), bodyStart);
  if (nextBoundary < 0) throw new Error("Multipart file nije zatvoren.");

  return {
    filename: basename(filenameMatch[1]),
    data: buffer.subarray(bodyStart, nextBoundary),
  };
}

function runPowerShell(scriptPath, inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-InputPath",
      inputPath,
      "-OutputPath",
      outputPath,
      "-ProgIds",
      progIds,
    ], { windowsHide: true });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error((stderr || stdout || `PowerShell exited with ${code}`).trim()));
      }
    });
  });
}

function runProcess(command, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${basename(command)} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error((stderr || stdout || `${basename(command)} exited with ${code}`).trim()));
      }
    });
  });
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findLibreDwgBinary() {
  if (process.env.DWG2DXF_PATH && await exists(process.env.DWG2DXF_PATH)) {
    return process.env.DWG2DXF_PATH;
  }

  const vendorPaths = [
    join(__dirname, "vendor", "libredwg-0.13.4-win64", "dwg2dxf.exe"),
    join(__dirname, "vendor", "libredwg-0.13.4-win64", "bin", "dwg2dxf.exe"),
  ];
  for (const vendorPath of vendorPaths) {
    if (await exists(vendorPath)) return vendorPath;
  }

  return "dwg2dxf.exe";
}

async function convertWithLibreDwg(inputPath, outputPath) {
  const dwg2dxf = await findLibreDwgBinary();
  await runProcess(dwg2dxf, ["-y", "-o", outputPath, inputPath], 120000);
  if (!await exists(outputPath)) {
    throw new Error("LibreDWG nije napravio DXF output.");
  }
}

async function handleConvert(req, res) {
  const workDir = join(tmpdir(), `geoterra-cad-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    const buffer = await collectBody(req);
    const uploaded = parseMultipartFile(buffer, req.headers["content-type"]);
    if (extname(uploaded.filename).toLowerCase() !== ".dwg") {
      throw new Error("Converter prima samo .dwg. DXF se ucitava direktno u aplikaciji.");
    }

    await mkdir(workDir, { recursive: true });
    const inputPath = join(workDir, uploaded.filename);
    const outputPath = join(workDir, `${basename(uploaded.filename, extname(uploaded.filename))}.dxf`);
    await writeFile(inputPath, uploaded.data);

    try {
      await convertWithLibreDwg(inputPath, outputPath);
    } catch (libreError) {
      console.error("[cad-converter] LibreDWG failed, trying COM fallback:", libreError);
      const scriptPath = join(__dirname, "Convert-DwgToDxf.ps1");
      await runPowerShell(scriptPath, inputPath, outputPath);
    }
    const dxf = await readFile(outputPath, "utf8");

    json(res, 200, { dxf });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, progIds, maxBytes });
    return;
  }
  if (req.method === "POST" && req.url === "/convert") {
    await handleConvert(req, res);
    return;
  }
  json(res, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Geo Terra CAD converter listening on http://localhost:${port}`);
  console.log(`Using COM ProgIDs: ${progIds}`);
});
