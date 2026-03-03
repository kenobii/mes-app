const { Router } = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/database');
const { authMiddleware, SECRET } = require('../middleware/auth');

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });

  const user = db.prepare('SELECT * FROM operators WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !user.password_hash)
    return res.status(401).json({ error: 'Credenciais inválidas.' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid)
    return res.status(401).json({ error: 'Credenciais inválidas.' });

  const role = user.role || 'user';
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

// POST /api/auth/change-password  (autenticado)
router.post('/change-password', authMiddleware, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`
    UPDATE operators SET password_hash = ?, password_change_required = 0 WHERE id = ?
  `).run(hash, req.user.id);

  res.json({ ok: true });
});

module.exports = router;
