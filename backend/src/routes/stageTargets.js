const { Router } = require('express');
const stageTargetRepository = require('../repositories/stageTargetRepository');
const { adminMiddleware } = require('../middleware/auth');
const router = Router();

router.get('/', (_req, res) => {
  res.json(stageTargetRepository.findAll());
});

router.post('/', adminMiddleware, (req, res) => {
  const { stage_id, target_minutes } = req.body;
  if (!stage_id || target_minutes == null)
    return res.status(400).json({ error: 'stage_id e target_minutes são obrigatórios' });
  res.status(201).json(stageTargetRepository.upsert({ stage_id, target_minutes }));
});

router.delete('/:id', adminMiddleware, (req, res) => {
  stageTargetRepository.delete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
