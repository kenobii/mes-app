const { Router } = require('express');
const db = require('../db/database');
const { adminMiddleware } = require('../middleware/auth');
const router = Router();

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT t.*, s.name AS stage_name
    FROM stage_targets t
    JOIN stages s ON s.id = t.stage_id
    ORDER BY s.name
  `).all());
});

router.post('/', adminMiddleware, (req, res) => {
  const { stage_id, target_minutes } = req.body;
  if (!stage_id || target_minutes == null)
    return res.status(400).json({ error: 'stage_id e target_minutes são obrigatórios' });

  // Upsert: atualiza se já existe meta para a etapa
  db.prepare(`
    INSERT INTO stage_targets (stage_id, target_minutes)
    VALUES (?, ?)
    ON CONFLICT(stage_id) DO UPDATE SET target_minutes = excluded.target_minutes
  `).run(stage_id, target_minutes);

  res.status(201).json(db.prepare(`
    SELECT t.*, s.name AS stage_name FROM stage_targets t
    JOIN stages s ON s.id = t.stage_id WHERE t.stage_id = ?
  `).get(stage_id));
});

router.delete('/:id', adminMiddleware, (req, res) => {
  db.prepare(`DELETE FROM stage_targets WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
