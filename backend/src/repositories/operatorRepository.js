const db = require('../db/database');

const operatorRepository = {
  findAll: () =>
    db.prepare(
      'SELECT id, uuid, name, email, role, active, external_id FROM operators ORDER BY name'
    ).all(),

  findById: (id) =>
    db.prepare(
      'SELECT id, uuid, name, email, active FROM operators WHERE id = ?'
    ).get(id),

  findByIdFull: (id) =>
    db.prepare('SELECT id, name, email FROM operators WHERE id = ?').get(id),

  findRoleById: (id) =>
    db.prepare('SELECT id, role FROM operators WHERE id = ?').get(id),

  findPublicById: (id) =>
    db.prepare(
      'SELECT id, uuid, name, email, role, active FROM operators WHERE id = ?'
    ).get(id),

  create: ({ name, email, passwordHash, external_id }) => {
    const result = db.prepare(`
      INSERT INTO operators (name, email, password_hash, password_change_required, external_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      email ? email.toLowerCase().trim() : null,
      passwordHash,
      email ? 1 : 0,
      external_id ?? null
    );
    return db.prepare(
      'SELECT id, uuid, name, email, active FROM operators WHERE id = ?'
    ).get(result.lastInsertRowid);
  },

  update: (id, fields) => {
    const setClauses = [];
    const params = [];

    if (fields.name !== undefined)        { setClauses.push('name = ?');        params.push(fields.name.trim()); }
    if ('email' in fields)                { setClauses.push('email = ?');       params.push(fields.email ? fields.email.toLowerCase().trim() : null); }
    if (fields.active !== undefined)      { setClauses.push('active = ?');      params.push(fields.active); }
    if (fields.external_id !== undefined) { setClauses.push('external_id = ?'); params.push(fields.external_id); }
    if (fields.role != null)              { setClauses.push('role = ?');         params.push(fields.role); }

    if (setClauses.length > 0) {
      params.push(id);
      db.prepare(`UPDATE operators SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
    }

    return db.prepare(
      'SELECT id, uuid, name, email, role, active FROM operators WHERE id = ?'
    ).get(id);
  },

  // Used by auth: resets password and forces change on next login
  updatePassword: (id, passwordHash) => {
    db.prepare(
      'UPDATE operators SET password_hash = ?, password_change_required = 1 WHERE id = ?'
    ).run(passwordHash, id);
  },

  // Used by auth/login: fetch full record including password_hash
  findByEmail: (email) =>
    db.prepare('SELECT * FROM operators WHERE email = ?').get(email),

  // Used by auth/change-password: clears the forced-change flag
  changePassword: (id, passwordHash) => {
    db.prepare(
      'UPDATE operators SET password_hash = ?, password_change_required = 0 WHERE id = ?'
    ).run(passwordHash, id);
  },
};

module.exports = operatorRepository;
