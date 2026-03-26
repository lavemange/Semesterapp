'use strict';

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// CORS – allow the configured frontend origin (or all origins for local use)
// ---------------------------------------------------------------------------
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// ---------------------------------------------------------------------------
// MySQL connection pool – retries on startup so the container can wait for DB
// ---------------------------------------------------------------------------
let pool;

async function createPool() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'semesterapp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
  });
}

async function waitForDb(retries = 20, delay = 3000) {
  await createPool();
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      console.log('Database connected.');
      return;
    } catch (err) {
      console.log(`DB not ready (attempt ${i}/${retries}): ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Could not connect to database after multiple retries.');
}

// ---------------------------------------------------------------------------
// Helper – format a Date (or MySQL date string) to YYYY-MM-DD
// ---------------------------------------------------------------------------
function toDateStr(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Already a string – take first 10 chars
  return String(value).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/employees
app.get('/api/employees', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, created_at FROM employees ORDER BY id ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees  { name }
// Creates the employee if not exists, otherwise returns the existing one.
app.post('/api/employees', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    // ON DUPLICATE KEY UPDATE keeps the existing row and returns its id via LAST_INSERT_ID()
    const [result] = await pool.query(
      'INSERT INTO employees (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
      [name]
    );
    const [rows] = await pool.query(
      'SELECT id, name, created_at FROM employees WHERE id = ?',
      [result.insertId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/requests?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/api/requests', async (req, res) => {
  const { from, to } = req.query;
  try {
    let sql = 'SELECT employee_id, date FROM time_off_requests';
    const params = [];
    if (from && to) {
      sql += ' WHERE date >= ? AND date <= ?';
      params.push(from, to);
    }
    sql += ' ORDER BY employee_id, date';
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(r => ({
      employeeId: r.employee_id,
      date: toDateStr(r.date),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/requests/toggle  { employeeId, date }
app.post('/api/requests/toggle', async (req, res) => {
  const { employeeId, date } = req.body;
  if (!employeeId || !date) {
    return res.status(400).json({ error: 'employeeId and date are required' });
  }
  try {
    const [existing] = await pool.query(
      'SELECT id FROM time_off_requests WHERE employee_id = ? AND date = ?',
      [employeeId, date]
    );
    if (existing.length > 0) {
      await pool.query(
        'DELETE FROM time_off_requests WHERE employee_id = ? AND date = ?',
        [employeeId, date]
      );
      res.json({ active: false });
    } else {
      await pool.query(
        'INSERT INTO time_off_requests (employee_id, date) VALUES (?, ?)',
        [employeeId, date]
      );
      res.json({ active: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
waitForDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error(err.message);
    process.exit(1);
  });
