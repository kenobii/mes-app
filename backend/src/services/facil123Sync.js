/**
 * Sincronização com Fácil123 — módulo de produção (/producoes)
 *
 * Estratégia:
 *  - Scraping via Playwright (tabela HTML, sem API REST disponível)
 *  - Upsert: novas ordens → INSERT como "Pendente"; existentes → UPDATE planned_qty/date
 *  - Status no MES é gerenciado pelos operadores — nunca sobrescrito pelo sync
 *  - Só importa ordens a partir de IMPORT_FROM_DATE (05/03/2026)
 */

const { chromium } = require('playwright');
const db = require('../db/database');

const FACIL123_URL  = 'https://app.facil123.com.br';
const LOGIN_URL     = `${FACIL123_URL}/usuarios/entrar`;
const PRODUCOES_URL = `${FACIL123_URL}/#/producoes`;

// Data de corte: só importa ordens a partir desta data
const IMPORT_FROM_DATE = '2026-03-05';

// Chromium: usa variável de ambiente (Railway/Nixpacks) ou deixa Playwright encontrar o próprio
function getChromiumPath() {
  if (process.env.CHROMIUM_EXECUTABLE_PATH) return process.env.CHROMIUM_EXECUTABLE_PATH;
  // Em Linux/Nixpacks, tenta encontrar chromium no PATH
  if (process.platform !== 'win32') {
    try {
      const { execSync } = require('child_process');
      const found = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || echo ""')
        .toString().trim();
      if (found) return found;
    } catch (_) {}
  }
  return undefined; // Playwright usa o próprio Chromium baixado
}

// ── Normalização de nomes para matching ────────────────────────────────────────
function normName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\s*\(?\s*\d+\s*kg\s*\)?\s*/gi, '')   // remove qtd+kg: "(1,2KG)", "1,2KG"
    .replace(/\s+em\s+kg/gi, '')
    .replace(/\s+kg\b/gi, '')
    .replace(/\s*\(?\s*und\s*\)?\s*/gi, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Parse da data no formato dd/mm/yyyy ────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;  // yyyy-mm-dd
}

// ── Parse da quantidade (pt-BR: "9,00" → 9.0) ─────────────────────────────────
function parseQty(str) {
  if (!str) return null;
  const n = parseFloat(str.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ── Cria ou obtém o log de sync ────────────────────────────────────────────────
function createLog() {
  const r = db.prepare(`INSERT INTO sync_logs (started_at) VALUES (datetime('now'))`).run();
  return r.lastInsertRowid;
}

function finishLog(id, stats) {
  db.prepare(`
    UPDATE sync_logs SET finished_at = datetime('now'), status = ?, imported = ?, updated = ?, skipped = ?, errors = ?, message = ?
    WHERE id = ?
  `).run(stats.errors > 0 ? 'partial' : 'ok', stats.imported, stats.updated, stats.skipped, stats.errors, stats.message || null, id);
}

// Mapeamento explícito: nome normalizado Fácil123 → nome normalizado MES
// Usado quando o nome no Fácil123 difere do MES mas é o mesmo produto
const EXPLICIT_MAP = {
  'quibe':          'quibe vegano',        // QUIBE KG → Quibe Vegano
  'empada de palmito g': 'empada de palmito m', // (G) e (M) = mesma
};

// ── Mapa de produtos do MES (para lookup por nome) ────────────────────────────
function buildProductMap() {
  const products = db.prepare('SELECT id, name FROM products WHERE 1=1').all();
  const map = new Map();
  for (const p of products) {
    map.set(normName(p.name), p.id);
  }
  return map;
}

// Resolve product_id: tenta mapa, mapeamento explícito, ou cria novo produto
function resolveProductId(facil123Name, productMap) {
  const norm = normName(facil123Name);

  // 1. Match direto
  if (productMap.has(norm)) return productMap.get(norm);

  // 2. Mapeamento explícito
  const mapped = EXPLICIT_MAP[norm];
  if (mapped && productMap.has(mapped)) return productMap.get(mapped);

  // 3. Cria novo produto automaticamente (Title Case, unidade KG por padrão)
  const LOWER_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'no', 'na', 'com', 'por', 'para', 'sem']);
  const newName = facil123Name
    .toLowerCase()
    .replace(/\s+(em\s+)?kg\b/gi, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (!w ? w : (i === 0 || !LOWER_WORDS.has(w)) ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

  const existing = db.prepare('SELECT id FROM products WHERE name = ?').get(newName);
  if (existing) {
    productMap.set(norm, existing.id);
    return existing.id;
  }

  const r = db.prepare('INSERT INTO products (name, unit) VALUES (?, ?)').run(newName, 'KG');
  console.log(`[sync] Produto criado: "${newName}" (KG)`);
  productMap.set(norm, r.lastInsertRowid);
  return r.lastInsertRowid;
}

// ── Playwright: login + scraping ──────────────────────────────────────────────
async function scrapeProducoes() {
  const executablePath = getChromiumPath();
  const browser = await chromium.launch({
    executablePath: executablePath || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();

    // Login
    console.log('[sync] Fazendo login no Fácil123...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.fill('input[type=email], input[name=email]', process.env.FACIL123_EMAIL);
    await page.fill('input[type=password]', process.env.FACIL123_SENHA);
    await page.click('input[type=submit], button[type=submit]');
    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch (_) {}
    await page.waitForTimeout(2000);
    console.log(`[sync] URL após login: ${page.url()}`);

    // Navega para produções
    console.log('[sync] Abrindo /producoes...');
    await page.goto(PRODUCOES_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Aguarda tabela carregar
    let rowCount = 0;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(3000);
      rowCount = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
      console.log(`[sync] tentativa ${i + 1}: ${rowCount} linhas`);
      if (rowCount > 0) break;
    }

    if (rowCount === 0) {
      throw new Error('Nenhuma linha encontrada na tabela de produções.');
    }

    // Clica em "Carregar mais" até não haver mais
    let loadMoreClicks = 0;
    while (true) {
      const loadMoreBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        const btn  = btns.find(b => b.innerText?.trim().toLowerCase().includes('carregar mais'));
        return btn ? true : false;
      });
      if (!loadMoreBtn) break;
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        const btn  = btns.find(b => b.innerText?.trim().toLowerCase().includes('carregar mais'));
        if (btn) btn.click();
      });
      await page.waitForTimeout(3000);
      loadMoreClicks++;
      if (loadMoreClicks > 20) break; // limite de segurança
    }

    // Extrai todas as linhas
    const rows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('tbody tr')).map(tr => {
        const cells = tr.querySelectorAll('td');
        const checkbox = tr.querySelector('[id^="check-"]');
        const externalId = checkbox ? checkbox.id.replace('check-', '') : null;
        return {
          externalId,
          productionDate: cells[2]?.innerText?.trim() || null,
          productName:    cells[3]?.innerText?.trim() || null,
          plannedQty:     cells[4]?.innerText?.trim() || null,
          facil123Status: cells[5]?.innerText?.trim() || null,
        };
      });
    });

    console.log(`[sync] Total de linhas extraídas: ${rows.length}`);
    return rows;

  } finally {
    await browser.close();
  }
}

