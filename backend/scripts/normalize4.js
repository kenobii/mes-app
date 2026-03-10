const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'mes.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

// ══════════════════════════════════════════════
// RENOMEAR — produtos ainda em MAIÚSCULO
// (confirmados como produtos distintos dos do Fácil123)
// ══════════════════════════════════════════════
const renames = [
  [1264, 'Empada de Espinafre M'],
  [1507, 'Empada de Espinafre PP'],
  [1260, 'Empada de Maçã'],
  [1255, 'Empada de Palmito M'],
  [1461, 'Empada de Sabores P'],
  [1325, 'Empada de Tomate Seco P'],
];
const stmtRename = db.prepare('UPDATE products SET name = ? WHERE id = ?');
for (const [id, name] of renames) stmtRename.run(name, id);
console.log(`[OK] ${renames.length} produtos renomeados para casing correto`);

// ══════════════════════════════════════════════
// INSERIR — produtos do Fácil123 ausentes no banco
// ══════════════════════════════════════════════
const toInsert = [
  ['Empada de Espinafre 160g',           'UND'],
  ['Empada de Maçã 120g',                'UND'],
  ['Empada de Palmito P',                'KG' ],
  ['Empada de Alho Poró P',              'KG' ],
  ['Discos Proteicos 240g',              'UND'],
  ['Estrogonofe de Grão de Bico 450g',   'UND'],
];
const stmtInsert = db.prepare('INSERT INTO products (name, unit) VALUES (?, ?)');
for (const [name, unit] of toInsert) {
  stmtInsert.run(name, unit);
  console.log(`[OK] Inserido: ${name} (${unit})`);
}

// ══════════════════════════════════════════════
// RESULTADO FINAL
// ══════════════════════════════════════════════
console.log('\n=== PRODUTOS (' + db.prepare('SELECT COUNT(*) as n FROM products').get().n + ' itens) ===');
db.prepare('SELECT name, unit FROM products ORDER BY name').all()
  .forEach(p => console.log(`  ${p.unit.padEnd(4)} | ${p.name}`));

console.log('\n=== ETAPAS (' + db.prepare('SELECT COUNT(*) as n FROM stages').get().n + ' itens) ===');
db.prepare('SELECT name, is_legacy FROM stages ORDER BY name').all()
  .forEach(s => console.log(`  ${s.is_legacy ? '[legado] ' : '         '} ${s.name}`));
