"""
GeoTerra Agent Server - FastAPI backend za autonomno izvršavanje koda
Pokreni lokalno na svom Windows PC-u, koristi ngrok za pristup s interneta.

Instalacija:
    pip install fastapi uvicorn gitpython

Pokretanje:
    python agent_server.py

Ngrok (za pristup s interneta):
    ngrok http 8432
"""

import os
import sys
import subprocess
import tempfile
import uuid
import shutil
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ============ KONFIGURACIJA ============
WORKSPACE_DIR = os.environ.get("AGENT_WORKSPACE", r"D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude\1 PROJEKTI")
API_KEY = os.environ.get("AGENT_API_KEY", "promijeni-me-na-siguran-kljuc-123")
MAX_TIMEOUT = 120
MAX_OUTPUT_CHARS = 50000
PYTHON_CMD = sys.executable

# ============ APLIKACIJA ============

app = FastAPI(title="GeoTerra Agent Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ AUTENTIFIKACIJA ============

async def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Nevažeći API ključ")
    return x_api_key


# ============ MODELI ============

class RunPythonRequest(BaseModel):
    code: str
    filename: Optional[str] = None
    args: Optional[list[str]] = None
    timeout: Optional[int] = 60

class RunShellRequest(BaseModel):
    command: str
    cwd: Optional[str] = None
    timeout: Optional[int] = 30

class ReadFileRequest(BaseModel):
    path: str
    encoding: Optional[str] = "utf-8"

class WriteFileRequest(BaseModel):
    path: str
    content: str
    encoding: Optional[str] = "utf-8"

class ListFilesRequest(BaseModel):
    path: Optional[str] = "."
    recursive: Optional[bool] = False

class GitPushRequest(BaseModel):
    repo_path: Optional[str] = "."
    message: Optional[str] = None
    files: Optional[list[str]] = None

class PipInstallRequest(BaseModel):
    packages: list[str]

class PlaywrightRequest(BaseModel):
    action: str
    url: Optional[str] = None
    selector: Optional[str] = None
    value: Optional[str] = None
    script: Optional[str] = None
    timeout: Optional[int] = 30000
    wait_for: Optional[str] = None
    full_page: Optional[bool] = True


# ============ HELPERI ============

def safe_path(requested_path: str | None) -> Path:
    """Dopusti relativne i apsolutne putanje, ali samo unutar workspace-a."""
    workspace = Path(WORKSPACE_DIR).resolve()
    raw_path = (requested_path or ".").strip() or "."
    candidate = Path(raw_path)

    target = candidate.resolve() if candidate.is_absolute() else (workspace / candidate).resolve()

    try:
        target.relative_to(workspace)
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail=f"Pristup zabranjen: path '{raw_path}' (resolved: '{target}') izlazi iz workspace-a '{workspace}'"
        )

    return target


def truncate_output(text: str) -> str:
    if len(text) > MAX_OUTPUT_CHARS:
        return text[:MAX_OUTPUT_CHARS] + f"\n\n... [output skraćen, ukupno {len(text)} znakova]"
    return text


def ensure_workspace():
    """Stvori workspace folder ako ne postoji"""
    os.makedirs(WORKSPACE_DIR, exist_ok=True)


# ============ BLACKLIST KOMANDI ============

SHELL_BLACKLIST = [
    "format", "del /s", "rd /s", "rmdir /s",
    "shutdown", "restart",
    "reg delete", "reg add",
    "net user", "net localgroup",
    "powershell -enc", "powershell -e ",
    "cmd /c del", "cmd /c rd",
]

def check_shell_safety(command: str):
    cmd_lower = command.lower().strip()
    for blocked in SHELL_BLACKLIST:
        if blocked in cmd_lower:
            raise HTTPException(
                status_code=403,
                detail=f"Komanda blokirana iz sigurnosnih razloga: sadrži '{blocked}'"
            )


# ============ ENDPOINTS ============

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "workspace": WORKSPACE_DIR,
        "python": PYTHON_CMD,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/run_python")
