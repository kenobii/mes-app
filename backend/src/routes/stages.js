const { Router } = require('express');
const stageRepository = require('../repositories/stageRepository');
const { adminMiddleware } = require('../middleware/auth');
const router = Router();

router.get('/', (req, res) => {
  res.json(stageRepository.findAll({ legacy: req.query.legacy }));
});

router.post('/', adminMiddleware, (req, res) => {
  const { name, category, external_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  res.status(201).json(stageRepository.create({ name, category, external_id }));
});

router.put('/:id', adminMiddleware, (req, res) => {
  const { name, category, active, external_id } = req.body;
  res.json(stageRepository.update(req.params.id, { name, category, active, external_id }));
});

module.exports = router;
