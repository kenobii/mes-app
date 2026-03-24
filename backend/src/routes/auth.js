const { Router } = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const operatorRepository = require('../repositories/operatorRepository');
const { authMiddleware, SECRET } = require('../middleware/auth');

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });

  const user = operatorRepository.findByEmail(email.toLowerCase().trim());
  if (!user || !user.password_hash)
    return res.status(401).json({ error: 'Credenciais inválidas.' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid)
    return res.status(401).json({ error: 'Credenciais inválidas.' });

  const role = user.role || 'conferente';
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role },
    SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role },
    password_change_required: user.password_change_required === 1,
  });
});

// GET /api/auth/guest-token  (público)
router.get('/guest-token', (req, res) => {
  const token = jwt.sign(
    { id: 0, name: 'Convidado', role: 'guest' },
    SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, user: { id: 0, name: 'Convidado', role: 'guest' } });
});

// GET /api/auth/me  (autenticado) — retorna dados frescos do banco
router.get('/me', authMiddleware, (req, res) => {
  if (req.user.role === 'guest') {
    return res.json({ id: 0, name: 'Convidado', email: null, role: 'guest' });
  }
  const user = operatorRepository.findPublicById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  res.json(user);
});

// POST /api/auth/change-password  (autenticado)
router.post('/change-password', authMiddleware, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });

  const hash = bcrypt.hashSync(password, 10);
  operatorRepository.changePassword(req.user.id, hash);

  res.json({ ok: true });
});

module.exports = router;
