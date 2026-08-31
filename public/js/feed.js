if (!requireAuth()) throw new Error('Not authenticated');

let currentUser = getUser();
let currentTab  = 'feed';

// ── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Refresh user data
  try {
    currentUser = await api.getMe();
    setAuth(getToken(), currentUser);
  } catch { logout(); return; }

  // Render nav avatar
  renderNavAvatar();

  // Load posts + suggested users
  await Promise.all([loadPosts(), loadSuggested()]);

  // Search
  initSearch();
});

function renderNavAvatar() {
  const navAvatar = document.getElementById('nav-avatar');
  navAvatar.textContent = (currentUser.display_name || currentUser.username)[0].toUpperCase();
  navAvatar.style.background = currentUser.avatar_color || '#7c3aed';
  document.getElementById('nav-username').textContent = currentUser.display_name || currentUser.username;

  const creatorAvatar = document.getElementById('creator-avatar');
  creatorAvatar.textContent = navAvatar.textContent;
  creatorAvatar.style.background = currentUser.avatar_color || '#7c3aed';
}

// ── Tabs ────────────────────────────────────────────────────────────────────
function setTab(tab) {
  currentTab = tab;
  document.getElementById('tab-feed').classList.toggle('active', tab === 'feed');
  document.getElementById('tab-explore').classList.toggle('active', tab === 'explore');
  document.getElementById('nav-feed').classList.toggle('active', tab === 'feed');
  document.getElementById('nav-explore').classList.toggle('active', tab === 'explore');
  loadPosts();
}

// ── Load posts ───────────────────────────────────────────────────────────────
async function loadPosts() {
  const container = document.getElementById('posts-container');
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const posts = currentTab === 'feed' ? await api.getFeed() : await api.getExplore();
    if (posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">${currentTab === 'feed' ? '🌱' : '🔭'}</div>
          <p>${currentTab === 'feed'
            ? 'Your feed is empty. Follow some people or explore!'
            : 'No posts yet. Be the first to post!'}</p>
        </div>`;
      return;
    }
    container.innerHTML = '';
    posts.forEach(p => container.appendChild(renderPost(p)));
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>❌ ${e.message}</p></div>`;
  }
}

// ── Render Post ──────────────────────────────────────────────────────────────
function renderPost(post) {
  const card = document.createElement('div');
  card.className = 'post-card glass';
  card.dataset.postId = post.id;

  const isOwn   = post.user_id === currentUser.id;
  const avatarBg = post.avatar_color || '#7c3aed';
  const initial  = (post.display_name || post.username || '?')[0].toUpperCase();

  card.innerHTML = `
    <div class="post-header">
      <div class="avatar" style="background:${avatarBg};cursor:pointer"
           onclick="goToProfile('${escHtml(post.username)}')">${initial}</div>
      <div class="post-user-info">
        <div class="name" onclick="goToProfile('${escHtml(post.username)}')">${escHtml(post.display_name)}</div>
        <div class="handle">@${escHtml(post.username)} · <span class="post-time">${timeAgo(post.created_at)}</span></div>
      </div>
    </div>
    <div class="post-content">${escHtml(post.content)}</div>
    <div class="post-actions">
      <button class="post-action-btn like-btn ${post.liked ? 'liked' : ''}"
              onclick="toggleLike(this, ${post.id})" id="like-btn-${post.id}">
        <span class="icon">${post.liked ? '❤️' : '🤍'}</span>
        <span class="count">${post.like_count}</span>
      </button>
      <button class="post-action-btn" onclick="toggleComments(${post.id})">
        <span class="icon">💬</span>
        <span class="count" id="comment-count-${post.id}">${post.comment_count}</span>
      </button>
      <div class="post-actions-right">
        ${isOwn ? `<button class="post-action-btn delete-btn" onclick="deletePost(${post.id})">🗑️</button>` : ''}
      </div>
    </div>
    <div class="comments-section" id="comments-${post.id}">
      <div class="comment-input-row">
        <input type="text" placeholder="Write a comment…" id="comment-input-${post.id}"
               onkeydown="if(event.key==='Enter') submitComment(${post.id})" />
        <button onclick="submitComment(${post.id})">Reply</button>
      </div>
      <div class="comments-list" id="comments-list-${post.id}">
        <div class="spinner" style="margin:12px auto;width:20px;height:20px;border-width:2px;"></div>
      </div>
    </div>
  `;
  return card;
}

