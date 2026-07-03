// Logins criados por revendedores (créditos + contas)
const RESELLER_LOGINS_KEY = 'bds_reseller_logins';
const RESELLER_CREDITS_KEY = 'bds_reseller_credits';
// Crédito infinito: guardamos um sentinela grande (finito e serializável em JSON,
// ao contrário de Infinity que viraria null). Qualquer saldo acima do limiar é
// tratado como ilimitado e não é decrementado ao gerar/renovar logins.
const RESELLER_UNLIMITED_CREDITS = 1000000000; // 1 bilhão
const RESELLER_UNLIMITED_THRESHOLD = 900000000;
const RESELLER_USERS_KEY = 'bds_users';
const RESELLER_PLANS_KEY = 'bds_active_plans';
const RESELLER_ADMIN_USER = atob('RGFzb3J0ZQ==');
const RESELLER_DAY_MS = 24 * 60 * 60 * 1000;

function getResellerLoginsStore() {
  try { return JSON.parse(localStorage.getItem(RESELLER_LOGINS_KEY)) || {}; } catch { return {}; }
}

function saveResellerLoginsStore(store) {
  localStorage.setItem(RESELLER_LOGINS_KEY, JSON.stringify(store));
}

function getResellerCreditsStore() {
  try { return JSON.parse(localStorage.getItem(RESELLER_CREDITS_KEY)) || {}; } catch { return {}; }
}

function saveResellerCreditsStore(store) {
  localStorage.setItem(RESELLER_CREDITS_KEY, JSON.stringify(store));
}

function normalizeResellerKey(reseller) {
  return String(reseller || '').trim();
}

function findResellerCreditsKey(store, reseller) {
  const key = normalizeResellerKey(reseller);
  if (!key) return null;
  if (typeof store[key] === 'number') return key;
  const lower = key.toLowerCase();
  const found = Object.keys(store).find(k => String(k).trim().toLowerCase() === lower);
  return found || null;
}

function getResellerCredits(reseller) {
  if (!reseller) return 0;
  const store = getResellerCreditsStore();
  const key = findResellerCreditsKey(store, reseller);
  if (!key) return 0;
  const n = store[key];
  return typeof n === 'number' && n > 0 ? n : 0;
}

function addResellerCredits(reseller, amount) {
  const key = normalizeResellerKey(reseller);
  const amt = Math.floor(Number(amount));
  if (!key || !amt || amt < 1) return false;
  const store = getResellerCreditsStore();
  const storeKey = findResellerCreditsKey(store, key) || key;
  store[storeKey] = getResellerCredits(storeKey) + amt;
  saveResellerCreditsStore(store);
  addResellerCreditHistory(key, +amt, 'Créditos adicionados pelo admin');
  return true;
}

// Saldo é "ilimitado" quando acima do limiar do sentinela.
function isUnlimitedResellerCredits(reseller) {
  return getResellerCredits(reseller) >= RESELLER_UNLIMITED_THRESHOLD;
}

// Concede crédito infinito (usado pelo pacote de R$300 na área de revendedor).
function grantUnlimitedResellerCredits(reseller) {
  const key = normalizeResellerKey(reseller);
  if (!key) return false;
  const store = getResellerCreditsStore();
  const storeKey = findResellerCreditsKey(store, key) || key;
  store[storeKey] = RESELLER_UNLIMITED_CREDITS;
  saveResellerCreditsStore(store);
  addResellerCreditHistory(key, RESELLER_UNLIMITED_CREDITS, 'Crédito infinito ativado');
  return true;
}

// Exibição amigável: '∞' quando ilimitado, senão o número.
function formatResellerCredits(value) {
  return Number(value) >= RESELLER_UNLIMITED_THRESHOLD ? '∞' : String(Number(value) || 0);
}

function getResellerLoginsFor(reseller) {
  if (!reseller) return [];
  const list = getResellerLoginsStore()[reseller];
  return Array.isArray(list) ? list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
}

function getDaysRemaining(expiresAt) {
  if (!expiresAt) return 0;
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / RESELLER_DAY_MS);
}

function formatResellerDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function resellerGetUsers() {
  try { return JSON.parse(localStorage.getItem(RESELLER_USERS_KEY)) || []; } catch { return []; }
}

function findResellerClientUserRecord(username) {
  const key = String(username || '').trim();
  if (!key) return null;
  const lower = key.toLowerCase();
  return resellerGetUsers().find(u => String(u.user || '').trim().toLowerCase() === lower) || null;
}

