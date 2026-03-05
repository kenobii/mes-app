const db = require('../db/database');

function calcMinutes(start, end) {
  return Math.round((new Date(end) - new Date(start)) / 6000) / 10;
}

const orderRepository = {
  findAll: (filters = {}) => {
    const { date_from, date_to, product_id, operator_id, status } = filters;
    let sql = `
      SELECT
        o.id, o.uuid, o.production_date, o.status,
        o.planned_qty, o.produced_qty, o.notes, o.source_sheet,
        o.created_at, o.updated_at,
        p.id   AS product_id,   p.name AS product_name, p.unit,
        op.id  AS operator_id,  op.name AS operator_name,
        ROUND(CASE WHEN o.planned_qty > 0
          THEN (o.produced_qty * 100.0 / o.planned_qty) ELSE NULL END, 1) AS efficiency_pct,
        (SELECT SUM(s.net_time_minutes) FROM production_steps s WHERE s.order_id = o.id) AS total_net_minutes
      FROM production_orders o
      JOIN products  p  ON p.id  = o.product_id
      LEFT JOIN operators op ON op.id = o.operator_id
      WHERE 1=1
    `;
    const params = [];
    if (date_from)   { sql += ` AND o.production_date >= ?`; params.push(date_from); }
    if (date_to)     { sql += ` AND o.production_date <= ?`; params.push(date_to); }
    if (product_id)  { sql += ` AND o.product_id = ?`;       params.push(product_id); }
    if (operator_id) { sql += ` AND o.operator_id = ?`;      params.push(operator_id); }
    if (status)      { sql += ` AND o.status = ?`;           params.push(status); }
    sql += ` ORDER BY o.production_date DESC, o.id DESC`;
    return db.prepare(sql).all(...params);
  },

  findById: (id) => {
    const order = db.prepare(`
      SELECT o.*, p.name AS product_name, p.unit,
             op.name AS operator_name,
             ROUND(CASE WHEN o.planned_qty > 0
               THEN (o.produced_qty * 100.0 / o.planned_qty) ELSE NULL END, 1) AS efficiency_pct
      FROM production_orders o
      JOIN products  p  ON p.id  = o.product_id
      LEFT JOIN operators op ON op.id = o.operator_id
      WHERE o.id = ?
    `).get(id);

    if (!order) return null;

    const steps = db.prepare(`
      SELECT s.*, st.name AS stage_name, st.is_legacy
      FROM production_steps s
      JOIN stages st ON st.id = s.stage_id
      WHERE s.order_id = ?
      ORDER BY s.started_at
    `).all(id);

    const stepIds = steps.map(s => s.id);
    const pauses = stepIds.length
      ? db.prepare(`
          SELECT * FROM production_pauses
          WHERE step_id IN (${stepIds.map(() => '?').join(',')})
          ORDER BY step_id, pause_index
        `).all(...stepIds)
      : [];

    const pausesByStep = {};
    for (const p of pauses) {
      if (!pausesByStep[p.step_id]) pausesByStep[p.step_id] = [];
      pausesByStep[p.step_id].push(p);
    }

    return { ...order, steps: steps.map(s => ({ ...s, pauses: pausesByStep[s.id] || [] })) };
  },

  create: ({ product_id, operator_id, production_date, planned_qty, notes }) => {
    const result = db.prepare(`
      INSERT INTO production_orders (product_id, operator_id, production_date, planned_qty, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(product_id, operator_id ?? null, production_date, planned_qty ?? null, notes ?? null);
    return db.prepare(`
      SELECT o.*, p.name AS product_name FROM production_orders o
      JOIN products p ON p.id = o.product_id WHERE o.id = ?
    `).get(result.lastInsertRowid);
  },

  update: (id, { status, produced_qty, planned_qty, notes, product_id, operator_id, production_date }) => {
    db.prepare(`
      UPDATE production_orders SET
        status          = COALESCE(?, status),
        produced_qty    = ?,
        planned_qty     = ?,
        notes           = ?,
        product_id      = COALESCE(?, product_id),
        operator_id     = ?,
        production_date = COALESCE(?, production_date)
      WHERE id = ?
    `).run(
      status          ?? null,
      produced_qty    ?? null,
      planned_qty     ?? null,
      notes           ?? null,
      product_id      ?? null,
      operator_id     ?? null,
      production_date ?? null,
      id
    );
    return db.prepare(`
      SELECT o.*, p.name AS product_name, op.name AS operator_name
      FROM production_orders o
      JOIN products p ON p.id = o.product_id
      LEFT JOIN operators op ON op.id = o.operator_id
      WHERE o.id = ?
    `).get(id);
  },

  delete: (id) => {
    const steps = db.prepare(`SELECT id FROM production_steps WHERE order_id = ?`).all(id);
    for (const s of steps)
      db.prepare(`DELETE FROM production_pauses WHERE step_id = ?`).run(s.id);
    db.prepare(`DELETE FROM production_steps WHERE order_id = ?`).run(id);
    db.prepare(`DELETE FROM production_orders WHERE id = ?`).run(id);
  },

  addStep: (orderId, { stage_id, started_at, finished_at, notes }) => {
    const gross = (started_at && finished_at)
      ? calcMinutes(started_at, finished_at)
      : null;
    const result = db.prepare(`
      INSERT INTO production_steps (order_id, stage_id, started_at, finished_at, gross_time_minutes, net_time_minutes, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, stage_id, started_at ?? null, finished_at ?? null, gross, gross, notes ?? null);
    return db.prepare(`
      SELECT s.*, st.name AS stage_name FROM production_steps s
      JOIN stages st ON st.id = s.stage_id WHERE s.id = ?
    `).get(result.lastInsertRowid);
  },

  addPause: (stepId, { paused_at, resumed_at, reason }) => {
    const nextIdx = (db.prepare(
      `SELECT COUNT(*) as n FROM production_pauses WHERE step_id = ?`
    ).get(stepId).n || 0) + 1;

    const dur = (paused_at && resumed_at)
      ? calcMinutes(paused_at, resumed_at)
      : null;

    const result = db.prepare(`
      INSERT INTO production_pauses (step_id, pause_index, paused_at, resumed_at, duration_minutes, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(stepId, nextIdx, paused_at, resumed_at ?? null, dur, reason ?? null);

    const totalPause = db.prepare(
      `SELECT COALESCE(SUM(duration_minutes),0) AS total FROM production_pauses WHERE step_id = ?`
    ).get(stepId).total;

    const step = db.prepare(`SELECT gross_time_minutes FROM production_steps WHERE id = ?`).get(stepId);
    if (step?.gross_time_minutes != null) {
      db.prepare(`UPDATE production_steps SET net_time_minutes = ? WHERE id = ?`)
        .run(step.gross_time_minutes - totalPause, stepId);
    }

    return db.prepare(`SELECT * FROM production_pauses WHERE id = ?`).get(result.lastInsertRowid);
  },
};

module.exports = orderRepository;
