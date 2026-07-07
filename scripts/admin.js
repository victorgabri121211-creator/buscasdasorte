// Painel administrativo — áreas separadas
const ADMIN_USER = atob('RGFzb3J0ZQ==');
const USERS_STORE_KEY = 'bds_users';
const RESELLER_ACCESS_KEY = 'bds_reseller_access';
const PLANS_STORE_KEY = 'bds_active_plans';
const ADMIN_VIEWS = ['admin-dashboard', 'admin-clientes', 'admin-revendedores'];

const ADMIN_PLAN_OPTIONS = [
  { id: 'diaria', period: 'Diária', ms: 24 * 60 * 60 * 1000 },
  { id: 'semana', period: '1 Semana', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'mes', period: '1 Mês', ms: 30 * 24 * 60 * 60 * 1000 },
];

function adminSavePlansStore(store) {
  localStorage.setItem(PLANS_STORE_KEY, JSON.stringify(store));
}

function adminActivateUserPlan(username, planId) {
  if (!username || username === ADMIN_USER) return false;
  if (typeof window.setPlanForUser !== 'function') return false;
  return window.setPlanForUser(String(username).trim(), planId);
}

function adminDeactivateUserPlan(username) {
  if (!username || username === ADMIN_USER) return false;
  if (typeof window.clearPlanForUser !== 'function') return false;
  return window.clearPlanForUser(String(username).trim());
}

function adminBuildPlanSelect(username, currentPlanId) {
  const selected = ADMIN_PLAN_OPTIONS.some(p => p.id === currentPlanId) ? currentPlanId : 'semana';
  let html = '<select class="admin-plan-select" data-username="' + escAdmin(username) + '" aria-label="Selecionar plano">';
  ADMIN_PLAN_OPTIONS.forEach(p => {
    html += '<option value="' + p.id + '"' + (p.id === selected ? ' selected' : '') + '>' + escAdmin(p.period) + '</option>';
  });
  html += '</select>';
  return html;
}

function isAdmin() {
  return typeof getSession === 'function' && getSession() === ADMIN_USER;
}

function adminGetUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_STORE_KEY)) || []; } catch { return []; }
}

function getResellerAccessMap() {
  try { return JSON.parse(localStorage.getItem(RESELLER_ACCESS_KEY)) || {}; } catch { return {}; }
}

function saveResellerAccessMap(map) {
  localStorage.setItem(RESELLER_ACCESS_KEY, JSON.stringify(map));
}

function normalizeResellerUsername(username) {
  return String(username || '').trim();
}

function findResellerAccessKey(map, username) {
  const key = normalizeResellerUsername(username);
  if (!key) return null;
  if (map[key] === true) return key;
  const lower = key.toLowerCase();
  const found = Object.keys(map).find(k => String(k).trim().toLowerCase() === lower);
  return found || null;
}

function isResellerEnabled(username) {
  const key = normalizeResellerUsername(username);
  if (!key || key === ADMIN_USER) return false;
  return getResellerAccessMap()[key] === true || !!findResellerAccessKey(getResellerAccessMap(), key);
}

