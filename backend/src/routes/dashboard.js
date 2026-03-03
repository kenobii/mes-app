const { Router } = require('express');
const db = require('../db/database');
const router = Router();

// ── Resumo geral ─────────────────────────────────────────────
// GET /api/dashboard/summary?date_from=&date_to=&operator_id=
router.get('/summary', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  const where  = buildWhere({ date_from, date_to, operator_id });

  const totals = db.prepare(`
    SELECT
      COUNT(DISTINCT o.id)                                          AS total_orders,
      COUNT(DISTINCT o.product_id)                                  AS total_products,
      ROUND(SUM(o.planned_qty),  2)                                 AS total_planned,
      ROUND(SUM(o.produced_qty), 2)                                 AS total_produced,
      ROUND(AVG(CASE WHEN o.planned_qty > 0
        THEN o.produced_qty * 100.0 / o.planned_qty END), 1)        AS avg_efficiency_pct,
      ROUND(SUM(s.net_time_minutes) / 60.0, 2)                     AS total_net_hours
    FROM production_orders o
    LEFT JOIN production_steps s ON s.order_id = o.id
    ${where.sql}
  `).get(...where.params);

  res.json(totals);
});

// ── Resumo período anterior (comparativo) ────────────────────
// GET /api/dashboard/summary-prev?date_from=&date_to=&operator_id=
router.get('/summary-prev', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  if (!date_from || !date_to) return res.json(null);

  // Calcula período anterior com mesma duração
  const from = new Date(date_from);
  const to   = new Date(date_to);
  const diff = to - from;                                   // ms
  const prevTo   = new Date(from - 1);                      // dia antes do from atual
  const prevFrom = new Date(prevTo - diff);

  const pf = prevFrom.toISOString().slice(0, 10);
  const pt = prevTo.toISOString().slice(0, 10);

  const where = buildWhere({ date_from: pf, date_to: pt, operator_id });

  const totals = db.prepare(`
    SELECT
      COUNT(DISTINCT o.id)                                          AS total_orders,
      COUNT(DISTINCT o.product_id)                                  AS total_products,
      ROUND(SUM(o.planned_qty),  2)                                 AS total_planned,
      ROUND(SUM(o.produced_qty), 2)                                 AS total_produced,
      ROUND(AVG(CASE WHEN o.planned_qty > 0
        THEN o.produced_qty * 100.0 / o.planned_qty END), 1)        AS avg_efficiency_pct,
      ROUND(SUM(s.net_time_minutes) / 60.0, 2)                     AS total_net_hours
    FROM production_orders o
    LEFT JOIN production_steps s ON s.order_id = o.id
    ${where.sql}
  `).get(...where.params);

  res.json({ ...totals, date_from: pf, date_to: pt });
});

// ── Produtividade por etapa ───────────────────────────────────
// GET /api/dashboard/by-stage?date_from=&date_to=&operator_id=
router.get('/by-stage', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  const where = buildWhere({ date_from, date_to, operator_id });

  const rows = db.prepare(`
    SELECT
      st.name                              AS stage,
      st.is_legacy,
      COUNT(s.id)                          AS occurrences,
      ROUND(SUM(s.net_time_minutes), 1)   AS total_net_minutes,
      ROUND(AVG(s.net_time_minutes), 1)   AS avg_net_minutes,
      ROUND(MAX(s.net_time_minutes), 1)   AS max_net_minutes
    FROM production_steps s
    JOIN stages            st ON st.id = s.stage_id
    JOIN production_orders  o ON o.id  = s.order_id
    ${where.sql}
    GROUP BY st.id
    ORDER BY total_net_minutes DESC
  `).all(...where.params);

  res.json(rows);
});

// ── Eficiência por produto ────────────────────────────────────
// GET /api/dashboard/efficiency?date_from=&date_to=&operator_id=
router.get('/efficiency', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  const where = buildWhere({ date_from, date_to, operator_id });

  const rows = db.prepare(`
    SELECT
      p.name                                                         AS product,
      COUNT(o.id)                                                    AS orders,
      ROUND(SUM(o.planned_qty),  2)                                  AS total_planned,
      ROUND(SUM(o.produced_qty), 2)                                  AS total_produced,
      ROUND(AVG(CASE WHEN o.planned_qty > 0
        THEN o.produced_qty * 100.0 / o.planned_qty END), 1)         AS avg_efficiency_pct
    FROM production_orders o
    JOIN products p ON p.id = o.product_id
    ${where.sql}
    GROUP BY p.id
    ORDER BY avg_efficiency_pct DESC
  `).all(...where.params);

  res.json(rows);
});

// ── Timeline de ocupação (Gantt) ─────────────────────────────
// GET /api/dashboard/timeline?date_from=&date_to=&operator_id=
router.get('/timeline', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  const where = buildWhere({ date_from, date_to, operator_id });

  const rows = db.prepare(`
    SELECT
      s.id              AS step_id,
      s.started_at,
      s.finished_at,
      s.net_time_minutes,
      s.gross_time_minutes,
      st.name           AS stage,
      st.is_legacy,
      p.name            AS product,
      o.production_date,
      o.id              AS order_id,
      op.name           AS operator
    FROM production_steps  s
    JOIN stages             st ON st.id = s.stage_id
    JOIN production_orders  o  ON o.id  = s.order_id
    JOIN products           p  ON p.id  = o.product_id
    LEFT JOIN operators    op  ON op.id = o.operator_id
    ${where.sql}
      AND s.started_at IS NOT NULL
      AND s.finished_at IS NOT NULL
    ORDER BY s.started_at
  `).all(...where.params);

  res.json(rows);
});

