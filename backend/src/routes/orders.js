const { Router } = require('express');
const orderRepository = require('../repositories/orderRepository');
const { requireNonGuest } = require('../middleware/auth');
const router = Router();

router.get('/', (req, res) => {
  const { date_from, date_to, product_id, operator_id, status } = req.query;
  res.json(orderRepository.findAll({ date_from, date_to, product_id, operator_id, status }));
});

router.get('/:id', (req, res) => {
  const order = orderRepository.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Ordem não encontrada' });
  res.json(order);
});

router.post('/', requireNonGuest, (req, res) => {
  const { product_id, operator_id, production_date, planned_qty, notes } = req.body;
  if (!product_id || !production_date)
    return res.status(400).json({ error: 'product_id e production_date são obrigatórios' });
  res.status(201).json(orderRepository.create({ product_id, operator_id, production_date, planned_qty, notes }));
});

router.put('/:id', requireNonGuest, (req, res) => {
  const { status, produced_qty, planned_qty, notes, product_id, operator_id, production_date } = req.body;
  res.json(orderRepository.update(req.params.id, { status, produced_qty, planned_qty, notes, product_id, operator_id, production_date }));
});

router.delete('/:id', requireNonGuest, (req, res) => {
  orderRepository.delete(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/steps', requireNonGuest, (req, res) => {
  const { stage_id, started_at, finished_at, notes } = req.body;
  if (!stage_id) return res.status(400).json({ error: 'stage_id é obrigatório' });
  res.status(201).json(orderRepository.addStep(req.params.id, { stage_id, started_at, finished_at, notes }));
});

router.post('/steps/:stepId/pauses', requireNonGuest, (req, res) => {
  const { paused_at, resumed_at, reason } = req.body;
  if (!paused_at) return res.status(400).json({ error: 'paused_at é obrigatório' });
  res.status(201).json(orderRepository.addPause(req.params.stepId, { paused_at, resumed_at, reason }));
});

module.exports = router;