function syncRevendedorNav() {
  const revNav = document.getElementById('nav-revendedor');
  if (!revNav) return;
  const show = !isAdmin() && canAccessRevendedor();
  revNav.classList.toggle('nav-revendedor--visible', show);
  revNav.hidden = !show;
  revNav.setAttribute('aria-hidden', show ? 'false' : 'true');
  // O item "Ranking" segue a mesma regra do menu Revendedor.
  const rankNav = document.getElementById('nav-ranking');
  if (rankNav) {
    rankNav.hidden = !show;
    rankNav.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
}

function setResellerEnabled(username, enabled) {
  const map = getResellerAccessMap();
  const key = normalizeResellerUsername(username);
  const existing = findResellerAccessKey(map, key);
  if (existing && existing !== key) delete map[existing];
  if (enabled) map[key] = true;
  else {
    delete map[key];
    if (existing) delete map[existing];
  }
  saveResellerAccessMap(map);
  // Sincroniza com Supabase em background
  if (typeof DB !== 'undefined' && DB.isConfigured()) {
    DB.setResellerAccess(key, enabled).catch(function() {});
  }
  updateAppNavigation();
  if (
    !enabled &&
    typeof getSession === 'function' &&
    getSession() === username &&
    typeof showAppView === 'function'
  ) {
    showAppView('modules');
  }
}

function canAccessRevendedor() {
  const user = typeof getSession === 'function' ? getSession() : null;
  if (!user) return false;
  return isResellerEnabled(user);
}

function adminGetPlansStore() {
  try { return JSON.parse(localStorage.getItem(PLANS_STORE_KEY)) || {}; } catch { return {}; }
}

function adminGetPlanInfo(username) {
  if (!username || username === ADMIN_USER) {
    return { label: 'Administrador', active: true, expires: null };
  }
  const plan = typeof window.getActivePlanForUser === 'function'
    ? window.getActivePlanForUser(username)
    : adminGetPlansStore()[String(username).trim()];
  if (!plan) {
    return { label: 'Sem plano', active: false, expires: null };
  }
  return {
    label: plan.period || plan.id || 'Ativo',
    active: true,
    expires: new Date(plan.expiresAt),
  };
}

function getDefaultViewForUser() {
  return isAdmin() ? 'admin-dashboard' : 'modules';
}

function setAdminNavActive(view) {
  const map = {
    'admin-dashboard': 'nav-admin-dashboard',
    'admin-clientes': 'nav-admin-clientes',
    'admin-revendedores': 'nav-admin-revendedores',
  };
  document.querySelectorAll('#sidebar-admin-menu .sidebar-item').forEach(el => {
    el.classList.toggle('active', el.id === map[view]);
  });
}

function updateAppNavigation() {
  const admin = isAdmin();
  const userMenu = document.getElementById('sidebar-user-menu');
  const adminMenu = document.getElementById('sidebar-admin-menu');
  const consultasWrap = document.getElementById('sidebar-consultas-wrap');
  const brand = document.querySelector('.topbar-brand');

  if (userMenu) userMenu.hidden = admin;
  if (adminMenu) adminMenu.hidden = !admin;
  if (consultasWrap) consultasWrap.hidden = admin;
  syncRevendedorNav();

  if (brand) {
    brand.setAttribute('title', admin ? 'Dashboard Admin' : 'Módulos');
    brand.onclick = function () {
      if (typeof showAppView === 'function') {
        showAppView(admin ? 'admin-dashboard' : 'modules');
      }
      if (typeof closeSidebar === 'function') closeSidebar();
    };
  }

  document.body.classList.toggle('user-admin', admin);

  if (!admin && typeof applyResellerClientNavigation === 'function') {
    applyResellerClientNavigation();
  }
}

function formatAdminDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function getExpiringPlansCount(hoursAhead) {
  hoursAhead = hoursAhead || 24;
  const users = adminGetUsers();
  const cutoff = Date.now() + hoursAhead * 3600 * 1000;
  return users.filter(u => {
    const plan = adminGetPlanInfo(u.user);
    if (!plan.active || !plan.expires) return false;
    return plan.expires.getTime() <= cutoff;
  }).length;
}

function adminExportClientsCSV() {
  const users = adminGetUsers();
  const rows = [['Usuário', 'Plano', 'Validade', 'Cadastro']];
  users.forEach(u => {
    const plan = adminGetPlanInfo(u.user);
    rows.push([
      u.user,
      plan.active ? plan.label : 'Inativo',
      plan.expires ? plan.expires.toLocaleString('pt-BR') : '—',
      u.createdAt ? new Date(u.createdAt).toLocaleString('pt-BR') : '—',
    ]);
  });
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clientes_buscasdasorte.csv';
  a.click();
  if (typeof showToast === 'function') showToast('CSV exportado com sucesso');
}

let _adminResetTarget = null;
function adminOpenResetModal(username) {
  _adminResetTarget = username;
  let overlay = document.getElementById('admin-reset-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'admin-reset-overlay';
    overlay.className = 'admin-reset-overlay';
    overlay.innerHTML =
      '<div class="admin-reset-box">' +
        '<div class="admin-reset-title">Redefinir senha</div>' +
        '<div class="admin-reset-sub" id="admin-reset-sub"></div>' +
        '<input class="admin-reset-input" id="admin-reset-input" type="text" placeholder="Nova senha (mín. 6 caracteres)" autocomplete="new-password"/>' +
        '<div class="admin-reset-actions">' +
          '<button class="admin-reset-confirm" id="admin-reset-confirm-btn">Salvar senha</button>' +
          '<button class="admin-reset-cancel" onclick="adminCloseResetModal()">Cancelar</button>' +
        '</div>' +
        '<div class="admin-reset-msg" id="admin-reset-msg"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('admin-reset-confirm-btn').addEventListener('click', adminConfirmReset);
    overlay.addEventListener('click', e => { if (e.target === overlay) adminCloseResetModal(); });
  }
  document.getElementById('admin-reset-sub').textContent = 'Usuário: ' + username;
  document.getElementById('admin-reset-input').value = '';
  document.getElementById('admin-reset-msg').textContent = '';
  document.getElementById('admin-reset-msg').className = 'admin-reset-msg';
  overlay.classList.add('open');
  setTimeout(() => document.getElementById('admin-reset-input').focus(), 80);
}

function adminCloseResetModal() {
  const overlay = document.getElementById('admin-reset-overlay');
  if (overlay) overlay.classList.remove('open');
  _adminResetTarget = null;
}

function adminConfirmReset() {
  const msgEl = document.getElementById('admin-reset-msg');
  const input = document.getElementById('admin-reset-input');
  const newPass = input ? input.value.trim() : '';
  if (!_adminResetTarget || !newPass) {
    if (msgEl) { msgEl.textContent = 'Informe a nova senha.'; msgEl.className = 'admin-reset-msg err'; }
    return;
  }
  if (newPass.length < 6) {
    if (msgEl) { msgEl.textContent = 'Senha deve ter mínimo 6 caracteres.'; msgEl.className = 'admin-reset-msg err'; }
    return;
  }
  const usersKey = USERS_STORE_KEY;
  let users = [];
  try { users = JSON.parse(localStorage.getItem(usersKey)) || []; } catch { users = []; }
  const idx = users.findIndex(u => u.user === _adminResetTarget);
  if (idx === -1) {
    if (msgEl) { msgEl.textContent = 'Usuário não encontrado.'; msgEl.className = 'admin-reset-msg err'; }
    return;
  }
  users[idx].pass = newPass;
  localStorage.setItem(usersKey, JSON.stringify(users));
  if (msgEl) { msgEl.textContent = 'Senha atualizada com sucesso!'; msgEl.className = 'admin-reset-msg ok'; }
  if (typeof showToast === 'function') showToast('Senha de ' + _adminResetTarget + ' atualizada');
  setTimeout(adminCloseResetModal, 1400);
}
window.adminOpenResetModal = adminOpenResetModal;
window.adminCloseResetModal = adminCloseResetModal;
window.adminExportClientsCSV = adminExportClientsCSV;

function escAdmin(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAdminView(view) {
  if (!isAdmin()) return;
  if (view === 'admin-dashboard' && typeof renderSalesDashboard === 'function') {
    renderSalesDashboard();
    if (typeof DB !== 'undefined' && DB.isConfigured()) {
      DB.syncSales().then(function () {
        renderSalesDashboard();
      }).catch(function () {});
    }
  }
  if (view === 'admin-clientes') {
    renderAdminClients();
  }
  if (view === 'admin-revendedores') renderAdminResellers();
  setAdminNavActive(view);
}

function renderAdminDashboard() {
  renderAdminView('admin-dashboard');
}

function renderAdminClients(filter) {
  const root = document.getElementById('admin-clients-root');
  if (!root) return;

  const _prevSearch = root.querySelector('.admin-clients-search-input');
  const hadSearchFocus = _prevSearch === document.activeElement;
  const searchCursorPos = hadSearchFocus ? _prevSearch.selectionStart : 0;
  const currentFilter = filter || root.getAttribute('data-filter') || 'all';
  root.setAttribute('data-filter', currentFilter);
  const searchTerm = root.getAttribute('data-search') || '';

  const users = adminGetUsers();
  let active = 0, inactive = 0;
  users.forEach(u => {
    const plan = adminGetPlanInfo(u.user);
    if (plan.active) active++; else inactive++;
  });

  const expiring = getExpiringPlansCount(24);

  const filtered = users.filter(u => {
    const plan = adminGetPlanInfo(u.user);
    if (currentFilter === 'active' && !plan.active) return false;
    if (currentFilter === 'inactive' && plan.active) return false;
    if (searchTerm && !u.user.toLowerCase().includes(searchTerm.trim().toLowerCase())) return false;
    return true;
  });

  const now24h = Date.now() + 24 * 3600 * 1000;

  const bulkBar =
    '<div class="admin-bulk-bar" id="admin-bulk-bar">' +
      '<span class="admin-bulk-count" id="admin-bulk-count">0 selecionados</span>' +
      '<div class="admin-bulk-sep"></div>' +
      '<select class="admin-bulk-select" id="admin-bulk-plan-select">' +
        ADMIN_PLAN_OPTIONS.map(p => '<option value="' + p.id + '">' + escAdmin(p.period) + '</option>').join('') +
      '</select>' +
      '<button type="button" class="admin-bulk-btn" id="admin-bulk-on-btn">Ativar selecionados</button>' +
      '<button type="button" class="admin-bulk-btn danger" id="admin-bulk-off-btn">Desativar selecionados</button>' +
    '</div>';

  let rows = '';
  filtered.forEach(u => {
    const plan = adminGetPlanInfo(u.user);
    const activePlan = typeof window.getActivePlanForUser === 'function' ? window.getActivePlanForUser(u.user) : null;
    const currentPlanId = activePlan ? activePlan.id : null;
    const expText = plan.expires
      ? plan.expires.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    const isExpiring = plan.active && plan.expires && plan.expires.getTime() <= now24h;
    const expiringTag = isExpiring ? '<span class="admin-expiring-row-badge">24h</span>' : '';
    rows +=
      '<tr class="' + (isExpiring ? 'admin-row-expiring' : '') + '">' +
        '<td><input type="checkbox" class="admin-cb admin-row-cb" data-username="' + escAdmin(u.user) + '"/></td>' +
        '<td><span class="admin-user-name">' + escAdmin(u.user) + '</span></td>' +
        '<td><span class="admin-plan-pill' + (plan.active ? ' active' : '') + '">' +
          (plan.active ? escAdmin(plan.label) : 'Inativo') +
        '</span>' + expiringTag + '</td>' +
        '<td class="admin-cell-muted">' + escAdmin(expText) + '</td>' +
        '<td class="admin-cell-muted">' + escAdmin(formatAdminDate(u.createdAt)) + '</td>' +
        '<td class="admin-plan-actions">' +
          adminBuildPlanSelect(u.user, currentPlanId) +
          '<button type="button" class="admin-plan-on-btn" data-username="' + escAdmin(u.user) + '">Ligar</button>' +
          (plan.active
            ? '<button type="button" class="admin-plan-off-btn" data-username="' + escAdmin(u.user) + '">Desligar</button>'
            : '') +
          '<button type="button" class="admin-reset-btn" data-username="' + escAdmin(u.user) + '">Reset senha</button>' +
        '</td>' +
      '</tr>';
  });

  const tableHtml = filtered.length
    ? '<div class="admin-table-wrap"><table class="admin-table admin-table-clients"><thead><tr>' +
        '<th><input type="checkbox" class="admin-cb" id="admin-cb-all" title="Selecionar todos"/></th>' +
        '<th>Cliente</th><th>Plano</th><th>Validade</th><th>Cadastro</th><th>Gerenciar</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>'
    : '<p class="admin-empty">Nenhum cliente neste filtro.</p>';

  function fBtn(f, label) {
    return '<button type="button" class="admin-filter-btn' + (currentFilter === f ? ' active' : '') + '" data-filter="' + f + '">' + label + '</button>';
  }

  root.innerHTML =
    '<div class="sdash-wrap">' +
      '<div class="sdash-header">' +
        '<div class="sdash-header-left">' +
          '<div class="sdash-header-icon sdash-icon-blue">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
          '</div>' +
          '<div>' +
            '<h3 class="sdash-title">Clientes</h3>' +
            '<p class="sdash-sub">Planos ativos e inativos de todos os usuários</p>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="admin-sync-btn" onclick="adminSyncFromSupabase()">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
          'Sincronizar' +
        '</button>' +
      '</div>' +
      '<div class="sdash-stats">' +
        _sdashStat('Total de clientes', users.length,
          '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 'blue') +
        _sdashStat('Ativos', active,
          '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', 'green') +
        _sdashStat('Inativos', inactive,
          '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>', 'purple') +
        _sdashStat('Expiram em 24h', expiring,
          '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 'orange') +
      '</div>' +
      '<div class="aclients-controls">' +
        '<div class="admin-filter-bar">' + fBtn('all', 'Todos') + fBtn('active', 'Ativos') + fBtn('inactive', 'Inativos') + '</div>' +
        '<div class="admin-search-wrap aclients-search">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          '<input class="admin-search-input admin-clients-search-input" type="text" placeholder="Buscar usuário..." value="' + escAdmin(searchTerm) + '" autocomplete="off"/>' +
        '</div>' +
        '<button type="button" class="admin-export-btn" onclick="adminExportClientsCSV()">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
          'Exportar CSV' +
        '</button>' +
      '</div>' +
      bulkBar +
      '<div class="admin-panel aclients-table-panel">' + tableHtml + '</div>' +
    '</div>';

  root.querySelectorAll('.admin-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => renderAdminClients(btn.getAttribute('data-filter')));
  });

  const searchEl = root.querySelector('.admin-clients-search-input');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      root.setAttribute('data-search', searchEl.value);
      renderAdminClients(root.getAttribute('data-filter'));
    });
    if (hadSearchFocus) {
      searchEl.focus();
      searchEl.setSelectionRange(searchCursorPos, searchCursorPos);
    }
  }

  const tablePanel = root.querySelector('.aclients-table-panel');

  const cbAll = document.getElementById('admin-cb-all');
  if (cbAll) {
    cbAll.addEventListener('change', () => {
      root.querySelectorAll('.admin-row-cb').forEach(cb => { cb.checked = cbAll.checked; });
      updateAdminBulkBar(root);
    });
  }
  root.querySelectorAll('.admin-row-cb').forEach(cb => {
    cb.addEventListener('change', () => updateAdminBulkBar(root));
  });

  root.querySelectorAll('.admin-reset-btn').forEach(btn => {
    btn.addEventListener('click', () => adminOpenResetModal(btn.getAttribute('data-username')));
  });

  const bulkOnBtn = document.getElementById('admin-bulk-on-btn');
  const bulkOffBtn = document.getElementById('admin-bulk-off-btn');
  if (bulkOnBtn) {
    bulkOnBtn.addEventListener('click', () => {
      const planId = document.getElementById('admin-bulk-plan-select').value;
      const selected = getAdminSelectedUsernames(root);
      selected.forEach(u => adminActivateUserPlan(u, planId));
      if (typeof refreshClientPlanState === 'function') refreshClientPlanState();
      if (typeof showToast === 'function') showToast(selected.length + ' plano(s) ativado(s)');
      renderAdminClients(filter);
    });
  }
  if (bulkOffBtn) {
    bulkOffBtn.addEventListener('click', () => {
      const selected = getAdminSelectedUsernames(root);
      selected.forEach(u => adminDeactivateUserPlan(u));
      if (typeof showToast === 'function') showToast(selected.length + ' plano(s) desativado(s)');
      renderAdminClients(filter);
    });
  }

  bindAdminClientPlanActions(tablePanel, currentFilter);
}

