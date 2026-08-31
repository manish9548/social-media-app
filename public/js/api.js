// ── API Base ────────────────────────────────────────────────────────────────
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const raw = localStorage.getItem('user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// ── Fetch wrapper ───────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── API Methods ─────────────────────────────────────────────────────────────
const api = {
  // Auth
  register: (body) => apiFetch('/auth/register', { method: 'POST', body }),
  login:    (body) => apiFetch('/auth/login',    { method: 'POST', body }),

  // Users
  getMe:          ()           => apiFetch('/users/me'),
  updateMe:       (body)       => apiFetch('/users/me',          { method: 'PUT', body }),
  getUser:        (username)   => apiFetch(`/users/${username}`),
  searchUsers:    (q)          => apiFetch(`/users/search?q=${encodeURIComponent(q)}`),
  follow:         (id)         => apiFetch(`/users/${id}/follow`, { method: 'POST' }),
  unfollow:       (id)         => apiFetch(`/users/${id}/follow`, { method: 'DELETE' }),
  getFollowers:   (id)         => apiFetch(`/users/${id}/followers`),
  getFollowing:   (id)         => apiFetch(`/users/${id}/following`),
  getSuggested:   (id)         => apiFetch(`/users/${id}/suggested`),

  // Posts
  getFeed:        ()           => apiFetch('/posts/feed'),
  getExplore:     ()           => apiFetch('/posts/explore'),
  getUserPosts:   (userId)     => apiFetch(`/posts/user/${userId}`),
  createPost:     (body)       => apiFetch('/posts',             { method: 'POST', body }),
  deletePost:     (id)         => apiFetch(`/posts/${id}`,        { method: 'DELETE' }),
  likePost:       (id)         => apiFetch(`/posts/${id}/like`,   { method: 'POST' }),

  // Comments
  getComments:    (postId)     => apiFetch(`/posts/${postId}/comments`),
  addComment:     (postId, body) => apiFetch(`/posts/${postId}/comments`, { method: 'POST', body }),
  deleteComment:  (postId, cid) => apiFetch(`/posts/${postId}/comments/${cid}`, { method: 'DELETE' }),
};

// ── Toast Notifications ─────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || '•'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── Time formatting ─────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const date = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
  const now  = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Avatar ─────────────────────────────────────────────────────────────────
function makeAvatarEl(user, sizeClass = '') {
  const div = document.createElement('div');
  div.className = `avatar ${sizeClass}`.trim();
  div.style.background = user.avatar_color || '#7c3aed';
  div.textContent = (user.display_name || user.username || '?')[0].toUpperCase();
  return div;
}

// ── Navigate ────────────────────────────────────────────────────────────────
function goToProfile(username) {
  window.location.href = `/profile.html?u=${encodeURIComponent(username)}`;
}

function goToMyProfile() {
  const user = getUser();
  if (user) goToProfile(user.username);
}

function logout() {
  clearAuth();
  window.location.href = '/index.html';
}

// ── Guard: redirect to login if not authenticated ──────────────────────────
function requireAuth() {
  if (!getToken()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// ── Redirect to feed if already authenticated ──────────────────────────────
function redirectIfAuth() {
  if (getToken()) window.location.href = '/feed.html';
}
