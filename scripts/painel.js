// PAINÉIS — REVENDA + ADM

const SEARCH_LOG_KEY = 'bds_search_log';
const MAX_LOG = 2000;
const REVENDA_KEY = 'bds_revenda_users';

function getRevendaUsers() { try { return JSON.parse(localStorage.getItem(REVENDA_KEY)) || []; } catch { return []; } }
function isRevendaAuthorized(user) { return user === ADMIN_USER || getRevendaUsers().includes(user); }

function admToggleRevenda(username) {
  const list = getRevendaUsers();
  const idx = list.indexOf(username);
  if (idx >= 0) list.splice(idx, 1); else list.push(username);
  localStorage.setItem(REVENDA_KEY, JSON.stringify(list));
  renderAdminPanel();
  const btn = document.getElementById('btn-revenda');
  const sess = getSession();
  if (btn && sess) btn.style.display = (isRevendaAuthorized(sess) && sess !== ADMIN_USER) ? '' : 'none';
}

function getSearchLog() {
  try { return JSON.parse(localStorage.getItem(SEARCH_LOG_KEY)) || []; } catch { return []; }
}

function logSearch(types, query, count) {
  const user = getSession();
  if (!user) return;
  const log = getSearchLog();
  log.unshift({ ts: Date.now(), user, types, query: String(query).slice(0, 80), count });
  if (log.length > MAX_LOG) log.splice(MAX_LOG);
  localStorage.setItem(SEARCH_LOG_KEY, JSON.stringify(log));
}

// ─── REVENDA ──────────────────────────────────────────────

function openRevendaPanel() {
  renderRevendaPanel();
  document.getElementById('revenda-overlay').classList.add('open');
}
function closeRevendaPanel() {
  document.getElementById('revenda-overlay').classList.remove('open');
}

function renderRevendaPanel() {
  const user = getSession();
  const log = getSearchLog();
  const userLog = log.filter(e => e.user === user);
  const today = new Date().toDateString();
  const todayLog = userLog.filter(e => new Date(e.ts).toDateString() === today);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekLog = userLog.filter(e => e.ts > weekAgo);

  document.getElementById('rv-username').textContent = user;
  document.getElementById('rv-stat-total').textContent = userLog.length;
  document.getElementById('rv-stat-hoje').textContent = todayLog.length;
  document.getElementById('rv-stat-semana').textContent = weekLog.length;

  const list = document.getElementById('rv-history');
  list.innerHTML = '';
  const recent = userLog.slice(0, 30);
  if (!recent.length) {
    list.innerHTML = '<div class="rv-empty">Nenhuma consulta realizada ainda</div>';
    return;
  }
  recent.forEach(e => {
    const d = new Date(e.ts);
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const item = document.createElement('div');
    item.className = 'rv-item';
    item.innerHTML =
      `<span class="rv-type">${escHtml(e.types.split(',')[0].trim())}</span>` +
      `<span class="rv-query">${escHtml(e.query)}</span>` +
      `<span class="rv-time">${date} ${time}</span>`;
    list.appendChild(item);
  });
}

// ─── ADM ──────────────────────────────────────────────────

function openAdminPanel() {
  if (getSession() !== ADMIN_USER) return;
  renderAdminPanel();
  document.getElementById('admin-overlay').classList.add('open');
}
function closeAdminPanel() {
  document.getElementById('admin-overlay').classList.remove('open');
}

function admSwitchTab(tab) {
  document.querySelectorAll('.adm-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.adm-panel-section').forEach(s =>
    s.classList.toggle('active', s.id === 'adm-section-' + tab));
}

function renderAdminPanel() {
  const log = getSearchLog();
  const users = getUsers();
  const today = new Date().toDateString();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  document.getElementById('adm-stat-users').textContent = users.length + 1;
  document.getElementById('adm-stat-total').textContent = log.length;
  document.getElementById('adm-stat-hoje').textContent = log.filter(e => new Date(e.ts).toDateString() === today).length;
  document.getElementById('adm-stat-semana').textContent = log.filter(e => e.ts > weekAgo).length;

  renderAdminUsers(users, log);
  renderAdminHistory(log, '');
  admSwitchTab('history');
}

function renderAdminUsers(users, log) {
  const tbody = document.getElementById('adm-users-tbody');
  tbody.innerHTML = '';
  const revendaList = getRevendaUsers();

  const makeRow = (username, isAdmin, created, log) => {
    const count = log.filter(e => e.user === username).length;
    const last = log.find(e => e.user === username);
    const lastDate = last ? new Date(last.ts).toLocaleDateString('pt-BR') : '—';
    const createdStr = created ? new Date(created).toLocaleDateString('pt-BR') : (isAdmin ? 'Admin' : '—');
    const isRevenda = revendaList.includes(username);
    const revendaCell = isAdmin
      ? '<span style="font-size:11px;color:rgba(255,255,255,0.2)">Dono</span>'
      : `<button class="adm-revenda-btn${isRevenda ? ' active' : ''}" onclick="admToggleRevenda('${escHtml(username)}')">${isRevenda ? 'Ativo' : 'Inativo'}</button>`;
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><span class="adm-badge ${isAdmin ? 'admin' : 'user'}">${isAdmin ? 'ADM' : 'USR'}</span>${escHtml(username)}</td>` +
      `<td>${createdStr}</td>` +
      `<td style="color:#30d158;font-weight:600">${count}</td>` +
      `<td>${lastDate}</td>` +
      `<td>${revendaCell}</td>`;
    return tr;
  };

  tbody.appendChild(makeRow(ADMIN_USER, true, null, log));
  users.forEach(u => tbody.appendChild(makeRow(u.user, false, u.created, log)));
}

function renderAdminHistory(log, filter) {
  const list = document.getElementById('adm-history-list');
  list.innerHTML = '';
  const filtered = filter
    ? log.filter(e => e.user.toLowerCase().includes(filter.toLowerCase()) || e.types.toLowerCase().includes(filter.toLowerCase()) || e.query.toLowerCase().includes(filter.toLowerCase()))
    : log;
  const entries = filtered.slice(0, 200);

  if (!entries.length) {
    list.innerHTML = '<div class="adm-empty">Nenhum registro encontrado</div>';
    return;
  }

  entries.forEach(e => {
    const d = new Date(e.ts);
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const isAdmin = e.user === ADMIN_USER;
    const item = document.createElement('div');
    item.className = 'adm-hist-item';
    item.innerHTML =
      `<span class="adm-hist-time">${date} ${time}</span>` +
      `<span class="adm-badge ${isAdmin ? 'admin' : 'user'}">${escHtml(e.user)}</span>` +
      `<span class="adm-hist-type">${escHtml(e.types.split(',')[0].trim())}</span>` +
      `<span class="adm-hist-query">${escHtml(e.query)}</span>` +
      `<span class="adm-hist-count">${e.count} res.</span>`;
    list.appendChild(item);
  });
}

function admClearLog() {
  if (!confirm('Apagar todo o histórico de consultas? Esta ação não pode ser desfeita.')) return;
  localStorage.removeItem(SEARCH_LOG_KEY);
  renderAdminPanel();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeRevendaPanel();
    closeAdminPanel();
  }
});

// Update revenda button for session that loaded before this script
(function() {
  const user = getSession();
  if (!user || user === ADMIN_USER) return;
  const btn = document.getElementById('btn-revenda');
  if (btn && isRevendaAuthorized(user)) btn.style.display = '';
})();
