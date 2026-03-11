"""
Script de exploração: Fácil123 — /producoes
Objetivo: descobrir a estrutura de dados da página de produções.

Requisitos:
  pip install playwright
  playwright install chromium

Uso:
  python explore_facil123.py
"""

import asyncio
import os
import json
from dotenv import load_dotenv
from playwright.async_api import async_playwright

# Carrega credenciais do .env (mesmo arquivo do Gestão Supren Veg)
load_dotenv(r"C:\Users\Ygor\Desktop\Projetos\Gestão Supren Veg\gestao-supren\claudio\.env")

FACIL123_URL   = "https://app.facil123.com.br"
FACIL123_EMAIL = os.getenv("FACIL123_EMAIL")
FACIL123_SENHA = os.getenv("FACIL123_SENHA")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # headless=False para visualizar
        page    = await browser.new_page()

        # ── Login ──────────────────────────────────────────────────────────
        print("Fazendo login...")
        await page.goto(f"{FACIL123_URL}/usuarios/entrar")
        await page.wait_for_load_state("networkidle")

        await page.fill("input[type=email]",    FACIL123_EMAIL)
        await page.fill("input[type=password]", FACIL123_SENHA)
        await page.click("input[type=submit]")
        await page.wait_for_load_state("networkidle")
        print("Login OK.")

        # ── Navegar para /producoes ────────────────────────────────────────
        print("Navegando para /producoes...")
        await page.goto(f"{FACIL123_URL}/#/producoes")
        await page.wait_for_timeout(5000)  # aguarda renderização AngularJS

        # ── Capturar texto visível ─────────────────────────────────────────
        print("\n=== TEXTO VISÍVEL NA PÁGINA ===")
        text = await page.inner_text("body")
        print(text[:3000])

        # ── Capturar estrutura de cards/linhas ────────────────────────────
        print("\n=== ESTRUTURA HTML (primeiros elementos relevantes) ===")
        html = await page.inner_html("body")

        # Salva HTML completo para análise
        with open("producoes_page.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("HTML salvo em producoes_page.html")

        # ── Tentar extrair dados via JavaScript ───────────────────────────
        print("\n=== TENTANDO EXTRAIR DADOS VIA JS ===")

        # Tenta encontrar cards, linhas de tabela, etc.
        items = await page.evaluate("""() => {
            // Tenta vários seletores comuns no Fácil123
            const selectors = [
                'tr[ng-repeat]',
                'div[ng-repeat]',
                '[ng-repeat]',
                'table tbody tr',
                '.card',
                '[class*="card"]',
                '[class*="list-item"]',
                '[class*="producao"]',
            ];

            for (const sel of selectors) {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) {
                    return {
                        selector: sel,
                        count: els.length,
                        sample: Array.from(els).slice(0, 3).map(el => ({
                            text: el.innerText?.trim().slice(0, 200),
                            attrs: Object.fromEntries(
                                Array.from(el.attributes).map(a => [a.name, a.value])
                            ),
                        }))
                    };
                }
            }
            return { error: 'Nenhum seletor funcionou' };
        }""")

        print(json.dumps(items, indent=2, ensure_ascii=False))

        # ── Screenshot ────────────────────────────────────────────────────
        await page.screenshot(path="producoes_screenshot.png", full_page=True)
        print("\nScreenshot salvo em producoes_screenshot.png")

        input("\nPressione Enter para fechar o browser...")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
