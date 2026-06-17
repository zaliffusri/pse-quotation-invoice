const { readStore } = require('../db');

function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  if (req.path.startsWith('/auth/')) return next();
  return res.status(401).json({ error: 'Sila log masuk dahulu.' });
}

module.exports = { requireAuth };
