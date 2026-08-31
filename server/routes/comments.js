const express = require('express');
const router = express.Router({ mergeParams: true });
const { run, get, all, lastInsertRowid } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/posts/:postId/comments
router.get('/', authMiddleware, (req, res) => {
  const comments = all(
    `SELECT c.id, c.content, c.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar_color
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC`,
    [req.params.postId]
  );
  res.json(comments);
});

// POST /api/posts/:postId/comments
router.post('/', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Comment cannot be empty' });
  }
  if (content.length > 280) {
    return res.status(400).json({ error: 'Comment too long (max 280 chars)' });
  }
  const post = get('SELECT id FROM posts WHERE id = ?', [req.params.postId]);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const id = run(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?,?,?)',
    [req.params.postId, req.user.id, content.trim()]
  );
  const comment = get(
    `SELECT c.id, c.content, c.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar_color
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [id]
  );
  res.status(201).json(comment);
});

// DELETE /api/comments/:id
router.delete('/:commentId', authMiddleware, (req, res) => {
  const comment = get('SELECT user_id, post_id FROM comments WHERE id = ?', [req.params.commentId]);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  // Allow comment owner OR post owner to delete
  const post = get('SELECT user_id FROM posts WHERE id = ?', [comment.post_id]);
  if (comment.user_id !== req.user.id && post?.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  run('DELETE FROM comments WHERE id = ?', [req.params.commentId]);
  res.json({ success: true });
});

module.exports = router;
