const express = require('express');
const router = express.Router();
const { run, get, all, lastInsertRowid } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/users/search?q=
router.get('/search', authMiddleware, (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const users = all(
    `SELECT id, username, display_name, bio, avatar_color FROM users
     WHERE (username LIKE ? OR display_name LIKE ?) AND id != ?
     LIMIT 10`,
    [q, q, req.user.id]
  );
  res.json(users);
});

// GET /api/users/me
router.get('/me', authMiddleware, (req, res) => {
  const user = get(
    'SELECT id, username, display_name, bio, avatar_color, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// PUT /api/users/me
router.put('/me', authMiddleware, (req, res) => {
  const { display_name, bio, avatar_color } = req.body;
  if (!display_name || display_name.trim() === '') {
    return res.status(400).json({ error: 'Display name required' });
  }
  run(
    'UPDATE users SET display_name = ?, bio = ?, avatar_color = ? WHERE id = ?',
    [display_name.trim(), bio || '', avatar_color || '#7c3aed', req.user.id]
  );
  const user = get(
    'SELECT id, username, display_name, bio, avatar_color FROM users WHERE id = ?',
    [req.user.id]
  );
  res.json(user);
});

// GET /api/users/:username
router.get('/:username', authMiddleware, (req, res) => {
  const user = get(
    'SELECT id, username, display_name, bio, avatar_color, created_at FROM users WHERE username = ?',
    [req.params.username]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });

  const stats = {
    posts: get('SELECT COUNT(*) as c FROM posts WHERE user_id = ?', [user.id])?.c || 0,
    followers: get('SELECT COUNT(*) as c FROM followers WHERE following_id = ?', [user.id])?.c || 0,
    following: get('SELECT COUNT(*) as c FROM followers WHERE follower_id = ?', [user.id])?.c || 0,
  };
  const isFollowing = !!get(
    'SELECT id FROM followers WHERE follower_id = ? AND following_id = ?',
    [req.user.id, user.id]
  );
  res.json({ ...user, ...stats, isFollowing, isOwn: user.id === req.user.id });
});

// POST /api/users/:id/follow
router.post('/:id/follow', authMiddleware, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

  const target = get('SELECT id FROM users WHERE id = ?', [targetId]);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const already = get(
    'SELECT id FROM followers WHERE follower_id = ? AND following_id = ?',
    [req.user.id, targetId]
  );
  if (!already) {
    run('INSERT INTO followers (follower_id, following_id) VALUES (?,?)', [req.user.id, targetId]);
  }
  const count = get('SELECT COUNT(*) as c FROM followers WHERE following_id = ?', [targetId])?.c || 0;
  res.json({ following: true, followers: count });
});

// DELETE /api/users/:id/follow
router.delete('/:id/follow', authMiddleware, (req, res) => {
  const targetId = parseInt(req.params.id);
  run('DELETE FROM followers WHERE follower_id = ? AND following_id = ?', [req.user.id, targetId]);
  const count = get('SELECT COUNT(*) as c FROM followers WHERE following_id = ?', [targetId])?.c || 0;
  res.json({ following: false, followers: count });
});

// GET /api/users/:id/followers
router.get('/:id/followers', authMiddleware, (req, res) => {
  const users = all(
    `SELECT u.id, u.username, u.display_name, u.avatar_color
     FROM followers f JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = ? ORDER BY f.created_at DESC`,
    [req.params.id]
  );
  res.json(users);
});

// GET /api/users/:id/following
router.get('/:id/following', authMiddleware, (req, res) => {
  const users = all(
    `SELECT u.id, u.username, u.display_name, u.avatar_color
     FROM followers f JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = ? ORDER BY f.created_at DESC`,
    [req.params.id]
  );
  res.json(users);
});

// GET /api/users/:id/suggested
router.get('/:id/suggested', authMiddleware, (req, res) => {
  const users = all(
    `SELECT u.id, u.username, u.display_name, u.avatar_color
     FROM users u
     WHERE u.id != ?
       AND u.id NOT IN (SELECT following_id FROM followers WHERE follower_id = ?)
     ORDER BY RANDOM() LIMIT 5`,
    [req.user.id, req.user.id]
  );
  res.json(users);
});

module.exports = router;
