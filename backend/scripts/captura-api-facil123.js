/**
 * Captura as queries GraphQL do Fácil123 (login + produções).
 * Roda LOCALMENTE. Uso: node scripts/captura-api-facil123.js
 */

require('dotenv').config();
const { chromium } = require('playwright');

const EMAIL = process.env.FACIL123_EMAIL;
const SENHA = process.env.FACIL123_SENHA;

if (!EMAIL || !SENHA) {
  console.error('Defina FACIL123_EMAIL e FACIL123_SENHA no .env');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Intercepta TODOS os requests do domínio facil123 para achar o login
  page.on('request', req => {
    const url = req.url();
    if (!url.includes('facil123.com.br')) return;
    if (url.includes('.js') || url.includes('.css') || url.includes('.png') || url.includes('.ico')) return;
    const method = req.method();
    if (method === 'GET') return;
    const body = req.postData();
    console.log(`\n>>> ${method} ${url.replace('https://app.facil123.com.br','')} — body: ${(body||'').slice(0,200)}`);
  });

  // Intercepta requests GraphQL e loga body + response
  await page.route('**/graphql', async (route) => {
    const req = route.request();
    const body = req.postDataJSON();
    console.log('\n─── GRAPHQL REQUEST ───────────────────────');
    console.log('Operation:', body?.operationName ?? '(sem nome)');
    console.log('Query:', (body?.query ?? '').slice(0, 300));
    if (body?.variables) console.log('Variables:', JSON.stringify(body.variables));

    const resp = await route.fetch();
    const json = await resp.json().catch(() => null);
    if (json) {
      const txt = JSON.stringify(json).slice(0, 500);
      console.log('Response:', txt);
    }
    route.fulfill({ response: resp });
  });

  // Limpa cookies para forçar login do zero
  await page.context().clearCookies();

  console.log('Abrindo Fácil123...');
  await page.goto('https://app.facil123.com.br/usuarios/entrar', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('Fazendo login...');
  await page.fill('input[type=email], input[name=email]', EMAIL);
  await page.fill('input[type=password]', SENHA);
  await page.click('input[type=submit], button[type=submit]');
  await page.waitForTimeout(5000);

  console.log('Abrindo produções...');
  await page.goto('https://app.facil123.com.br/#/producoes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  console.log('\n─── FIM DA CAPTURA ───────────────────────');
  await browser.close();
})();
