"""
Exploração da página /producoes do Fácil123.
Baseado no scraper.py do Gestão Supren Veg.

Uso: python explore_producoes.py
"""

import asyncio
import os
import json
import sys
from pathlib import Path
from dotenv import load_dotenv
from playwright.async_api import async_playwright

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv(r"C:\Users\Ygor\Desktop\Projetos\Gestão Supren Veg\gestao-supren\claudio\.env")

FACIL123_URL   = "https://app.facil123.com.br"
FACIL123_EMAIL = os.environ["FACIL123_EMAIL"]
FACIL123_SENHA = os.environ["FACIL123_SENHA"]
PRODUCOES_URL  = f"{FACIL123_URL}/#/producoes"


async def login(page):
    print("→ Fazendo login...")
    await page.goto(f"{FACIL123_URL}/usuarios/entrar", wait_until="domcontentloaded", timeout=20000)
    await asyncio.sleep(2)
    await page.fill("input[type=email], input[name=email]", FACIL123_EMAIL)
    await page.fill("input[type=password]", FACIL123_SENHA)
    await page.click("input[type=submit], button[type=submit]")
    try:
        await page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass
    await asyncio.sleep(2)
    print(f"   URL após login: {page.url}")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page    = await browser.new_page()

        await login(page)

        print(f"\n→ Navegando para {PRODUCOES_URL} ...")
        await page.goto(PRODUCOES_URL, wait_until="domcontentloaded", timeout=15000)

        # Aguarda Angular renderizar — tenta até 10 vezes
        rows_found = 0
        for i in range(10):
            await asyncio.sleep(3)
            rows_found = await page.evaluate("""() => {
                return document.querySelectorAll('tr, [ng-repeat], .card, [class*="card"]').length;
            }""")
            print(f"   tentativa {i+1}: {rows_found} elementos encontrados")
            if rows_found > 3:
                break

        # ── Texto visível ────────────────────────────────────────────────────
        print("\n=== TEXTO VISÍVEL (primeiros 4000 chars) ===")
        text = await page.inner_text("body")
        print(text[:4000])

        # ── Estrutura da tabela / linhas ─────────────────────────────────────
        print("\n=== ANÁLISE DE SELETORES ===")
        analysis = await page.evaluate("""() => {
            const sels = [
                'tr[ng-repeat]', '[ng-repeat]', 'tbody tr',
                'table tr', '.card', '[class*="card-color"]',
                '[class*="producao"]', '[class*="production"]',
            ];
            const result = {};
            for (const sel of sels) {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) {
                    result[sel] = {
                        count: els.length,
                        sample: Array.from(els).slice(0, 2).map(e => ({
                            text: e.innerText?.trim().slice(0, 300),
                            html: e.outerHTML?.slice(0, 500),
                        }))
                    };
                }
            }
            return result;
        }""")
        print(json.dumps(analysis, indent=2, ensure_ascii=False))

        # ── Salva HTML completo ──────────────────────────────────────────────
        html = await page.inner_html("body")
        out_path = Path(__file__).parent / "producoes_result.html"
        out_path.write_text(html, encoding="utf-8")
        print(f"\nHTML salvo em: {out_path}")

        # ── Screenshot ───────────────────────────────────────────────────────
        ss_path = Path(__file__).parent / "producoes_result.png"
        await page.screenshot(path=str(ss_path), full_page=True)
        print(f"Screenshot salvo em: {ss_path}")

        await browser.close()
    print("\nConcluído.")


if __name__ == "__main__":
    asyncio.run(main())
