/**
 * migrate.js
 * Importa RELATÓRIO OPERACIONAL.xlsx para o banco SQLite (node:sqlite nativo).
 * Aplica todas as regras de normalização do de_para.json.
 * Idempotente: limpa e reimporta a cada execução.
 */

const path = require('path');
const fs   = require('fs');
const ExcelJS = require('exceljs');
const db = require('../src/db/database');

const EXCEL_PATH = path.join(__dirname, '..', '..', '..', 'RELATÓRIO OPERACIONAL atualizado.xlsx');
const DEPA_PATH  = path.join(__dirname, '..', '..', '..', 'normalization', 'de_para.json');

const depa = JSON.parse(fs.readFileSync(DEPA_PATH, 'utf-8'));
const ETAPA_MAP   = depa.etapas;
const PRODUTO_MAP = Object.fromEntries(
  Object.entries(depa.produtos).filter(([k]) => !k.startsWith('_'))
);
const LEGACY_STAGES = new Set(depa.etapas._legado.etapas);

// ─── helpers ─────────────────────────────────────────────────
function norm(val) {
  return val == null ? null : String(val).trim();
}

// Resolve células com fórmula compartilhada: { formula, result } → result
function resolveCell(val) {
  if (val == null) return null;
  if (typeof val === 'object' && !(val instanceof Date) && 'result' in val) {
    return val.result;
  }
  return val;
}

function toISO(raw) {
  const val = resolveCell(raw);
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d) ? null : d.toISOString();
  }
  return null;
}
function toDateOnly(raw) {
  const iso = toISO(raw);
  return iso ? iso.slice(0, 10) : null;
}
function diffMinutes(a, b) {
  if (!a || !b) return null;
  const s = a instanceof Date ? a : new Date(a);
  const e = b instanceof Date ? b : new Date(b);
  return Math.round((e - s) / 60000 * 10) / 10;
}
function normStage(raw)   { const r = norm(raw); if (!r) return null; return ETAPA_MAP[r]   || r; }
function normProduct(raw) { const r = norm(raw); if (!r) return null; return PRODUTO_MAP[r] || r; }

