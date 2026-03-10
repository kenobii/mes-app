const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'mes.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

// ══════════════════════════════════════════════
// ETAPAS — consolidações
// ══════════════════════════════════════════════

// a) PESAR (1625), PESAR AGUA (1584), PESAR AMENDOAS (1582) → PESAR INSUMOS (1269)
db.exec('UPDATE production_steps SET stage_id = 1269 WHERE stage_id IN (1625, 1584, 1582)');
db.exec('DELETE FROM stages WHERE id IN (1625, 1584, 1582)');
console.log('[OK] PESAR / PESAR AGUA / PESAR AMENDOAS → PESAR INSUMOS');

// b) FECHAR EMPADA (1591) → TAMPAR (1240)
db.exec('UPDATE production_steps SET stage_id = 1240 WHERE stage_id = 1591');
db.exec('DELETE FROM stages WHERE id = 1591');
console.log('[OK] FECHAR EMPADA → TAMPAR');

// c) LAVAR (1363), LAVAGEM (MÁQUINA) (1594), HIGIENIZAR BERINJELA (1633) → HIGIENIZAR
db.exec("UPDATE stages SET name = 'HIGIENIZAR' WHERE id = 1633");
db.exec('UPDATE production_steps SET stage_id = 1633 WHERE stage_id IN (1363, 1594)');
db.exec('DELETE FROM stages WHERE id IN (1363, 1594)');
console.log('[OK] LAVAR / LAVAGEM (MÁQUINA) / HIGIENIZAR BERINJELA → HIGIENIZAR');

// d) BATER AMENDOAS (1586), FERVER AMENDOAS (1585) → PROCESSAR
db.exec("UPDATE stages SET name = 'PROCESSAR' WHERE id = 1586");
db.exec('UPDATE production_steps SET stage_id = 1586 WHERE stage_id = 1585');
db.exec('DELETE FROM stages WHERE id = 1585');
console.log('[OK] BATER AMENDOAS / FERVER AMENDOAS → PROCESSAR');

// e) INICIO (1603) → SEPARAR INSUMOS (1621)
db.exec('UPDATE production_steps SET stage_id = 1621 WHERE stage_id = 1603');
db.exec('DELETE FROM stages WHERE id = 1603');
console.log('[OK] INICIO → SEPARAR INSUMOS');

// f) POR MOLHO NA BANDEJA (1604) → MONTAGEM (1336)
db.exec('UPDATE production_steps SET stage_id = 1336 WHERE stage_id = 1604');
db.exec('DELETE FROM stages WHERE id = 1604');
console.log('[OK] POR MOLHO NA BANDEJA → MONTAGEM');

// ══════════════════════════════════════════════
// PRODUTOS — remover unidade do nome + corrigir campo unit
// ══════════════════════════════════════════════

// [id, novo_nome, nova_unit (null = não altera)]
const productUpdates = [
  [1491, 'ABOBRINHA ASSADA',             null],
  [1355, 'BERINJELA ASSADA',             null],
  [1269, 'CALDO DE LEGUMES',             null],
  [1274, 'CREME DE ARROZ',               null],
  [1278, 'CREME DE INHAME',              null],
  [1354, 'CREME DE LEITE',               null],
  [1639, 'CREME DE LEITE DE AMÊNDOAS',   null],
  [1570, 'CUSCUZ PAULISTA',              null],
  [1264, 'EMPADA DE ESPINAFRE M',        null],
  [1507, 'EMPADA DE ESPINAFRE PP',       null],
  [1260, 'EMPADA DE MAÇÃ',               null],
  [1255, 'EMPADA DE PALMITO M',          null],
  [1238, 'EMPADA DE PALMITO PP',         null],
  [1247, 'EMPADA DE PALMITO 160G',       'UND'],  // porção
  [1461, 'EMPADA DE SABORES P',          null],
  [1237, 'EMPADA DE TOMATE SECO PP',     null],
  [1325, 'EMPADA DE TOMATE SECO P',      null],
  [1621, 'ESTROGONOFE DE GRÃO DE BICO',  null],
  [1351, 'FARINHA DE AMÊNDOAS',          null],
  [1296, 'GRÃO DE BICO COZIDO',          null],
  [1602, 'GUISADO DE PINHÃO 450G',       'UND'],  // porção
  [1473, 'LASANHA DE ABOBRINHA',         null],
  [1644, 'LASANHA DE ABOBRINHA 410G',    'UND'],  // porção (era "410 G" com espaço)
  [1336, 'LASANHA DE BERINJELA 1,2KG',   null],   // unit=UND já ok
  [1359, 'LASANHA DE BERINJELA 410G',    null],   // unit=UND já ok
  [1311, 'LENTILHA COZIDA',              null],
  [1293, 'MASSA DE EMPADA',              null],
  [1288, 'MOLHO DE TOMATE',              null],
  [1441, 'PALMITO',                      null],
  [1306, 'PASTA DE ALHO',                null],
  [1331, 'PINHÃO COZIDO',               null],
  [1516, 'PÃO DE QUEIJO VEGANO',         null],
  [1323, 'QUEIJO DE INHAME',             null],
  [1330, 'QUEIJO VEGANO DA CASA',        null],
  [1281, 'QUIBE VEGANO',                 null],
  [1252, 'QUIBE VEGANO 180G',            'UND'],  // porção
  [1476, 'QUICHE SABORES',               null],
  [1514, 'RECHEIO DE MAÇÃ',              null],
  [1285, 'RECHEIO DE PALMITO',           null],
  [1377, 'RECHEIO DE TOMATE SECO',       null],
];

const stmtName = db.prepare('UPDATE products SET name = ? WHERE id = ?');
const stmtBoth = db.prepare('UPDATE products SET name = ?, unit = ? WHERE id = ?');

for (const [id, name, unit] of productUpdates) {
  if (unit) stmtBoth.run(name, unit, id);
  else      stmtName.run(name, id);
}
console.log(`[OK] ${productUpdates.length} produtos renomeados`);

// ══════════════════════════════════════════════
// RESULTADO FINAL
// ══════════════════════════════════════════════

console.log('\n=== PRODUTOS ===');
db.prepare('SELECT name, unit FROM products ORDER BY name').all()
  .forEach(p => console.log(`  ${p.unit.padEnd(4)} | ${p.name}`));

console.log('\n=== ETAPAS ===');
db.prepare('SELECT name, is_legacy FROM stages ORDER BY name').all()
  .forEach(s => console.log(`  ${s.is_legacy ? '[legado] ' : '         '} ${s.name}`));