function bindAdminClientPlanActions(tableEl, filter) {
  if (!tableEl) return;

  tableEl.querySelectorAll('.admin-plan-on-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.getAttribute('data-username');
      const row = btn.closest('tr');
      const sel = row ? row.querySelector('.admin-plan-select') : null;
      if (!username || !sel) return;
      if (adminActivateUserPlan(username, sel.value)) {
        if (typeof refreshClientPlanState === 'function') refreshClientPlanState();
      }
      renderAdminClients(filter);
    });
  });

  tableEl.querySelectorAll('.admin-plan-off-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.getAttribute('data-username');
      if (!username) return;
      adminDeactivateUserPlan(username);
      renderAdminClients(filter);
    });
  });
}

function getAdminSelectedUsernames(root) {
  const selected = [];
  root.querySelectorAll('.admin-row-cb:checked').forEach(cb => {
    const u = cb.getAttribute('data-username');
    if (u) selected.push(u);
  });
  return selected;
}

function updateAdminBulkBar(root) {
  const bar = document.getElementById('admin-bulk-bar');
  const countEl = document.getElementById('admin-bulk-count');
  const selected = getAdminSelectedUsernames(root);
  if (!bar) return;
  bar.classList.toggle('visible', selected.length > 0);
  if (countEl) countEl.textContent = selected.length + ' selecionado' + (selected.length === 1 ? '' : 's');
}

