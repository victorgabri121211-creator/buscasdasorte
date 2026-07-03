// AUTENTICAÇÃO
const ADMIN_USER = 'Dasorte';
const ADMIN_HASH = '9dc3eba65b8905b9ea4fb08b06c800de0b35256d0ecfdd80bc59d9713b0bed8c';
const STORE_KEY = 'bds_users';
const SESSION_KEY = 'bds_session';

async function hashPass(pass) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function getUsers() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; } }
function saveUsers(u) { localStorage.setItem(STORE_KEY, JSON.stringify(u)); }
function getSession() { return localStorage.getItem(SESSION_KEY); }
function setSession(u) { localStorage.setItem(SESSION_KEY, u); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (i===0&&tab==='login')||(i===1&&tab==='register')));
  document.getElementById('form-login').classList.toggle('active', tab==='login');
  document.getElementById('form-register').classList.toggle('active', tab==='register');
}

function showMsg(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg; el.className = 'auth-msg ' + type;
}

async function doLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  if (!user || !pass) { showMsg('login-msg','⚠️  Preencha todos os campos','error'); shakeInput('login-user'); return; }
  const hash = await hashPass(pass);
  // Admin check
  if (user === ADMIN_USER && hash === ADMIN_HASH) { setSession(user); enterApp(user); return; }
  // User check (hashed)
  let users = getUsers();
  let found = users.find(u => u.user === user && u.hash === hash);
  // Migration: upgrade plain-text stored passwords transparently
  if (!found) {
    const legacy = users.find(u => u.user === user && u.pass && u.pass === pass);
    if (legacy) {
      legacy.hash = hash;
      delete legacy.pass;
      saveUsers(users);
      found = legacy;
    }
  }
  if (found) { setSession(user); enterApp(user); return; }
  // Failed
  showMsg('login-msg','✕  Usuário ou senha incorretos','error');
  shakeInput('login-pass');
  document.getElementById('login-pass').value = '';
  const passInp = document.getElementById('login-pass');
  passInp.type = 'password';
  document.getElementById('eye-login').innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  passInp.focus();
}

function shakeInput(id) {
  const el = document.getElementById(id);
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

function togglePassVis(id, btn) {
  const inp = document.getElementById(id);
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  btn.querySelector('svg').innerHTML = isPass
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  btn.style.color = isPass ? 'rgba(48,209,88,0.6)' : 'rgba(255,255,255,0.25)';
}

async function doRegister() {
  const user = document.getElementById('reg-user').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  if (!user||!pass||!pass2) { showMsg('reg-msg','⚠️  Preencha todos os campos','error'); return; }
  if (pass.length<6) { showMsg('reg-msg','⚠️  Senha deve ter mínimo 6 caracteres','error'); shakeInput('reg-pass'); return; }
  if (pass!==pass2) { showMsg('reg-msg','✕  As senhas não coincidem','error'); shakeInput('reg-pass2'); return; }
  if (user===ADMIN_USER) { showMsg('reg-msg','✕  Nome de usuário indisponível','error'); return; }
  const users = getUsers();
  if (users.find(u=>u.user===user)) { showMsg('reg-msg','Usuário já existe','error'); return; }
  const hash = await hashPass(pass);
  users.push({user, hash}); saveUsers(users);
  showMsg('reg-msg','Conta criada com sucesso!','success');
  setTimeout(()=>switchTab('login'),1500);
}

function doLogout() { clearSession(); location.reload(); }

function enterApp(user) {
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('topbar-username').textContent=user;
  const btnAdmin = document.getElementById('btn-admin');
  if (btnAdmin) btnAdmin.style.display = user === ADMIN_USER ? '' : 'none';
  const btnRevenda = document.getElementById('btn-revenda');
  if (btnRevenda) {
    const authorized = typeof isRevendaAuthorized !== 'undefined' && isRevendaAuthorized(user);
    btnRevenda.style.display = authorized && user !== ADMIN_USER ? '' : 'none';
  }
}

const sess = getSession();
if (sess) enterApp(sess);

document.getElementById('login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
document.getElementById('login-user').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
