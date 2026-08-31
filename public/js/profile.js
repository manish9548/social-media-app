if (!requireAuth()) throw new Error('Not authenticated');

let currentUser = getUser();
let profileUser = null;
let selectedColor = null;

const AVATAR_COLORS = ['#7c3aed','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#f97316'];

// ── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Refresh own user data
  try {
    currentUser = await api.getMe();
    setAuth(getToken(), currentUser);
  } catch { logout(); return; }

  // Render nav avatar
  renderNavAvatar();
  initSearch();

  // Load profile from URL param
  const params = new URLSearchParams(window.location.search);
  const username = params.get('u');
  if (!username) { window.location.href = '/feed.html'; return; }

  await loadProfile(username);
});

function renderNavAvatar() {
  const navAvatar = document.getElementById('nav-avatar');
  navAvatar.textContent  = (currentUser.display_name || currentUser.username)[0].toUpperCase();
  navAvatar.style.background = currentUser.avatar_color || '#7c3aed';
  document.getElementById('nav-username').textContent = currentUser.display_name || currentUser.username;
}

// ── Load Profile ─────────────────────────────────────────────────────────────
async function loadProfile(username) {
  const headerEl = document.getElementById('profile-header');
  const postsEl  = document.getElementById('profile-posts');

  try {
    profileUser = await api.getUser(username);
  } catch (e) {
    headerEl.innerHTML = `<div class="empty-state"><p>❌ ${e.message}</p></div>`;
    return;
  }

  // Render header
  headerEl.innerHTML = `
    <div class="profile-cover">
      <div class="profile-cover-overlay"></div>
    </div>
    <div class="profile-info-section">
      <div class="profile-top-row">
        <div class="profile-avatar-wrap">
          <div class="avatar avatar-2xl" id="profile-avatar"
               style="background:${profileUser.avatar_color || '#7c3aed'}">
            ${(profileUser.display_name || profileUser.username)[0].toUpperCase()}
          </div>
        </div>
        <div style="display:flex;gap:10px;padding-top:60px">
          ${profileUser.isOwn
            ? `<button class="btn btn-outline btn-sm" onclick="openEditModal()">✏️ Edit Profile</button>`
            : `<button class="btn btn-follow btn-sm ${profileUser.isFollowing ? 'following' : ''}"
                       id="follow-btn" onclick="toggleFollow()">
                 ${profileUser.isFollowing ? 'Following' : 'Follow'}
               </button>`}
        </div>
      </div>
      <div>
        <div class="profile-name">${escHtml(profileUser.display_name)}</div>
        <div class="profile-handle">@${escHtml(profileUser.username)}</div>
        ${profileUser.bio ? `<div class="profile-bio">${escHtml(profileUser.bio)}</div>` : ''}
        <div class="profile-joined">📅 Joined ${formatDate(profileUser.created_at)}</div>
      </div>
      <div class="profile-stats">
        <div class="stat-item">
          <div class="stat-value gradient-text" id="stat-posts">${profileUser.posts}</div>
          <div class="stat-label">Posts</div>
        </div>
        <div class="stat-item">
          <div class="stat-value gradient-text" id="stat-followers">${profileUser.followers}</div>
          <div class="stat-label">Followers</div>
        </div>
        <div class="stat-item">
          <div class="stat-value gradient-text" id="stat-following">${profileUser.following}</div>
          <div class="stat-label">Following</div>
        </div>
      </div>
    </div>
  `;

  // Load user posts
  await loadUserPosts(postsEl);
}

async function loadUserPosts(container) {
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const posts = await api.getUserPosts(profileUser.id);
    if (posts.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">📝</div><p>No posts yet!</p></div>`;
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
      <div class="avatar" style="background:${avatarBg}">${initial}</div>
      <div class="post-user-info">
        <div class="name">${escHtml(post.display_name)}</div>
        <div class="handle">@${escHtml(post.username)} · <span class="post-time">${timeAgo(post.created_at)}</span></div>
      </div>
    </div>
    <div class="post-content">${escHtml(post.content)}</div>
    <div class="post-actions">
      <button class="post-action-btn like-btn ${post.liked ? 'liked' : ''}"
              onclick="toggleLike(this, ${post.id})">
        <span class="icon">${post.liked ? '❤️' : '🤍'}</span>
        <span class="count">${post.like_count}</span>
      </button>
      <button class="post-action-btn" onclick="toggleComments(${post.id})">
        <span class="icon">💬</span>
        <span class="count" id="comment-count-${post.id}">${post.comment_count}</span>
      </button>
      <div class="post-actions-right">
        ${isOwn ? `<button class="post-action-btn delete-btn" onclick="deletePost(${post.id}, this)">🗑️</button>` : ''}
      </div>
    </div>
    <div class="comments-section" id="comments-${post.id}">
      <div class="comment-input-row">
        <input type="text" placeholder="Write a comment…" id="comment-input-${post.id}"
               onkeydown="if(event.key==='Enter') submitComment(${post.id})" />
        <button onclick="submitComment(${post.id})">Reply</button>
      </div>
      <div class="comments-list" id="comments-list-${post.id}"></div>
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
  } catch (e) { toast(e.message, 'error'); }
}