function renderAdminResellers() {
  const root = document.getElementById('admin-resellers-root');
  if (!root) return;

  const _prevSearchR = root.querySelector('.admin-resellers-search-input');
  const hadSearchFocus = _prevSearchR === document.activeElement;
  const searchCursorPos = hadSearchFocus ? _prevSearchR.selectionStart : 0;
  const searchTerm = root.getAttribute('data-search') || '';

  const allUsers = adminGetUsers();
  let enabled = 0, totalLogins = 0, totalCredits = 0;
  allUsers.forEach(u => {
    if (isResellerEnabled(u.user)) enabled++;
    if (typeof getResellerLoginsFor === 'function') totalLogins += getResellerLoginsFor(u.user).length;
    if (typeof getResellerCredits === 'function') {
      const unl = typeof isUnlimitedResellerCredits === 'function' && isUnlimitedResellerCredits(u.user);
      if (!unl) totalCredits += getResellerCredits(u.user);
    }
  });

  const _searchLower = searchTerm.trim().toLowerCase();
  const users = _searchLower
    ? allUsers.filter(u => u.user.toLowerCase().includes(_searchLower))
    : allUsers;

  let listHtml = '';
  if (!allUsers.length) {
    listHtml = '<p class="admin-empty">Nenhum usuário cadastrado ainda.</p>';
  } else if (!users.length) {
    listHtml = '<p class="admin-empty">Nenhum resultado para "' + escAdmin(searchTerm) + '".</p>';
  } else {
    let cards = '';
    users.forEach(u => {
      const on = isResellerEnabled(u.user);
      const credits = typeof getResellerCredits === 'function' ? getResellerCredits(u.user) : 0;
      const creditsUnlimited = typeof isUnlimitedResellerCredits === 'function' && isUnlimitedResellerCredits(u.user);
      const creditsLabel = creditsUnlimited
        ? '<strong>∞</strong> créditos'
        : '<strong>' + credits + '</strong> crédito' + (credits === 1 ? '' : 's');
      const loginsCount = typeof getResellerLoginsFor === 'function' ? getResellerLoginsFor(u.user).length : 0;
      const userEsc = escAdmin(u.user);
      cards +=
        '<article class="admin-reseller-card' + (on ? ' is-active' : '') + '">' +
          '<div class="admin-reseller-card-top">' +
            '<div class="admin-reseller-card-identity">' +
              '<h4 class="admin-reseller-card-name">' + userEsc + '</h4>' +
              '<p class="admin-reseller-card-meta">' +
                '<span class="admin-reseller-meta-item">' + creditsLabel + '</span>' +
                '<span class="admin-reseller-meta-sep">·</span>' +
                '<span class="admin-reseller-meta-item">' + loginsCount + ' login' + (loginsCount === 1 ? '' : 's') + ' criado' + (loginsCount === 1 ? '' : 's') + '</span>' +
              '</p>' +
            '</div>' +
            '<span class="admin-reseller-pill' + (on ? ' on' : '') + '">' + (on ? 'Revenda ativa' : 'Inativo') + '</span>' +
          '</div>' +
          '<div class="admin-reseller-card-actions">' +
            '<button type="button" class="admin-reseller-act admin-reseller-act-primary" data-username="' + userEsc + '" data-reseller-action="credits">' +
              '<span class="admin-reseller-act-title">Adicionar créditos</span><span class="admin-reseller-act-desc">Saldo para criar logins</span>' +
            '</button>' +
            '<button type="button" class="admin-reseller-act" data-username="' + userEsc + '" data-reseller-action="logins">' +
              '<span class="admin-reseller-act-title">Ver logins</span><span class="admin-reseller-act-desc">Contas já geradas</span>' +
            '</button>' +
            '<button type="button" class="admin-reseller-act" data-username="' + userEsc + '" data-reseller-action="panel">' +
              '<span class="admin-reseller-act-title">Abrir painel</span><span class="admin-reseller-act-desc">Visualizar como revendedor</span>' +
            '</button>' +
            '<button type="button" class="admin-reseller-act admin-reseller-act-toggle' + (on ? ' is-on' : '') + '" data-username="' + userEsc + '" data-reseller-action="toggle" data-enabled="' + (on ? 'true' : 'false') + '">' +
              '<span class="admin-reseller-act-title">' + (on ? 'Desativar revenda' : 'Ativar revenda') + '</span>' +
              '<span class="admin-reseller-act-desc">' + (on ? 'Remove menu Revendedor' : 'Libera área de revenda') + '</span>' +
            '</button>' +
          '</div>' +
        '</article>';
    });
    listHtml = '<div class="admin-reseller-list">' + cards + '</div>';
  }

  root.innerHTML =
    '<div class="sdash-wrap">' +
      '<div class="sdash-header">' +
        '<div class="sdash-header-left">' +
          '<div class="sdash-header-icon sdash-icon-orange">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
          '</div>' +
          '<div>' +
            '<h3 class="sdash-title">Revendedores</h3>' +
            '<p class="sdash-sub">Habilite quem pode revender logins na plataforma</p>' +
          '</div>' +
        '</div>' +
        '<span class="aresellers-count-badge">' + enabled + ' de ' + allUsers.length + ' ativos</span>' +
      '</div>' +
      '<div class="sdash-stats">' +
        _sdashStat('Usuários', allUsers.length,
          '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 'blue') +
        _sdashStat('Revenda ativa', enabled,
          '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', 'green') +
        _sdashStat('Logins criados', totalLogins,
          '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>', 'orange') +
        _sdashStat('Créditos distribuídos', totalCredits,
          '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>', 'purple') +
      '</div>' +
      '<div class="admin-resellers-legend">' +
        '<div class="admin-resellers-legend-item"><span class="admin-resellers-legend-dot"></span><span><strong>Créditos</strong> — cada unidade permite gerar 1 login de cliente.</span></div>' +
        '<div class="admin-resellers-legend-item"><span class="admin-resellers-legend-dot"></span><span><strong>Revenda ativa</strong> — o usuário vê o menu Revendedor ao entrar.</span></div>' +
      '</div>' +
      (typeof _resellerRankingHtml === 'function' ? _resellerRankingHtml() : '') +
      '<div class="admin-search-wrap">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '<input class="admin-search-input admin-resellers-search-input" type="text" placeholder="Buscar revendedor..." value="' + escAdmin(searchTerm) + '" autocomplete="off"/>' +
      '</div>' +
      listHtml +
    '</div>';

  if (typeof _loadResellerRanking === 'function') _loadResellerRanking(null);

  const searchEl = root.querySelector('.admin-resellers-search-input');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      root.setAttribute('data-search', searchEl.value);
      renderAdminResellers();
    });
    if (hadSearchFocus) {
      searchEl.focus();
      searchEl.setSelectionRange(searchCursorPos, searchCursorPos);
    }
  }

  root.querySelectorAll('[data-reseller-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.getAttribute('data-username');
      const action = btn.getAttribute('data-reseller-action');
      if (!username || !action) return;
      if (action === 'credits') {
        openAdminResellerCreditsModal(username);
      } else if (action === 'logins') {
        openAdminResellerLoginsModal(username);
      } else if (action === 'panel') {
        if (typeof openAdminResellerPanel === 'function') openAdminResellerPanel(username);
      } else if (action === 'toggle') {
        setResellerEnabled(username, btn.getAttribute('data-enabled') !== 'true');
        renderAdminResellers();
      }
    });
  });
}

