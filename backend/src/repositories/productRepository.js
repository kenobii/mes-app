const db = require('../db/database');

const productRepository = {
  findAll: () =>
    db.prepare(`
      SELECT id, uuid, name, unit, external_id, active, created_at
      FROM products
      WHERE active = 1
      ORDER BY name
    `).all(),

  findById: (id) =>
    db.prepare(`SELECT * FROM products WHERE id = ?`).get(id),

  create: ({ name, unit = 'KG', external_id }) => {
    const result = db.prepare(`
      INSERT INTO products (name, unit, external_id) VALUES (?, ?, ?)
    `).run(name.trim().toUpperCase(), unit, external_id ?? null);
    return db.prepare(`SELECT * FROM products WHERE id = ?`).get(result.lastInsertRowid);
  },

  update: (id, { name, unit, active, external_id }) => {
    db.prepare(`
      UPDATE products SET
        name        = COALESCE(?, name),
        unit        = COALESCE(?, unit),
        active      = COALESCE(?, active),
        external_id = COALESCE(?, external_id)
      WHERE id = ?
    `).run(name ?? null, unit ?? null, active ?? null, external_id ?? null, id);
    return db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
  },
};

module.exports = productRepository;
