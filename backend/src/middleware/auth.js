const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
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

// Permite admin e producao
function producaoMiddleware(req, res, next) {
  if (!['admin', 'producao'].includes(req.user?.role))
    return res.status(403).json({ error: 'Acesso restrito.' });
  next();
}

module.exports = { authMiddleware, adminMiddleware, requireNonGuest, producaoMiddleware };