/** Conta criada por revendedor — não deve ver/comprar na Loja de Planos. */
function isResellerClientUser(username) {
  const key = String(username || '').trim();
  if (!key || key === RESELLER_ADMIN_USER) return false;

  const entry = findResellerClientUserRecord(key);
  if (entry && entry.createdByReseller) return true;

  const plans = resellerGetPlansStore();
  const planKey = Object.keys(plans).find(
    k => String(k).trim().toLowerCase() === key.toLowerCase()
  );
  const plan = planKey ? plans[planKey] : null;
  if (plan && plan.id === 'reseller' && plan.grantedBy) return true;

  return false;
}

function isResellerClientSession() {
  const user = typeof getSession === 'function' ? getSession() : null;
  return isResellerClientUser(user);
}

function resellerSaveUsers(users) {
  localStorage.setItem(RESELLER_USERS_KEY, JSON.stringify(users));
}

function resellerGetPlansStore() {
  if (typeof window.getPlansStore === 'function') return window.getPlansStore();
  try { return JSON.parse(localStorage.getItem(RESELLER_PLANS_KEY)) || {}; } catch (e) { return {}; }
}

function resellerSavePlansStore(store) {
  if (typeof window.savePlansStore === 'function') window.savePlansStore(store);
  else localStorage.setItem(RESELLER_PLANS_KEY, JSON.stringify(store));
}

async function createResellerLogin(reseller, data) {
  const username = (data.username || '').trim();
  let password = (data.password || '').trim();
  const days = parseInt(data.days, 10);

  if (!reseller) return { ok: false, msg: 'Revendedor inválido.' };
  if (!username || username.length < 3) return { ok: false, msg: 'Usuário com mínimo 3 caracteres.' };
  if (!password) password = generateResellerPassword();
  if (password.length < 6) return { ok: false, msg: 'Senha com mínimo 6 caracteres.' };
  if (!days || days < 1 || days > 365) return { ok: false, msg: 'Informe dias válidos (1 a 365).' };
  if (username === RESELLER_ADMIN_USER) return { ok: false, msg: 'Nome de usuário indisponível.' };
  if (getResellerCredits(reseller) < 1) return { ok: false, msg: 'Sem créditos de login. Compre um pacote primeiro.' };

  const users = resellerGetUsers();
  if (users.find(u => u.user === username)) return { ok: false, msg: 'Usuário já existe.' };

  // Tenta Supabase primeiro para garantir que o cliente consiga logar de qualquer dispositivo
  if (typeof DB !== 'undefined' && DB.isConfigured()) {
    let res = null;
    try {
      res = await DB.createResellerLogin(reseller, username, password, days);
    } catch (e) {
      res = null; // erro de rede — cai no fallback local
    }
    if (res && !res.ok) {
      // Supabase recusou (créditos insuficientes no servidor, usuário já existe, etc.)
      return { ok: false, msg: res.msg || 'Erro ao criar conta no servidor.' };
    }
    // res === null → erro de rede → cria localmente (modo offline)
  }

  const expiresAt = Date.now() + days * RESELLER_DAY_MS;
  users.push({ user: username, pass: password, createdAt: Date.now(), createdByReseller: reseller });
  resellerSaveUsers(users);

  const plans = resellerGetPlansStore();
  const planKey = username.trim();
  plans[planKey] = {
    id: 'reseller',
    period: days + (days === 1 ? ' dia' : ' dias'),
    days: days,
    expiresAt: expiresAt,
    grantedBy: reseller,
  };
  resellerSavePlansStore(plans);

  const loginsStore = getResellerLoginsStore();
  if (!loginsStore[reseller]) loginsStore[reseller] = [];
  loginsStore[reseller].push({
    id: 'rl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    username: username,
    password: password,
    days: days,
    createdAt: Date.now(),
    expiresAt: expiresAt,
  });
  saveResellerLoginsStore(loginsStore);

  if (!isUnlimitedResellerCredits(reseller)) {
    const credits = getResellerCreditsStore();
    credits[reseller] = Math.max(0, getResellerCredits(reseller) - 1);
    saveResellerCreditsStore(credits);
  }

  return {
    ok: true,
    msg: 'Conta criada com sucesso!',
    username: username,
    password: password,
    days: days,
  };
}