// ── Sync principal ─────────────────────────────────────────────────────────────
async function runSync() {
  const logId = createLog();
  const stats = { imported: 0, updated: 0, skipped: 0, errors: 0, message: null };

  console.log(`[sync] Iniciando sync Fácil123 (log #${logId})...`);

  try {
    const rows = await scrapeProducoes();
    const productMap = buildProductMap();

    const stmtFind   = db.prepare('SELECT id, planned_qty, production_date FROM production_orders WHERE external_id = ?');
    const stmtInsert = db.prepare(`
      INSERT INTO production_orders (product_id, operator_id, production_date, status, planned_qty, external_id, source_sheet)
      VALUES (?, NULL, ?, 'Pendente', ?, ?, 'facil123')
    `);
    const stmtUpdate = db.prepare(`
      UPDATE production_orders SET planned_qty = ?, production_date = ?, updated_at = datetime('now')
      WHERE external_id = ?
    `);

    for (const row of rows) {
      try {
        if (!row.externalId || !row.productName) { stats.skipped++; continue; }

        const productionDate = parseDate(row.productionDate);
        if (!productionDate || productionDate < IMPORT_FROM_DATE) { stats.skipped++; continue; }

        const plannedQty = parseQty(row.plannedQty);
        const productId  = resolveProductId(row.productName, productMap);

        if (!productId) {
          console.warn(`[sync] Produto não resolvido: "${row.productName}"`);
          stats.errors++;
          continue;
        }

        const existing = stmtFind.get(row.externalId);
        if (existing) {
          // Atualiza apenas qty e data — nunca o status
          stmtUpdate.run(plannedQty, productionDate, row.externalId);
          stats.updated++;
        } else {
          stmtInsert.run(productId, productionDate, plannedQty, row.externalId);
          stats.imported++;
        }
      } catch (e) {
        console.error(`[sync] Erro na linha ${row.externalId}:`, e.message);
        stats.errors++;
      }
    }

    stats.message = `Total extraído: ${rows.length}`;
    console.log(`[sync] Concluído — importados: ${stats.imported}, atualizados: ${stats.updated}, ignorados: ${stats.skipped}, erros: ${stats.errors}`);

  } catch (e) {
    stats.errors++;
    stats.message = e.message;
    console.error('[sync] Erro geral:', e.message);
  }

  finishLog(logId, stats);
  return stats;
}

// ── Último sync ────────────────────────────────────────────────────────────────
function getLastSync() {
  return db.prepare(`
    SELECT id, started_at, finished_at, status, imported, updated, skipped, errors, message
    FROM sync_logs ORDER BY id DESC LIMIT 1
  `).get() || null;
}

module.exports = { runSync, getLastSync };
