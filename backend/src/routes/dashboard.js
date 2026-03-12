const { Router } = require('express');
const dashboardRepository = require('../repositories/dashboardRepository');
const router = Router();

router.get('/summary', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  res.json(dashboardRepository.getSummary({ date_from, date_to, operator_id }));
});

router.get('/summary-prev', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  if (!date_from || !date_to) return res.json(null);

  const from = new Date(date_from);
  const to   = new Date(date_to);
  const diff = to - from;
  const prevTo   = new Date(from - 1);
  const prevFrom = new Date(prevTo - diff);

  const pf = prevFrom.toISOString().slice(0, 10);
  const pt = prevTo.toISOString().slice(0, 10);

  const totals = dashboardRepository.getSummary({ date_from: pf, date_to: pt, operator_id });
  res.json({ ...totals, date_from: pf, date_to: pt });
});

router.get('/by-stage', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  res.json(dashboardRepository.getByStage({ date_from, date_to, operator_id }));
});

router.get('/efficiency', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  res.json(dashboardRepository.getEfficiency({ date_from, date_to, operator_id }));
});

router.get('/timeline', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  res.json(dashboardRepository.getTimeline({ date_from, date_to, operator_id }));
});

router.get('/daily', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  res.json(dashboardRepository.getDaily({ date_from, date_to, operator_id }));
});

router.get('/by-product-stage', (req, res) => {
  const { date_from, date_to, operator_id, product_id } = req.query;
  res.json(dashboardRepository.getByProductStage({ date_from, date_to, operator_id }, product_id));
});

router.get('/by-operator', (req, res) => {
  const { date_from, date_to } = req.query;
  res.json(dashboardRepository.getByOperator({ date_from, date_to }));
});

router.get('/top-products-by-operator', (req, res) => {
  const { date_from, date_to } = req.query;
  res.json(dashboardRepository.getTopProductsByOperator({ date_from, date_to }));
});

router.get('/pauses', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  res.json(dashboardRepository.getPauses({ date_from, date_to, operator_id }));
});

module.exports = router;