// ─── prepared statements ─────────────────────────────────────
const insertOperator  = db.prepare(`INSERT INTO operators (name) VALUES (?) ON CONFLICT(name) DO NOTHING`);
const getOperator     = db.prepare(`SELECT id FROM operators WHERE name = ?`);
const insertProduct   = db.prepare(`INSERT INTO products (name, unit) VALUES (?, ?) ON CONFLICT(name) DO NOTHING`);
const getProduct      = db.prepare(`SELECT id FROM products WHERE name = ?`);
const insertStage     = db.prepare(`INSERT INTO stages (name, is_legacy, legacy_note) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING`);
const getStage        = db.prepare(`SELECT id FROM stages WHERE name = ?`);
const insertOrder     = db.prepare(`
  INSERT INTO production_orders
    (product_id, operator_id, production_date, status, planned_qty, produced_qty, notes, source_sheet)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertStep      = db.prepare(`
  INSERT INTO production_steps
    (order_id, stage_id, status, started_at, finished_at, gross_time_minutes, net_time_minutes, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertPause     = db.prepare(`
  INSERT INTO production_pauses (step_id, pause_index, paused_at, resumed_at, duration_minutes)
  VALUES (?, ?, ?, ?, ?)
`);

function orderKey(sheetName, productName, dateOnly, operatorId) {
  return `${sheetName}||${productName}||${dateOnly}||${operatorId}`;
}

async function run() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);

  const SHEETS = [
    { name: 'BASE DE DADOS', operatorName: 'Base de Dados' },
    { name: 'LUCAS',         operatorName: 'Lucas'         },
  ];

  // Salva dados de autenticação dos operadores antes de limpar
  const savedAuth = db.prepare(
    'SELECT name, email, password_hash, password_change_required, role FROM operators WHERE password_hash IS NOT NULL'
  ).all();

  // Limpa dados anteriores (mantém estrutura)
  db.exec(`
    DELETE FROM production_pauses;
    DELETE FROM production_steps;
    DELETE FROM production_orders;
    DELETE FROM stages;
    DELETE FROM products;
    DELETE FROM operators;
  `);

  // Pre-seed operadores
  for (const { operatorName } of SHEETS) {
    insertOperator.run(operatorName);
  }

  // Restaura senhas e roles dos operadores existentes
  // Se o operador não está nas abas do Excel, recria-o (ex.: Ygor)
  const restoreUpd = db.prepare(`
    UPDATE operators SET email = ?, password_hash = ?, password_change_required = ?, role = ?
    WHERE name = ?
  `);
  const restoreIns = db.prepare(`
    INSERT INTO operators (name, email, password_hash, password_change_required, role)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const op of savedAuth) {
    const r = restoreUpd.run(op.email, op.password_hash, op.password_change_required, op.role, op.name);
    if (r.changes === 0) {
      restoreIns.run(op.name, op.email, op.password_hash, op.password_change_required, op.role);
    }
  }
  if (savedAuth.length > 0) {
    console.log(`  ↺ ${savedAuth.length} operador(es) com senha restaurado(s).`);
  }

  db.exec('BEGIN');
  try {
    let totalOrders = 0, totalSteps = 0, totalPauses = 0;

    for (const { name: sheetName, operatorName } of SHEETS) {
      const ws = workbook.getWorksheet(sheetName);
      if (!ws) { console.warn(`Aba "${sheetName}" não encontrada.`); continue; }

      const operatorId  = getOperator.get(operatorName)?.id;
      const orderCache  = new Map();

      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;

        const rawProduct = row.getCell(1).value;
        if (!rawProduct) return;

        // Pula linhas sem data de produção (linhas de cabeçalho repetidas ou inválidas)
        const rawDate = row.getCell(3).value;
        if (!rawDate) return;

        // Produto
        const productName = normProduct(rawProduct);
        const unit = /\(KG\)|\bKG\b/i.test(productName) ? 'KG'
                   : /\(UND\)|\bUND\b/i.test(productName) ? 'UND' : 'KG';
        insertProduct.run(productName, unit);
        const productId = getProduct.get(productName).id;

        // Campos da linha
        const status      = norm(row.getCell(2).value) || 'Concluído';
        const prodDate    = toDateOnly(row.getCell(3).value);
        const rawStage    = row.getCell(4).value;
        const startedAt   = toISO(row.getCell(5).value);
        const pause1At    = toISO(row.getCell(6).value);
        const resume1At   = toISO(row.getCell(7).value);
        const pause2At    = toISO(row.getCell(8).value);
        const resume2At   = toISO(row.getCell(9).value);
        const pause3At    = toISO(row.getCell(10).value);
        const resume3At   = toISO(row.getCell(11).value);
        const finishedAt  = toISO(row.getCell(12).value);
        const plannedQty  = row.getCell(13).value ?? null;
        const producedQty = row.getCell(14).value ?? null;
        const netTimeMins = row.getCell(15).value ?? null;
        const obs         = norm(row.getCell(16).value);

        // Etapa
        const stageName  = normStage(rawStage);
        const isLegacy   = LEGACY_STAGES.has(stageName) ? 1 : 0;
        const legacyNote = isLegacy ? 'Dados históricos sem desmembramento por etapa' : null;
        insertStage.run(stageName, isLegacy, legacyNote);
        const stageId = getStage.get(stageName).id;

        // Ordem de Produção (1 por produto+dia)
        const key = orderKey(sheetName, productName, prodDate, operatorId);
        let orderId = orderCache.get(key);
        if (!orderId) {
          const r = insertOrder.run(productId, operatorId ?? null, prodDate,
                                    status, plannedQty, producedQty, obs, sheetName);
          orderId = Number(r.lastInsertRowid);
          orderCache.set(key, orderId);
          totalOrders++;
        }

        // Step
        const grossTime = diffMinutes(startedAt, finishedAt);
        const pauses = [
          { at: pause1At, resume: resume1At, idx: 1 },
          { at: pause2At, resume: resume2At, idx: 2 },
          { at: pause3At, resume: resume3At, idx: 3 },
        ].filter(p => p.at);

        let totalPauseMin = 0;
        for (const p of pauses) {
          const d = diffMinutes(p.at, p.resume);
          if (d) totalPauseMin += d;
        }

        const netTime = netTimeMins ?? (grossTime != null ? grossTime - totalPauseMin : null);

        const stepResult = insertStep.run(
          orderId, stageId, status, startedAt, finishedAt, grossTime, netTime, obs
        );
        const stepId = Number(stepResult.lastInsertRowid);
        totalSteps++;

        // Pausas
        for (const p of pauses) {
          const dur = diffMinutes(p.at, p.resume);
          insertPause.run(stepId, p.idx, p.at, p.resume ?? null, dur);
          totalPauses++;
        }
      });

      console.log(`  ✓ ${sheetName}: ${orderCache.size} ordens processadas`);
    }

    db.exec('COMMIT');
    console.log('\n=== Migração concluída ===');
    console.log(`  Ordens  : ${totalOrders}`);
    console.log(`  Steps   : ${totalSteps}`);
    console.log(`  Pausas  : ${totalPauses}`);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

run().catch(err => { console.error(err); process.exit(1); });
