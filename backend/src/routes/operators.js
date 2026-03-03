const { Router }  = require('express');
const bcrypt       = require('bcryptjs');
const nodemailer   = require('nodemailer');
const db           = require('../db/database');
const { adminMiddleware } = require('../middleware/auth');

const router = Router();

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function sendTempPasswordEmail(to, name, password) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;
  if (!user || !pass) {
    console.warn('GMAIL_USER / GMAIL_PASS não configurados. Email não enviado.');
    return false;
  }
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  await transporter.sendMail({
    from: `"Dados Operacionais" <${user}>`,
    to,
    subject: 'Seu acesso ao Dados Operacionais',
    html: `
      <p>Olá, <strong>${name}</strong>!</p>
      <p>Sua conta foi criada no sistema <strong>Dados Operacionais</strong>.</p>
      <p>Sua senha temporária é: <strong style="font-size:18px;letter-spacing:2px">${password}</strong></p>
      <p>Você deverá alterá-la no primeiro acesso.</p>
    `,
  });
  return true;
}

router.get('/', (_req, res) => {
  res.json(db.prepare(
    'SELECT id, uuid, name, email, role, active, external_id FROM operators ORDER BY name'
  ).all());
});

router.post('/', adminMiddleware, async (req, res) => {
  const { name, email, external_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });

  let passwordHash = null;
  let tempPassword = null;

  if (email) {
    tempPassword = generateTempPassword();
    passwordHash = bcrypt.hashSync(tempPassword, 10);
  }

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

  const created = db.prepare(
    'SELECT id, uuid, name, email, active FROM operators WHERE id = ?'
  ).get(result.lastInsertRowid);

  let emailSent = false;
  if (email && tempPassword) {
    emailSent = await sendTempPasswordEmail(email, name, tempPassword).catch(err => {
      console.error('Erro ao enviar email:', err.message);
      return false;
    });
  }

  res.status(201).json({ ...created, emailSent });
});

router.put('/:id', adminMiddleware, (req, res) => {
  const { name, active, external_id, role } = req.body;
  // Impede que o próprio admin remova seu próprio acesso de admin
  const target = db.prepare('SELECT id, role FROM operators WHERE id = ?').get(req.params.id);
  const newRole = (role === 'admin' || role === 'user') ? role : null;
  if (newRole === 'user' && target?.role === 'admin' && Number(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Você não pode remover sua própria permissão de admin.' });

  // Constrói SET dinamicamente para suportar atualização opcional de email
  const fields = [];
  const params = [];

  if (name !== undefined)        { fields.push('name = ?');        params.push(name.trim()); }
  if ('email' in req.body)       { fields.push('email = ?');       params.push(req.body.email ? req.body.email.toLowerCase().trim() : null); }
  if (active !== undefined)      { fields.push('active = ?');      params.push(active); }
  if (external_id !== undefined) { fields.push('external_id = ?'); params.push(external_id); }
  if (newRole !== null)          { fields.push('role = ?');        params.push(newRole); }

  if (fields.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE operators SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json(db.prepare(
    'SELECT id, uuid, name, email, role, active FROM operators WHERE id = ?'
  ).get(req.params.id));
});

router.post('/:id/reset-password', adminMiddleware, async (req, res) => {
  const op = db.prepare('SELECT id, name, email FROM operators WHERE id = ?').get(req.params.id);
  if (!op) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const tempPassword = generateTempPassword();
  const passwordHash = bcrypt.hashSync(tempPassword, 10);

  db.prepare(
    'UPDATE operators SET password_hash = ?, password_change_required = 1 WHERE id = ?'
  ).run(passwordHash, req.params.id);

  let emailSent = false;
  if (op.email) {
    emailSent = await sendTempPasswordEmail(op.email, op.name, tempPassword).catch(err => {
      console.error('Erro ao enviar email:', err.message);
      return false;
    });
  }

  // Se o email foi enviado, não retorna a senha no JSON.
  // Se não foi enviado, retorna para o admin compartilhar manualmente.
  res.json({ emailSent, tempPassword: emailSent ? null : tempPassword });
});

module.exports = router;
