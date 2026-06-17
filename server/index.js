const express = require('express');
const session = require('express-session');
const path = require('path');
const { readStore } = require('./db');
const apiHandler = require('./routes/api');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'pse-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: isProd,
    sameSite: 'lax',
    httpOnly: true
  }
}));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const users = readStore('users', []);
  const user = users.find(u => u.username === username && u.password_hash === password);
  if (!user) return res.status(401).json({ error: 'Username atau kata laluan salah.' });
  req.session.userId = user.id;
  req.session.userName = user.name;
  res.json({ ok: true, user: { id: user.id, username: user.username, name: user.name } });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/check', (req, res) => {
  if (!req.session.userId) return res.json({ authenticated: false });
  const users = readStore('users', []);
  const user = users.find(u => u.id === req.session.userId);
  res.json({ authenticated: true, user: user ? { id: user.id, username: user.username, name: user.name } : null });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, app: 'PSE System', version: '3.0.0' });
});

app.use('/api', requireAuth, (req, res) => apiHandler(req, res));

app.get('/app.html', (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, '..', 'public', 'app.html'));
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  if (req.session.userId) return res.sendFile(path.join(__dirname, '..', 'public', 'app.html'));
  res.redirect('/login.html');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  PSE System running on port', PORT);
  if (!isProd) {
    console.log('  Local:  http://localhost:' + PORT);
    console.log('  Login:  admin / pse2026');
  }
  console.log('');
});
