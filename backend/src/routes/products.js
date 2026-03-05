const { Router } = require('express');
const productRepository = require('../repositories/productRepository');
const { adminMiddleware } = require('../middleware/auth');
const router = Router();

router.get('/', (_req, res) => {
  res.json(productRepository.findAll());
});

router.get('/:id', (req, res) => {
  const row = productRepository.findById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(row);
});

router.post('/', adminMiddleware, (req, res) => {
  const { name, unit = 'KG', external_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  res.status(201).json(productRepository.create({ name, unit, external_id }));
});

router.put('/:id', adminMiddleware, (req, res) => {
  const { name, unit, active, external_id } = req.body;
  const existing = productRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(productRepository.update(req.params.id, { name, unit, active, external_id }));
});

module.exports = router;
