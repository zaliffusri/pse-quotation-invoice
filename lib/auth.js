const jwt = require('jsonwebtoken');
const { serialize, parse } = require('cookie');

const COOKIE = 'pse_token';
const MAX_AGE = 7 * 24 * 60 * 60;

function secret() {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || 'pse-dev-secret';
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, name: user.name }, secret(), { expiresIn: MAX_AGE });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, secret());
  } catch {
    return null;
  }
}

function setAuthCookie(res, user) {
  const token = signToken(user);
  res.setHeader('Set-Cookie', serialize(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/'
  }));
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', serialize(COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  }));
}

function getUserFromReq(req) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[COOKIE];
  if (!token) return null;
  return verifyToken(token);
}

function requireUser(req, res) {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Sila log masuk dahulu.' });
    return null;
  }
  return user;
}

module.exports = { setAuthCookie, clearAuthCookie, getUserFromReq, requireUser, COOKIE };