function generateResellerPassword() {
  return 'Bd' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 89 + 10);
}

function getResellerPanelUser() {
  if (typeof isAdmin === 'function' && isAdmin() && window._resellerPanelUser) {
    return window._resellerPanelUser;
  }
  return typeof getSession === 'function' ? getSession() : null;
}

function getResellerStats(reseller) {
  const logins = getResellerLoginsFor(reseller);
  const remaining = getResellerCredits(reseller);
  const now = Date.now();
  const h24  = now - RESELLER_DAY_MS;
  const d7   = now - 7  * RESELLER_DAY_MS;
  const d30  = now - 30 * RESELLER_DAY_MS;
  const active = logins.filter(l => getDaysRemaining(l.expiresAt) > 0).length;
  return {
    creditsRemaining: remaining,
    creditsUsed:      logins.length,
    loginsCreated:    logins.length,
    clientsActive:    active,
    clientsManaged:   logins.length,
    created24h: logins.filter(l => (l.createdAt || 0) >= h24).length,
    created7d:  logins.filter(l => (l.createdAt || 0) >= d7).length,
    created30d: logins.filter(l => (l.createdAt || 0) >= d30).length,
  };
}

function deactivateResellerClient(reseller, loginId) {
  const store = getResellerLoginsStore();
  const list = store[reseller];
  if (!Array.isArray(list)) return { ok: false, msg: 'Login não encontrado.' };
  const item = list.find(l => l.id === loginId);
  if (!item) return { ok: false, msg: 'Login não encontrado.' };

  const expired = Date.now() - 1;
  const plans = resellerGetPlansStore();
  const planKey = String(item.username).trim();
  if (plans[planKey]) {
    plans[planKey].expiresAt = expired;
    resellerSavePlansStore(plans);
  }
  item.expiresAt = expired;
  saveResellerLoginsStore(store);
  return { ok: true, msg: 'Cliente desativado.' };
}

function renewResellerClient(reseller, loginId, days) {
  days = parseInt(days, 10);
  if (!days || days < 1 || days > 365) return { ok: false, msg: 'Informe dias válidos.' };
  if (getResellerCredits(reseller) < 1) return { ok: false, msg: 'Sem créditos. Compre um pacote.' };

  const store = getResellerLoginsStore();
  const list = store[reseller];
  if (!Array.isArray(list)) return { ok: false, msg: 'Login não encontrado.' };
  const item = list.find(l => l.id === loginId);
  if (!item) return { ok: false, msg: 'Login não encontrado.' };

  const now = Date.now();
  const base = Math.max(item.expiresAt || now, now);
  const newExpires = base + days * RESELLER_DAY_MS;
  item.expiresAt = newExpires;
  item.days = (item.days || 0) + days;
  saveResellerLoginsStore(store);

  const plans = resellerGetPlansStore();
  const planKey = String(item.username).trim();
  if (plans[planKey]) {
    const planBase = Math.max(plans[planKey].expiresAt || now, now);
    plans[planKey].expiresAt = planBase + days * RESELLER_DAY_MS;
    plans[planKey].days = (plans[planKey].days || 0) + days;
    resellerSavePlansStore(plans);
  }

  if (!isUnlimitedResellerCredits(reseller)) {
    const credits = getResellerCreditsStore();
    credits[reseller] = Math.max(0, getResellerCredits(reseller) - 1);
    saveResellerCreditsStore(credits);
    addResellerCreditHistory(reseller, -1, 'Renovação: ' + item.username + ' (+' + days + 'd)');
  }

  if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('bds-plans-changed'));
  }
  return { ok: true, msg: 'Cliente renovado por +' + days + ' dia' + (days === 1 ? '' : 's') + '.' };
}

const RESELLER_CREDIT_HISTORY_KEY = 'bds_reseller_credit_history';

function getResellerCreditHistory(reseller) {
  try {
    const store = JSON.parse(localStorage.getItem(RESELLER_CREDIT_HISTORY_KEY)) || {};
    return Array.isArray(store[reseller]) ? store[reseller] : [];
  } catch { return []; }
}

function addResellerCreditHistory(reseller, amount, label) {
  try {
    const store = JSON.parse(localStorage.getItem(RESELLER_CREDIT_HISTORY_KEY)) || {};
    if (!Array.isArray(store[reseller])) store[reseller] = [];
    store[reseller].unshift({ ts: Date.now(), amount: amount, label: label });
    if (store[reseller].length > 50) store[reseller] = store[reseller].slice(0, 50);
    localStorage.setItem(RESELLER_CREDIT_HISTORY_KEY, JSON.stringify(store));
  } catch {}
}

