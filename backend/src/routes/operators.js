const { Router }  = require('express');
const bcrypt       = require('bcryptjs');
const { generateTempPassword, sendTempPasswordEmail } = require('../services/emailService');
const operatorRepository = require('../repositories/operatorRepository');
const { adminMiddleware } = require('../middleware/auth');

const router = Router();

router.get('/', (_req, res) => {
  res.json(operatorRepository.findAll());
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

  const created = operatorRepository.create({ name, email, passwordHash, external_id });

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
  const target = operatorRepository.findRoleById(req.params.id);
  const newRole = (role === 'admin' || role === 'user') ? role : null;
  if (newRole === 'user' && target?.role === 'admin' && Number(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Você não pode remover sua própria permissão de admin.' });

  const fields = { name, active, external_id, role: newRole };
  if ('email' in req.body) fields.email = req.body.email;

  res.json(operatorRepository.update(req.params.id, fields));
});

router.post('/:id/reset-password', adminMiddleware, async (req, res) => {
  const op = operatorRepository.findByIdFull(req.params.id);
  if (!op) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const tempPassword = generateTempPassword();
  const passwordHash = bcrypt.hashSync(tempPassword, 10);
  operatorRepository.updatePassword(req.params.id, passwordHash);

  let emailSent = false;
  if (op.email) {
    emailSent = await sendTempPasswordEmail(op.email, op.name, tempPassword).catch(err => {
      console.error('Erro ao enviar email:', err.message);
      return false;
    });
  }

  res.json({ emailSent, tempPassword: emailSent ? null : tempPassword });
});

module.exports = router;
