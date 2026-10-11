const express = require('express');
const cors = require('cors');
const path = require('path');
const { authenticateToken } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Express 4 khong tu bat loi async -> boc lai cho gon.
const wrap = (router) => {
  for (const layer of router.stack) {
    for (const l of layer.route?.stack ?? []) {
      const fn = l.handle;
      l.handle = (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
    }
  }
  return router;
};

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.ejs'), {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
}));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.ejs'), {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
}));
app.get('/', authenticateToken, (req, res) => res.sendFile(path.join(__dirname, 'views', 'smart_garden_simulation.ejs'), {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
}));
app.use('/api/auth', wrap(require('./routes/auth')));
app.use('/api/assets', wrap(require('./routes/assets')));
app.use('/api/devices', wrap(require('./routes/devices')));

app.use((err, req, res, next) => {
  if (err.name === 'CastError') return res.status(400).json({ error: 'id khong hop le' });
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;