async def run_python(req: RunPythonRequest, _: str = Depends(verify_api_key)):
    """Pokreni Python kod u workspace folderu"""
    ensure_workspace()

    filename = req.filename or f"script_{uuid.uuid4().hex[:8]}.py"
    script_path = safe_path(filename)

    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text(req.code, encoding="utf-8")

    timeout = min(req.timeout or 60, MAX_TIMEOUT)
    args = req.args or []

    try:
        result = subprocess.run(
            [PYTHON_CMD, str(script_path)] + args,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=WORKSPACE_DIR,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        return {
            "success": result.returncode == 0,
            "exit_code": result.returncode,
            "stdout": truncate_output(result.stdout),
            "stderr": truncate_output(result.stderr),
            "script_path": str(script_path.relative_to(WORKSPACE_DIR)),
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Skripta prekinuta nakon {timeout}s timeout-a",
            "script_path": str(script_path.relative_to(WORKSPACE_DIR)),
        }


@app.post("/run_shell")
async def run_shell(req: RunShellRequest, _: str = Depends(verify_api_key)):
    """Izvrši shell komandu u workspace folderu"""
    ensure_workspace()
    check_shell_safety(req.command)

    cwd = str(safe_path(req.cwd)) if req.cwd else WORKSPACE_DIR
    timeout = min(req.timeout or 30, MAX_TIMEOUT)

    try:
        result = subprocess.run(
            req.command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        return {
            "success": result.returncode == 0,
            "exit_code": result.returncode,
            "stdout": truncate_output(result.stdout),
            "stderr": truncate_output(result.stderr),
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Komanda prekinuta nakon {timeout}s timeout-a",
        }


@app.post("/read_file")
async def read_file(req: ReadFileRequest, _: str = Depends(verify_api_key)):
    """Pročitaj datoteku iz workspace-a"""
    file_path = safe_path(req.path)

    if not file_path.exists():
        return {"success": False, "error": f"Datoteka ne postoji: {req.path}"}

    if not file_path.is_file():
        return {"success": False, "error": f"Nije datoteka: {req.path}"}

    if file_path.stat().st_size > 10 * 1024 * 1024:
        return {"success": False, "error": "Datoteka prevelika (max 10MB)"}

    try:
        content = file_path.read_text(encoding=req.encoding)
        return {
            "success": True,
            "content": truncate_output(content),
            "size": file_path.stat().st_size,
            "path": req.path,
        }
    except UnicodeDecodeError:
        return {"success": False, "error": "Datoteka nije tekstualna ili koristi drugačiji encoding"}


@app.post("/write_file")
async def write_file(req: WriteFileRequest, _: str = Depends(verify_api_key)):
    """Zapiši datoteku u workspace"""
    file_path = safe_path(req.path)

    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(req.content, encoding=req.encoding)

    return {
        "success": True,
        "path": req.path,
        "size": len(req.content),
    }


@app.post("/list_files")
async def list_files(req: ListFilesRequest, _: str = Depends(verify_api_key)):
    """Izlistaj datoteke u workspace-u"""
    target = safe_path(req.path or ".")

    if not target.exists():
        return {"success": False, "error": f"Path ne postoji: {req.path}"}

    files = []
    if req.recursive:
        for item in target.rglob("*"):
            rel = item.relative_to(Path(WORKSPACE_DIR))
            files.append({
                "path": str(rel),
                "is_dir": item.is_dir(),
                "size": item.stat().st_size if item.is_file() else 0,
            })
    else:
        for item in target.iterdir():
            rel = item.relative_to(Path(WORKSPACE_DIR))
            files.append({
                "path": str(rel),
                "is_dir": item.is_dir(),
                "size": item.stat().st_size if item.is_file() else 0,
            })

    files.sort(key=lambda f: (not f["is_dir"], f["path"]))

    return {
        "success": True,
        "files": files[:500],
        "total": len(files),
    }


@app.post("/git_push")
async def git_push(req: GitPushRequest, _: str = Depends(verify_api_key)):
    """Git add, commit i push u workspace-u"""
    repo_path = str(safe_path(req.repo_path or "."))
    message = req.message or f"Auto-commit {datetime.now().strftime('%Y-%m-%d %H:%M')}"

    results = []

    if req.files:
        for f in req.files:
            r = subprocess.run(["git", "add", f], capture_output=True, text=True, cwd=repo_path)
            results.append({"cmd": f"git add {f}", "ok": r.returncode == 0, "output": r.stderr or r.stdout})
    else:
        r = subprocess.run(["git", "add", "-A"], capture_output=True, text=True, cwd=repo_path)
        results.append({"cmd": "git add -A", "ok": r.returncode == 0, "output": r.stderr or r.stdout})

    r = subprocess.run(["git", "commit", "-m", message], capture_output=True, text=True, cwd=repo_path)
    results.append({"cmd": f"git commit -m '{message}'", "ok": r.returncode == 0, "output": r.stderr or r.stdout})

    r = subprocess.run(["git", "push"], capture_output=True, text=True, cwd=repo_path, timeout=60)
    results.append({"cmd": "git push", "ok": r.returncode == 0, "output": r.stderr or r.stdout})

    all_ok = all(r["ok"] for r in results)
    return {"success": all_ok, "steps": results}


@app.post("/pip_install")
async def pip_install(req: PipInstallRequest, _: str = Depends(verify_api_key)):
    """Instaliraj Python pakete"""
    if not req.packages:
        return {"success": False, "error": "Nema paketa za instalaciju"}

    for pkg in req.packages:
        if any(c in pkg for c in [";", "&", "|", "`", "$", "(", ")"]):
            raise HTTPException(status_code=403, detail=f"Nevažeći naziv paketa: {pkg}")

    try:
        result = subprocess.run(
            [PYTHON_CMD, "-m", "pip", "install"] + req.packages,
            capture_output=True,
            text=True,
            timeout=120,
        )
        return {
            "success": result.returncode == 0,
            "stdout": truncate_output(result.stdout),
            "stderr": truncate_output(result.stderr),
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Instalacija prekinuta (timeout)"}


# ============ PLAYWRIGHT ============

_playwright = None
_browser = None
_page = None


async def get_playwright_page():
    """Get or create persistent async browser page"""
    global _playwright, _browser, _page
    if _page is None or _browser is None:
        try:
            from playwright.async_api import async_playwright
            _playwright = await async_playwright().start()
            _browser = await _playwright.chromium.launch(headless=True)
            _page = await _browser.new_page()
            await _page.set_viewport_size({"width": 1280, "height": 720})
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="Playwright nije instaliran. Pokreni: pip install playwright && playwright install chromium"
            )
    return _page


async def close_playwright():
    """Close browser session"""
    global _playwright, _browser, _page
    if _browser:
        try:
            await _browser.close()
        except:
            pass
    if _playwright:
        try:
            await _playwright.stop()
        except:
            pass
    _playwright = None
    _browser = None
    _page = None


@app.post("/playwright")
async def playwright_action(req: PlaywrightRequest, _: str = Depends(verify_api_key)):
    """Kontroliraj browser putem Playwrighta"""
    import base64
    action = req.action.lower()

    if action == "close":
        await close_playwright()
        return {"success": True, "message": "Browser session zatvorena"}

    try:
        page = await get_playwright_page()

        if action == "navigate":
            if not req.url:
                return {"success": False, "error": "URL je obavezan za navigate"}
            await page.goto(req.url, timeout=req.timeout, wait_until="domcontentloaded")
            if req.wait_for:
                await page.wait_for_selector(req.wait_for, timeout=req.timeout)
            title = await page.title()
            url = page.url
            return {
                "success": True,
                "title": title,
                "url": url,
                "message": f"Navigirano na {url} (naslov: {title})",
            }

        elif action == "screenshot":
            screenshot_path = os.path.join(WORKSPACE_DIR, "screenshot.png")
            await page.screenshot(path=screenshot_path, full_page=req.full_page)
            with open(screenshot_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            return {
                "success": True,
                "screenshot_base64": b64[:100] + "..." if len(b64) > 100 else b64,
                "screenshot_path": "screenshot.png",
                "size": os.path.getsize(screenshot_path),
                "message": "Screenshot spremljen u screenshot.png",
            }

        elif action == "click":
            if not req.selector:
                return {"success": False, "error": "Selector je obavezan za click"}
            await page.click(req.selector, timeout=req.timeout)
            if req.wait_for:
                await page.wait_for_selector(req.wait_for, timeout=req.timeout)
            return {"success": True, "message": f"Kliknuto na '{req.selector}'"}

        elif action == "fill":
            if not req.selector or req.value is None:
                return {"success": False, "error": "Selector i value su obavezni za fill"}
            await page.fill(req.selector, req.value, timeout=req.timeout)
            return {"success": True, "message": f"Ispunjeno polje '{req.selector}' s vrijednošću"}

        elif action == "extract":
            if not req.selector:
                content = await page.inner_text("body")
            else:
                elements = await page.query_selector_all(req.selector)
                texts = []
                for el in elements:
                    texts.append(await el.inner_text())
                content = "\n".join(texts)
            return {
                "success": True,
                "content": truncate_output(content),
                "url": page.url,
            }

        elif action == "evaluate":
            if not req.script:
                return {"success": False, "error": "Script je obavezan za evaluate"}
            result = await page.evaluate(req.script)
            return {
                "success": True,
                "result": str(result)[:MAX_OUTPUT_CHARS] if result is not None else None,
            }

        elif action == "pdf":
            pdf_path = os.path.join(WORKSPACE_DIR, "page.pdf")
            await page.pdf(path=pdf_path, format="A4")
            return {
                "success": True,
                "pdf_path": "page.pdf",
                "size": os.path.getsize(pdf_path),
                "message": "PDF spremljen u page.pdf",
            }

        elif action == "wait":
            if req.wait_for:
                await page.wait_for_selector(req.wait_for, timeout=req.timeout)
                return {"success": True, "message": f"Element '{req.wait_for}' pronađen"}
            elif req.timeout:
                await page.wait_for_timeout(min(req.timeout, 10000))
                return {"success": True, "message": f"Čekano {req.timeout}ms"}
            return {"success": False, "error": "Potreban wait_for selector ili timeout"}

        elif action == "select":
            if not req.selector or not req.value:
                return {"success": False, "error": "Selector i value su obavezni za select"}
            await page.select_option(req.selector, req.value, timeout=req.timeout)
            return {"success": True, "message": f"Odabrano '{req.value}' u '{req.selector}'"}

        elif action == "get_html":
            if req.selector:
                el = await page.query_selector(req.selector)
                html = await el.inner_html() if el else ""
            else:
                html = await page.content()
            return {
                "success": True,
                "html": truncate_output(html),
                "url": page.url,
            }

        else:
            return {"success": False, "error": f"Nepoznata akcija: {action}. Dostupne: navigate, screenshot, click, fill, extract, evaluate, pdf, close, wait, select, get_html"}

    except Exception as e:
        return {"success": False, "error": str(e)}


# ============ POKRETANJE ============

if __name__ == "__main__":
    import uvicorn

    print(f"""
╔══════════════════════════════════════════════════════╗
║        GeoTerra Agent Server v1.0                    ║
╠══════════════════════════════════════════════════════╣
║  Workspace:  {WORKSPACE_DIR:<40} ║
║  Python:     {PYTHON_CMD:<40} ║
║  API Key:    {'***' + API_KEY[-4:]:<40} ║
║  Port:       8432                                    ║
╠══════════════════════════════════════════════════════╣
║  Za pristup s interneta koristi:                     ║
║    ngrok http 8432                                   ║
║                                                      ║
║  Zatim kopiraj ngrok URL u Lovable secret:           ║
║    AGENT_SERVER_URL = https://xxxx.ngrok.io           ║
╚══════════════════════════════════════════════════════╝
    """)

    ensure_workspace()
    uvicorn.run(app, host="0.0.0.0", port=8432)