// ── Volume diário ─────────────────────────────────────────────
// GET /api/dashboard/daily?date_from=&date_to=&operator_id=
router.get('/daily', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  const where = buildWhere({ date_from, date_to, operator_id });

  const rows = db.prepare(`
    SELECT
      o.production_date                                              AS date,
      COUNT(DISTINCT o.id)                                          AS orders,
      ROUND(SUM(o.produced_qty), 2)                                 AS produced,
      ROUND(SUM(o.planned_qty),  2)                                 AS planned,
      ROUND(AVG(CASE WHEN o.planned_qty > 0
        THEN o.produced_qty * 100.0 / o.planned_qty END), 1)        AS efficiency_pct,
      ROUND(SUM(s.net_time_minutes) / 60.0, 2)                     AS net_hours
    FROM production_orders o
    LEFT JOIN production_steps s ON s.order_id = o.id
    ${where.sql}
    GROUP BY o.production_date
    ORDER BY o.production_date
  `).all(...where.params);

  res.json(rows);
});

// ── Tempo médio por etapa, agrupado por produto ───────────────
// GET /api/dashboard/by-product-stage?date_from=&date_to=&operator_id=&product_id=
router.get('/by-product-stage', (req, res) => {
  const { date_from, date_to, operator_id, product_id } = req.query;
  const where = buildWhere({ date_from, date_to, operator_id });

  // Injeta filtro de produto se informado
  const productClause = product_id ? `AND o.product_id = ${Number(product_id)}` : '';

  const rows = db.prepare(`
    SELECT
      p.id                              AS product_id,
      p.name                            AS product,
      st.id                             AS stage_id,
      st.name                           AS stage,
      st.is_legacy,
      COUNT(s.id)                       AS occurrences,
      ROUND(SUM(s.net_time_minutes), 1) AS total_net_minutes,
      ROUND(AVG(s.net_time_minutes), 1) AS avg_net_minutes,
      ROUND(MIN(s.net_time_minutes), 1) AS min_net_minutes,
      ROUND(MAX(s.net_time_minutes), 1) AS max_net_minutes,
      ROUND(AVG(
        (SELECT COALESCE(SUM(duration_minutes), 0)
         FROM production_pauses pp WHERE pp.step_id = s.id)
      ), 1)                             AS avg_pause_minutes
    FROM production_steps  s
    JOIN stages             st ON st.id = s.stage_id
    JOIN production_orders  o  ON o.id  = s.order_id
    JOIN products           p  ON p.id  = o.product_id
    ${where.sql} ${productClause}
      AND s.net_time_minutes IS NOT NULL
      AND s.net_time_minutes > 0
    GROUP BY p.id, st.id
    ORDER BY p.name, avg_net_minutes DESC
  `).all(...where.params);

  // Estrutura para o frontend: { product, stages: [...] }
  const byProduct = {};
  for (const row of rows) {
    if (!byProduct[row.product_id]) {
      byProduct[row.product_id] = { product_id: row.product_id, product: row.product, stages: [] };
    }
    byProduct[row.product_id].stages.push({
      stage_id:          row.stage_id,
      stage:             row.stage,
      is_legacy:         row.is_legacy,
      occurrences:       row.occurrences,
      total_net_minutes: row.total_net_minutes,
      avg_net_minutes:   row.avg_net_minutes,
      min_net_minutes:   row.min_net_minutes,
      max_net_minutes:   row.max_net_minutes,
      avg_pause_minutes: row.avg_pause_minutes,
    });
  }

  res.json(Object.values(byProduct));
});

// ── Análise de pausas ─────────────────────────────────────────
// GET /api/dashboard/pauses?date_from=&date_to=&operator_id=
router.get('/pauses', (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  const where = buildWhere({ date_from, date_to, operator_id });

  const rows = db.prepare(`
    SELECT
      COALESCE(NULLIF(TRIM(pp.reason), ''), 'Sem motivo') AS reason,
      COUNT(*)                                             AS occurrences,
      ROUND(SUM(pp.duration_minutes),  1)                 AS total_minutes,
      ROUND(AVG(pp.duration_minutes),  1)                 AS avg_minutes
    FROM production_pauses pp
    JOIN production_steps  s  ON s.id  = pp.step_id
    JOIN production_orders o  ON o.id  = s.order_id
    ${where.sql}
      AND pp.duration_minutes IS NOT NULL
    GROUP BY reason
    ORDER BY total_minutes DESC
  `).all(...where.params);

  res.json(rows);
});

// ─────────────────────────────────────────────────────────────
function buildWhere({ date_from, date_to, operator_id }) {
  const clauses = [];
  const params  = [];
  if (date_from)   { clauses.push(`o.production_date >= ?`); params.push(date_from); }
  if (date_to)     { clauses.push(`o.production_date <= ?`); params.push(date_to); }
  if (operator_id) { clauses.push(`o.operator_id = ?`);      params.push(operator_id); }
  const sql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { sql, params };
}

module.exports = router;
