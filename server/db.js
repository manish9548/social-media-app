const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'social.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db;

async function initDB() {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON;');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name  TEXT NOT NULL,
      bio           TEXT DEFAULT '',
      avatar_color  TEXT DEFAULT '#7c3aed',
      password_hash TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      content    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id    INTEGER NOT NULL,
      user_id    INTEGER NOT NULL,
      content    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      UNIQUE(post_id, user_id),
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS followers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id  INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(follower_id, following_id),
      FOREIGN KEY(follower_id) REFERENCES users(id),
      FOREIGN KEY(following_id) REFERENCES users(id)
    );
  `);

  await seedDB();

  persist();
  console.log('✅ Database initialized');
}

async function seedDB() {
  const userCount = get('SELECT COUNT(*) as c FROM users')?.c || 0;
  if (userCount > 0) return;

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('password123', 10);

  // Seed Users
  run(`INSERT INTO users (username, display_name, bio, avatar_color, password_hash) VALUES
    ('demo_user', 'Demo User', 'Exploring the new Pulse platform! 🚀', '#7c3aed', ?),
    ('sarah_code', 'Sarah Chen', 'Full-stack developer & UI designer 💻✨', '#ec4899', ?),
    ('marcus_v', 'Marcus Vance', 'Photography, tech & coffee lover ☕📸', '#06b6d4', ?),
    ('elena_r', 'Elena Rostova', 'Building the future of web apps 🌐', '#10b981', ?)
  `, [hash, hash, hash, hash]);

  // Seed Posts
  run(`INSERT INTO posts (user_id, content, created_at) VALUES
    (2, 'Just deployed a new web feature using modern CSS glassmorphism & gradients! Loving this aesthetic 🎨', datetime('now', '-2 hours')),
    (3, 'Coffee brew #2 of the morning. Ready to crush some code today! ☕💻', datetime('now', '-1 hours')),
    (4, 'What is everyone building this week? Drop your projects in the comments! 👇', datetime('now', '-30 minutes')),
    (1, 'Welcome to Pulse! ⚡ Connect, share thoughts, and follow amazing people.', datetime('now', '-5 minutes'))
  `);

  // Seed Followers (demo_user follows sarah & marcus; sarah follows demo_user & elena)
  run(`INSERT INTO followers (follower_id, following_id) VALUES
    (1, 2), (1, 3), (2, 1), (2, 4), (3, 1), (4, 2)
  `);

  // Seed Comments
  run(`INSERT INTO comments (post_id, user_id, content, created_at) VALUES
    (1, 1, 'Looks stunning Sarah! 🔥', datetime('now', '-1 hour')),
    (1, 3, 'Agreed! The UI is super smooth.', datetime('now', '-45 minutes')),
    (3, 2, 'Building a mini social platform! 🚀', datetime('now', '-15 minutes'))
  `);

  // Seed Likes
  run(`INSERT INTO likes (post_id, user_id) VALUES (1, 1), (1, 3), (2, 1), (3, 1), (3, 4)`);

  console.log('🌱 Demo database seeded with sample users, posts, and comments!');
}

// Persist in-memory DB to file
function persist() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Helper: run a write statement and persist. Returns last inserted row id.
function run(sql, params = []) {
  db.run(sql, params);
  // Capture rowid BEFORE persist() — db.export() resets last_insert_rowid to 0
  const results = db.exec('SELECT last_insert_rowid()');
  const rowid = (results && results.length > 0)
    ? Number(results[0].values[0][0])
    : null;
  persist();
  return rowid;
}

// Helper: get all rows
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    // sql.js can return BigInt for INTEGER columns — normalize to Number
    const normalized = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k] = typeof v === 'bigint' ? Number(v) : v;
    }
    rows.push(normalized);
  }
  stmt.free();
  return rows;
}

// Helper: get one row
function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

// Helper: get last inserted row id (use the return value of run() instead)
function lastInsertRowid() {
  const results = db.exec('SELECT last_insert_rowid()');
  if (!results || results.length === 0) return null;
  const val = results[0].values[0][0];
  return Number(val) || null;
}

module.exports = { initDB, run, all, get, lastInsertRowid };
