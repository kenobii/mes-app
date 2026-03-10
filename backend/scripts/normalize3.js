const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'mes.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

// ══════════════════════════════════════════════
// ETAPAS — consolidações finais
// ══════════════════════════════════════════════

// SEPARAR INSUMOS (1621) ← CONTAR FORMINHAS (1606)
db.exec('UPDATE production_steps SET stage_id = 1621 WHERE stage_id = 1606');
db.exec('DELETE FROM stages WHERE id = 1606');
console.log('[OK] CONTAR FORMINHAS → SEPARAR INSUMOS');

// PROCESSAR (1586) ← LIQUIDIFICAR (1348)
db.exec('UPDATE production_steps SET stage_id = 1586 WHERE stage_id = 1348');
db.exec('DELETE FROM stages WHERE id = 1348');
console.log('[OK] LIQUIDIFICAR → PROCESSAR');

// SEPARAR INSUMOS (1621) ← PESAR INSUMOS (1269)
db.exec('UPDATE production_steps SET stage_id = 1621 WHERE stage_id = 1269');
db.exec('DELETE FROM stages WHERE id = 1269');
console.log('[OK] PESAR INSUMOS → SEPARAR INSUMOS');

// ══════════════════════════════════════════════
// PRODUTOS — renomear para nomenclatura Fácil123
// Correspondências claras (mesmos produtos, formato diferente)
// ══════════════════════════════════════════════
const renames = [
  // [id, novo_nome, nova_unit]
  [1247, 'Empada de Palmito 160g',      'UND'],
  [1238, 'Empada de Palmito PP',         'KG' ],
  [1237, 'Empada de Tomate Seco PP',     'KG' ],
  [1644, 'Lasanha de Abobrinha 410g',    'UND'],
  [1336, 'Lasanha de Berinjela 1,2kg',   'UND'],
  [1359, 'Lasanha de Berinjela 410g',    'UND'],
  [1252, 'Quibe Vegano 180g',            'UND'],
  [1281, 'Quibe Vegano',                 'KG' ],
  [1296, 'Grão de Bico Cozido',          'KG' ],
  [1311, 'Lentilha Cozida',              'KG' ],
  [1351, 'Farinha de Amêndoas',          'KG' ],
  [1354, 'Creme de Leite',               'KG' ],
  // Outros produtos internos — apenas ajuste de casing
  [1491, 'Abobrinha Assada',             'KG' ],
  [1355, 'Berinjela Assada',             'KG' ],
  [1269, 'Caldo de Legumes',             'KG' ],
  [1274, 'Creme de Arroz',               'KG' ],
  [1278, 'Creme de Inhame',              'KG' ],
  [1570, 'Cuscuz Paulista',              'KG' ],
  [1602, 'Guisado de Pinhão 450g',       'UND'],
  [1473, 'Lasanha de Abobrinha',         'KG' ],
  [1293, 'Massa de Empada',              'KG' ],
  [1288, 'Molho de Tomate',              'KG' ],
  [1441, 'Palmito',                      'KG' ],
  [1306, 'Pasta de Alho',               'KG' ],
  [1331, 'Pinhão Cozido',               'KG' ],
  [1516, 'Pão de Queijo Vegano',         'KG' ],
  [1323, 'Queijo de Inhame',             'KG' ],
  [1330, 'Queijo Vegano da Casa',        'KG' ],
  [1476, 'Quiche Sabores',               'KG' ],
  [1514, 'Recheio de Maçã',              'KG' ],
  [1285, 'Recheio de Palmito',           'KG' ],
  [1377, 'Recheio de Tomate Seco',       'KG' ],
  [1621, 'Estrogonofe de Grão de Bico',  'KG' ],
];

const stmt = db.prepare('UPDATE products SET name = ?, unit = ? WHERE id = ?');
for (const [id, name, unit] of renames) {
  stmt.run(name, unit, id);
}
console.log(`[OK] ${renames.length} produtos renomeados`);

// ══════════════════════════════════════════════
// RESULTADO FINAL
// ══════════════════════════════════════════════

console.log('\n=== PRODUTOS ===');
db.prepare('SELECT id, name, unit FROM products ORDER BY name').all()
  .forEach(p => console.log(`  ${String(p.id).padStart(4)} | ${p.unit.padEnd(4)} | ${p.name}`));

console.log('\n=== ETAPAS ===');
db.prepare('SELECT name, is_legacy FROM stages ORDER BY name').all()
  .forEach(s => console.log(`  ${s.is_legacy ? '[legado] ' : '         '} ${s.name}`));
