"""
GeoTerra Agent Server - FastAPI backend za autonomno izvršavanje koda
Pokreni lokalno na svom Windows PC-u. Za vanjski pristup koristi Cloudflare Tunnel.

Instalacija:
    pip install fastapi uvicorn gitpython

Pokretanje:
    python agent_server.py

Cloudflare Tunnel (preporučeno):
    https://agent.geoterrainfo.com
"""

import os
import sys
import subprocess
import uuid
import json
import base64
import re
import shutil
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, Any

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ============ KONFIGURACIJA ============
WORKSPACE_DIR = os.environ.get(
    "AGENT_WORKSPACE",
    r"D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude\STELLAN-GIT"
)
# Read-only pristup cijelom projektu (parent od MOZAK foldera)
READ_ROOT_DIR = os.environ.get(
    "AGENT_READ_ROOT",
    str(Path(WORKSPACE_DIR).parent)
)
WRITE_ROOT_DIR = os.environ.get(
    "AGENT_WRITE_ROOT",
    READ_ROOT_DIR
)
AGENT_SUBDIR = "2 AGENT"
BACKUP_DIR_NAME = f"{AGENT_SUBDIR}/_agent_backups"
LOG_DIR_NAME = f"{AGENT_SUBDIR}/_agent_logs"
MAX_SEARCH_RESULTS = 500
DEFAULT_AGENT_API_KEY = "stellan-agent-2026-v2-x7k9m2p"
API_KEY = (os.environ.get("AGENT_API_KEY", "") or "").strip() or DEFAULT_AGENT_API_KEY
VALID_API_KEYS = {
    key.strip()
    for key in [
        API_KEY,
        os.environ.get("AGENT_API_KEY", ""),
        DEFAULT_AGENT_API_KEY,
    ]
    if key and key.strip()
}
MAX_TIMEOUT = 180
MAX_OUTPUT_CHARS = 50000
PYTHON_CMD = sys.executable
# Agent server folder — puno dopuštenje (čitanje/pisanje)
AGENT_SERVER_DIR = os.environ.get(
    "AGENT_SERVER_DIR",
    r"D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude\STELLAN-GIT\docs\agent-server"
)

# ============ PORTAL KREDENCIJALI ============
# Postavi svoje SDGE i OSS kredencijale ovdje ili kroz environment varijable
if not os.environ.get("SDGE_USERNAME"):
    os.environ["SDGE_USERNAME"] = ""  # UPIŠI SVOJ SDGE USERNAME
if not os.environ.get("SDGE_PASSWORD"):
    os.environ["SDGE_PASSWORD"] = ""  # UPIŠI SVOJU SDGE LOZINKU
if not os.environ.get("OSS_USERNAME"):
    os.environ["OSS_USERNAME"] = ""  # UPIŠI SVOJ OSS USERNAME
if not os.environ.get("OSS_PASSWORD"):
    os.environ["OSS_PASSWORD"] = ""  # UPIŠI SVOJU OSS LOZINKU

# ============ APLIKACIJA ============
app = FastAPI(title="GeoTerra Agent Server", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ AUTENTIFIKACIJA ============

async def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    if x_api_key not in VALID_API_KEYS:
        raise HTTPException(status_code=401, detail="Nevažeći API ključ")
    return x_api_key

# ============ STELLAN BRAIN ============
try:
    from brain_routes import register_brain_routes
    register_brain_routes(app, verify_key=verify_api_key)
    print("[BRAIN] Stellan Brain ucitan i endpointi registrirani")
except Exception as _brain_err:
    print(f"[BRAIN] WARNING: Brain nije ucitan ({_brain_err}). Agent server radi normalno bez brain endpointa.")

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
    full_content: Optional[bool] = True

class WriteFileRequest(BaseModel):
    path: str
    content: str
    encoding: Optional[str] = "utf-8"
    create_dirs: Optional[bool] = True
    backup_first: Optional[bool] = False

class BackupFileRequest(BaseModel):
    path: str

class BackupProjectRequest(BaseModel):
    repo_path: Optional[str] = "."
    limit: Optional[int] = 8

class ListBackupsRequest(BaseModel):
    repo_path: Optional[str] = "."
    limit: Optional[int] = 8

class ListFilesRequest(BaseModel):
    path: Optional[str] = "."
    recursive: Optional[bool] = False

class SearchInFilesRequest(BaseModel):
    root: str
    query: str
    extensions: Optional[list[str]] = [".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md"]
    recursive: Optional[bool] = True

class FindFilesRequest(BaseModel):
    root: str
    pattern: str
    recursive: Optional[bool] = True
    max_results: Optional[int] = 50

class GitPushRequest(BaseModel):
    repo_path: Optional[str] = "."
    message: Optional[str] = None
    files: Optional[list[str]] = None
    branch: Optional[str] = None

class GitCommitRequest(BaseModel):
    repo_path: Optional[str] = "."
    message: str

class GitStatusRequest(BaseModel):
    repo_path: Optional[str] = "."

class GitPullRebaseRequest(BaseModel):
    repo_path: Optional[str] = "."
    branch: Optional[str] = None

class RunBuildRequest(BaseModel):
    cwd: Optional[str] = "."
    command: Optional[list[str]] = ["npm", "run", "build"]
    timeout: Optional[int] = 300

class ReadLogsRequest(BaseModel):
    cwd: Optional[str] = "."
    log_name: Optional[str] = "build"
    max_chars: Optional[int] = 20000

class PatchFileItem(BaseModel):
    path: str
    content: str

class SafeApplyPatchSetRequest(BaseModel):
    cwd: str
    files: list[PatchFileItem]
    run_build: Optional[bool] = True
    build_command: Optional[list[str]] = ["npm", "run", "build"]
    build_timeout: Optional[int] = 300
    git_commit: Optional[bool] = False
    commit_message: Optional[str] = "agent patch"
    git_push: Optional[bool] = False
    git_branch: Optional[str] = "main"

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

class StepScreenshotRequest(BaseModel):
    description: Optional[str] = None

class AgentRunRequest(BaseModel):
    command: str


class CleanPlaywrightRequest(BaseModel):
    content: str

class RunTempCodeRequest(BaseModel):
    content: str
    timeout: Optional[int] = 90

class MergeRecordingRequest(BaseModel):
    content: str
    insert_at: Optional[int] = None
    marker: Optional[str] = "# STELLAN_CONTINUE_HERE"


# ============ HELPERI ============

def safe_path(requested_path: str | None) -> Path:
    """Puna prava (čitanje/pisanje/izvršavanje) — unutar workspace-a, project write root-a ili agent-server foldera."""
    workspace = Path(WORKSPACE_DIR).resolve()
    write_root = Path(WRITE_ROOT_DIR).resolve()
    agent_dir = Path(AGENT_SERVER_DIR).resolve()
    raw_path = (requested_path or ".").strip() or "."
    candidate = Path(raw_path)

    if candidate.is_absolute():
        target = candidate.resolve()
    else:
        workspace_candidate = (workspace / candidate).resolve()
        write_root_candidate = (write_root / candidate).resolve()
        agent_candidate = (agent_dir / candidate).resolve()
        if workspace_candidate.exists():
            target = workspace_candidate
        elif write_root_candidate.exists():
            target = write_root_candidate
        elif agent_candidate.exists():
            target = agent_candidate
        else:
            # default new files go to write root unless explicitly under workspace/agent path
            target = write_root_candidate

    in_workspace = False
    in_write_root = False
    in_agent_dir = False
    try:
        target.relative_to(workspace)
        in_workspace = True
    except ValueError:
        pass
    try:
        target.relative_to(write_root)
        in_write_root = True
    except ValueError:
        pass
    try:
        target.relative_to(agent_dir)
        in_agent_dir = True
    except ValueError:
        pass

    if not in_workspace and not in_write_root and not in_agent_dir:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Pristup zabranjen: path '{raw_path}' (resolved: '{target}') "
                f"izlazi iz dozvoljenih direktorija: '{workspace}', '{write_root}' ili '{agent_dir}'"
            ),
        )

    return target

def safe_read_path(requested_path: str | None) -> Path:
    """Read-only pristup — dozvoljava projekt folder, workspace i agent-server folder."""
    read_root = Path(READ_ROOT_DIR).resolve()
    workspace = Path(WORKSPACE_DIR).resolve()
    agent_dir = Path(AGENT_SERVER_DIR).resolve()
    raw_path = (requested_path or ".").strip() or "."
    candidate = Path(raw_path)

    if candidate.is_absolute():
        target = candidate.resolve()
    else:
        workspace_candidate = (workspace / candidate).resolve()
        read_root_candidate = (read_root / candidate).resolve()
        agent_candidate = (agent_dir / candidate).resolve()
        target = workspace_candidate if workspace_candidate.exists() else (agent_candidate if agent_candidate.exists() else read_root_candidate)

    in_workspace = False
    in_read_root = False
    in_agent_dir = False
    try:
        target.relative_to(workspace)
        in_workspace = True
    except ValueError:
        pass
    try:
        target.relative_to(read_root)
        in_read_root = True
    except ValueError:
        pass
    try:
        target.relative_to(agent_dir)
        in_agent_dir = True
    except ValueError:
        pass

    if not in_workspace and not in_read_root and not in_agent_dir:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Pristup zabranjen: path '{raw_path}' izlazi iz dozvoljenih direktorija. "
                f"Dozvoljeno: '{workspace}' (pisanje) i '{read_root}' (čitanje)"
            ),
        )

    return target

def truncate_output(text: str) -> str:
    if len(text) > MAX_OUTPUT_CHARS:
        return text[:MAX_OUTPUT_CHARS] + f"\n\n... [output skraćen, ukupno {len(text)} znakova]"
    return text

def ensure_workspace():
    """Stvori workspace folder ako ne postoji."""
    os.makedirs(WORKSPACE_DIR, exist_ok=True)

def ensure_stellan_helpers():
    """Kopiraj stellan_helpers.py iz agent-server foldera u workspace ako postoji novija verzija."""
    src = Path(AGENT_SERVER_DIR) / "stellan_helpers.py"
    dst = Path(WORKSPACE_DIR) / "stellan_helpers.py"
    if not src.exists():
        return
    # Kopiraj samo ako je source noviji ili destination ne postoji
    if not dst.exists() or src.stat().st_mtime > dst.stat().st_mtime:
        import shutil
        shutil.copy2(str(src), str(dst))
        print(f"[Stellan] stellan_helpers.py deployed to workspace.")


def get_log_dir(base_dir: str | Path) -> Path:
    target = Path(base_dir).resolve() / LOG_DIR_NAME
    target.mkdir(parents=True, exist_ok=True)
    return target

def backup_file_impl(file_path: Path) -> Path:
    if not file_path.exists():
        raise FileNotFoundError(f"Datoteka ne postoji: {file_path}")
    backup_dir = file_path.parent / BACKUP_DIR_NAME
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"{file_path.name}.{datetime.now().strftime('%Y%m%d_%H%M%S')}.bak"
    shutil.copy2(file_path, backup_path)
    return backup_path

def search_in_files_impl(root: Path, query: str, extensions: list[str], recursive: bool) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    patterns = [f"*{ext}" for ext in (extensions or [])]
    files: list[Path] = []
    if recursive:
        for pattern in patterns:
            files.extend(root.rglob(pattern))
    else:
        for pattern in patterns:
            files.extend(root.glob(pattern))

    q = query.lower()
    for file in files:
        if not file.is_file():
            continue
        try:
            content = file.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        for idx, line in enumerate(content.splitlines(), start=1):
            if q in line.lower():
                matches.append({
                    "path": str(file),
                    "line": idx,
                    "text": line[:1000],
                })
                if len(matches) >= MAX_SEARCH_RESULTS:
                    return matches
    return matches

def find_files_impl(root: Path, pattern: str, recursive: bool = True, max_results: int = 50) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    needle = pattern.lower().replace("\\", "/").split("/")[-1]
    iterator = root.rglob("*") if recursive else root.glob("*")
    for file in iterator:
        if any(part.lower() in {"node_modules", ".git", "dist", "build"} for part in file.parts):
            continue
        if not file.is_file():
            continue
        if needle in file.name.lower():
            try:
                size = file.stat().st_size
            except Exception:
                size = 0
            results.append({"path": str(file), "size": size})
            if len(results) >= max_results:
                break
    return results

def resolve_command_for_windows(command: list[str]) -> list[str]:
    """Na Windowsu osiguraj da npm/npx/git komande rade i kad PATH ne vraća plain naziv."""
    if not command:
        return command

    first = str(command[0]).lower()
    if os.name != "nt":
        return command

    if first == "npm":
        npm_cmd = shutil.which("npm.cmd") or shutil.which("npm")
        if npm_cmd:
            return [npm_cmd, *command[1:]]
        return ["cmd", "/c", "npm", *command[1:]]

    if first == "npx":
        npx_cmd = shutil.which("npx.cmd") or shutil.which("npx")
        if npx_cmd:
            return [npx_cmd, *command[1:]]
        return ["cmd", "/c", "npx", *command[1:]]

    if first == "git":
        git_cmd = shutil.which("git.exe") or shutil.which("git.cmd") or shutil.which("git")
        if git_cmd:
            return [git_cmd, *command[1:]]
        return ["cmd", "/c", "git", *command[1:]]

    return command

def run_simple_command(command: list[str], cwd: Path, timeout: int = 180) -> dict[str, Any]:
    resolved_command = resolve_command_for_windows(command)
    try:
        result = subprocess.run(
            resolved_command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
        )
        return {
            "success": result.returncode == 0,
            "exit_code": result.returncode,
            "stdout": truncate_output(result.stdout),
            "stderr": truncate_output(result.stderr),
            "command": resolved_command,
        }
    except FileNotFoundError as e:
        err = f"{e}. Command tried: {' '.join(resolved_command)}"
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": err,
            "error": err,
            "command": resolved_command,
        }

def run_command_with_logs(command: list[str], cwd: Path, log_name: str, timeout: int = 180) -> dict[str, Any]:
    cwd = cwd.resolve()
    log_dir = get_log_dir(cwd)
    stdout_log = log_dir / f"{log_name}.stdout.log"
    stderr_log = log_dir / f"{log_name}.stderr.log"

    result = run_simple_command(command, cwd, timeout=timeout)
    stdout_log.write_text(result.get("stdout") or "", encoding="utf-8")
    stderr_log.write_text(result.get("stderr") or "", encoding="utf-8")
    result["stdout_log"] = str(stdout_log)
    result["stderr_log"] = str(stderr_log)
    return result

def read_log_tail(log_path: Path, max_chars: int = 20000) -> str:
    if not log_path.exists():
        return ""
    content = log_path.read_text(encoding="utf-8", errors="replace")
    return content[-max_chars:]


def get_project_backup_dir(base_dir: str | Path) -> Path:
    target = Path(base_dir).resolve() / BACKUP_DIR_NAME
    target.mkdir(parents=True, exist_ok=True)
    return target


def create_project_backup(repo_path: Path) -> dict[str, Any]:
    repo_path = repo_path.resolve()
    backup_dir = get_project_backup_dir(repo_path)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    archive_path = backup_dir / f"project_backup_{timestamp}.zip"
    exclude_parts = {'.git', 'node_modules', 'dist', 'build', '_agent_backups', '_agent_logs', '_flow_meta', '_flow_versions', '__pycache__'}

    import zipfile
    with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in repo_path.rglob("*"):
            if any(part in exclude_parts for part in item.parts):
                continue
            if item.is_dir():
                continue
            try:
                arcname = item.relative_to(repo_path)
            except Exception:
                continue
            zf.write(item, arcname)

    return {
        "success": True,
        "backup_name": archive_path.name,
        "backup_path": str(archive_path),
        "size": archive_path.stat().st_size if archive_path.exists() else 0,
        "created_at": datetime.now().isoformat(),
    }


