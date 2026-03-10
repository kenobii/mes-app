const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'mes.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

// ══════════════════════════════════════════════
// PRODUTO — CREME DE LEITE DE AMÊNDOAS → CREME DE LEITE
// ══════════════════════════════════════════════
db.exec('UPDATE production_orders SET product_id = 1354 WHERE product_id = 1639');
db.exec('DELETE FROM products WHERE id = 1639');
console.log('[OK] CREME DE LEITE DE AMÊNDOAS → CREME DE LEITE');

// ══════════════════════════════════════════════
// ETAPAS — consolidações
// ══════════════════════════════════════════════

// EMBALAGEM (1237) ← ARMAZENAGEM (1576), SELAR (1250), DATAR (1249)
db.exec('UPDATE production_steps SET stage_id = 1237 WHERE stage_id IN (1576, 1250, 1249)');
db.exec('DELETE FROM stages WHERE id IN (1576, 1250, 1249)');
console.log('[OK] ARMAZENAGEM / SELAR / DATAR → EMBALAGEM');

// PROCESSAR (1586) ← PROCESSAR THERMOMIX (1273), BATER (1284)
db.exec('UPDATE production_steps SET stage_id = 1586 WHERE stage_id IN (1273, 1284)');
db.exec('DELETE FROM stages WHERE id IN (1273, 1284)');
console.log('[OK] PROCESSAR THERMOMIX / BATER → PROCESSAR');

// HOMOGENEIZAR (1318) ← MISTURAR MASSA (1293)
db.exec('UPDATE production_steps SET stage_id = 1318 WHERE stage_id = 1293');
db.exec('DELETE FROM stages WHERE id = 1293');
console.log('[OK] MISTURAR MASSA → HOMOGENEIZAR');

// ══════════════════════════════════════════════
// RESULTADO FINAL
// ══════════════════════════════════════════════

console.log('\n=== PRODUTOS ===');
db.prepare('SELECT name, unit FROM products ORDER BY name').all()
  .forEach(p => console.log(`  ${p.unit.padEnd(4)} | ${p.name}`));

console.log('\n=== ETAPAS ===');
db.prepare('SELECT name, is_legacy FROM stages ORDER BY name').all()
  .forEach(s => console.log(`  ${s.is_legacy ? '[legado] ' : '         '} ${s.name}`));
