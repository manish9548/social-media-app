const express = require('express');
const router = express.Router();
const { run, get, all, lastInsertRowid } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const POST_SELECT = `
  SELECT p.id, p.content, p.created_at,
         u.id as user_id, u.username, u.display_name, u.avatar_color,
         (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
         (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
  FROM posts p JOIN users u ON u.id = p.user_id
`;

// GET /api/posts/feed  — posts from followed users + own posts
router.get('/feed', authMiddleware, (req, res) => {
  const posts = all(
    `${POST_SELECT}
     WHERE p.user_id = ? OR p.user_id IN (
       SELECT following_id FROM followers WHERE follower_id = ?
     )
     ORDER BY p.created_at DESC LIMIT 50`,
    [req.user.id, req.user.id]
  );
  const enriched = posts.map(p => ({
    ...p,
    liked: !!get('SELECT id FROM likes WHERE post_id = ? AND user_id = ?', [p.id, req.user.id])
  }));
  res.json(enriched);
});

// GET /api/posts/explore  — all posts
router.get('/explore', authMiddleware, (req, res) => {
  const posts = all(
    `${POST_SELECT} ORDER BY p.created_at DESC LIMIT 50`,
    []
  );
  const enriched = posts.map(p => ({
    ...p,
    liked: !!get('SELECT id FROM likes WHERE post_id = ? AND user_id = ?', [p.id, req.user.id])
  }));
  res.json(enriched);
});

// GET /api/posts/user/:userId  — posts by a specific user
router.get('/user/:userId', authMiddleware, (req, res) => {
  const posts = all(
    `${POST_SELECT} WHERE p.user_id = ? ORDER BY p.created_at DESC`,
    [req.params.userId]
  );
  const enriched = posts.map(p => ({
    ...p,
    liked: !!get('SELECT id FROM likes WHERE post_id = ? AND user_id = ?', [p.id, req.user.id])
  }));
  res.json(enriched);
});

// POST /api/posts
router.post('/', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' });
  }
  if (content.length > 500) {
    return res.status(400).json({ error: 'Post too long (max 500 chars)' });
  }
  const id = run('INSERT INTO posts (user_id, content) VALUES (?,?)', [req.user.id, content.trim()]);
  const post = get(`${POST_SELECT} WHERE p.id = ?`, [id]);
  res.status(201).json({ ...post, liked: false });
});

// DELETE /api/posts/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const post = get('SELECT user_id FROM posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  run('DELETE FROM posts WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// POST /api/posts/:id/like  — toggle like
router.post('/:id/like', authMiddleware, (req, res) => {
  const postId = parseInt(req.params.id);
  const post = get('SELECT id FROM posts WHERE id = ?', [postId]);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = get('SELECT id FROM likes WHERE post_id = ? AND user_id = ?', [postId, req.user.id]);
  if (existing) {
    run('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [postId, req.user.id]);
  } else {
    run('INSERT INTO likes (post_id, user_id) VALUES (?,?)', [postId, req.user.id]);
  }
  const count = get('SELECT COUNT(*) as c FROM likes WHERE post_id = ?', [postId])?.c || 0;
  res.json({ liked: !existing, like_count: count });
});

module.exports = router;