def list_project_backups(repo_path: Path, limit: int = 8) -> list[dict[str, Any]]:
    backup_dir = get_project_backup_dir(repo_path)
    items: list[dict[str, Any]] = []
    for item in sorted(backup_dir.glob("*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)[: max(1, limit)]:
        items.append({
            "name": item.name,
            "path": str(item),
            "size": item.stat().st_size,
            "modified_at": datetime.fromtimestamp(item.stat().st_mtime).isoformat(),
        })
    return items


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
                detail=f"Komanda blokirana iz sigurnosnih razloga: sadrži '{blocked}'",
            )

# ============ ENDPOINTS ============

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "1.2.0",
        "workspace": WORKSPACE_DIR,
        "read_root": READ_ROOT_DIR,
        "write_root": WRITE_ROOT_DIR,
        "python": PYTHON_CMD,
        "timestamp": datetime.now().isoformat(),
    }

@app.post("/run_python")
async def run_python(req: RunPythonRequest, _: str = Depends(verify_api_key)):
    """Pokreni Python kod u workspace folderu."""
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
    """Izvrši shell komandu u workspace folderu."""
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
    """Pročitaj datoteku iz dozvoljenih direktorija."""
    file_path = safe_read_path(req.path)

    if not file_path.exists():
        return {"success": False, "error": f"Datoteka ne postoji: {req.path}"}

    if not file_path.is_file():
        return {"success": False, "error": f"Nije datoteka: {req.path}"}

    if file_path.stat().st_size > 10 * 1024 * 1024:
        return {"success": False, "error": "Datoteka prevelika (max 10MB)"}

    try:
        content = file_path.read_text(encoding=req.encoding, errors="replace")
        return {
            "success": True,
            "content": content if req.full_content else truncate_output(content),
            "size": file_path.stat().st_size,
            "path": str(file_path),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/write_file")
async def write_file(req: WriteFileRequest, _: str = Depends(verify_api_key)):
    """Zapiši datoteku u dozvoljene direktorije."""
    file_path = safe_path(req.path)

    backup_path = None
    if req.backup_first and file_path.exists():
        try:
            backup_path = backup_file_impl(file_path)
        except Exception as e:
            return {"success": False, "error": f"Backup nije uspio: {e}"}

    if req.create_dirs:
        file_path.parent.mkdir(parents=True, exist_ok=True)

    file_path.write_text(req.content, encoding=req.encoding)

    return {
        "success": True,
        "path": str(file_path),
        "size": len(req.content),
        "backup_path": str(backup_path) if backup_path else None,
    }

@app.post("/list_files")
async def list_files(req: ListFilesRequest, _: str = Depends(verify_api_key)):
    """Izlistaj datoteke u workspace-u."""
    target = safe_read_path(req.path or ".")

    if not target.exists():
        return {"success": False, "error": f"Path ne postoji: {req.path}"}

    read_root = Path(READ_ROOT_DIR).resolve()
    workspace = Path(WORKSPACE_DIR).resolve()
    def rel_path(item):
        try:
            return str(item.relative_to(workspace))
        except ValueError:
            try:
                return str(item.relative_to(read_root))
            except ValueError:
                return str(item)

    files = []
    if req.recursive:
        for item in target.rglob("*"):
            files.append({"path": rel_path(item), "is_dir": item.is_dir(), "size": item.stat().st_size if item.is_file() else 0})
    else:
        for item in target.iterdir():
            files.append({"path": rel_path(item), "is_dir": item.is_dir(), "size": item.stat().st_size if item.is_file() else 0})

    files.sort(key=lambda f: (not f["is_dir"], f["path"]))

    return {
        "success": True,
        "files": files[:500],
        "total": len(files),
    }

@app.post("/git_push")
async def git_push(req: GitPushRequest, _: str = Depends(verify_api_key)):
    """Git push. Ako je poslan message ili files, prvo radi add/commit pa tek onda push."""
    repo_path = safe_path(req.repo_path or ".")
    if repo_path.is_file():
        repo_path = repo_path.parent
    repo_path = repo_path.resolve()

    branch = req.branch
    results = []

    if req.files:
        for f in req.files:
            add_result = run_simple_command(["git", "add", f], repo_path, timeout=120)
            results.append({
                "cmd": f"git add {f}",
                "ok": add_result["success"],
                "output": add_result.get("stderr") or add_result.get("stdout") or "",
            })
            if not add_result["success"]:
                return {"success": False, "stage": "git_add", "steps": results, "error": add_result.get("error")}

    elif req.message:
        add_result = run_simple_command(["git", "add", "-A"], repo_path, timeout=120)
        results.append({
            "cmd": "git add -A",
            "ok": add_result["success"],
            "output": add_result.get("stderr") or add_result.get("stdout") or "",
        })
        if not add_result["success"]:
            return {"success": False, "stage": "git_add", "steps": results, "error": add_result.get("error")}

    if req.message:
        commit_result = run_simple_command(["git", "commit", "-m", req.message], repo_path, timeout=120)
        results.append({
            "cmd": f"git commit -m '{req.message}'",
            "ok": commit_result["success"],
            "output": commit_result.get("stderr") or commit_result.get("stdout") or "",
        })
        if not commit_result["success"]:
            return {
                "success": False,
                "stage": "git_commit",
                "steps": results,
                "stdout": commit_result.get("stdout", ""),
                "stderr": commit_result.get("stderr", ""),
                "error": commit_result.get("error"),
            }

    push_cmd = ["git", "push", "origin", branch] if branch else ["git", "push"]
    push_result = run_simple_command(push_cmd, repo_path, timeout=180)
    results.append({
        "cmd": " ".join(push_cmd),
        "ok": push_result["success"],
        "output": push_result.get("stderr") or push_result.get("stdout") or "",
    })

    return {
        "success": push_result["success"],
        "stage": "git_push",
        "steps": results,
        "stdout": push_result.get("stdout", ""),
        "stderr": push_result.get("stderr", ""),
        "error": push_result.get("error"),
        "command": push_result.get("command"),
    }

@app.post("/pip_install")
async def pip_install(req: PipInstallRequest, _: str = Depends(verify_api_key)):
    """Instaliraj Python pakete."""
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

@app.post("/codegen")
async def launch_codegen(req: dict = {}, _: str = Depends(verify_api_key)):
    """Launch Playwright Codegen — opens browser + inspector with code generation."""
    url = req.get("url", "https://oss.uredjenazemlja.hr")
    output_file = req.get("output", os.path.join(WORKSPACE_DIR, "recorded_script.py"))
    try:
        # Launch codegen as detached process (non-blocking)
        subprocess.Popen(
            [PYTHON_CMD, "-m", "playwright", "codegen", url, "-o", output_file, "--target", "python-async"],
            cwd=WORKSPACE_DIR,
            creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0),
        )
        return {
            "success": True,
            "message": f"Playwright Codegen pokrenut za {url}",
            "output_file": output_file,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/codegen/read")
async def codegen_read(req: dict = {}, _: str = Depends(verify_api_key)):
    """Read the last generated codegen script."""
    path = req.get("path", os.path.join(WORKSPACE_DIR, "recorded_script.py"))
    if not os.path.exists(path):
        return {"success": False, "error": "Još nema generiranog koda. Klikaj po browseru pa zatvori Codegen."}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return {"success": True, "content": f.read(), "path": path}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/backup_file")
async def backup_file(req: BackupFileRequest, _: str = Depends(verify_api_key)):
    file_path = safe_path(req.path)
    try:
        backup_path = backup_file_impl(file_path)
        return {"success": True, "path": str(file_path), "backup_path": str(backup_path)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/backup_project")
async def backup_project(req: BackupProjectRequest, _: str = Depends(verify_api_key)):
    repo_path = safe_path(req.repo_path or ".")
    if repo_path.is_file():
        repo_path = repo_path.parent
    try:
        return create_project_backup(repo_path)
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/list_backups")
async def list_backups(req: ListBackupsRequest, _: str = Depends(verify_api_key)):
    repo_path = safe_path(req.repo_path or ".")
    if repo_path.is_file():
        repo_path = repo_path.parent
    try:
        return {"success": True, "items": list_project_backups(repo_path, int(req.limit or 8))}
    except Exception as e:
        return {"success": False, "error": str(e), "items": []}

@app.post("/search_in_files")
async def search_in_files(req: SearchInFilesRequest, _: str = Depends(verify_api_key)):
    root = safe_read_path(req.root)
    if not root.exists():
        return {"success": False, "error": f"Path ne postoji: {req.root}"}
    if not root.is_dir():
        return {"success": False, "error": f"Nije direktorij: {req.root}"}

    matches = search_in_files_impl(root, req.query, req.extensions or [], bool(req.recursive))
    return {"success": True, "count": len(matches), "matches": matches}

@app.post("/find_files")
async def find_files(req: FindFilesRequest, _: str = Depends(verify_api_key)):
    root = safe_read_path(req.root)
    if not root.exists():
        return {"success": False, "error": f"Path ne postoji: {req.root}"}
    if not root.is_dir():
        return {"success": False, "error": f"Nije direktorij: {req.root}"}

    files = find_files_impl(root, req.pattern, bool(req.recursive), int(req.max_results or 50))
    return {"success": True, "count": len(files), "files": files}

@app.post("/run_build")
async def run_build(req: RunBuildRequest, _: str = Depends(verify_api_key)):
    cwd = safe_path(req.cwd or ".")
    if not cwd.exists():
        return {"success": False, "error": f"CWD ne postoji: {req.cwd}"}
    if cwd.is_file():
        cwd = cwd.parent
    try:
        result = run_command_with_logs(req.command or ["npm", "run", "build"], cwd, "build", timeout=min(req.timeout or 300, 900))
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/read_logs")
async def read_logs(req: ReadLogsRequest, _: str = Depends(verify_api_key)):
    cwd = safe_path(req.cwd or ".")
    if cwd.is_file():
        cwd = cwd.parent
    log_dir = get_log_dir(cwd)
    stdout_log = log_dir / f"{req.log_name}.stdout.log"
    stderr_log = log_dir / f"{req.log_name}.stderr.log"
    return {
        "success": True,
        "stdout": read_log_tail(stdout_log, req.max_chars or 20000),
        "stderr": read_log_tail(stderr_log, req.max_chars or 20000),
        "stdout_log": str(stdout_log),
        "stderr_log": str(stderr_log),
    }

@app.post("/git_pull_rebase")
async def git_pull_rebase(req: GitPullRebaseRequest, _: str = Depends(verify_api_key)):
    repo_path = safe_path(req.repo_path or ".")
    if repo_path.is_file():
        repo_path = repo_path.parent
    repo_path = repo_path.resolve()

    branch = (req.branch or "").strip()
    pull_cmd = ["git", "pull", "--rebase", "origin", branch] if branch else ["git", "pull", "--rebase"]
    pull_result = run_simple_command(pull_cmd, repo_path, timeout=180)

    return {
        "success": pull_result["success"],
        "stage": "git_pull_rebase",
        "stdout": pull_result.get("stdout", ""),
        "stderr": pull_result.get("stderr", ""),
        "error": pull_result.get("error"),
        "command": pull_result.get("command"),
        "exit_code": pull_result.get("exit_code", 0),
    }

@app.post("/git_status")
async def git_status(req: GitStatusRequest, _: str = Depends(verify_api_key)):
    repo_path = safe_path(req.repo_path or ".")
    if repo_path.is_file():
        repo_path = repo_path.parent
    repo_path = repo_path.resolve()

    status_result = run_simple_command(["git", "status", "--short", "--branch"], repo_path, timeout=60)
    return {
        "success": status_result["success"],
        "stage": "git_status",
        "stdout": status_result.get("stdout", ""),
        "stderr": status_result.get("stderr", ""),
        "error": status_result.get("error"),
        "command": status_result.get("command"),
        "exit_code": status_result.get("exit_code", 0),
    }

@app.post("/git_commit")
async def git_commit(req: GitCommitRequest, _: str = Depends(verify_api_key)):
    repo_path = safe_path(req.repo_path or ".")
    if repo_path.is_file():
        repo_path = repo_path.parent
    repo_path = repo_path.resolve()

    add_result = run_simple_command(["git", "add", "-A"], repo_path, timeout=120)
    if not add_result["success"]:
        return {
            "success": False,
            "stage": "git_add",
            "stdout": add_result.get("stdout", ""),
            "stderr": add_result.get("stderr", ""),
            "error": add_result.get("error"),
            "command": add_result.get("command"),
        }

    commit_result = run_simple_command(["git", "commit", "-m", req.message], repo_path, timeout=120)
    return {
        "success": commit_result["success"],
        "stage": "git_commit",
        "stdout": commit_result.get("stdout", ""),
        "stderr": commit_result.get("stderr", ""),
        "error": commit_result.get("error"),
        "command": commit_result.get("command"),
        "exit_code": commit_result.get("exit_code", 0),
    }

@app.post("/safe_apply_patch_set")
async def safe_apply_patch_set(req: SafeApplyPatchSetRequest, _: str = Depends(verify_api_key)):
    base_cwd = safe_path(req.cwd)
    if base_cwd.is_file():
        base_cwd = base_cwd.parent

    backups = []
    written_files = []

    try:
        for item in req.files:
            target_path = safe_path(str((base_cwd / item.path).resolve()) if not Path(item.path).is_absolute() else item.path)
            if target_path.exists():
                backup_path = backup_file_impl(target_path)
                backups.append({"path": str(target_path), "backup_path": str(backup_path)})
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_text(item.content, encoding="utf-8")
            written_files.append(str(target_path))

        response = {
            "success": True,
            "written_files": written_files,
            "backups": backups,
        }

        if req.run_build:
            build_result = run_command_with_logs(
                req.build_command or ["npm", "run", "build"],
                base_cwd,
                "build",
                timeout=min(req.build_timeout or 300, 900),
            )
            response["build"] = build_result
            if not build_result.get("success"):
                response["success"] = False
                response["stopped_at"] = "build"
                return response

        if req.git_commit:
            add_result = subprocess.run(["git", "add", "-A"], capture_output=True, text=True, cwd=str(base_cwd))
            commit_result = subprocess.run(
                ["git", "commit", "-m", req.commit_message or "agent patch"],
                capture_output=True,
                text=True,
                cwd=str(base_cwd),
            )
            response["git_commit"] = {
                "success": commit_result.returncode == 0,
                "stdout": truncate_output(commit_result.stdout),
                "stderr": truncate_output(commit_result.stderr),
                "exit_code": commit_result.returncode,
            }
            if commit_result.returncode != 0:
                response["success"] = False
                response["stopped_at"] = "git_commit"
                response["git_add"] = {
                    "success": add_result.returncode == 0,
                    "stdout": truncate_output(add_result.stdout),
                    "stderr": truncate_output(add_result.stderr),
                    "exit_code": add_result.returncode,
                }
                return response

        if req.git_push:
            push_cmd = ["git", "push", "origin", req.git_branch or "main"]
            push_result = subprocess.run(push_cmd, capture_output=True, text=True, cwd=str(base_cwd), timeout=180)
            response["git_push"] = {
                "success": push_result.returncode == 0,
                "stdout": truncate_output(push_result.stdout),
                "stderr": truncate_output(push_result.stderr),
                "exit_code": push_result.returncode,
            }
            if push_result.returncode != 0:
                response["success"] = False
                response["stopped_at"] = "git_push"
                return response

        return response
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "written_files": written_files,
            "backups": backups,
        }

# ============ PLAYWRIGHT ============

_playwright = None
_browser = None
_page = None

async def get_playwright_page():
    """Get or create persistent async browser page. Auto-reconnects if closed."""
    global _playwright, _browser, _page

    # Check if existing browser/page is still alive
    needs_restart = _page is None or _browser is None
    if not needs_restart:
        try:
            # Provjeri browser process
            if not _browser.is_connected():
                needs_restart = True
            # Provjeri je li page/tab zatvoren (korisnik zatvorio X)
            elif _page.is_closed():
                needs_restart = True
            else:
                # Brzi ping da vidimo radi li page
                await _page.evaluate("1")
        except Exception:
            needs_restart = True

    if needs_restart:
        # Pokušaj samo otvoriti novi tab u postojećem browseru
        new_page_only = False
        if _browser is not None:
            try:
                if _browser.is_connected():
                    _page = await _browser.new_page(no_viewport=True)
                    new_page_only = True
                    print("[Playwright] Otvoren novi tab u postojećem browseru")
            except Exception:
                new_page_only = False

        if not new_page_only:
            # Tek onda otvori novi browser
            await close_playwright()
            try:
                from playwright.async_api import async_playwright
                _playwright = await async_playwright().start()
                _browser = await _playwright.chromium.launch(headless=False, args=["--start-maximized"])
                _page = await _browser.new_page(no_viewport=True)
                print("[Playwright] Novi browser otvoren")
            except ImportError:
                raise HTTPException(status_code=500, detail="Playwright nije instaliran.")

        # Inject listener na page (uvijek — novi tab ili novi browser)
        try:
            await _page.add_init_script(r"""
            (() => {
              if (window.__stellanInstalled) return;
              window.__stellanInstalled = true;
              window.__stellan_events = [];

              function selectorFor(el) {
                if (!el) return "";
                // 1. ID (most reliable)
                if (el.id) return "#" + el.id;
                // 2. name attribute
                if (el.name) return '[name="' + el.name + '"]';
                // 3. aria-label
                const aria = el.getAttribute && el.getAttribute('aria-label');
                if (aria) return '[aria-label="' + aria + '"]';
                // 4. placeholder
                if (el.placeholder) return '[placeholder="' + el.placeholder + '"]';
                // 5. role + name
                const role = el.getAttribute && el.getAttribute('role');
                if (role) {
                  const txt = (el.textContent || "").trim();
                  if (txt && txt.length <= 30) return role + ':has-text("' + txt + '")';
                }
                // 6. Short visible text (for buttons, links, labels)
                const tag = (el.tagName || "").toLowerCase();
                if (['a','button','label','span','h1','h2','h3','h4','td','th','li'].includes(tag)) {
                  const txt = (el.innerText || el.textContent || "").trim();
                  if (txt && txt.length > 0 && txt.length <= 40) return 'text=' + txt;
                }
                // 7. Input by type
                if (tag === 'input') {
                  const type = el.type || 'text';
                  const parent = el.closest('label, .v-slot, .v-formlayout-row, .form-group');
                  if (parent) {
                    const label = parent.textContent.trim().slice(0, 30);
                    if (label) return 'input[type="' + type + '"]:near(:text("' + label + '"))';
                  }
                  return 'input[type="' + type + '"]';
                }
                // 8. CSS class fallback
                if (el.className && typeof el.className === 'string') {
                  const cls = el.className.split(' ').filter(c => c && c.length > 2 && !c.startsWith('v-')).slice(0,2).join('.');
                  if (cls) return tag + '.' + cls;
                }
                return tag || "";
              }

              document.addEventListener('click', function(e) {
                const el = e.target;
                const sel = selectorFor(el);
                if (sel) {
                  window.__stellan_events.push({
                    action: "click",
                    selector: sel,
                    tag: (el.tagName||"").toLowerCase(),
                    text: (el.innerText||"").trim().slice(0,50),
                    x: e.clientX,
                    y: e.clientY,
                    url: location.href,
                    ts: Date.now()
                  });
                }
              }, true);

              document.addEventListener('change', function(e) {
                const el = e.target;
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                  const sel = selectorFor(el);
                  if (sel) {
                    window.__stellan_events.push({
                      action: "fill",
                      selector: sel,
                      value: el.value || "",
                      url: location.href,
                      ts: Date.now()
                    });
                  }
                }
              }, true);
            })();
            """)
            # Attach network capture listeners
            await _attach_network_listeners(_page)
        except Exception as _inject_err:
            print(f"[Playwright] Listener inject warning: {_inject_err}")
    return _page

async def close_playwright():
    """Close browser session."""
    global _playwright, _browser, _page
    if _browser:
        try:
            await _browser.close()
        except Exception:
            pass
    if _playwright:
        try:
            await _playwright.stop()
        except Exception:
            pass
    _playwright = None
    _browser = None
    _page = None

@app.post("/playwright")
async def playwright_action(req: PlaywrightRequest, _: str = Depends(verify_api_key)):
    """Kontroliraj browser putem Playwrighta. Auto-restarts if browser died."""

    action = req.action.lower()

    if action == "close":
        await close_playwright()
        return {"success": True, "message": "Browser session zatvorena"}

    # Retry logic: if browser is dead, restart and try once more
    for attempt in range(2):
        try:
            page = await get_playwright_page()

            # Extra safety: test if page is alive
            try:
                await page.evaluate("1+1")
            except Exception:
                if attempt == 0:
                    print("[Playwright] Page dead, restarting browser...")
                    await close_playwright()
                    continue
                raise

            # Auto-record if recording is active
            if _recording:
                _recorded_steps.append(dict(req))

            return await _execute_playwright_action(page, req, action)

        except Exception as e:
            error_msg = str(e)
            if attempt == 0 and ("closed" in error_msg.lower() or "target" in error_msg.lower() or "disposed" in error_msg.lower()):
                print(f"[Playwright] Browser error, restarting: {error_msg[:100]}")
                await close_playwright()
                continue
            return {"success": False, "error": error_msg[:500]}

    return {"success": False, "error": "Browser restart failed after 2 attempts"}


async def _execute_playwright_action(page, req: PlaywrightRequest, action: str):
    """Execute the actual playwright action on a live page."""

    async def auto_screenshot(label=""):
        try:
            await page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            pass
        ss_path = os.path.join(WORKSPACE_DIR, "screenshot.png")
        await page.screenshot(path=ss_path, full_page=False)
        with open(ss_path, "rb") as f:
            ss_b64 = base64.b64encode(f.read()).decode("utf-8")
        return ss_b64, page.url, await page.title()

    if action == "navigate":
        if not req.url:
            return {"success": False, "error": "URL je obavezan za navigate"}
        await page.goto(req.url, timeout=req.timeout, wait_until="domcontentloaded")
        if req.wait_for:
            await page.wait_for_selector(req.wait_for, timeout=req.timeout)
        ss_b64, url, title = await auto_screenshot("navigate")
        return {
            "success": True,
            "title": title,
            "url": url,
            "screenshot_base64": ss_b64,
            "message": f"Otvorio sam {url}",
        }

    elif action == "screenshot":
        screenshot_path = os.path.join(WORKSPACE_DIR, "screenshot.png")
        await page.screenshot(path=screenshot_path, full_page=req.full_page)
        with open(screenshot_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        return {
            "success": True,
            "screenshot_base64": b64,
            "screenshot_path": "screenshot.png",
            "size": os.path.getsize(screenshot_path),
            "message": f"Screenshot napravljen ({os.path.getsize(screenshot_path)//1024}KB)",
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
        return {
            "success": False,
            "error": (
                f"Nepoznata akcija: {action}. Dostupne: navigate, screenshot, click, "
                "fill, extract, evaluate, pdf, close, wait, select, get_html"
            ),
        }

@app.post("/screenshot/step")
async def screenshot_step(req: StepScreenshotRequest, _: str = Depends(verify_api_key)):
    """Snimi screenshot trenutne stranice i, ako je aktivno učenje, zapamti korak."""

    try:
        page = await get_playwright_page()
        try:
            await page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            pass

        screenshot_path = os.path.join(WORKSPACE_DIR, "screenshot_step.png")
        await page.screenshot(path=screenshot_path, full_page=False)

        with open(screenshot_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        desc = (req.description or "korak").strip()
        if _recording:
            _recorded_steps.append({
                "action": "screenshot",
                "description": desc,
                "url": page.url,
            })

        return {
            "success": True,
            "description": desc,
            "url": page.url,
            "title": await page.title(),
            "screenshot_base64": b64,
            "message": f"Korak snimljen: {desc}",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/agent/run")
async def agent_run(req: AgentRunRequest, _: str = Depends(verify_api_key)):
    """High-level natural language agent command for DEV chat."""

    command = (req.command or "").strip()
    lower = command.lower()
    if not command:
        return {"success": False, "error": "Naredba je prazna"}

    try:
        page = await get_playwright_page()

        def extract_url(cmd: str) -> Optional[str]:
            m = re.search(r'((https?://|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:/[^\s]*)?)', cmd, re.I)
            if m:
                url = m.group(1)
                if not url.startswith(("http://", "https://")):
                    url = "https://" + url
                return url
            if "oss" in cmd.lower():
                return "https://oss.uredjenazemlja.hr/"
            return None

        async def wait_and_capture(name: str = "auto.png"):
            try:
                await page.wait_for_load_state("networkidle", timeout=12000)
            except Exception:
                try:
                    await page.wait_for_load_state("load", timeout=5000)
                except Exception:
                    pass
            screenshot_path = os.path.join(WORKSPACE_DIR, name)
            await page.screenshot(path=screenshot_path, full_page=False)
            with open(screenshot_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            return b64

        url = extract_url(command)

        if url and any(k in lower for k in ["idi", "odi", "otvori", "open", "navigate", "go to", "oss", "uredjenazemlja"]):
            await page.goto(url, timeout=30000, wait_until="domcontentloaded")
            b64 = await wait_and_capture()
            return {
                "success": True,
                "action": "navigate",
                "url": page.url,
                "title": await page.title(),
                "screenshot_base64": b64,
                "message": f"Otvorio sam {page.url} i osvježio preview.",
            }

        if any(k in lower for k in ["screenshot", "snimku", "snimi", "što vidiš", "sto vidis", "preview"]):
            b64 = await wait_and_capture()
            return {
                "success": True,
                "action": "screenshot",
                "url": page.url,
                "title": await page.title(),
                "screenshot_base64": b64,
                "message": "Napravio sam screenshot i osvježio preview.",
            }

        return {
            "success": False,
            "error": "Ne razumijem naredbu. Probaj: 'idi na oss.uredjenazemlja.hr' ili 'napravi screenshot'.",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============ OSS PRETRAGA (PLAYWRIGHT) ============

class OssSearchRequest(BaseModel):
    cestica: Optional[str] = None
    katastarska_opcina: Optional[str] = None
    mode: Optional[str] = "search"  # search | details | owners
    parcel_id: Optional[str] = None

@app.post("/oss/search")
async def oss_search(req: OssSearchRequest, _: str = Depends(verify_api_key)):
    """Pretraži OSS portal kroz Playwright browser."""

    try:
        page = await get_playwright_page()

        # 1. Idi na OSS stranicu za pretragu
        oss_url = "https://oss.uredjenazemlja.hr/public-services/search-cad-parcel"
        print(f"[OSS] Navigating to {oss_url}")
        await page.goto(oss_url, timeout=30000, wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)

        # Provjeri je li Cloudflare challenge
        content = await page.content()
        if "challenge" in content.lower() or "cf-" in content.lower():
            # Čekaj da prođe challenge
            print("[OSS] Cloudflare challenge detected, waiting...")
            await page.wait_for_timeout(5000)
            content = await page.content()

        current_url = page.url
        print(f"[OSS] Current URL: {current_url}")

        # Ako smo preusmjereni na login
        if "/login" in current_url:
            print("[OSS] Login required, attempting...")
            # Pokušaj se ulogirati
            oss_user = os.environ.get("OSS_USERNAME", "")
            oss_pass = os.environ.get("OSS_PASSWORD", "")
            if oss_user and oss_pass:
                try:
                    await page.fill('input[name="username"], #username', oss_user, timeout=5000)
                    await page.fill('input[name="password"], #password', oss_pass, timeout=5000)
                    await page.click('button[type="submit"], input[type="submit"], .btn-primary', timeout=5000)
                    await page.wait_for_timeout(3000)
                    # Navigiraj ponovo na search
                    await page.goto(oss_url, timeout=30000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(2000)
                except Exception as e:
                    print(f"[OSS] Login error: {e}")

        # 2. Popuni formu za pretragu
        ko = req.katastarska_opcina or ""
        cestica = req.cestica or ""

        if not ko and not cestica:
            return {"success": False, "error": "Potrebna je katastarska_opcina i/ili cestica"}

        results = []

        try:
            # Traži input polje za katastarsku općinu
            ko_selectors = [
                'input[placeholder*="općin"]', 'input[placeholder*="opein"]',
                'input[name*="municipality"]', 'input[name*="cadMunicipality"]',
                '#cadMunicipalityName', '.municipality-search input',
                'input[type="text"]:first-of-type',
            ]
            ko_filled = False
            if ko:
                for sel in ko_selectors:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            await el.click()
                            await el.fill(ko)
                            await page.wait_for_timeout(1500)
                            # Probaj kliknuti na prvi rezultat dropdown-a
                            dropdown_selectors = [
                                '.dropdown-item', '.autocomplete-result', '.suggestion',
                                'li.active', '.ui-menu-item', '[role="option"]',
                                '.tt-suggestion', '.typeahead-result',
                            ]
                            for dd_sel in dropdown_selectors:
                                try:
                                    dd_el = await page.query_selector(dd_sel)
                                    if dd_el:
                                        await dd_el.click()
                                        ko_filled = True
                                        await page.wait_for_timeout(500)
                                        break
                                except Exception:
                                    continue
                            if ko_filled:
                                break
                            # Ako nema dropdown, pritisni Enter
                            await el.press("Enter")
                            ko_filled = True
                            break
                    except Exception:
                        continue

            # Traži input polje za broj čestice
            cestica_filled = False
            if cestica:
                cestica_selectors = [
                    'input[placeholder*="čestic"]', 'input[placeholder*="cestic"]',
                    'input[placeholder*="parcel"]', 'input[name*="parcel"]',
                    '#parcelNumber', '.parcel-search input',
                    'input[type="text"]:nth-of-type(2)',
                ]
                for sel in cestica_selectors:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            await el.fill(cestica)
                            cestica_filled = True
                            break
                    except Exception:
                        continue

            print(f"[OSS] KO filled: {ko_filled}, Cestica filled: {cestica_filled}")

            # 3. Klikni pretraži
            search_selectors = [
                'button:has-text("Pretraži")', 'button:has-text("Traži")',
                'button:has-text("Search")', 'button[type="submit"]',
                '.btn-search', '.search-button', '#searchButton',
            ]
            search_clicked = False
            for sel in search_selectors:
                try:
                    btn = await page.query_selector(sel)
                    if btn:
                        await btn.click()
                        search_clicked = True
                        break
                except Exception:
                    continue

            if not search_clicked:
                # Probaj Enter na zadnjem polju
                try:
                    await page.keyboard.press("Enter")
                except Exception:
                    pass

            # 4. Čekaj rezultate
            await page.wait_for_timeout(3000)

            # 5. Izvuci rezultate iz stranice
            page_text = await page.inner_text("body")
            page_html = await page.content()

            # Screenshot za debug
            ss_path = os.path.join(WORKSPACE_DIR, "oss_search.png")
            await page.screenshot(path=ss_path, full_page=False)
            with open(ss_path, "rb") as f:
                screenshot_b64 = base64.b64encode(f.read()).decode("utf-8")

            # Pokušaj izvući podatke iz tablice rezultata
            table_selectors = [
                'table tbody tr', '.result-table tr', '.search-results tr',
                '.table tr', '[class*="result"] tr',
            ]
            for sel in table_selectors:
                try:
                    rows = await page.query_selector_all(sel)
                    for row in rows:
                        cells = await row.query_selector_all("td")
                        if cells:
                            cell_texts = []
                            for cell in cells:
                                text = await cell.inner_text()
                                cell_texts.append(text.strip())
                            if cell_texts and any(t for t in cell_texts):
                                results.append(cell_texts)
                except Exception:
                    continue

            # Ako nema tablice, izvuci tekst
            result_text = ""
            if not results:
                result_selectors = [
                    '.search-results', '.results', '#results',
                    '[class*="result"]', '.panel-body', '.content',
                ]
                for sel in result_selectors:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            result_text = await el.inner_text()
                            if result_text.strip():
                                break
                    except Exception:
                        continue

            return {
                "success": True,
                "cestica": cestica,
                "katastarska_opcina": ko,
                "ko_filled": ko_filled,
                "cestica_filled": cestica_filled,
                "search_clicked": search_clicked,
                "current_url": page.url,
                "table_results": results[:20],
                "result_text": (result_text or page_text[:3000]).strip(),
                "screenshot_base64": screenshot_b64,
                "message": f"Pronađeno {len(results)} redova u tablici" if results else "Pretraga izvršena, pogledaj screenshot",
            }

        except Exception as e:
            # Screenshot za debug
            ss_path = os.path.join(WORKSPACE_DIR, "oss_error.png")
            try:
                await page.screenshot(path=ss_path, full_page=False)
                with open(ss_path, "rb") as f:
                    screenshot_b64 = base64.b64encode(f.read()).decode("utf-8")
            except Exception:
                screenshot_b64 = None

            return {
                "success": False,
                "error": str(e),
                "current_url": page.url,
                "screenshot_base64": screenshot_b64,
            }

    except Exception as e:
        return {"success": False, "error": str(e)}


# ============ SDGE AUTOMATIZACIJA (PLAYWRIGHT — SNIMLJENI SELEKTORI) ============

class SdgeRequest(BaseModel):
    search: Optional[str] = None          # pojam pretrage (ime, broj)
    broj_predmeta: Optional[str] = None   # e.g. "3/2026" (alias)
    action: Optional[str] = "povratnice"  # povratnice | dostavnica | search | info
    select_all: Optional[bool] = False    # označi sve za dostavnicu

@app.post("/sdge/povratnice")
async def sdge_povratnice_endpoint(req: SdgeRequest, _: str = Depends(verify_api_key)):
    """SDGE automatizacija — pretraga, povratnice, dostavnice."""

    search_term = req.search or req.broj_predmeta or ""
    action = req.action or "povratnice"

    if not search_term:
        return {"success": False, "error": "Potreban je search parametar (ime ili broj predmeta)"}

    sdge_user = os.environ.get("SDGE_USERNAME", "")
    sdge_pass = os.environ.get("SDGE_PASSWORD", "")
    if not sdge_user or not sdge_pass:
        return {"success": False, "error": "SDGE_USERNAME/SDGE_PASSWORD nisu postavljeni"}

    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1920, "height": 1080})

            result = {"success": False, "action": action, "search_term": search_term}

            try:
                # === 1. LOGIN ===
                print(f"[SDGE] Login as {sdge_user}...")
                await page.goto("https://sdge.dgu.hr/login", timeout=30000)
                await page.wait_for_timeout(2000)

                # Klikni PRIJAVA (otvara login overlay)
                try:
                    await page.get_by_text("PRIJAVA PRIJAVA Zaboravili").click(timeout=5000)
                except Exception:
                    try:
                        await page.click('text="PRIJAVA"', timeout=3000)
                    except Exception:
                        pass
                await page.wait_for_timeout(2000)

                # Popuni login
                try:
                    await page.get_by_role("textbox", name="Korisničko ime").fill(sdge_user)
                except Exception:
                    inputs = await page.query_selector_all('input[type="text"], input:not([type])')
                    for inp in inputs:
                        if await inp.is_visible():
                            await inp.fill(sdge_user)
                            break

                try:
                    await page.get_by_role("textbox", name="Lozinka").fill(sdge_pass)
                except Exception:
                    pwd = await page.query_selector('input[type="password"]')
                    if pwd:
                        await pwd.fill(sdge_pass)

                try:
                    await page.get_by_role("button", name="PRIJAVA").click()
                except Exception:
                    await page.keyboard.press("Enter")

                await page.wait_for_timeout(4000)
                if "login" in page.url and "app" not in page.url:
                    result["error"] = "Login failed"
                    await browser.close()
                    return result
                print("[SDGE] Login OK!")

                # === 2. NAVIGACIJA DO PRETRAGE ===
                try:
                    await page.locator('#xheader-button-text-upisnik').get_by_text('Upisnik').click(timeout=5000)
                    await page.wait_for_timeout(1000)
                except Exception:
                    pass
                try:
                    await page.get_by_role("button", name="Upisnik").click(timeout=3000)
                    await page.wait_for_timeout(1000)
                except Exception:
                    pass
                try:
                    await page.get_by_text("Pretraga predmeta").click(timeout=5000)
                    await page.wait_for_timeout(2000)
                except Exception:
                    await page.goto("https://sdge.dgu.hr/app#!pretraga-predmeta", timeout=15000)
                    await page.wait_for_timeout(3000)

                # === 3. PRETRAGA ===
                print(f"[SDGE] Tražim: {search_term}")
                try:
                    tb = page.get_by_role("textbox").first
                    await tb.click()
                    await tb.fill(search_term)
                except Exception:
                    inputs = await page.query_selector_all('input.v-textfield')
                    if inputs:
                        await inputs[0].fill(search_term)

                try:
                    await page.get_by_role("button", name="Pretraži").click()
                except Exception:
                    await page.keyboard.press("Enter")
                await page.wait_for_timeout(3000)

                # === 4. REZULTATI ===
                search_results = await page.evaluate('''() => {
                    const rows = [];
                    document.querySelectorAll('.v-grid-body tr, table tbody tr').forEach(tr => {
                        const cells = tr.querySelectorAll('td');
                        if (cells.length >= 3) {
                            const r = [];
                            cells.forEach(c => r.push(c.textContent.trim().replace(/\\s+/g, ' ')));
                            rows.push(r);
                        }
                    });
                    return rows;
                }''')
                result["search_results_count"] = len(search_results)
                result["search_results"] = search_results[:10]
                print(f"[SDGE] Rezultata: {len(search_results)}")

                if not search_results:
                    result["error"] = "Nema rezultata pretrage"
                    ss_path = os.path.join(WORKSPACE_DIR, "sdge_no_results.png")
                    await page.screenshot(path=ss_path)
                    with open(ss_path, "rb") as f:
                        result["screenshot_base64"] = base64.b64encode(f.read()).decode()
                    await browser.close()
                    return result

                if action == "search":
                    result["success"] = True
                    await browser.close()
                    return result

                # === 5. KLIKNI NA PREDMET ===
                clicked = False
                cells = await page.query_selector_all('.v-grid-body td, table tbody td')
                for cell in cells:
                    text = await cell.inner_text()
                    if search_term.lower() in text.lower():
                        await cell.click()
                        clicked = True
                        print(f"[SDGE] Kliknuo: {text[:50]}")
                        break
                if not clicked:
                    first = await page.query_selector('.v-grid-body tr:first-child, table tbody tr:first-child')
                    if first:
                        await first.click()
                        clicked = True
                await page.wait_for_timeout(1000)

                # === 6. DETALJI PREDMETA ===
                try:
                    await page.get_by_role("button", name="Detalji predmeta").click(timeout=5000)
                except Exception:
                    try:
                        await page.click('text="DETALJI PREDMETA"', timeout=3000)
                    except Exception:
                        pass
                await page.wait_for_timeout(3000)

                # URL info
                result["url"] = page.url
                id_match = page.url
                pid = re.search(r'predmetId=(\d+)', page.url)
                if pid:
                    result["predmet_id"] = pid.group(1)

                if action == "info":
                    result["success"] = True
                    await browser.close()
                    return result

                # === 7. OTPREMA/DOSTAVA TAB ===
                try:
                    await page.get_by_text("Otprema/dostava").click(timeout=5000)
                except Exception:
                    await page.click('text="Otprema/dostava"', timeout=5000)
                await page.wait_for_timeout(3000)

                # === 8. IZVUCI POVRATNICE ===
                povratnice = await page.evaluate('''() => {
                    const r = { headers: [], rows: [] };
                    document.querySelectorAll('.v-grid-header th, .v-grid-column-header-content, table thead th').forEach(th => {
                        const t = th.textContent.trim();
                        if (t) r.headers.push(t);
                    });
                    document.querySelectorAll('.v-grid-body tr, table tbody tr').forEach(tr => {
                        const cells = tr.querySelectorAll('td');
                        if (cells.length >= 2) {
                            const row = {};
                            let i = 0;
                            cells.forEach(c => {
                                const h = r.headers[i] || 'col_' + i;
                                const cb = c.querySelector('input[type="checkbox"]');
                                row[h] = cb ? (cb.checked ? "DA" : "NE") : c.textContent.trim().replace(/\\s+/g, ' ');
                                i++;
                            });
                            r.rows.push(row);
                        }
                    });
                    return r;
                }''')

                result["povratnice"] = povratnice
                result["povratnice_count"] = len(povratnice.get("rows", []))
                result["success"] = True
                print(f"[SDGE] Povratnica: {result['povratnice_count']}")

                # === 9. DOSTAVNICA (ako tražena) ===
                if action == "dostavnica":
                    if req.select_all:
                        await page.evaluate('''() => {
                            document.querySelectorAll('.v-grid-body input[type="checkbox"]').forEach(cb => {
                                if (!cb.checked) cb.click();
                            });
                        }''')
                        await page.wait_for_timeout(1000)

                    try:
                        async with page.expect_download(timeout=15000) as dl:
                            await page.get_by_role("button", name="Preuzmi dostavnicu").click()
                        download = await dl.value
                        fname = download.suggested_filename or "dostavnica.pdf"
                        save_path = os.path.join(WORKSPACE_DIR, fname)
                        await download.save_as(save_path)
                        result["dostavnica_path"] = save_path
                        print(f"[SDGE] Dostavnica: {save_path}")
                    except Exception as e:
                        result["dostavnica_error"] = str(e)

                # Screenshot
                ss_path = os.path.join(WORKSPACE_DIR, "sdge_result.png")
                await page.screenshot(path=ss_path, full_page=False)
                with open(ss_path, "rb") as f:
                    result["screenshot_base64"] = base64.b64encode(f.read()).decode()

            except Exception as e:
                result["error"] = str(e)
                try:
                    ss_path = os.path.join(WORKSPACE_DIR, "sdge_error.png")
                    await page.screenshot(path=ss_path)
                    with open(ss_path, "rb") as f:
                        result["screenshot_base64"] = base64.b64encode(f.read()).decode()
                except Exception:
                    pass

            await browser.close()
            return result

    except Exception as e:
        return {"success": False, "error": str(e)}


# ============ NETWORK CAPTURE ============

_network_capture_enabled = False
_network_logs: list = []
_MAX_NETWORK_LOGS = 500

def _should_capture_request(url: str) -> bool:
    """Only capture interesting requests (UIDL, API, downloads), skip static assets."""
    skip_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot')
    skip_paths = ('/VAADIN/themes/', '/VAADIN/widgetsets/', 'favicon')
    url_lower = url.lower()
    if any(url_lower.endswith(ext) for ext in skip_extensions):
        return False
    if any(sp in url_lower for sp in skip_paths):
        return False
    return True

async def _attach_network_listeners(page):
    """Attach request/response listeners to the playwright page."""

    async def on_request(request):
        if not _network_capture_enabled:
            return
        url = request.url
        if not _should_capture_request(url):
            return
        post_data = None
        try:
            post_data = request.post_data
            if post_data and len(post_data) > 5000:
                post_data = post_data[:5000] + "...[truncated]"
        except Exception:
            pass
        entry = {
            "id": len(_network_logs),
            "timestamp": datetime.now().isoformat(),
            "method": request.method,
            "url": url,
            "request_body": post_data,
            "request_headers": {k: v for k, v in request.headers.items() if k.lower() in ('content-type', 'accept', 'cookie')},
            "status": None,
            "response_body": None,
            "response_type": None,
        }
        _network_logs.append(entry)
        if len(_network_logs) > _MAX_NETWORK_LOGS:
            _network_logs.pop(0)

    async def on_response(response):
        if not _network_capture_enabled:
            return
        url = response.url
        if not _should_capture_request(url):
            return
        # Find matching request entry and update with response
        for entry in reversed(_network_logs):
            if entry["url"] == url and entry["status"] is None:
                entry["status"] = response.status
                content_type = response.headers.get("content-type", "")
                entry["response_type"] = content_type
                # Capture response body for text/json responses
                if any(t in content_type for t in ('json', 'text', 'html', 'xml', 'javascript')):
                    try:
                        body = await response.text()
                        if len(body) > 8000:
                            body = body[:8000] + "...[truncated]"
                        entry["response_body"] = body
                    except Exception:
                        entry["response_body"] = "[could not read]"
                elif 'pdf' in content_type or 'octet' in content_type:
                    entry["response_body"] = f"[binary: {content_type}]"
                break

    page.on("request", on_request)
    page.on("response", on_response)


@app.post("/network/start")
async def network_start(_: str = Depends(verify_api_key)):
    """Start capturing network requests from the browser."""
    global _network_capture_enabled, _network_logs
    _network_capture_enabled = True
    _network_logs = []
    return {"success": True, "message": "Network capture started"}


@app.post("/network/stop")
async def network_stop(_: str = Depends(verify_api_key)):
    """Stop capturing network requests."""
    global _network_capture_enabled
    _network_capture_enabled = False
    return {"success": True, "message": "Network capture stopped", "captured": len(_network_logs)}


@app.get("/network/logs")
async def network_logs(_: str = Depends(verify_api_key)):
    """Get all captured network logs."""
    return {"success": True, "logs": list(_network_logs), "count": len(_network_logs), "capturing": _network_capture_enabled}


@app.post("/network/clear")
async def network_clear(_: str = Depends(verify_api_key)):
    """Clear captured network logs."""
    global _network_logs
    _network_logs = []
    return {"success": True, "message": "Network logs cleared"}


_preview_timeline: list = []
_MAX_PREVIEW_TIMELINE = 8

def _push_preview_timeline(label: str, title: str, url: str, path: str, screenshot_base64: str | None):
    global _preview_timeline
    item = {
        "id": uuid.uuid4().hex[:10],
        "label": label,
        "title": title,
        "url": url,
        "path": path,
        "screenshot_base64": screenshot_base64,
        "captured_at": datetime.now().isoformat(),
    }
    _preview_timeline.insert(0, item)
    _preview_timeline = _preview_timeline[:_MAX_PREVIEW_TIMELINE]


@app.get("/preview/current")
async def preview_current(_: str = Depends(verify_api_key)):
    """Return current screenshot from persistent Playwright browser for live preview."""
    try:
        page = await get_playwright_page()
        try:
            await page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass

        screenshot_path = os.path.join(WORKSPACE_DIR, "preview_current.png")
        await page.screenshot(path=screenshot_path, full_page=False)
        with open(screenshot_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        title = await page.title()
        _push_preview_timeline("Live preview", title, page.url, screenshot_path, b64)
        return {
            "success": True,
            "screenshot_base64": b64,
            "url": page.url,
            "title": title,
            "path": screenshot_path,
            "captured_at": datetime.now().isoformat(),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/preview/timeline")
async def preview_timeline(_: str = Depends(verify_api_key)):
    return {"success": True, "items": list(_preview_timeline)}

# ============ RECORDING / UCENJE ============

_recording = False
_recorded_steps: list = []
_recorded_action_name: str = ""

_STELLAN_JS = r"""(() => {
              if (window.__stellanInstalled) return;
              window.__stellanInstalled = true;
              window.__stellan_events = [];

              function selectorFor(el) {
                if (!el) return "";
                if (el.id) return "#" + el.id;
                if (el.name) return '[name="' + el.name + '"]';
                const aria = el.getAttribute && el.getAttribute('aria-label');
                if (aria) return '[aria-label="' + aria + '"]';
                if (el.placeholder) return '[placeholder="' + el.placeholder + '"]';
                const role = el.getAttribute && el.getAttribute('role');
                if (role) {
                  const txt = (el.textContent || "").trim();
                  if (txt && txt.length <= 30) return role + ':has-text("' + txt + '")';
                }
                const tag = (el.tagName || "").toLowerCase();
                if (['a','button','label','span','h1','h2','h3','h4','td','th','li'].includes(tag)) {
                  const txt = (el.innerText || el.textContent || "").trim();
                  if (txt && txt.length > 0 && txt.length <= 40) return 'text=' + txt;
                }
                if (tag === 'input') {
                  const type = el.type || 'text';
                  const parent = el.closest('label, .v-slot, .v-formlayout-row, .form-group');
                  if (parent) {
                    const label = parent.textContent.trim().slice(0, 30);
                    if (label) return 'input[type="' + type + '"]:near(:text("' + label + '"))';
                  }
                  return 'input[type="' + type + '"]';
                }
                if (el.className && typeof el.className === 'string') {
                  const cls = el.className.split(' ').filter(c => c && c.length > 2 && !c.startsWith('v-')).slice(0,2).join('.');
                  if (cls) return tag + '.' + cls;
                }
                return tag || "";
              }

              document.addEventListener('click', function(e) {
                const el = e.target;
                const sel = selectorFor(el);
                if (sel) {
                  window.__stellan_events.push({
                    action: "click", selector: sel,
                    tag: (el.tagName||"").toLowerCase(),
                    text: (el.innerText||"").trim().slice(0,50),
                    x: e.clientX, y: e.clientY,
                    url: location.href, ts: Date.now()
                  });
                }
              }, true);

              document.addEventListener('change', function(e) {
                const el = e.target;
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                  const sel = selectorFor(el);
                  if (sel) {
                    window.__stellan_events.push({
                      action: "fill", selector: sel,
                      value: el.value || "",
                      url: location.href, ts: Date.now()
                    });
                  }
                }
              }, true);
            })();"""

@app.post("/record/start")
async def record_start(req: dict = {}, _: str = Depends(verify_api_key)):
    global _recording, _recorded_steps, _recorded_action_name
    _recording = True
    _recorded_steps = []
    _recorded_action_name = req.get("name", "nova_akcija") if req else "nova_akcija"
    start_url = req.get("url", "") if req else ""
    try:
        page = await get_playwright_page()
        # Reset events i re-inject listener na TRENUTNOJ stranici (ne samo pri navigaciji)
        await page.evaluate("window.__stellanInstalled = false; window.__stellan_events = [];")
        await page.evaluate(_STELLAN_JS)
        if start_url and start_url.startswith("http"):
            await page.goto(start_url, wait_until="domcontentloaded", timeout=30000)
            _recorded_steps.append({"action": "navigate", "url": start_url, "ts": __import__("time").time() * 1000})
    except Exception as e:
        pass
    return {"success": True, "message": f"Snimanje pokrenuto: {_recorded_action_name}", "url": start_url}

@app.post("/record/stop")
async def record_stop(_: str = Depends(verify_api_key)):
    global _recording
    _recording = False
    await _collect_browser_events()
    # Pretvori u Flowscribe format (array, ne broj)
    steps_list = []
    for i, step in enumerate(_recorded_steps):
        steps_list.append({
            "id": step.get("id", str(i)),
            "type": step.get("action", step.get("type", "click")),
            "target": step.get("selector", step.get("target", "")),
            "value": step.get("value", ""),
            "url": step.get("url", ""),
            "timestamp": step.get("ts", step.get("timestamp", 0)),
        })
    return {"success": True, "steps": steps_list, "count": len(steps_list), "message": f"Zaustavljeno — {len(steps_list)} koraka"}

@app.get("/record/poll")
async def record_poll(_: str = Depends(verify_api_key)):
    """Poll browser for new click/input events captured by injected JS."""
    new_events = await _collect_browser_events()
    return {
        "success": True,
        "new_events": new_events,
        "total_steps": len(_recorded_steps),
        "recording": _recording,
    }

async def _collect_browser_events():
    """Collect and drain events from browser's __stellan_events array."""
    global _recorded_steps
    new_events = []
    try:
        page = await get_playwright_page()
        events = await page.evaluate("""() => {
            const evts = window.__stellan_events || [];
            window.__stellan_events = [];
            return evts;
        }""")
        if events:
            for evt in events:
                _recorded_steps.append(evt)
                new_events.append(evt)
    except Exception:
        pass
    return new_events

@app.post("/record/delete")
async def record_delete(req: dict, _: str = Depends(verify_api_key)):
    """Delete a saved action script."""
    name = req.get("name", "").replace(" ", "_").lower()
    if not name:
        return {"success": False, "error": "Ime je obavezno"}
    path = os.path.join(WORKSPACE_DIR, f"{name}.py")
    if os.path.exists(path):
        os.remove(path)
        return {"success": True, "message": f"Obrisano: {name}"}
    return {"success": False, "error": f"Nije pronađeno: {name}"}

@app.post("/record/read")
async def record_read(req: dict, _: str = Depends(verify_api_key)):
    """Read a saved action script content."""
    name = req.get("name", "").replace(" ", "_").lower()
    if not name:
        return {"success": False, "error": "Ime je obavezno"}
    path = os.path.join(WORKSPACE_DIR, f"{name}.py")
    if not os.path.exists(path):
        return {"success": False, "error": f"Nije pronađeno: {name}"}
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        metadata = read_flow_metadata(name)
        versions = list_flow_versions(name)
        return {"success": True, "name": name, "content": content, "path": path, "metadata": metadata, "versions": versions}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/record/write")
async def record_write(req: dict, _: str = Depends(verify_api_key)):
    """Write/update a saved action script content."""
    name = req.get("name", "").replace(" ", "_").lower()
    content = req.get("content", "")
    if not name:
        return {"success": False, "error": "Ime je obavezno"}
    if not content:
        return {"success": False, "error": "Content je obavezan"}
    path = os.path.join(WORKSPACE_DIR, f"{name}.py")
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        metadata = read_flow_metadata(name)
        create_flow_version(name, content, metadata, source="record_write")
        return {"success": True, "name": name, "path": path, "message": f"Spremljeno: {name}.py"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/record/save")
async def record_save(req: dict = {}, _: str = Depends(verify_api_key)):
    global _recording, _recorded_steps, _recorded_action_name
    _recording = False
    name = (req.get("name") if req else None) or _recorded_action_name or "akcija"
    name = name.replace(" ", "_").lower()

    # Izvor koraka: req.steps (frontend) ima prioritet, fallback na _recorded_steps (snimanje)
    req_steps = req.get("steps") if req else None
    source_steps = req_steps if (isinstance(req_steps, list) and req_steps) else _recorded_steps

    # Normaliziraj korake za metadata
    steps_for_meta = []
    for i, step in enumerate(source_steps):
        steps_for_meta.append({
            "id": step.get("id") or str(i),
            "type": step.get("type") or step.get("action") or "click",
            "target": step.get("target") or step.get("selector") or "",
            "value": step.get("value", ""),
            "url": step.get("url", ""),
            "timestamp": step.get("timestamp") or step.get("ts") or 0,
        })

    # Ako frontend šalje eksplicitni kod (ručno uređen), koristi ga; inače generiraj iz koraka
    req_code = req.get("code") if req else None
    if isinstance(req_code, str) and req_code.strip():
        script = req_code
    else:
        # Generiraj .py iz koraka — koristi isti format kao frontend liveCode
        def _q(s):
            """Pametni navodni: ako s ima ", koristi '...' ; inače "..." ."""
            s = str(s or "")
            if '"' in s and "'" not in s:
                return f"'{s}'"
            return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

        code_lines = [
            "import asyncio",
            "from playwright.async_api import async_playwright",
            "",
            f"async def run_{name}():",
            "    async with async_playwright() as p:",
            "        browser = await p.chromium.launch(headless=False)",
            "        page = await browser.new_page()",
            "",
        ]
        for step in steps_for_meta:
            stype = step["type"]
            target = step["target"]
            value = step["value"]
            url = step["url"]
            if stype == "navigate" and url:
                code_lines.append(f'        await page.goto({_q(url)}, wait_until="domcontentloaded")')
            elif stype == "click" and target:
                code_lines.append(f'        await page.click({_q(target)})')
            elif stype in ("fill", "type") and target:
                code_lines.append(f'        await page.fill({_q(target)}, {_q(value)})')
            elif stype == "submit" and target:
                code_lines.append(f'        await page.press({_q(target)}, "Enter")')
            elif stype == "wait":
                ms = 1000
                try: ms = int(value or step.get("ms") or 1000)
                except: pass
                code_lines.append(f'        await page.wait_for_timeout({ms})')
            elif stype == "screenshot":
                code_lines.append(f'        await page.screenshot(path="screenshot_{name}.png", full_page=True)')
            elif target:
                code_lines.append(f'        # {stype}: {target}')
        code_lines += ["", "        await browser.close()", "", f"asyncio.run(run_{name}())"]
        script = "\n".join(code_lines)

    # Zapiši .py
    save_path = os.path.join(WORKSPACE_DIR, f"{name}.py")
    with open(save_path, "w", encoding="utf-8") as f:
        f.write(script)

    # Zapiši metadata
    req_status = req.get("status", "raw") if req else "raw"
    req_start_url = req.get("url", "") if req else ""
    display_name = req.get("display_name", req.get("name", name)) if req else name
    req_temporary = bool(req.get("temporary", False)) if req else False
    metadata = read_flow_metadata(name)
    param_keys = list({
        p for s in steps_for_meta
        if isinstance(s.get("value"), str)
        for p in __import__("re").findall(r"\{(\w+)\}", s["value"])
    })
    if req_status == "polished":
        metadata["polished_code"] = script
    else:
        metadata["raw_code"] = script
    metadata.update({
        "name": display_name,
        "display_name": display_name,
        "steps": steps_for_meta,
        "status": req_status,
        "start_url": req_start_url,
        "params": param_keys,
        "active_variant": "polished" if req_status == "polished" else "raw",
        "is_temporary": req_temporary,
    })
    write_flow_metadata(name, metadata)
    _recorded_steps = []
    if not req_temporary:
        create_flow_version(name, script, metadata, source="record_save")
    return {
        "success": True,
        "name": name,
        "path": save_path,
        "steps": steps_for_meta,
        "status": req_status,
        "message": f"Flow '{name}' spremljen ({len(steps_for_meta)} koraka)"
    }

@app.get("/record/list")
async def record_list(_: str = Depends(verify_api_key)):
    """List all saved .py action scripts in workspace"""
    scripts = []
    for f in os.listdir(WORKSPACE_DIR):
        if f.endswith(".py") and f != "agent_server.py":
            name = f[:-3]
            meta = read_flow_metadata(name)
            if meta.get("is_temporary") or is_temporary_flow_name(name):
                continue
            path = os.path.join(WORKSPACE_DIR, f)
            size = os.path.getsize(path)
            scripts.append({"name": name, "file": f, "size": size, "portal": meta.get("portal", "Ostalo"), "tags": meta.get("tags", []), "params": flow_param_keys(meta), "description": meta.get("description", ""), "version_count": len(list_flow_versions(name))})
    return {"success": True, "actions": scripts}


@app.post("/record/analyze")
async def record_analyze(req: dict = {}, _: str = Depends(verify_api_key)):
    name = (req.get("name") if req else None) or _recorded_action_name or "shadow_session"
    start_url = (req.get("url") if req else None) or ""
    context = (req.get("context") if req else None) or ""
    auto_save = bool(req.get("auto_save", True)) if req else True
    req_steps = req.get("steps") if req else None
    source_steps = req_steps if isinstance(req_steps, list) and req_steps else _recorded_steps
    analysis = analyze_shadow_session(name, start_url, source_steps or [], context)
    saved = save_shadow_session(analysis) if auto_save else None
    return {
        "success": True,
        "analysis": analysis,
        "saved": saved,
        "message": f"Shadow analiza gotova ({analysis['stats']['step_count']} koraka)",
    }

@app.post("/record/run")
async def record_run(req: dict, _: str = Depends(verify_api_key)):
    """
    Pokreni flow u TRENUTNOM Chromium browseru.
    Koristi robustan string parser koji ispravno čita mixed quotes selektore.
    """
    name = req.get("name", "").replace(" ", "_").lower()
    params = req.get("params", {}) or {}
    stop_on_error = req.get("stop_on_error", False)

    if not name:
        return {"success": False, "error": "Ime akcije je obavezno"}

    path = os.path.join(WORKSPACE_DIR, f"{name}.py")
    if not os.path.exists(path):
        return {"success": False, "error": f"Fajl '{name}.py' nije pronađen"}

    with open(path, "r", encoding="utf-8") as f:
        code = f.read()

    # Zamijeni {param} s pravim vrijednostima
    for k, v in params.items():
        code = code.replace(f"{{{k}}}", str(v))

    # ── Robustan string parser ──────────────────────────────────────────
    def extract_args(line: str) -> list:
        """Parsira string argumente iz Python poziva, ispravno rukuje mixed quotes."""
        idx = line.find("(")
        if idx == -1: return []
        i, args = idx + 1, []
        while i < len(line) and len(args) < 3:
            while i < len(line) and line[i] in " \t,": i += 1
            if i >= len(line) or line[i] not in "\"'": break
            q = line[i]; i += 1; chars = []
            while i < len(line):
                if line[i] == "\\" and i + 1 < len(line):
                    chars.append({"n":"\n","t":"\t","r":"\r"}.get(line[i+1], line[i+1])); i += 2; continue
                if line[i] == q: args.append("".join(chars)); i += 1; break
                chars.append(line[i]); i += 1
            else: break
        return args

    steps_to_run = []
    for line_num, raw_line in enumerate(code.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"): continue

        if "page.goto(" in line:
            a = extract_args(line)
            if a: steps_to_run.append({"type": "navigate", "url": a[0], "_line": line_num}); continue

        if "page.fill(" in line or "page.type(" in line:
            a = extract_args(line)
            if len(a) >= 2: steps_to_run.append({"type": "fill", "target": a[0], "value": a[1], "_line": line_num}); continue

        if "page.click(" in line:
            a = extract_args(line)
            if a: steps_to_run.append({"type": "click", "target": a[0], "_line": line_num}); continue

        if "page.press(" in line:
            a = extract_args(line)
            if len(a) >= 2: steps_to_run.append({"type": "press", "target": a[0], "key": a[1], "_line": line_num}); continue

        if "page.wait_for_timeout(" in line:
            m = re.search(r'wait_for_timeout\(\s*(\d+)', line)
            if m: steps_to_run.append({"type": "wait", "ms": int(m.group(1)), "_line": line_num}); continue

        if "page.wait_for_selector(" in line:
            a = extract_args(line)
            if a: steps_to_run.append({"type": "wait_for_selector", "target": a[0], "_line": line_num}); continue

        if "page.hover(" in line:
            a = extract_args(line)
            if a: steps_to_run.append({"type": "hover", "target": a[0], "_line": line_num}); continue

        if "page.screenshot(" in line:
            steps_to_run.append({"type": "screenshot", "_line": line_num}); continue

    if not steps_to_run:
        return {"success": False, "error": "Nije moguće parsirati korake. Provjeri da .py ima await page.goto/click/fill linije."}

    # ── Izvrši ─────────────────────────────────────────────────────────
    page = await get_playwright_page()
    results = []
    failed = []

    for i, step in enumerate(steps_to_run):
        stype = step["type"]
        line_no = step.get("_line", 0)
        try:
            if stype == "navigate":
                try: await page.goto(step["url"], wait_until="load", timeout=45000)
                except Exception: await page.goto(step["url"], wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(1500)
                results.append(f"✓ L{line_no} goto {step['url']}")

            elif stype == "fill":
                try: await page.wait_for_selector(step["target"], state="visible", timeout=10000)
                except Exception: pass
                await page.fill(step["target"], step["value"], timeout=15000)
                results.append(f"✓ L{line_no} fill {step['target']}")

            elif stype == "click":
                try: await page.wait_for_selector(step["target"], state="visible", timeout=10000)
                except Exception: pass
                await page.click(step["target"], timeout=15000)
                await page.wait_for_timeout(500)
                results.append(f"✓ L{line_no} click {step['target']}")

            elif stype == "press":
                await page.press(step["target"], step["key"], timeout=10000)
                await page.wait_for_timeout(1000)
                results.append(f"✓ L{line_no} press {step['key']}")

            elif stype == "wait":
                await page.wait_for_timeout(step["ms"])
                results.append(f"✓ L{line_no} wait {step['ms']}ms")

            elif stype == "wait_for_selector":
                await page.wait_for_selector(step["target"], timeout=15000)
                results.append(f"✓ L{line_no} wait_for_selector {step['target']}")

            elif stype == "hover":
                await page.hover(step["target"], timeout=15000)
                results.append(f"✓ L{line_no} hover {step['target']}")

            elif stype == "screenshot":
                ss = os.path.join(WORKSPACE_DIR, f"test_{name}_{i}.png")
                await page.screenshot(path=ss)
                results.append(f"✓ L{line_no} screenshot → {ss}")

        except Exception as e:
            err = str(e).split('\n')[0][:150]
            results.append(f"✗ L{line_no} ({stype}): {err}")
            failed.append({"line": line_no, "type": stype, "target": step.get("target",""), "error": err})
            if stop_on_error: break

    return {
        "success": True,
        "steps_run": len(steps_to_run),
        "results": results,
        "failed": failed,
        "output": "\n".join(results),
        "url": page.url,
    }



# ============ CODE CLEANUP / TEMP RUN / MERGE ============

def _dedupe_consecutive_lines(lines: list[str]) -> list[str]:
    cleaned = []
    for line in lines:
        if cleaned and cleaned[-1].strip() == line.strip() and line.strip():
            continue
        cleaned.append(line)
    return cleaned

def _normalize_playwright_content(content: str) -> tuple[str, list[str]]:
    notes: list[str] = []
    text = content.replace("\r\n", "\n").strip()

    oss_username = os.environ.get("OSS_USERNAME", "")
    oss_password = os.environ.get("OSS_PASSWORD", "")
    if "OSS_USERNAME" not in text and oss_username and f'fill("{oss_username}")' in text:
        text = text.replace(f'fill("{oss_username}")', 'fill(OSS_USERNAME)')
        notes.append("Username prebačen na OSS_USERNAME.")
    if "OSS_PASSWORD" not in text and oss_password and f'fill("{oss_password}")' in text:
        text = text.replace(f'fill("{oss_password}")', 'fill(OSS_PASSWORD)')
        notes.append("Lozinka prebačena na OSS_PASSWORD.")

    if "OSS_USERNAME = os.environ.get" not in text and "from playwright.async_api" in text:
        text = text.replace(
            "import asyncio\n",
            "import asyncio\nimport os\n",
            1,
        )
        text = text.replace(
            "from playwright.async_api import Playwright, async_playwright, expect\n",
            "from playwright.async_api import Playwright, async_playwright, expect\n\nOSS_USERNAME = os.environ.get(\"OSS_USERNAME\", \"\")\nOSS_PASSWORD = os.environ.get(\"OSS_PASSWORD\", \"\")\n",
            1,
        )
        notes.append("Dodane env varijable za OSS kredencijale.")

    lines = text.split("\n")
    lines = _dedupe_consecutive_lines(lines)

    normalized: list[str] = []
    for line in lines:
        stripped = line.strip()

        if stripped == 'await page.get_by_text("Lozinka").click()':
            notes.append("Maknut suvišan klik na polje Lozinka.")
            continue

        if stripped == 'await page.get_by_role("button", name="Prijava").click()' and normalized:
            prev = normalized[-1].strip()
            if prev == stripped:
                notes.append("Maknut dupli klik na Prijava.")
                continue

        normalized.append(line)

    text = "\n".join(normalized)

    # ── accept_downloads=True za PDF/dostavnica download ──
    if "accept_downloads" not in text and "new_context()" in text:
        text = text.replace(
            "await browser.new_context()",
            "await browser.new_context(accept_downloads=True)"
        )
        notes.append("Dodan accept_downloads=True na new_context() za podršku PDF downloada.")

    if "await page.goto(" in text and 'wait_until="domcontentloaded"' not in text and "wait_until='domcontentloaded'" not in text:
        text = text.replace('await page.goto("https://oss.uredjenazemlja.hr/")',
                            'await page.goto("https://oss.uredjenazemlja.hr/", wait_until="domcontentloaded")')
        notes.append("Dodano wait_until='domcontentloaded' na page.goto().")

    if "await page.wait_for_load_state(\"networkidle\")" not in text:
        text = text.replace(
            'await page.goto("https://oss.uredjenazemlja.hr/", wait_until="domcontentloaded")',
            'await page.goto("https://oss.uredjenazemlja.hr/", wait_until="domcontentloaded")\n    await page.wait_for_load_state("networkidle")'
        )
        notes.append("Dodano čekanje networkidle nakon otvaranja stranice.")

    # ── Popup PDF download injection ──
    if "expect_popup" in text and "download_popup_pdf" not in text:
        # Dodaj import stellan_helpers ako postoji popup
        if "from stellan_helpers import" not in text:
            # Ubaci import nakon playwright importa
            pw_import_line = "from playwright.async_api import Playwright, async_playwright, expect"
            if pw_import_line in text:
                text = text.replace(
                    pw_import_line,
                    pw_import_line + "\nfrom stellan_helpers import download_popup_pdf",
                    1,
                )
                notes.append("Dodan import stellan_helpers za PDF download.")
            else:
                # Fallback: dodaj na vrh
                text = "from stellan_helpers import download_popup_pdf\n" + text
                notes.append("Dodan import stellan_helpers na vrh skripte.")

        # Zamijeni "page1 = await page1_info.value" + praznu liniju
        # sa kodom koji preuzima PDF
        # Podržava page1, page2, popup, itd.
        popup_var_pattern = re.compile(
            r'([ \t]+)(\w+)\s*=\s*await\s+(\w+_info)\.value\s*\n',
        )
        match = popup_var_pattern.search(text)
        if match:
            indent = match.group(1)
            popup_var = match.group(2)
            info_var = match.group(3)
            old_line = match.group(0)
            new_block = (
                f"{old_line}"
                f"{indent}pdf_result = await download_popup_pdf({popup_var})\n"
                f"{indent}if pdf_result['success']:\n"
                f"{indent}    print(f\"PDF spremljen: {{pdf_result['path']}} ({{pdf_result['size'] / 1024:.1f}} KB)\")\n"
                f"{indent}else:\n"
                f"{indent}    print(f\"PDF download neuspješan: {{pdf_result.get('error', 'nepoznato')}}\")\n"
                f"{indent}await {popup_var}.close()\n"
            )
            text = text.replace(old_line, new_block, 1)
            notes.append(f"Dodan PDF download za popup ({popup_var}) putem stellan_helpers.")
        else:
            notes.append("Detektiran expect_popup ali nisam mogao prepoznati varijablu — dodaj download_popup_pdf() ručno.")

    # ── SDGE credential detection ──
    if "SDGE_USERNAME" not in text and "sdge" in text.lower():
        for env_name in ["SDGE_USERNAME", "SDGE_PASSWORD"]:
            env_value = os.environ.get(env_name, "")
            if env_value and f'fill("{env_value}")' in text:
                text = text.replace(f'fill("{env_value}")', f'fill({env_name})')
                notes.append(f"Hardkodirani kredencijal prebačen na {env_name}.")
        if "SDGE_USERNAME = os.environ.get" not in text and "SDGE_USERNAME" in text:
            pw_line = "from playwright.async_api import"
            idx = text.find(pw_line)
            if idx != -1:
                end_of_line = text.index("\n", idx)
                text = text[:end_of_line + 1] + \
                    '\nSDGE_USERNAME = os.environ.get("SDGE_USERNAME", "")\nSDGE_PASSWORD = os.environ.get("SDGE_PASSWORD", "")\n' + \
                    text[end_of_line + 1:]
                notes.append("Dodane env varijable za SDGE kredencijale.")

    # Generička provjera kredencijala — samo za portale koji su u skripti
    if "async def run(" in text:
        checks = []
        if "OSS_USERNAME" in text and "if not OSS_USERNAME" not in text:
            checks.append(('OSS_USERNAME', 'OSS_PASSWORD', 'OSS'))
        if "SDGE_USERNAME" in text and "if not SDGE_USERNAME" not in text:
            checks.append(('SDGE_USERNAME', 'SDGE_PASSWORD', 'SDGE'))
        if checks:
            guard_lines = []
            for uvar, pvar, label in checks:
                guard_lines.append(f"    if not {uvar} or not {pvar}:")
                guard_lines.append(f'        raise RuntimeError("{uvar} i {pvar} nisu postavljeni.")')
                guard_lines.append("")
            guard_block = "\n".join(guard_lines)
            text = text.replace(
                "async def run(playwright: Playwright) -> None:\n",
                f"async def run(playwright: Playwright) -> None:\n{guard_block}\n",
                1,
            )
            names = ", ".join(c[2] for c in checks)
            notes.append(f"Dodana provjera kredencijala za: {names}.")

    return text, notes

@app.post("/code/clean_playwright")
async def code_clean_playwright(req: CleanPlaywrightRequest, _: str = Depends(verify_api_key)):
    if not req.content.strip():
        return {"success": False, "error": "Content je prazan"}
    cleaned, notes = _normalize_playwright_content(req.content)
    return {
        "success": True,
        "cleaned_content": cleaned,
        "notes": notes,
    }

def _find_new_output_files(before_time: float) -> dict:
    """Pronađi nove PNG i PDF fajlove stvorene nakon before_time u workspace-u."""
    latest_png = None
    latest_png_mtime = 0.0
    new_pdfs = []

    for f in Path(WORKSPACE_DIR).iterdir():
        if not f.is_file():
            continue
        try:
            mtime = f.stat().st_mtime
            if mtime < before_time:
                continue
        except Exception:
            continue

        suffix = f.suffix.lower()
        if suffix == ".png":
            if mtime >= latest_png_mtime:
                latest_png = f
                latest_png_mtime = mtime
        elif suffix == ".pdf":
            new_pdfs.append({"name": f.name, "path": str(f), "size": f.stat().st_size})

    screenshot_path = latest_png.name if latest_png else None
    screenshot_base64 = None
    if latest_png and latest_png.exists():
        try:
            screenshot_base64 = base64.b64encode(latest_png.read_bytes()).decode("utf-8")
        except Exception:
            pass

    return {
        "screenshot_path": screenshot_path,
        "screenshot_base64": screenshot_base64,
        "downloaded_pdfs": new_pdfs,
    }

def _prepare_code_for_autorun(code: str) -> str:
    """Pripremi kod za automatsko izvršavanje — ukloni blokade."""
    text = code
    # Ukloni page.pause() koji blokira subprocess
    text = text.replace("    await page.pause()\n", "")
    text = text.replace("await page.pause()\n", "")
    text = text.replace("await page.pause()", "# page.pause() uklonjeno za autorun")
    # Osiguraj accept_downloads
    if "accept_downloads" not in text and "new_context()" in text:
        text = text.replace("new_context()", "new_context(accept_downloads=True)")
    return text

@app.post("/code/run_temp")
async def code_run_temp(req: RunTempCodeRequest, _: str = Depends(verify_api_key)):
    ensure_workspace()
    ensure_stellan_helpers()

    if not req.content.strip():
        return {"success": False, "error": "Content je prazan"}

    # Pripremi kod za autorun (ukloni page.pause, prebaci headless)
    run_code = _prepare_code_for_autorun(req.content)

    temp_name = f"temp_run_{uuid.uuid4().hex[:8]}.py"
    temp_path = Path(WORKSPACE_DIR) / temp_name
    temp_path.write_text(run_code, encoding="utf-8")

    before_time = datetime.now().timestamp()
    timeout = min(req.timeout or 120, MAX_TIMEOUT)

    try:
        result = subprocess.run(
            [PYTHON_CMD, str(temp_path)],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=WORKSPACE_DIR,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )

        outputs = _find_new_output_files(before_time)
        screenshot_path = outputs["screenshot_path"]
        screenshot_base64 = outputs["screenshot_base64"]
        downloaded_pdfs = outputs["downloaded_pdfs"]

        if screenshot_base64:
            _push_preview_timeline("Probni run", "Probni run screenshot", screenshot_path or "", screenshot_path or "", screenshot_base64)

        return {
            "success": result.returncode == 0,
            "stdout": truncate_output(result.stdout),
            "stderr": truncate_output(result.stderr),
            "exit_code": result.returncode,
            "temp_file": temp_name,
            "screenshot_path": screenshot_path,
            "screenshot_base64": screenshot_base64,
            "downloaded_pdfs": downloaded_pdfs,
            "captured_at": datetime.now().isoformat(),
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Probno izvršavanje prekinuto nakon {timeout}s timeout-a",
            "temp_file": temp_name,
        }
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass

def recorded_steps_to_code_lines(steps: list[dict]) -> list[str]:
    lines: list[str] = []
    for step in steps:
        action = step.get("action")

        if action == "navigate":
            url = step.get("url", "")
            if url:
                lines.append(f"    await page.goto({url!r}, wait_until='domcontentloaded')")

        elif action == "click":
            selector = step.get("selector", "")
            if selector:
                lines.append(f"    await page.click({selector!r})")

        elif action == "fill":
            selector = step.get("selector", "")
            value = step.get("value", "")
            if selector:
                lines.append(f"    await page.fill({selector!r}, {value!r})")

        elif action == "screenshot":
            description = (step.get("description") or "continue").strip().replace(" ", "_").lower()
            lines.append(f"    await page.screenshot(path='screenshot_{description}.png', full_page=True)")

        elif action == "wait":
            selector = step.get("selector", "")
            if selector:
                lines.append(f"    await page.wait_for_selector({selector!r})")

    return lines

@app.post("/record/merge_into_code")
async def record_merge_into_code(req: MergeRecordingRequest, _: str = Depends(verify_api_key)):
    global _recorded_steps

    if not req.content.strip():
        return {"success": False, "error": "Content je prazan"}

    if not _recorded_steps:
        return {"success": False, "error": "Nema snimljenih koraka za spajanje"}

    new_block_lines = recorded_steps_to_code_lines(_recorded_steps)
    if not new_block_lines:
        return {"success": False, "error": "Nije moguće pretvoriti snimljene korake u kod"}

    new_block = "\n".join(new_block_lines)
    merged = req.content
    merge_mode = "append"

    if req.marker and req.marker in merged:
        merged = merged.replace(req.marker, f"{req.marker}\n{new_block}", 1)
        merge_mode = "marker"
    elif req.insert_at is not None and 0 <= req.insert_at <= len(merged):
        merged = merged[:req.insert_at] + "\n" + new_block + "\n" + merged[req.insert_at:]
        merge_mode = "cursor"
    else:
        merged += "\n\n" + new_block + "\n"

    _recorded_steps = []

    return {
        "success": True,
        "merged_content": merged,
        "steps_used": len(new_block_lines),
        "merge_mode": merge_mode,
    }


# ============ PACKAGE 1: FLOW METADATA / INPUTS / VERSIONS ============

FLOW_META_DIR = Path(WORKSPACE_DIR) / "2 AGENT" / "_flow_meta"
FLOW_VERSIONS_DIR = Path(WORKSPACE_DIR) / "2 AGENT" / "_flow_versions"
SHADOW_SESSION_DIR = Path(WORKSPACE_DIR) / "2 AGENT" / "_shadow_sessions"

def ensure_flow_dirs():
    ensure_workspace()
    FLOW_META_DIR.mkdir(parents=True, exist_ok=True)
    FLOW_VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
    SHADOW_SESSION_DIR.mkdir(parents=True, exist_ok=True)

def normalize_flow_name(name: str) -> str:
    return (name or "").strip().replace(" ", "_").lower()

def is_temporary_flow_name(name: str) -> bool:
    n = normalize_flow_name(name)
    return n.startswith("temp_") or "_test_" in n or n.endswith("_test")

def flow_script_path(name: str) -> Path:
    return Path(WORKSPACE_DIR) / f"{normalize_flow_name(name)}.py"

def flow_meta_path(name: str) -> Path:
    return FLOW_META_DIR / f"{normalize_flow_name(name)}.json"

def flow_versions_path(name: str) -> Path:
    return FLOW_VERSIONS_DIR / normalize_flow_name(name)

def default_flow_metadata(name: str) -> dict:
    n = normalize_flow_name(name)
    return {
        "id": n,
        "name": n,
        "display_name": n,
        "description": "",
        "portal": "Ostalo",
        "tags": [],
        "params": [],
        "example_inputs": {},
        "raw_code": "",
        "polished_code": "",
        "active_variant": "raw",
        "is_temporary": False,
        "updated_at": datetime.now().isoformat(),
    }

def read_flow_metadata(name: str) -> dict:
    ensure_flow_dirs()
    path = flow_meta_path(name)
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return default_flow_metadata(name)

def write_flow_metadata(name: str, metadata: dict) -> dict:
    ensure_flow_dirs()
    current = default_flow_metadata(name)
    current.update(metadata or {})
    current["id"] = normalize_flow_name(name)
    display_name = str(current.get("display_name") or current.get("name") or name).strip()
    current["display_name"] = display_name or normalize_flow_name(name)
    current["name"] = current["display_name"]
    current["updated_at"] = datetime.now().isoformat()

    params = []
    for p in current.get("params", []):
        if isinstance(p, str):
            key = p.strip()
            if not key:
                continue
            params.append({
                "key": key,
                "label": key,
                "type": "text",
                "required": False,
                "env_key": key.upper(),
                "default": "",
            })
            continue
        if not isinstance(p, dict):
            continue
        key = str(p.get("key", "")).strip()
        if not key:
            continue
        params.append({
            "key": key,
            "label": str(p.get("label") or key).strip(),
            "type": str(p.get("type") or "text").strip(),
            "required": bool(p.get("required", False)),
            "env_key": str(p.get("env_key") or key.upper()).strip(),
            "default": str(p.get("default") or "").strip(),
        })
    current["params"] = params
    if current.get("active_variant") not in {"raw", "polished"}:
        current["active_variant"] = "raw"
    current["is_temporary"] = bool(current.get("is_temporary", False))

    if not isinstance(current.get("tags"), list):
        if isinstance(current.get("tags"), str):
            current["tags"] = [t.strip() for t in current["tags"].split(",") if t.strip()]
        else:
            current["tags"] = []
    if not isinstance(current.get("example_inputs"), dict):
        current["example_inputs"] = {}

    path = flow_meta_path(name)
    path.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    return current

def flow_param_keys(metadata: dict) -> list[str]:
    keys: list[str] = []
    for param in metadata.get("params", []) or []:
        if isinstance(param, str):
            key = param.strip()
        elif isinstance(param, dict):
            key = str(param.get("key", "")).strip()
        else:
            key = ""
        if key and key not in keys:
            keys.append(key)
    return keys

def maybe_parametrize_content(content: str, metadata: dict) -> tuple[str, list[str]]:
    text = content or ""
    notes = []
    examples = metadata.get("example_inputs") or {}
    params = metadata.get("params") or []

    if "import os" not in text and params:
        if "import asyncio\n" in text:
            text = text.replace("import asyncio\n", "import asyncio\nimport os\n", 1)
            notes.append("Dodan import os za input parametre.")
        elif "from playwright.async_api" in text:
            text = "import os\n" + text
            notes.append("Dodan import os na vrh skripte.")

    for param in params:
        key = param.get("key")
        env_key = param.get("env_key") or str(key).upper()
        example = examples.get(key)
        if not key:
            continue

        # already parametrized
        if f'os.environ.get("{env_key}"' in text or f"os.environ.get('{env_key}'" in text:
            continue

        replaced = False

        if example not in (None, ""):
            ex = str(example)
            candidates = [
                f'"{ex}"',
                f"'{ex}'",
                f'fill("{ex}")',
                f"fill('{ex}')",
            ]
            for cand in candidates:
                if cand in text:
                    replacement = f'os.environ.get("{env_key}", {json.dumps(ex, ensure_ascii=False)})'
                    if cand.startswith("fill("):
                        text = text.replace(cand, f'fill({replacement})', 1)
                    else:
                        text = text.replace(cand, replacement, 1)
                    replaced = True
                    notes.append(f"Parametar '{key}' prebačen na env varijablu {env_key}.")
                    break

        if not replaced:
            marker = f"# INPUT_{key.upper()}"
            if marker in text:
                line = f'{key} = os.environ.get("{env_key}", {json.dumps(str(example or param.get("default") or ""), ensure_ascii=False)})'
                text = text.replace(marker, line)
                replaced = True
                notes.append(f"Marker {marker} zamijenjen input parametrom.")

    return text, notes

def create_flow_version(name: str, code: str, metadata: dict | None = None, source: str = "manual") -> dict:
    ensure_flow_dirs()
    n = normalize_flow_name(name)
    version_dir = flow_versions_path(n)
    version_dir.mkdir(parents=True, exist_ok=True)
    version_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    payload = {
        "version_id": version_id,
        "name": n,
        "source": source,
        "created_at": datetime.now().isoformat(),
        "code": code,
        "metadata": metadata or read_flow_metadata(n),
    }
    (version_dir / f"{version_id}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload

def list_flow_versions(name: str) -> list[dict]:
    ensure_flow_dirs()
    version_dir = flow_versions_path(name)
    items = []
    if not version_dir.exists():
        return items
    for file in sorted(version_dir.glob("*.json"), reverse=True):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
            items.append({
                "version_id": data.get("version_id") or file.stem,
                "created_at": data.get("created_at"),
                "source": data.get("source") or "manual",
            })
        except Exception:
            items.append({
                "version_id": file.stem,
                "created_at": None,
                "source": "unknown",
            })
    return items


def guess_portal_from_url(url: str) -> str:
    u = (url or "").lower()
    if "oss.uredjenazemlja.hr" in u:
        return "OSS Uredena Zemlja"
    if "sdge" in u:
        return "SDGE"
    if "katastar" in u:
        return "Katastar"
    if "zemljisna-knjiga" in u or "zk" in u:
        return "Zemljisna knjiga"
    return "Web portal"


def infer_flow_type(text_blob: str) -> str:
    t = (text_blob or "").lower()
    if "parcel" in t:
        return "parcelacija"
    if "upis" in t:
        return "upis"
    if "uskla" in t:
        return "uskladjenje"
    if "iskol" in t:
        return "iskolcenje"
    if "situacij" in t:
        return "situacija"
    if "prilog" in t or "upload" in t:
        return "predaja_priloga"
    if "predaj" in t or "submit" in t:
        return "predaja_elaborata"
    return "sdge_postupak"


def detect_shadow_phases(steps: list[dict], context_text: str = "") -> list[str]:
    phases: list[str] = []
    keywords = " ".join(
        filter(None, [context_text] + [str(s.get("target") or s.get("url") or s.get("value") or "") for s in steps])
    ).lower()

    if any((s.get("type") or s.get("action")) == "navigate" for s in steps):
        phases.append("Otvaranje portala / predmeta")
    if any((s.get("type") or s.get("action")) in {"type", "fill"} for s in steps):
        phases.append("Unos podataka / pretraga")
    if any("prilog" in str(s.get("target") or "").lower() or "upload" in str(s.get("target") or "").lower() for s in steps):
        phases.append("Dodavanje priloga")
    if any("pdf" in str(s.get("target") or "").lower() or "download" in str(s.get("target") or "").lower() for s in steps):
        phases.append("Pregled ili preuzimanje PDF-a")
    if any("predaj" in keywords or "submit" == (s.get("type") or s.get("action")) for s in steps):
        phases.append("Predaja / potvrda")
    if not phases:
        phases.append("Rucni rad u portalu")
    return phases


def build_shadow_checklist(flow_type: str, steps: list[dict], context_text: str = "") -> list[str]:
    items: list[str] = [
        "Provjeri predmet, stranku i cesticu prije unosa.",
        "Provjeri da su svi obavezni podaci spremljeni prije iduce faze.",
    ]
    joined = " ".join(
        filter(None, [context_text] + [str(s.get("target") or s.get("value") or s.get("url") or "") for s in steps])
    ).lower()
    if any((s.get("type") or s.get("action")) in {"type", "fill"} for s in steps):
        items.append("Usporedi upisana polja s elaboratom i radnim biljeskama.")
    if "prilog" in joined or "upload" in joined:
        items.append("Provjeri da su svi prilozi ucitani u pravoj verziji i formatu.")
    if "pdf" in joined or "download" in joined:
        items.append("Otvori PDF i provjeri naziv, mjerilo, oznake i priloge prije slanja.")
    if "predaj" in joined or any((s.get("type") or s.get("action")) == "submit" for s in steps):
        items.append("Prije predaje potvrdi da nema validacijskih gresaka i da je status predmeta ispravan.")
    if flow_type == "parcelacija":
        items.append("Kod parcelacije provjeri nove oznake cestica, povrsine i uskladjenost skice.")
    if flow_type == "upis":
        items.append("Kod upisa provjeri uskladjenost vlasnika, adrese i identifikatora predmeta.")
    return items[:6]


def build_shadow_risks(steps: list[dict], context_text: str = "") -> list[str]:
    risks: list[str] = []
    if len(steps) < 3:
        risks.append("Sesija ima malo koraka pa je moguce da playbook nije potpun.")
    wait_count = sum(1 for s in steps if (s.get("type") or s.get("action")) == "wait")
    if wait_count >= 3:
        risks.append("Ima vise cekanja; portal vjerojatno kasni pa treba dodati checkpoint provjere.")
    if not any((s.get("type") or s.get("action")) in {"submit", "click"} for s in steps):
        risks.append("Nema jasnog zavrsnog koraka; provjeri je li sesija stala prije potvrde ili spremanja.")
    joined = " ".join(filter(None, [context_text] + [str(s.get("target") or s.get("url") or "") for s in steps])).lower()
    if "pdf" not in joined:
        risks.append("Nije vidljiv pregled PDF-a; dodaj provjeru izlaznog dokumenta prije predaje.")
    return risks[:4]


def analyze_shadow_session(name: str, start_url: str, steps: list[dict], context: str = "") -> dict:
    ensure_flow_dirs()
    normalized_steps: list[dict] = []
    pages: list[str] = []
    counts: dict[str, int] = {}

    for i, step in enumerate(steps or []):
        stype = str(step.get("type") or step.get("action") or "click").strip() or "click"
        target = str(step.get("target") or step.get("selector") or "").strip()
        value = str(step.get("value") or "").strip()
        url = str(step.get("url") or "").strip()
        ts = step.get("timestamp") or step.get("ts") or 0
        normalized = {
            "id": step.get("id") or str(i),
            "type": stype,
            "target": target,
            "value": value,
            "url": url,
            "timestamp": ts,
        }
        normalized_steps.append(normalized)
        counts[stype] = counts.get(stype, 0) + 1
        if url and url not in pages:
            pages.append(url)

    text_blob = " ".join(
        filter(None, [name, start_url, context] + [f"{s['type']} {s['target']} {s['value']} {s['url']}" for s in normalized_steps])
    )
    portal = guess_portal_from_url(start_url or (pages[0] if pages else ""))
    flow_type = infer_flow_type(text_blob)
    phases = detect_shadow_phases(normalized_steps, context)
    checklist = build_shadow_checklist(flow_type, normalized_steps, context)
    risks = build_shadow_risks(normalized_steps, context)
    duration_ms = 0
    timestamps = [int(s["timestamp"]) for s in normalized_steps if str(s.get("timestamp", "")).isdigit()]
    if len(timestamps) >= 2:
        duration_ms = max(timestamps) - min(timestamps)

    suggested_name = normalize_flow_name(name or f"{portal}_{flow_type}_{datetime.now().strftime('%Y%m%d_%H%M')}")
    summary = (
        f"Shadow session za {portal}: {len(normalized_steps)} koraka kroz faze "
        f"{', '.join(phases[:3])}. Predlozeni tip postupka: {flow_type}."
    )

    return {
        "name": name,
        "suggested_name": suggested_name,
        "portal": portal,
        "flow_type": flow_type,
        "summary": summary,
        "phases": phases,
        "checklist": checklist,
        "risks": risks,
        "tags": [portal.lower().replace(" ", "_"), flow_type, "shadow_learning"],
        "stats": {
            "step_count": len(normalized_steps),
            "pages": pages,
            "page_count": len(pages),
            "counts": counts,
            "duration_ms": duration_ms,
        },
        "steps": normalized_steps,
        "context": context,
        "start_url": start_url,
        "captured_at": datetime.now().isoformat(),
    }


def save_shadow_session(payload: dict) -> dict:
    ensure_flow_dirs()
    session_id = f"{normalize_flow_name(payload.get('suggested_name') or payload.get('name') or 'shadow')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    path = SHADOW_SESSION_DIR / f"{session_id}.json"
    document = dict(payload)
    document["session_id"] = session_id
    document["saved_at"] = datetime.now().isoformat()
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"session_id": session_id, "path": str(path)}

class FlowNameRequest(BaseModel):
    name: str

class LearnFlowRequest(BaseModel):
    name: str
    content: str
    metadata: Optional[dict] = None
    create_version: Optional[bool] = True

class RunFlowWithInputsRequest(BaseModel):
    name: str
    inputs: Optional[dict] = None
    timeout: Optional[int] = 90

class RestoreFlowVersionRequest(BaseModel):
    name: str
    version_id: str

@app.post("/flow/metadata/read")
async def flow_metadata_read(req: FlowNameRequest, _: str = Depends(verify_api_key)):
    name = normalize_flow_name(req.name)
    if not name:
        return {"success": False, "error": "Ime flowa je obavezno"}
    meta = read_flow_metadata(name)
    return {"success": True, "metadata": meta}


@app.post("/flow/metadata/write")
async def flow_metadata_write(req: LearnFlowRequest, _: str = Depends(verify_api_key)):
    name = normalize_flow_name(req.name)
    if not name:
        return {"success": False, "error": "Ime flowa je obavezno"}
    metadata = write_flow_metadata(name, req.metadata or {"name": name})
    code = req.content or (flow_script_path(name).read_text(encoding="utf-8") if flow_script_path(name).exists() else "")
    if code:
        create_flow_version(name, code, metadata, source="metadata_write")
    return {"success": True, "metadata": metadata, "message": f"Metadata spremljen za {name}."}

@app.post("/flow/learn")
async def flow_learn(req: LearnFlowRequest, _: str = Depends(verify_api_key)):
    ensure_flow_dirs()
    name = normalize_flow_name(req.name)
    if not name:
        return {"success": False, "error": "Ime flowa je obavezno"}
    if not req.content.strip():
        return {"success": False, "error": "Content je obavezan"}

    metadata = write_flow_metadata(name, req.metadata or {"name": name})
    content, notes = maybe_parametrize_content(req.content, metadata)

    path = flow_script_path(name)
    path.write_text(content, encoding="utf-8")

    version = None
    if req.create_version:
        version = create_flow_version(name, content, metadata, source="learn_flow")

    return {
        "success": True,
        "name": name,
        "path": str(path),
        "metadata": metadata,
        "version": version["version_id"] if version else None,
        "notes": notes,
        "message": f"Flow '{name}' naučen i spremljen.",
    }

@app.post("/flow/versions")
async def flow_versions(req: FlowNameRequest, _: str = Depends(verify_api_key)):
    name = normalize_flow_name(req.name)
    if not name:
        return {"success": False, "error": "Ime flowa je obavezno"}
    return {"success": True, "versions": list_flow_versions(name)}

@app.post("/flow/restore")
async def flow_restore(req: RestoreFlowVersionRequest, _: str = Depends(verify_api_key)):
    name = normalize_flow_name(req.name)
    if not name or not req.version_id:
        return {"success": False, "error": "Ime flowa i version_id su obavezni"}

    file = flow_versions_path(name) / f"{req.version_id}.json"
    if not file.exists():
        return {"success": False, "error": f"Verzija '{req.version_id}' nije pronađena"}

    try:
        data = json.loads(file.read_text(encoding="utf-8"))
        code = data.get("code") or ""
        metadata = data.get("metadata") or read_flow_metadata(name)
        flow_script_path(name).write_text(code, encoding="utf-8")
        write_flow_metadata(name, metadata)
        create_flow_version(name, code, metadata, source=f"restore:{req.version_id}")
        return {
            "success": True,
            "name": name,
            "content": code,
            "metadata": metadata,
            "message": f"Vraćena verzija {req.version_id}",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/flow/run_with_inputs")
async def flow_run_with_inputs(req: RunFlowWithInputsRequest, _: str = Depends(verify_api_key)):
    ensure_flow_dirs()
    name = normalize_flow_name(req.name)
    if not name:
        return {"success": False, "error": "Ime flowa je obavezno"}
    path = flow_script_path(name)
    if not path.exists():
        return {"success": False, "error": f"Flow '{name}' nije pronađen"}

    metadata = read_flow_metadata(name)
    inputs = req.inputs or {}
    code = path.read_text(encoding="utf-8")
    code, notes = maybe_parametrize_content(code, metadata)
    code = _prepare_code_for_autorun(code)
    ensure_stellan_helpers()

    before_time = datetime.now().timestamp()
    timeout = min(req.timeout or 120, MAX_TIMEOUT)
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}

    for param in metadata.get("params", []):
        key = param.get("key")
        env_key = str(param.get("env_key") or str(key).upper())
        value = inputs.get(key)
        if value in (None, ""):
            value = metadata.get("example_inputs", {}).get(key, param.get("default", ""))
        env[env_key] = str(value)
        env[f"INPUT_{env_key}"] = str(value)

    temp_path = Path(WORKSPACE_DIR) / f"temp_inputs_{name}_{uuid.uuid4().hex[:6]}.py"
    temp_path.write_text(code, encoding="utf-8")

    try:
        result = subprocess.run(
            [PYTHON_CMD, str(temp_path)],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=WORKSPACE_DIR,
            env=env,
        )

        outputs = _find_new_output_files(before_time)
        screenshot_path = outputs["screenshot_path"]
        screenshot_base64 = outputs["screenshot_base64"]
        downloaded_pdfs = outputs["downloaded_pdfs"]

        if screenshot_base64:
            _push_preview_timeline(f"Run inputs: {name}", "Flow run with inputs", screenshot_path or "", screenshot_path or "", screenshot_base64)

        return {
            "success": result.returncode == 0,
            "stdout": truncate_output(result.stdout),
            "stderr": truncate_output(result.stderr),
            "exit_code": result.returncode,
            "used_inputs": {k: env.get((next((p.get("env_key") for p in metadata.get("params", []) if p.get("key")==k), k.upper()))) for k in inputs.keys()},
            "notes": notes,
            "screenshot_path": screenshot_path,
            "screenshot_base64": screenshot_base64,
            "downloaded_pdfs": downloaded_pdfs,
            "captured_at": datetime.now().isoformat(),
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"Run with inputs prekinut nakon {timeout}s"}
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass

# ============ BROWSER KONTROLA (Učenje tab) ============

@app.post("/browser/open")
async def browser_open(req: dict = {}, _: str = Depends(verify_api_key)):
    url = (req.get("url") if req else None) or "about:blank"
    try:
        page = await get_playwright_page()
        if url and url.startswith("http"):
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        return {"success": True, "url": page.url}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/browser/navigate")
async def browser_navigate_ep(req: dict = {}, _: str = Depends(verify_api_key)):
    url = (req.get("url") if req else None) or ""
    if not url:
        return {"success": False, "error": "URL obavezan"}
    try:
        page = await get_playwright_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        return {"success": True, "url": page.url}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/browser/back")
async def browser_back_ep(_: str = Depends(verify_api_key)):
    try:
        page = await get_playwright_page()
        await page.go_back(wait_until="domcontentloaded", timeout=10000)
        return {"success": True, "url": page.url}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/browser/forward")
async def browser_forward_ep(_: str = Depends(verify_api_key)):
    try:
        page = await get_playwright_page()
        await page.go_forward(wait_until="domcontentloaded", timeout=10000)
        return {"success": True, "url": page.url}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/browser/reload")
async def browser_reload_ep(_: str = Depends(verify_api_key)):
    try:
        page = await get_playwright_page()
        await page.reload(wait_until="domcontentloaded", timeout=10000)
        return {"success": True, "url": page.url}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/browser/status")
async def browser_status_ep(_: str = Depends(verify_api_key)):
    global _browser, _page
    try:
        if _browser and _browser.is_connected() and _page:
            return {"online": True, "url": _page.url}
        return {"online": False, "url": ""}
    except Exception:
        return {"online": False, "url": ""}

@app.post("/browser/close")
async def browser_close_ep(_: str = Depends(verify_api_key)):
    await close_playwright()
    return {"success": True}

@app.post("/browser/reset")
async def browser_reset_ep(req: dict = {}, _: str = Depends(verify_api_key)):
    """Resetiraj browser state i ponovo otvori. Koristi kad korisnik zatvori Chromium."""
    global _playwright, _browser, _page
    # Forsiraj reset
    _playwright = None
    _browser = None
    _page = None
    url = (req.get("url") if req else None) or "about:blank"
    try:
        page = await get_playwright_page()
        if url and url.startswith("http"):
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        return {"success": True, "url": page.url, "message": "Browser resetiran i otvoren"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============ FLOWS ENDPOINTI (StellanLearningPanel) ============

@app.post("/flows/polish")
async def flows_polish(req: dict = {}, _: str = Depends(verify_api_key)):
    import json as _json
    name = (req.get("name") if req else None) or "flow"
    steps = (req.get("steps") if req else None) or []
    if not steps:
        return {"success": False, "error": "Nema koraka"}
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY", "")
    grok_key = os.environ.get("GROK_API_KEY") or os.environ.get("XAI_API_KEY", "")
    steps_json = _json.dumps(steps, ensure_ascii=False, indent=2)
    prompt = f"""Optimiziraj ove snimljene web automatizacijske korake. Vrati SAMO JSON bez objasnjenja:
{{"steps": [{{"id":"0","type":"navigate|click|type|submit|wait","target":"selektor","value":"vrijednost ili {{param}}","url":"https://...","timestamp":0}}], "params": ["lista"], "notes": "komentar"}}

Koraci:
{steps_json}"""
    polished_steps = steps
    params: list = []
    notes = ""
    try:
        if gemini_key:
            import urllib.request
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
            payload = _json.dumps({"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2000}}).encode()
            req_obj = urllib.request.Request(api_url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req_obj, timeout=30) as resp:
                data = _json.loads(resp.read())
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            if "```" in text:
                parts = text.split("```")
                text = parts[1] if len(parts) > 1 else text
                if text.startswith("json"): text = text[4:]
            parsed = _json.loads(text.strip())
            polished_steps = parsed.get("steps", steps)
            params = parsed.get("params", [])
            notes = parsed.get("notes", "")
        elif grok_key:
            import urllib.request
            payload = _json.dumps({"model": "grok-3-fast", "messages": [{"role": "user", "content": prompt}], "temperature": 0.1}).encode()
            req_obj = urllib.request.Request("https://api.x.ai/v1/chat/completions", data=payload,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {grok_key}"}, method="POST")
            with urllib.request.urlopen(req_obj, timeout=30) as resp:
                data = _json.loads(resp.read())
            text = data["choices"][0]["message"]["content"].strip()
            if "```" in text:
                parts = text.split("```")
                text = parts[1] if len(parts) > 1 else text
                if text.startswith("json"): text = text[4:]
            parsed = _json.loads(text.strip())
            polished_steps = parsed.get("steps", steps)
            params = parsed.get("params", [])
            notes = parsed.get("notes", "")
        else:
            notes = "Nema AI API kljuca (GEMINI_API_KEY ili GROK_API_KEY)."
    except Exception as e:
        notes = f"AI greska: {str(e)[:200]}"
    return {"success": True, "steps": polished_steps, "params": params, "notes": notes,
            "original_count": len(steps), "polished_count": len(polished_steps)}

@app.post("/flows/run_step")
async def flows_run_step(req: dict = {}, _: str = Depends(verify_api_key)):
    flow_id = req.get("flow_id", "")
    step_index = req.get("step_index", 0)
    params = req.get("params", {})
    name = flow_id.replace(" ", "_").lower()
    meta = read_flow_metadata(name)
    steps = meta.get("steps", [])
    if not steps or step_index >= len(steps):
        path = os.path.join(WORKSPACE_DIR, f"{name}.py")
        if os.path.exists(path):
            try:
                result = subprocess.run([PYTHON_CMD, path], capture_output=True, text=True, timeout=60,
                    cwd=WORKSPACE_DIR, env={**os.environ, **{k.upper(): v for k, v in params.items()}})
                return {"success": result.returncode == 0, "output": result.stdout[-500:], "error": result.stderr[-200:]}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"success": False, "error": f"Flow nije pronadjen: {name}"}
    step = steps[step_index]
    def resolve(val):
        if not val: return val
        for k, v in params.items(): val = val.replace(f"{{{k}}}", str(v))
        return val
    # step_override — frontend može poslati korak direktno (za test)
    step_override = req.get("step_override") if req else None
    if step_override and isinstance(step_override, dict):
        step = step_override

    try:
        # Ne otvara novi browser — koristi postojeći
        page = await get_playwright_page()
        stype = step.get("type", step.get("action", ""))
        target = resolve(step.get("target", step.get("selector", "")))
        value = resolve(step.get("value", ""))
        url = resolve(step.get("url", ""))

        if stype == "navigate" and url:
            # Pokušaj s load, ako failuje prihvati domcontentloaded
            try:
                await page.goto(url, wait_until="load", timeout=45000)
            except Exception:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                except Exception:
                    pass  # Stranica možda radi iako je timeout
            # Kratko čekanje da se Angular/React renderira
            await page.wait_for_timeout(1500)

        elif stype == "click" and target:
            # Čekaj da element bude vidljiv prije klika
            try:
                await page.wait_for_selector(target, state="visible", timeout=10000)
            except Exception:
                pass
            await page.click(target, timeout=15000)
            await page.wait_for_timeout(500)  # Kratko čekanje nakon klika

        elif stype in ("type", "fill") and target:
            try:
                await page.wait_for_selector(target, state="visible", timeout=10000)
            except Exception:
                pass
            await page.fill(target, value, timeout=15000)

        elif stype == "submit" and target:
            await page.press(target, "Enter", timeout=10000)
            await page.wait_for_timeout(1000)

        elif stype == "wait":
            ms = int(step.get("waitMs", step.get("value", 1000)) or 1000)
            await page.wait_for_timeout(ms)

        elif stype == "screenshot":
            ss_path = os.path.join(WORKSPACE_DIR, f"step_{step_index}.png")
            await page.screenshot(path=ss_path)

        return {"success": True, "action": f"{stype} -> {target or url}", "url": page.url}
    except Exception as e:
        return {"success": False, "error": str(e)[:300], "step": step}

@app.delete("/flows/delete/{flow_id}")
@app.post("/flows/delete/{flow_id}")
async def flows_delete(flow_id: str, _: str = Depends(verify_api_key)):
    name = flow_id.replace(" ", "_").lower()
    deleted = []
    for p in [Path(WORKSPACE_DIR) / f"{name}.py", FLOW_META_DIR / f"{name}.json"]:
        if p.exists():
            try: p.unlink(); deleted.append(str(p))
            except: pass
    ver = FLOW_VERSIONS_DIR / name
    if ver.exists():
        try: __import__("shutil").rmtree(ver); deleted.append(str(ver))
        except: pass
    return {"success": bool(deleted), "deleted": deleted,
            "message": f"Flow '{name}' obrisan" if deleted else "Nije pronadjen"}

@app.get("/flows/list")
async def flows_list_ep(_: str = Depends(verify_api_key)):
    flows = []
    try:
        for f in Path(WORKSPACE_DIR).glob("*.py"):
            if f.name in ("agent_server.py", "stellan_helpers.py"): continue
            name = f.stem
            meta = read_flow_metadata(name)
            if meta.get("is_temporary") or is_temporary_flow_name(name):
                continue
            stat = f.stat()
            steps = meta.get("steps", [])
            flows.append({
                "id": name, "name": meta.get("display_name") or meta.get("name", name),
                "description": meta.get("description", ""),
                "startUrl": meta.get("start_url", ""),
                "steps": steps if isinstance(steps, list) else [],
                "params": flow_param_keys(meta),
                "status": meta.get("status", "raw"),
                "rawCode": meta.get("raw_code", ""),
                "polishedCode": meta.get("polished_code", ""),
                "activeVariant": meta.get("active_variant", "raw"),
                "createdAt": int(stat.st_ctime * 1000),
                "updatedAt": int(stat.st_mtime * 1000),
                "lastRun": meta.get("last_run")
            })
    except Exception as e:
        return {"success": False, "error": str(e), "flows": []}
    return {"success": True, "flows": flows, "actions": flows}


# ============ POKRETANJE ============

if __name__ == "__main__":
    import uvicorn

    print(f"""
╔════════════════════════════════════════════════════════╗
║          GeoTerra Agent Server v1.2                    ║
╠════════════════════════════════════════════════════════╣
║  Workspace:  {WORKSPACE_DIR:<42}║
║  Python:     {PYTHON_CMD:<42}║
║  API Key:    {(('***' + API_KEY[-4:]) if API_KEY else 'nije postavljen'):<42}║
║  Port:       {'8432':<42}║
╠════════════════════════════════════════════════════════╣
║  Za pristup s interneta koristi Cloudflare Tunnel.     ║
║  AGENT_SERVER_URL = https://agent.geoterrainfo.com     ║
║  AGENT_SERVER_DIR prati env varijablu ako je postavljena.║
╚════════════════════════════════════════════════════════╝
    """)

    ensure_workspace()
    ensure_flow_dirs()
    ensure_stellan_helpers()

    # Čisti stare temp fajlove pri pokretanju
    cleaned = 0
    for f in Path(WORKSPACE_DIR).glob("temp_*.py"):
        try:
            if (datetime.now().timestamp() - f.stat().st_mtime) > 3600:
                f.unlink()
                cleaned += 1
        except Exception:
            pass
    if cleaned:
        print(f"  Obrisano {cleaned} starih temp fajlova.")

    uvicorn.run(app, host="0.0.0.0", port=8432)
