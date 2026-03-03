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

  db.prepare(`
    UPDATE operators SET
      name        = COALESCE(?, name),
      active      = COALESCE(?, active),
      external_id = COALESCE(?, external_id),
      role        = COALESCE(?, role)
    WHERE id = ?
  `).run(name ?? null, active ?? null, external_id ?? null, newRole, req.params.id);
  res.json(db.prepare(
    'SELECT id, uuid, name, email, role, active FROM operators WHERE id = ?'
  ).get(req.params.id));
});

module.exports = router;