// ── Delete Post ───────────────────────────────────────────────────────────────
async function deletePost(postId, btn) {
  if (!confirm('Delete this post?')) return;
  try {
    await api.deletePost(postId);
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (card) { card.style.opacity='0'; card.style.transition='opacity 0.3s'; setTimeout(()=>card.remove(),300); }
    // Update posts count
    const statPosts = document.getElementById('stat-posts');
    if (statPosts) statPosts.textContent = Math.max(0, parseInt(statPosts.textContent)-1);
    toast('Post deleted', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ── Comments ──────────────────────────────────────────────────────────────────
async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  const isOpen  = section.classList.contains('open');
  section.classList.toggle('open', !isOpen);
  if (!isOpen) {
    const list = document.getElementById(`comments-list-${postId}`);
    list.innerHTML = '<div class="spinner" style="margin:12px auto;width:20px;height:20px;border-width:2px;"></div>';
    const comments = await api.getComments(postId);
    renderComments(postId, comments);
  }
}

function renderComments(postId, comments) {
  const list = document.getElementById(`comments-list-${postId}`);
  if (comments.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:8px 0">No comments yet 🗣️</p>`;
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
  item.innerHTML = `
    <div class="avatar" style="background:${c.avatar_color||'#7c3aed'};width:30px;height:30px;font-size:12px">${(c.display_name||c.username)[0].toUpperCase()}</div>
    <div class="comment-body">
      <div class="comment-header">
        <span class="name" onclick="goToProfile('${escHtml(c.username)}')" style="cursor:pointer">${escHtml(c.display_name)}</span>
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
    if (list.querySelector('p')) list.innerHTML = '';
    list.appendChild(renderComment(comment, postId));
    const countEl = document.getElementById(`comment-count-${postId}`);
    if (countEl) countEl.textContent = parseInt(countEl.textContent||0)+1;
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteComment(postId, commentId) {
  try {
    await api.deleteComment(postId, commentId);
    document.querySelector(`[data-comment-id="${commentId}"]`)?.remove();
    const countEl = document.getElementById(`comment-count-${postId}`);
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent||0)-1);
  } catch (e) { toast(e.message, 'error'); }
}

// ── Follow / Unfollow ─────────────────────────────────────────────────────────
async function toggleFollow() {
  const btn = document.getElementById('follow-btn');
  const isFollowing = profileUser.isFollowing;
  try {
    let result;
    if (isFollowing) {
      result = await api.unfollow(profileUser.id);
    } else {
      result = await api.follow(profileUser.id);
    }
    profileUser.isFollowing = result.following;
    profileUser.followers = result.followers;
    btn.classList.toggle('following', result.following);
    btn.textContent = result.following ? 'Following' : 'Follow';
    document.getElementById('stat-followers').textContent = result.followers;
    toast(result.following ? 'Now following! ✨' : 'Unfollowed', result.following ? 'success' : 'info');
  } catch (e) { toast(e.message, 'error'); }
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────
function openEditModal() {
  document.getElementById('edit-displayname').value = profileUser.display_name || '';
  document.getElementById('edit-bio').value = profileUser.bio || '';
  selectedColor = profileUser.avatar_color || '#7c3aed';
  renderColorPicker();
  document.getElementById('edit-modal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
}

// Close modal on backdrop click
document.getElementById('edit-modal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('edit-modal')) closeEditModal();
});

function renderColorPicker() {
  const container = document.getElementById('color-picker');
  container.innerHTML = '';
  AVATAR_COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = `color-swatch ${color === selectedColor ? 'selected' : ''}`;
    swatch.style.background = color;
    swatch.onclick = () => {
      selectedColor = color;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
    };
    container.appendChild(swatch);
  });
}

async function saveProfile() {
  const display_name = document.getElementById('edit-displayname').value.trim();
  const bio = document.getElementById('edit-bio').value.trim();
  if (!display_name) return toast('Display name is required', 'error');

  try {
    const updated = await api.updateMe({ display_name, bio, avatar_color: selectedColor });
    currentUser = { ...currentUser, ...updated };
    setAuth(getToken(), currentUser);
    profileUser = { ...profileUser, ...updated };

    // Update UI
    document.querySelector('.profile-name').textContent = updated.display_name;
    document.querySelector('.profile-bio') && (document.querySelector('.profile-bio').textContent = updated.bio);
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) {
      avatarEl.style.background = updated.avatar_color;
      avatarEl.textContent = updated.display_name[0].toUpperCase();
    }
    renderNavAvatar();
    closeEditModal();
    toast('Profile updated! ✅', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ── Search (same as feed) ─────────────────────────────────────────────────────
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
            item.onclick = () => { goToProfile(u.username); results.classList.remove('open'); input.value=''; };
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

// ── Utils ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + (dateStr?.includes('Z') ? '' : 'Z'));
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
