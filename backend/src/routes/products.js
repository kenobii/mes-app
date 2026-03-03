const { Router } = require('express');
const db = require('../db/database');
const { adminMiddleware } = require('../middleware/auth');
const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT id, uuid, name, unit, external_id, active, created_at
    FROM products
    WHERE active = 1
    ORDER BY name
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(row);
});

router.post('/', adminMiddleware, (req, res) => {
  const { name, unit = 'KG', external_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  const result = db.prepare(`
    INSERT INTO products (name, unit, external_id) VALUES (?, ?, ?)
  `).run(name.trim().toUpperCase(), unit, external_id ?? null);
  const row = db.prepare(`SELECT * FROM products WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', adminMiddleware, (req, res) => {
  const { name, unit, active, external_id } = req.body;
  const existing = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });
  db.prepare(`
    UPDATE products SET
      name        = COALESCE(?, name),
      unit        = COALESCE(?, unit),
      active      = COALESCE(?, active),
      external_id = COALESCE(?, external_id)
    WHERE id = ?
  `).run(name ?? null, unit ?? null, active ?? null, external_id ?? null, req.params.id);
  res.json(db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id));
});

module.exports = router;
