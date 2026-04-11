"""
stellan_helpers.py — Zajednicki utility za sve Stellan flowove.

Automatski se postavlja u WORKSPACE_DIR pri pokretanju agent servera.
Flowovi ga importaju s:  from stellan_helpers import download_popup_pdf

Svaki flow koji otvara popup s PDF-om moze koristiti:

    async with page.expect_popup() as popup_info:
        await page.click("...link koji otvara PDF...")
    popup = await popup_info.value
    saved = await download_popup_pdf(popup, "moj_dokument.pdf")
"""

import os
import base64
from pathlib import Path
from datetime import datetime
from typing import Optional


OUTPUT_DIR = os.environ.get("AGENT_WORKSPACE", os.getcwd())


async def _wait_for_popup_url(popup_page, timeout_ms: int = 20000) -> str:
    """Cekaj da popup URL prestane biti about:blank (redirect na pravi URL)."""
    interval = 500
    elapsed = 0
    while elapsed < timeout_ms:
        url = popup_page.url
        if url and url != "about:blank" and not url.startswith("about:"):
            print(f"[PDF] Popup URL spreman: {url[:120]}")
            return url
        await popup_page.wait_for_timeout(interval)
        elapsed += interval
    return popup_page.url


async def download_popup_pdf(
    popup_page,
    filename: Optional[str] = None,
    output_dir: Optional[str] = None,
    timeout: int = 20000,
) -> dict:
    """
    Genericka funkcija za preuzimanje PDF-a iz popup prozora.

    Pokusava strategije redom:
      A) Ceka pravi URL, skida PDF putem context.request (dijeli cookies s browserom)
      B) JS fetch iz browser konteksta (ima pristup svim cookies)
      C) Download button u Chrome PDF vieweru
      D) CDP Page.printToPDF fallback
      E) Screenshot fallback
    """
    out = output_dir or OUTPUT_DIR
    os.makedirs(out, exist_ok=True)

    # 1. Cekaj da popup URL bude pravi (ne about:blank)
    popup_url = await _wait_for_popup_url(popup_page, timeout)
    print(f"[PDF] Popup URL: {popup_url[:150]}")

    # 2. Cekaj da se stranica ucita
    try:
        await popup_page.wait_for_load_state("load", timeout=15000)
    except Exception:
        pass
    try:
        await popup_page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass
    # Dodatno cekanje za renderiranje
    await popup_page.wait_for_timeout(2000)

    # 3. Generiraj ime
    if not filename:
        title = "dokument"
        try:
            t = await popup_page.title()
            if t and len(t.strip()) > 2:
                title = t.strip()[:60].replace(" ", "_").replace("/", "-")
        except Exception:
            pass
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{title}_{ts}.pdf"
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    save_path = os.path.join(out, filename)

    # Refresh URL (mogao se promijeniti)
    popup_url = popup_page.url

    # -- Strategija A: Direktan PDF URL putem context.request --
    try:
        content_type = ""
        try:
            content_type = await popup_page.evaluate("document.contentType") or ""
        except Exception:
            pass

        is_pdf_url = (
            "pdf" in content_type.lower()
            or ".pdf" in popup_url.lower()
            or "report" in popup_url.lower()
            or "document" in popup_url.lower()
        )

        if is_pdf_url and popup_url and not popup_url.startswith("about:"):
            print(f"[PDF] Strategija A: context.request.get ({popup_url[:100]})")
            resp = await popup_page.context.request.get(popup_url)
            body = await resp.body()
            resp_ct = resp.headers.get("content-type", "")

            if body and len(body) > 500 and (body[:5] == b"%PDF-" or "pdf" in resp_ct.lower()):
                Path(save_path).write_bytes(body)
                size = len(body)
                print(f"[PDF] Spremljeno: {save_path} ({size / 1024:.1f} KB)")
                return {"success": True, "path": save_path, "size": size, "method": "direct_url", "error": None}
            else:
                print(f"[PDF] Strategija A: nije PDF (ct: {resp_ct}, size: {len(body) if body else 0}, header: {body[:20] if body else b''})")
    except Exception as e:
        print(f"[PDF] Strategija A neuspjesna: {e}")

    # -- Strategija B: JS fetch iz browser konteksta (ima sve cookies) --
    try:
        if popup_url and not popup_url.startswith("about:"):
            print(f"[PDF] Strategija B: JS fetch iz browsera")
            pdf_base64 = await popup_page.evaluate("""async (url) => {
                try {
                    const resp = await fetch(url, { credentials: 'include' });
                    const blob = await resp.blob();
                    if (blob.size < 500) return null;
                    return await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                } catch(e) { return null; }
            }""", popup_url)

            if pdf_base64:
                pdf_bytes = base64.b64decode(pdf_base64)
                if len(pdf_bytes) > 500 and pdf_bytes[:5] == b"%PDF-":
                    Path(save_path).write_bytes(pdf_bytes)
                    size = len(pdf_bytes)
                    print(f"[PDF] Spremljeno: {save_path} ({size / 1024:.1f} KB)")
                    return {"success": True, "path": save_path, "size": size, "method": "js_fetch", "error": None}
                else:
                    print(f"[PDF] Strategija B: nije validan PDF ({len(pdf_bytes)} bytes, header: {pdf_bytes[:20]})")
    except Exception as e:
        print(f"[PDF] Strategija B neuspjesna: {e}")

    # -- Strategija C: Download button u Chrome PDF vieweru --
    try:
        download_selectors = [
            'cr-icon-button#download',
            '#download',
            '[data-testid="download"]',
            'button[title="Download"]',
            'a[download]',
        ]
        for sel in download_selectors:
            try:
                btn = popup_page.locator(sel).first
                if await btn.is_visible(timeout=2000):
                    print(f"[PDF] Strategija C: download button ({sel})")
                    async with popup_page.expect_download(timeout=timeout) as dl_info:
                        await btn.click()
                    download = await dl_info.value
                    await download.save_as(save_path)
                    size = os.path.getsize(save_path)
                    if size > 500:
                        print(f"[PDF] Spremljeno: {save_path} ({size / 1024:.1f} KB)")
                        return {"success": True, "path": save_path, "size": size, "method": "download_button", "error": None}
            except Exception:
                continue
    except Exception as e:
        print(f"[PDF] Strategija C neuspjesna: {e}")

    # -- Strategija D: CDP printToPDF --
    try:
        print("[PDF] Strategija D: CDP Page.printToPDF")
        cdp = await popup_page.context.new_cdp_session(popup_page)
        result = await cdp.send("Page.printToPDF", {
            "printBackground": True,
            "preferCSSPageSize": True,
        })
        pdf_bytes = base64.b64decode(result["data"])
        if pdf_bytes and len(pdf_bytes) > 1000:
            Path(save_path).write_bytes(pdf_bytes)
            size = len(pdf_bytes)
            print(f"[PDF] Spremljeno (CDP): {save_path} ({size / 1024:.1f} KB)")
            return {"success": True, "path": save_path, "size": size, "method": "cdp_print", "error": None}
        else:
            print(f"[PDF] CDP vratio prazan PDF ({len(pdf_bytes)} bytes)")
    except Exception as e:
        print(f"[PDF] Strategija D neuspjesna: {e}")

    # -- Strategija E: Screenshot fallback --
    try:
        ss_path = save_path.replace(".pdf", ".png")
        await popup_page.screenshot(path=ss_path, full_page=True)
        size = os.path.getsize(ss_path)
        print(f"[PDF] Screenshot fallback: {ss_path} ({size / 1024:.1f} KB)")
        return {"success": False, "path": ss_path, "size": size, "method": "screenshot_fallback",
                "error": "PDF download nije uspio nijednom metodom, spremljen screenshot"}
    except Exception as e2:
        return {"success": False, "path": None, "size": 0, "method": "none", "error": str(e2)}