let _adminCreditsReseller = null;

function openAdminResellerCreditsModal(reseller) {
  const overlay = document.getElementById('admin-reseller-credits-overlay');
  const titleEl = document.getElementById('admin-reseller-credits-title');
  const currentEl = document.getElementById('admin-reseller-credits-current');
  const amountEl = document.getElementById('admin-reseller-credits-amount');
  const msgEl = document.getElementById('admin-reseller-credits-msg');
  const form = document.getElementById('admin-reseller-credits-form');
  if (!overlay || !form) return;

  _adminCreditsReseller = reseller;
  const credits = typeof getResellerCredits === 'function' ? getResellerCredits(reseller) : 0;

  if (titleEl) titleEl.textContent = 'Créditos — ' + reseller;
  if (currentEl) {
    const unlimited = typeof isUnlimitedResellerCredits === 'function' && isUnlimitedResellerCredits(reseller);
    currentEl.textContent = unlimited
      ? 'Saldo atual: crédito infinito (∞)'
      : 'Saldo atual: ' + credits + ' crédito' + (credits === 1 ? '' : 's') + ' disponíve' + (credits === 1 ? 'l' : 'is');
  }
  if (amountEl) amountEl.value = '10';
  if (msgEl) {
    msgEl.textContent = '';
    msgEl.className = 'admin-reseller-credits-msg';
  }

  if (!form._creditsBound) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!_adminCreditsReseller) return;
      const amt = parseInt(document.getElementById('admin-reseller-credits-amount').value, 10);
      await adminAddResellerCredits(_adminCreditsReseller, amt);
    });
    document.querySelectorAll('#admin-reseller-credits-quick .admin-credits-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amountEl = document.getElementById('admin-reseller-credits-amount');
        if (!amountEl) return;
        const add = parseInt(btn.getAttribute('data-amount'), 10) || 0;
        const current = parseInt(amountEl.value, 10) || 0;
        amountEl.value = String(Math.min(9999, current + add));
      });
    });
    form._creditsBound = true;
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAdminResellerCreditsModal() {
  const overlay = document.getElementById('admin-reseller-credits-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  _adminCreditsReseller = null;
}

async function adminAddResellerCredits(reseller, amount) {
  const msgEl = document.getElementById('admin-reseller-credits-msg');
  const submitBtn = document.querySelector('#admin-reseller-credits-form button[type="submit"]');
  const amt = Math.floor(Number(amount));
  if (!reseller) return;
  if (!amt || amt < 1 || amt > 9999) {
    if (msgEl) {
      msgEl.textContent = 'Informe uma quantidade entre 1 e 9999.';
      msgEl.className = 'admin-reseller-credits-msg err';
    }
    return;
  }
  if (typeof addResellerCredits !== 'function') {
    if (msgEl) {
      msgEl.textContent = 'Função de créditos indisponível. Recarregue a página.';
      msgEl.className = 'admin-reseller-credits-msg err';
    }
    return;
  }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...'; }
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'admin-reseller-credits-msg'; }

  try {
    // Salva no Supabase primeiro para garantir sincronização
    if (typeof DB !== 'undefined' && DB.isConfigured()) {
      const res = await DB.addResellerCredits(reseller, amt).catch(function() { return null; });
      if (res && !res.ok) {
        if (msgEl) {
          msgEl.textContent = 'Erro ao salvar no servidor: ' + (res.msg || 'tente novamente.');
          msgEl.className = 'admin-reseller-credits-msg err';
        }
        return;
      }
    }

    const ok = addResellerCredits(reseller, amt);
    if (!ok) {
      if (msgEl) {
        msgEl.textContent = 'Não foi possível adicionar os créditos.';
        msgEl.className = 'admin-reseller-credits-msg err';
      }
      return;
    }

    const total = getResellerCredits(reseller);
    const totalUnlimited = typeof isUnlimitedResellerCredits === 'function' && isUnlimitedResellerCredits(reseller);
    if (msgEl) {
      msgEl.textContent = '+' + amt + ' crédito' + (amt === 1 ? '' : 's') + ' adicionado' + (amt === 1 ? '' : 's') + '. Novo saldo: ' + (totalUnlimited ? '∞' : total) + '.';
      msgEl.className = 'admin-reseller-credits-msg ok';
    }
    const currentEl = document.getElementById('admin-reseller-credits-current');
    if (currentEl) {
      currentEl.textContent = totalUnlimited
        ? 'Saldo atual: crédito infinito (∞)'
        : 'Saldo atual: ' + total + ' crédito' + (total === 1 ? '' : 's') + ' disponíve' + (total === 1 ? 'l' : 'is');
    }
    renderAdminResellers();
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Adicionar créditos'; }
  }
}

