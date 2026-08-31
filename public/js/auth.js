// Redirect if already logged in
redirectIfAuth();

function switchTab(tab) {
  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLogin     = document.getElementById('tab-login');
  const tabRegister  = document.getElementById('tab-register');

  if (tab === 'login') {
    loginForm.style.display    = 'flex';
    registerForm.style.display = 'none';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
  } else {
    loginForm.style.display    = 'none';
    registerForm.style.display = 'flex';
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btnText  = document.getElementById('login-btn-text');

  if (!username || !password) return toast('Please fill in all fields', 'error');

  btnText.textContent = 'Signing in…';
  document.getElementById('login-btn').disabled = true;

  try {
    const { token, user } = await api.login({ username, password });
    setAuth(token, user);
    toast('Welcome back! 👋', 'success', 1500);
    setTimeout(() => window.location.href = '/feed.html', 500);
  } catch (err) {
    toast(err.message, 'error');
    btnText.textContent = 'Sign In';
    document.getElementById('login-btn').disabled = false;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const display_name = document.getElementById('reg-displayname').value.trim();
  const username     = document.getElementById('reg-username').value.trim();
  const password     = document.getElementById('reg-password').value;
  const btnText      = document.getElementById('register-btn-text');

  if (!display_name || !username || !password) return toast('Please fill in all fields', 'error');

  btnText.textContent = 'Creating account…';
  document.getElementById('register-btn').disabled = true;

  try {
    const { token, user } = await api.register({ username, display_name, password });
    setAuth(token, user);
    toast('Account created! Welcome 🎉', 'success', 1500);
    setTimeout(() => window.location.href = '/feed.html', 500);
  } catch (err) {
    toast(err.message, 'error');
    btnText.textContent = 'Create Account';
    document.getElementById('register-btn').disabled = false;
  }
}

async function demoLogin() {
  document.getElementById('login-username').value = 'demo_user';
  document.getElementById('login-password').value = 'password123';
  const fakeEvent = { preventDefault: () => {} };
  await handleLogin(fakeEvent);
}

