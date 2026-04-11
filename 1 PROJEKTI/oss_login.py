import asyncio
import os
import re
from playwright.async_api import Playwright, async_playwright, expect
from stellan_helpers import download_popup_pdf

OSS_USERNAME = os.environ.get("OSS_USERNAME", "")
OSS_PASSWORD = os.environ.get("OSS_PASSWORD", "")


async def run(playwright: Playwright) -> None:
    if not OSS_USERNAME or not OSS_PASSWORD:
        raise RuntimeError("OSS_USERNAME i OSS_PASSWORD nisu postavljeni.")

    browser = await playwright.chromium.launch(headless=False)
    context = await browser.new_context(accept_downloads=True)
    page = await context.new_page()
    await page.goto("https://oss.uredjenazemlja.hr/", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    await page.get_by_role("button", name="Prijava").click()
    await page.get_by_role("button", name="Poslovni korisnici").click()
    await page.get_by_role("button", name="Prihvati").click()
    await page.get_by_role("textbox", name="Korisničko ime").click()
    await page.get_by_role("textbox", name="Korisničko ime").fill(OSS_USERNAME)
    await page.get_by_role("textbox", name="Lozinka").click()
    await page.get_by_role("textbox", name="Lozinka").fill(OSS_PASSWORD)
    await page.get_by_role("button", name="Prijava").click()
    await page.get_by_text("Početna stranica").click()
    await page.get_by_text("Pronađi katastarsku česticu").click()
    await page.get_by_text("Katastarska općina").click()
    await page.get_by_role("combobox", name="Katastarska općina").fill("TREŠNJEVKA NOVA")
    await page.get_by_text("TREŠNJEVKA NOVA, GU ZAGREB").click()
    await page.get_by_text("Broj kat. čestice").click()
    await page.get_by_role("combobox", name="Broj kat. čestice").fill("2707")
    await page.get_by_text("2707").click()
    await page.get_by_role("button", name="Pregledaj").click()
    await page.get_by_text("Neslužbena javna isprava").click()
    async with page.expect_popup() as page1_info:
        await page.get_by_label("Neslužbena javna isprava").get_by_text("Posjedovni list / BZP").click()
    page1 = await page1_info.value

    pdf_result = await download_popup_pdf(page1)
    if pdf_result['success']:
        print(f"PDF spremljen: {pdf_result['path']} ({pdf_result['size'] / 1024:.1f} KB)")
    else:
        print(f"PDF download neuspješan: {pdf_result.get('error', 'nepoznato')}")
    await page1.close()
    # ---------------------
    await context.close()
    await browser.close()


async def main() -> None:
    async with async_playwright() as playwright:
        await run(playwright)


asyncio.run(main())