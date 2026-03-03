const { Router } = require('express');
const db = require('../db/database');
const { adminMiddleware } = require('../middleware/auth');
const router = Router();

router.get('/', (req, res) => {
  const { legacy } = req.query;
  let sql = `SELECT * FROM stages WHERE active = 1`;
  if (legacy === 'false') { sql += ` AND is_legacy = 0`; }
  if (legacy === 'true')  { sql += ` AND is_legacy = 1`; }
  sql += ` ORDER BY name`;
  res.json(db.prepare(sql).all());
});

router.post('/', adminMiddleware, (req, res) => {
  const { name, category, external_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  const result = db.prepare(`
    INSERT INTO stages (name, category, external_id) VALUES (?, ?, ?)
  `).run(name.trim().toUpperCase(), category ?? null, external_id ?? null);
  res.status(201).json(db.prepare(`SELECT * FROM stages WHERE id = ?`).get(result.lastInsertRowid));
});

router.put('/:id', adminMiddleware, (req, res) => {
  const { name, category, active, external_id } = req.body;
  db.prepare(`
    UPDATE stages SET
      name        = COALESCE(?, name),
      category    = COALESCE(?, category),
      active      = COALESCE(?, active),
      external_id = COALESCE(?, external_id)
    WHERE id = ?
  `).run(name ?? null, category ?? null, active ?? null, external_id ?? null, req.params.id);
  res.json(db.prepare(`SELECT * FROM stages WHERE id = ?`).get(req.params.id));
});

module.exports = router;
