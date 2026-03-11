// Usa o módulo SQLite nativo do Node.js (disponível a partir do Node 22.5+)
// Não requer compilação de módulos nativos.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const SEED_DB     = path.join(__dirname, '..', '..', 'data', 'mes.db');
const DB_PATH     = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : SEED_DB;
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Na primeira execução com volume externo, copia o banco local como ponto de partida
if (process.env.DB_PATH && !fs.existsSync(DB_PATH) && fs.existsSync(SEED_DB)) {
  fs.copyFileSync(SEED_DB, DB_PATH);
  console.log('Banco de dados iniciado a partir da cópia local.');
}

const db = new DatabaseSync(DB_PATH);

// Aplica o schema (idempotente via CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schema);

// Migração de auth — idempotente
const authCols = [
  "ALTER TABLE operators ADD COLUMN email TEXT",
  "ALTER TABLE operators ADD COLUMN password_hash TEXT",
  "ALTER TABLE operators ADD COLUMN password_change_required INTEGER DEFAULT 1",
];
for (const sql of authCols) {
  try { db.exec(sql); } catch (_) { /* coluna já existe */ }
}

// Migração de role — idempotente
try { db.exec("ALTER TABLE operators ADD COLUMN role TEXT DEFAULT 'user'"); } catch (_) {}
db.prepare("UPDATE operators SET role = 'admin' WHERE name = 'Ygor' AND (role IS NULL OR role != 'admin')").run();

// Migração de metas — idempotente
db.exec(`
  CREATE TABLE IF NOT EXISTS stage_targets (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id       INTEGER NOT NULL REFERENCES stages(id),
    target_minutes REAL    NOT NULL,
    created_at     TEXT    DEFAULT (datetime('now')),
    UNIQUE(stage_id)
  )
`);

// Migração de normalização de nomes — idempotente
// Corrige bancos existentes que não passaram pelos scripts normalize*.js
try {
  db.exec('PRAGMA foreign_keys = OFF');

  // Mescla oldName → canonicalName.
  // Se canonicalName não existir no banco, renomeia oldName para se tornar o canônico.
  function mergeStage(oldName, canonicalName) {
    const old = db.prepare("SELECT id FROM stages WHERE name = ?").get(oldName);
    if (!old) return;
    let canonical = db.prepare("SELECT id FROM stages WHERE name = ?").get(canonicalName);
    if (!canonical) {
      db.prepare("UPDATE stages SET name = ? WHERE id = ?").run(canonicalName, old.id);
      console.log(`[migração] etapa renomeada: "${oldName}" → "${canonicalName}"`);
      return;
    }
    if (old.id === canonical.id) return;
    db.prepare("UPDATE production_steps SET stage_id = ? WHERE stage_id = ?").run(canonical.id, old.id);
    db.prepare("DELETE FROM stages WHERE id = ?").run(old.id);
    console.log(`[migração] etapa mesclada: "${oldName}" → "${canonicalName}"`);
  }

  // ─── Etapas: consolidações ──────────────────────────────────────────────
  // IMPORTANTE: a primeira entrada de cada grupo canônico deve vir primeiro,
  // pois se o canônico não existir ela é renomeada para criá-lo.
  const stageMerges = [
    ['ARMAZENAGEM',          'EMBALAGEM'],
    ['SELAR',                'EMBALAGEM'],
    ['DATAR',                'EMBALAGEM'],
    ['PROCESSAR THERMOMIX',  'PROCESSAR'],  // cria PROCESSAR se não existir
    ['BATER',                'PROCESSAR'],
    ['BATER AMÊNDOAS',       'PROCESSAR'],
    ['BATER AMENDOAS',       'PROCESSAR'],
    ['FERVER AMÊNDOAS',      'PROCESSAR'],
    ['FERVER AMENDOAS',      'PROCESSAR'],
    ['LIQUIDIFICAR',         'PROCESSAR'],
    ['MISTURAR MASSA',       'HOMOGENEIZAR'],
    ['CONTAR FORMINHAS',     'SEPARAR INSUMOS'],
    ['PESAR INSUMOS',        'SEPARAR INSUMOS'],
    ['PESAR',                'SEPARAR INSUMOS'],
    ['PESAR ÁGUA',           'SEPARAR INSUMOS'],
    ['PESAR AGUA',           'SEPARAR INSUMOS'],
    ['PESAR AMÊNDOAS',       'SEPARAR INSUMOS'],
    ['PESAR AMENDOAS',       'SEPARAR INSUMOS'],
    ['INICIO',               'SEPARAR INSUMOS'],
    ['POR MOLHO NA BANDEJA', 'MONTAGEM'],
    ['POR MOLHO NA BANDEIJA','MONTAGEM'],
    ['FECHAR EMPADA',        'TAMPAR'],
    ['HIGIENIZAR BERINJELA', 'HIGIENIZAR'],  // cria HIGIENIZAR se não existir
    ['HIGIENIZAR BERINGELA', 'HIGIENIZAR'],
    ['LAVAR',                'HIGIENIZAR'],
    ['LAVAGEM (MÁQUINA)',    'HIGIENIZAR'],
    ['LAVAGEM(MAQUINA)',     'HIGIENIZAR'],
  ];

  for (const [oldName, canonicalName] of stageMerges) {
    mergeStage(oldName, canonicalName);
  }

  // ─── Produto: CREME DE LEITE DE AMÊNDOAS → CREME DE LEITE ──────────────
  // Busca o canônico por qualquer variante (casing, com ou sem unidade)
  const cremeLeiteCanonicos = [
    'Creme de Leite', 'CREME DE LEITE', 'CREME DE LEITE (KG)', 'Creme de Leite (KG)',
  ];
  const cremeLeiteAntigos = [
    'CREME DE LEITE DE AMÊNDOAS (KG)', 'Creme de Leite de Amêndoas (KG)',
    'CREME DE LEITE DE AMÊNDOAS',      'Creme de Leite de Amêndoas',
    'CREME DE LEITE DE AMENDOAS (KG)', 'Creme de Leite de Amendoas (KG)',
    'CREME DE LEITE DE AMENDOAS',      'Creme de Leite de Amendoas',
  ];

  let cremeLeiteId = null;
  for (const name of cremeLeiteCanonicos) {
    const row = db.prepare("SELECT id FROM products WHERE name = ?").get(name);
    if (row) { cremeLeiteId = row.id; break; }
  }

  if (cremeLeiteId) {
    for (const name of cremeLeiteAntigos) {
      const old = db.prepare("SELECT id FROM products WHERE name = ?").get(name);
      if (old && old.id !== cremeLeiteId) {
        db.prepare("UPDATE production_orders SET product_id = ? WHERE product_id = ?").run(cremeLeiteId, old.id);
        db.prepare("DELETE FROM products WHERE id = ?").run(old.id);
        console.log(`[migração] produto mesclado: "${name}" → Creme de Leite`);
      }
    }
  }

  db.exec('PRAGMA foreign_keys = ON');
} catch (e) {
  console.error('[migração] Erro nas migrations de normalização:', e.message);
  try { db.exec('PRAGMA foreign_keys = ON'); } catch (_) {}
}

module.exports = db;