window.openAdminResellerCreditsModal = openAdminResellerCreditsModal;
window.closeAdminResellerCreditsModal = closeAdminResellerCreditsModal;

function openAdminResellerLoginsModal(reseller) {
  const overlay = document.getElementById('admin-reseller-logins-overlay');
  const titleEl = document.getElementById('admin-reseller-logins-title');
  const bodyEl = document.getElementById('admin-reseller-logins-body');
  const creditsEl = document.getElementById('admin-reseller-logins-credits');
  if (!overlay || !bodyEl) return;

  const logins = typeof getResellerLoginsFor === 'function' ? getResellerLoginsFor(reseller) : [];
  const credits = typeof getResellerCredits === 'function' ? getResellerCredits(reseller) : 0;
  const creditsUnlimited = typeof isUnlimitedResellerCredits === 'function' && isUnlimitedResellerCredits(reseller);

  if (titleEl) titleEl.textContent = 'Logins de ' + reseller;
  if (creditsEl) {
    const credTxt = creditsUnlimited ? '∞ créditos' : credits + ' crédito' + (credits === 1 ? '' : 's');
    creditsEl.textContent = credTxt + ' não usados · ' + logins.length + ' login' + (logins.length === 1 ? '' : 's') + ' criado' + (logins.length === 1 ? '' : 's');
  }

  if (!logins.length) {
    bodyEl.innerHTML = '<p class="admin-empty">Este revendedor ainda não criou nenhum login.</p>';
  } else {
    let rows = '';
    logins.forEach(item => {
      const left = typeof getDaysRemaining === 'function' ? getDaysRemaining(item.expiresAt) : 0;
      const status = left > 0 ? 'Ativo' : 'Expirado';
      rows +=
        '<tr>' +
          '<td><span class="admin-user-name">' + escAdmin(item.username) + '</span></td>' +
          '<td><code class="admin-login-pass">' + escAdmin(item.password) + '</code></td>' +
          '<td>' + escAdmin(String(item.days)) + ' dias</td>' +
          '<td>' + left + ' dia' + (left === 1 ? '' : 's') + '</td>' +
          '<td><span class="admin-reseller-status' + (left > 0 ? ' on' : '') + '">' + status + '</span></td>' +
          '<td class="admin-cell-muted">' + escAdmin(formatResellerDate(item.createdAt)) + '</td>' +
        '</tr>';
    });
    bodyEl.innerHTML =
      '<div class="admin-table-wrap">' +
        '<table class="admin-table admin-table-logins-modal">' +
          '<thead><tr><th>Usuário</th><th>Senha</th><th>Plano</th><th>Restante</th><th>Status</th><th>Criado em</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>';
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAdminResellerLoginsModal() {
  const overlay = document.getElementById('admin-reseller-logins-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function patchEnterAppForAdmin() {
  if (typeof window.enterApp !== 'function' || window.enterApp._adminPatched) return;
  const original = window.enterApp;
  window.enterApp = function (user) {
    original(user); // já dispara showAppView → renderAdminView via patch abaixo
    updateAppNavigation();
    if (isAdmin()) {
      // filter binding happens inside renderAdminClients on each render
    } else if (typeof refreshClientPlanState === 'function') {
      refreshClientPlanState();
      if (typeof renderModulesHub === 'function') renderModulesHub();
      if (typeof renderSidebarConsultas === 'function') renderSidebarConsultas();
      if (typeof updateSidebarUserFooter === 'function') updateSidebarUserFooter();
    }
  };
  window.enterApp._adminPatched = true;
}

function initAdminShowAppView() {
  if (typeof window.showAppView === 'undefined' || window.showAppView._adminViewsPatched) return;
  const original = window.showAppView;
  window.showAppView = function (view) {
    if (isAdmin()) {
      const userViews = ['modules', 'search', 'loja', 'revendedor', 'revendedor-painel', 'admin'];
      if (view === 'revendedor-painel') {
        if (!window._resellerPanelUser) view = 'admin-dashboard';
      } else if (userViews.indexOf(view) !== -1) {
        view = 'admin-dashboard';
      } else if (ADMIN_VIEWS.indexOf(view) === -1) {
        view = 'admin-dashboard';
      }
    }
    original(view);
    if (isAdmin() && ADMIN_VIEWS.indexOf(view) !== -1) {
      renderAdminView(view);
    }
  };
  window.showAppView._adminViewsPatched = true;
}

async function adminSyncFromSupabase() {
  if (typeof DB === 'undefined' || !DB.isConfigured()) return;
  const btns = Array.from(document.querySelectorAll('.admin-sync-btn'));
  btns.forEach(function(b) {
    b.disabled = true;
    b.classList.remove('ok', 'error');
    var svg = b.querySelector('svg');
    if (svg) svg.style.animation = 'adminSyncSpin 0.8s linear infinite';
  });
  try {
    const user = typeof getSession === 'function' ? getSession() : null;
    const syncOk = await DB.syncOnLogin(user);
    renderAdminClients();
    renderAdminResellers();
    if (typeof renderSalesDashboard === 'function') renderSalesDashboard();
    if (syncOk === false) {
      btns.forEach(function(b) { b.classList.add('error'); });
      setTimeout(function () { btns.forEach(function(b) { b.classList.remove('error'); }); }, 3000);
    } else {
      btns.forEach(function(b) { b.classList.add('ok'); });
      setTimeout(function () { btns.forEach(function(b) { b.classList.remove('ok'); }); }, 2000);
    }
  } catch (e) {
    console.error('[Admin] Erro na sincronização:', e);
    btns.forEach(function(b) { b.classList.add('error'); });
    setTimeout(function () { btns.forEach(function(b) { b.classList.remove('error'); }); }, 3000);
  } finally {
    btns.forEach(function(b) {
      b.disabled = false;
      var svg = b.querySelector('svg');
      if (svg) svg.style.animation = '';
    });
  }
}
window.adminSyncFromSupabase = adminSyncFromSupabase;

patchEnterAppForAdmin();
initAdminShowAppView();
window.updateAppNavigation = updateAppNavigation;

(function bootLoggedInSession() {
  if (typeof getSession !== 'function' || !getSession()) return;
  updateAppNavigation();
  const app = document.getElementById('app');
  if (!app || app.style.display !== 'block') return;
  if (isAdmin()) {
    // showAppView (patched by initAdminShowAppView) already calls renderAdminView internally
    if (typeof showAppView === 'function') {
      showAppView('admin-dashboard');
    } else {
      renderAdminView('admin-dashboard');
    }
    return;
  }
  if (typeof showAppView === 'function') {
    const view = document.getElementById('view-revendedor');
    if (view && view.classList.contains('active') && !canAccessRevendedor()) {
      showAppView('modules');
    }
  }
})();