function deleteResellerClient(reseller, loginId) {
  const store = getResellerLoginsStore();
  const list = store[reseller];
  if (!Array.isArray(list)) return { ok: false, msg: 'Login não encontrado.' };
  const item = list.find(l => l.id === loginId);
  if (!item) return { ok: false, msg: 'Login não encontrado.' };

  store[reseller] = list.filter(l => l.id !== loginId);
  saveResellerLoginsStore(store);

  const plans = resellerGetPlansStore();
  delete plans[String(item.username).trim()];
  resellerSavePlansStore(plans);

  const users = resellerGetUsers().filter(u => u.user !== item.username);
  resellerSaveUsers(users);

  return { ok: true, msg: 'Cliente removido.' };
}

function closeResellerPanelView() {
  if (typeof isAdmin === 'function' && isAdmin() && window._resellerPanelUser) {
    window._resellerPanelUser = null;
    if (typeof showAppView === 'function') showAppView('admin-revendedores');
    return;
  }
  if (typeof showAppView === 'function') showAppView('revendedor');
}

function openResellerPanel() {
  if (typeof canAccessRevendedor === 'function' && !canAccessRevendedor()) {
    if (typeof showToast === 'function') showToast('Revenda não habilitada para sua conta. Peça ao administrador.', 'warn');
    return;
  }
  window._resellerPanelUser = null;
  if (typeof showAppView === 'function') showAppView('revendedor-painel');
}

function openAdminResellerPanel(username) {
  window._resellerPanelUser = username;
  if (typeof showAppView === 'function') showAppView('revendedor-painel');
}

window.openResellerPanel = openResellerPanel;
window.openAdminResellerPanel = openAdminResellerPanel;
window.closeResellerPanelView = closeResellerPanelView;
window.getResellerCredits = getResellerCredits;
window.addResellerCredits = addResellerCredits;
window.isUnlimitedResellerCredits = isUnlimitedResellerCredits;
window.grantUnlimitedResellerCredits = grantUnlimitedResellerCredits;
window.formatResellerCredits = formatResellerCredits;
window.RESELLER_UNLIMITED_CREDITS = RESELLER_UNLIMITED_CREDITS;

function showResellerLoginCreatedModal(data) {
  const overlay = document.getElementById('reseller-login-created-overlay');
  const nameEl = document.getElementById('reseller-created-name');
  const passEl = document.getElementById('reseller-created-pass');
  const daysEl = document.getElementById('reseller-created-days');
  if (!overlay || !nameEl || !passEl || !daysEl) return;

  const days = parseInt(data.days, 10);
  nameEl.textContent = data.username || '—';
  passEl.textContent = data.password || '—';
  daysEl.textContent = days ? String(days) : '—';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeResellerLoginCreatedModal() {
  const overlay = document.getElementById('reseller-login-created-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function copyResellerLoginCreated() {
  const name = document.getElementById('reseller-created-name')?.textContent || '';
  const pass = document.getElementById('reseller-created-pass')?.textContent || '';
  const days = document.getElementById('reseller-created-days')?.textContent || '';
  const text =
    'NOME: ' + name + '\n' +
    'SENHA: ' + pass + '\n' +
    'DIAS DE PUXADA: ' + days;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('reseller-created-copy-btn');
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = 'Copiado!';
        setTimeout(() => { btn.textContent = prev; }, 2000);
      }
    }).catch(() => {
      if (typeof showToast === 'function') showToast('Erro ao copiar. Copie manualmente:\n' + text, 'warn', 6000);
    });
  } else {
    if (typeof showToast === 'function') showToast('Copie manualmente: ' + text, 'info', 8000);
  }
}

window.showResellerLoginCreatedModal = showResellerLoginCreatedModal;
window.closeResellerLoginCreatedModal = closeResellerLoginCreatedModal;
window.copyResellerLoginCreated = copyResellerLoginCreated;
window.isResellerClientUser = isResellerClientUser;
window.isResellerClientSession = isResellerClientSession;
window.renewResellerClient = renewResellerClient;
window.getResellerCreditHistory = getResellerCreditHistory;
window.addResellerCreditHistory = addResellerCreditHistory;
