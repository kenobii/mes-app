const db = require('../db/database');

const stageRepository = {
  findAll: ({ legacy } = {}) => {
    let sql = `SELECT * FROM stages WHERE active = 1`;
    if (legacy === 'false') sql += ` AND is_legacy = 0`;
    if (legacy === 'true')  sql += ` AND is_legacy = 1`;
    sql += ` ORDER BY name`;
    return db.prepare(sql).all();
  },

  findById: (id) =>
    db.prepare(`SELECT * FROM stages WHERE id = ?`).get(id),

  create: ({ name, category, external_id }) => {
    const result = db.prepare(`
      INSERT INTO stages (name, category, external_id) VALUES (?, ?, ?)
    `).run(name.trim(), category ?? null, external_id ?? null);
    return db.prepare(`SELECT * FROM stages WHERE id = ?`).get(result.lastInsertRowid);
  },

  update: (id, { name, category, active, external_id }) => {
    db.prepare(`
      UPDATE stages SET
        name        = COALESCE(?, name),
        category    = COALESCE(?, category),
        active      = COALESCE(?, active),
        external_id = COALESCE(?, external_id)
      WHERE id = ?
    `).run(name ?? null, category ?? null, active ?? null, external_id ?? null, id);
    return db.prepare(`SELECT * FROM stages WHERE id = ?`).get(id);
  },
};

module.exports = stageRepository;