// ── Like ─────────────────────────────────────────────────────────────────────
async function toggleLike(btn, postId) {
  try {
    const { liked, like_count } = await api.likePost(postId);
    btn.classList.toggle('liked', liked);
    btn.querySelector('.icon').textContent = liked ? '❤️' : '🤍';
    btn.querySelector('.count').textContent = like_count;
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Delete Post ──────────────────────────────────────────────────────────────
async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  try {
    await api.deletePost(postId);
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      card.style.transition = 'all 0.3s';
      setTimeout(() => card.remove(), 300);
    }
    toast('Post deleted', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Comments ─────────────────────────────────────────────────────────────────
async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  const isOpen  = section.classList.contains('open');
  section.classList.toggle('open', !isOpen);
  if (!isOpen) await loadComments(postId);
}

async function loadComments(postId) {
  const list = document.getElementById(`comments-list-${postId}`);
  list.innerHTML = '<div class="spinner" style="margin:12px auto;width:20px;height:20px;border-width:2px;"></div>';
  try {
    const comments = await api.getComments(postId);
    renderComments(postId, comments);
  } catch (e) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:8px">Failed to load</p>`;
  }
}

function renderComments(postId, comments) {
  const list = document.getElementById(`comments-list-${postId}`);
  if (comments.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:8px 0">No comments yet. Be first! 🗣️</p>`;
    return;
  }
  list.innerHTML = '';
  comments.forEach(c => list.appendChild(renderComment(c, postId)));
}

function renderComment(c, postId) {
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.dataset.commentId = c.id;
  const isOwn = c.user_id === currentUser.id;
  const avatarBg = c.avatar_color || '#7c3aed';
  const initial  = (c.display_name || c.username || '?')[0].toUpperCase();

  item.innerHTML = `
    <div class="avatar" style="background:${avatarBg};cursor:pointer;width:30px;height:30px;font-size:12px"
         onclick="goToProfile('${escHtml(c.username)}')">${initial}</div>
    <div class="comment-body">
      <div class="comment-header">
        <span class="name" onclick="goToProfile('${escHtml(c.username)}')">${escHtml(c.display_name)}</span>
        <span class="time">${timeAgo(c.created_at)}</span>
      </div>
      <div class="comment-text">${escHtml(c.content)}</div>
    </div>
    ${isOwn ? `<button class="comment-delete" onclick="deleteComment(${postId}, ${c.id})">✕</button>` : ''}
  `;
  return item;
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;
  try {
    const comment = await api.addComment(postId, { content });
    input.value = '';
    const list = document.getElementById(`comments-list-${postId}`);
    // Remove empty state if present
    if (list.querySelector('p')) list.innerHTML = '';
    list.appendChild(renderComment(comment, postId));
    // Update count
    const countEl = document.getElementById(`comment-count-${postId}`);
    if (countEl) countEl.textContent = parseInt(countEl.textContent || 0) + 1;
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteComment(postId, commentId) {
  try {
    await api.deleteComment(postId, commentId);
    const item = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (item) item.remove();
    const countEl = document.getElementById(`comment-count-${postId}`);
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent || 0) - 1);
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Create Post ──────────────────────────────────────────────────────────────
async function createPost() {
  const content = document.getElementById('post-content').value.trim();
  if (!content) return toast('Write something first!', 'error');
  const btn = document.getElementById('post-btn');
  btn.disabled = true; btn.textContent = 'Posting…';
  try {
    const post = await api.createPost({ content });
    document.getElementById('post-content').value = '';
    document.getElementById('char-count').textContent = '0 / 500';
    document.getElementById('char-count').className = 'char-count';

    // Prepend to current tab's list
    const container = document.getElementById('posts-container');
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) container.innerHTML = '';
    const card = renderPost({ ...post, liked: false });
    container.prepend(card);
    toast('Posted! ⚡', 'success');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = '⚡ Post';
  }
}

function updateCharCount(ta) {
  const n   = ta.value.length;
  const el  = document.getElementById('char-count');
  el.textContent = `${n} / 500`;
  el.className   = n > 450 ? 'char-count danger' : n > 380 ? 'char-count warning' : 'char-count';
}

// ── Suggested Users ──────────────────────────────────────────────────────────
async function loadSuggested() {
  const container = document.getElementById('suggested-users');
  try {
    const users = await api.getSuggested(currentUser.id);
    if (users.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No suggestions yet 🙂</p>';
      return;
    }
    container.innerHTML = '';
    users.forEach(u => {
      const item = document.createElement('div');
      item.className = 'suggest-item';
      item.innerHTML = `
        <div class="avatar" style="background:${u.avatar_color || '#7c3aed'};cursor:pointer"
             onclick="goToProfile('${escHtml(u.username)}')">${(u.display_name||u.username)[0].toUpperCase()}</div>
        <div class="suggest-info">
          <div class="name" onclick="goToProfile('${escHtml(u.username)}')">${escHtml(u.display_name)}</div>
          <div class="handle">@${escHtml(u.username)}</div>
        </div>
        <button class="btn btn-follow btn-sm" data-uid="${u.id}" onclick="quickFollow(this, ${u.id})">Follow</button>
      `;
      container.appendChild(item);
    });
  } catch {
    container.innerHTML = '';
  }
}

async function quickFollow(btn, userId) {
  try {
    await api.follow(userId);
    btn.classList.add('following');
    btn.textContent = 'Following';
    btn.onclick = () => quickUnfollow(btn, userId);
    toast('Now following! ✨', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}
async function quickUnfollow(btn, userId) {
  try {
    await api.unfollow(userId);
    btn.classList.remove('following');
    btn.textContent = 'Follow';
    btn.onclick = () => quickFollow(btn, userId);
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Search ───────────────────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  let timer;

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { results.classList.remove('open'); return; }
    timer = setTimeout(async () => {
      try {
        const users = await api.searchUsers(q);
        results.innerHTML = '';
        if (users.length === 0) {
          results.innerHTML = '<div class="search-result-item"><span style="color:var(--text-muted)">No results</span></div>';
        } else {
          users.forEach(u => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
              <div class="avatar" style="background:${u.avatar_color||'#7c3aed'};width:32px;height:32px;font-size:13px">${(u.display_name||u.username)[0].toUpperCase()}</div>
              <div><div class="name">${escHtml(u.display_name)}</div><div class="handle">@${escHtml(u.username)}</div></div>
            `;
            item.onclick = () => { goToProfile(u.username); results.classList.remove('open'); input.value = ''; };
            results.appendChild(item);
          });
        }
        results.classList.add('open');
      } catch {}
    }, 280);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.navbar-search')) results.classList.remove('open');
  });
}

// ── Utils ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
