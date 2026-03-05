const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  next();
}

function requireNonGuest(req, res, next) {
  if (req.user?.role === 'guest')
    return res.status(403).json({ error: 'Convidados não podem realizar esta ação.' });
  next();
}

module.exports = { authMiddleware, adminMiddleware, requireNonGuest, SECRET };