async def download_from_click(
    page,
    click_action,
    filename: Optional[str] = None,
    output_dir: Optional[str] = None,
    timeout: int = 15000,
) -> dict:
    """
    Genericka funkcija za download koji se trigera klikom (ne popup nego direktan download).
    Koristi se za SDGE dostavnice, izvjestaje i sl.

    Primjer:
        result = await download_from_click(
            page,
            lambda: page.get_by_role("button", name="Preuzmi dostavnicu").click(),
            filename="dostavnica_3_2026.pdf"
        )
    """
    out = output_dir or OUTPUT_DIR
    os.makedirs(out, exist_ok=True)

    try:
        async with page.expect_download(timeout=timeout) as dl_info:
            await click_action()
        download = await dl_info.value

        suggested = download.suggested_filename or "download"
        final_name = filename or suggested
        save_path = os.path.join(out, final_name)

        await download.save_as(save_path)
        size = os.path.getsize(save_path)
        print(f"[DOWNLOAD] Spremljeno: {save_path} ({size / 1024:.1f} KB)")
        return {"success": True, "path": save_path, "size": size, "suggested_filename": suggested, "error": None}
    except Exception as e:
        print(f"[DOWNLOAD] Greska: {e}")
        return {"success": False, "path": None, "size": 0, "suggested_filename": None, "error": str(e)}


async def wait_and_screenshot(page, name: str = "screenshot.png", output_dir: Optional[str] = None) -> str:
    """Helper: cekaj networkidle pa snimi screenshot. Vraca putanju."""
    out = output_dir or OUTPUT_DIR
    path = os.path.join(out, name)
    try:
        await page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        try:
            await page.wait_for_load_state("load", timeout=5000)
        except Exception:
            pass
    await page.screenshot(path=path, full_page=False)
    print(f"[SCREENSHOT] {path}")
    return path
