const db = require('../db/database');

const stageTargetRepository = {
  findAll: () =>
    db.prepare(`
      SELECT t.*, s.name AS stage_name
      FROM stage_targets t
      JOIN stages s ON s.id = t.stage_id
      ORDER BY s.name
    `).all(),

  upsert: ({ stage_id, target_minutes }) => {
    db.prepare(`
      INSERT INTO stage_targets (stage_id, target_minutes)
      VALUES (?, ?)
      ON CONFLICT(stage_id) DO UPDATE SET target_minutes = excluded.target_minutes
    `).run(stage_id, target_minutes);
    return db.prepare(`
      SELECT t.*, s.name AS stage_name FROM stage_targets t
      JOIN stages s ON s.id = t.stage_id WHERE t.stage_id = ?
    `).get(stage_id);
  },

  delete: (id) => {
    db.prepare(`DELETE FROM stage_targets WHERE id = ?`).run(id);
  },
};

module.exports = stageTargetRepository;
