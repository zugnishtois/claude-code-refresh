const express = require('express');
const crypto = require('crypto');
const path = require('path');
const store = require('./store');
const scheduler = require('./scheduler');
const logs = require('./logs');

const app = express();
const PORT = process.env.PORT || 3000;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || null;

// Active session tokens
const sessions = new Set();

app.use(express.json());

// --- robots.txt ---
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

// --- Auth ---

function authMiddleware(req, res, next) {
  if (!DASHBOARD_PASSWORD) return next();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && sessions.has(token)) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

app.post('/api/login', (req, res) => {
  if (!DASHBOARD_PASSWORD) return res.json({ token: null, authRequired: false });

  const { password } = req.body;
  if (password !== DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'wrong_password' });
  }

  const token = crypto.randomUUID();
  sessions.add(token);
  res.json({ token, authRequired: true });
});

app.get('/api/auth-check', (req, res) => {
  if (!DASHBOARD_PASSWORD) return res.json({ authRequired: false, authenticated: true });

  const token = req.headers.authorization?.replace('Bearer ', '');
  const authenticated = token && sessions.has(token);
  res.json({ authRequired: true, authenticated });
});

// Static files (always served, login page is part of the SPA)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Protect all API routes except login and auth-check
app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/auth-check') return next();
  authMiddleware(req, res, next);
});

// --- API Routes ---

app.get('/api/status', (req, res) => {
  const config = store.loadConfig();
  const state = scheduler.getState();
  res.json({
    lastPing: state.lastPingResult,
    nextPingTime: state.nextPingTime,
    isPaused: state.isPaused,
    isRunning: state.isRunning,
    config
  });
});

app.get('/api/config', (req, res) => {
  res.json(store.loadConfig());
});

app.put('/api/config', (req, res) => {
  const current = store.loadConfig();
  const body = req.body;

  if (body.intervalMinutes !== undefined) {
    const m = parseInt(body.intervalMinutes);
    if (isNaN(m) || m < 1 || m > 1440) return res.status(400).json({ error: 'intervalMinutes must be 1-1440' });
    current.intervalMinutes = m;
  }

  if (body.scheduleTimes !== undefined) {
    if (body.scheduleTimes === null) {
      current.scheduleTimes = null;
    } else if (Array.isArray(body.scheduleTimes)) {
      const valid = body.scheduleTimes.every(t => /^\d{2}:\d{2}$/.test(t));
      if (!valid) return res.status(400).json({ error: 'scheduleTimes must be HH:MM format' });
      current.scheduleTimes = body.scheduleTimes;
    }
  }

  if (body.timezone !== undefined) {
    current.timezone = body.timezone;
  }

  if (body.paused !== undefined) {
    current.paused = !!body.paused;
  }

  const saved = store.saveConfig(current);
  scheduler.reschedule(saved);
  res.json(saved);
});

app.get('/api/history', (req, res) => {
  const history = store.loadHistory();
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const entries = history.entries.slice(offset, offset + limit);
  res.json({ entries, total: history.entries.length });
});

app.delete('/api/history', (req, res) => {
  store.clearHistory();
  res.json({ ok: true });
});

app.post('/api/ping', (req, res) => {
  // Fire and forget — respond immediately, ping runs in background
  scheduler.executePing('manual');
  res.json({ started: true });
});

app.get('/api/logs', (req, res) => {
  const since = parseInt(req.query.since) || 0;
  res.json(logs.getSince(since));
});

app.post('/api/pause', (req, res) => {
  scheduler.pause();
  res.json({ paused: true });
});

app.post('/api/resume', (req, res) => {
  scheduler.resume();
  res.json({ paused: false });
});

// --- Start ---

const config = store.loadConfig();
const history = store.loadHistory();
if (history.entries.length > 0) {
  const state = scheduler.getState();
  state.lastPingResult = history.entries[0];
}

scheduler.start(config);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard running at http://0.0.0.0:${PORT}`);
  console.log(`Auth: ${DASHBOARD_PASSWORD ? 'ENABLED' : 'DISABLED (set DASHBOARD_PASSWORD to enable)'}`);
  console.log(`Config:`, JSON.stringify(config));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  scheduler.stop();
  process.exit(0);
});
