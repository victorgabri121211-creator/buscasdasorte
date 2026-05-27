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
    bindAdminClientFilters();
    renderAdminClients();
  }
  if (view === 'admin-revendedores') renderAdminResellers();
  setAdminNavActive(view);
}

function renderAdminDashboard() {
  renderAdminView('admin-dashboard');
}

function renderAdminClients(filter) {
  const tableEl = document.getElementById('admin-clients-table');
  const countsEl = document.getElementById('admin-clients-counts');
  if (!tableEl) return;

  const users = adminGetUsers();
  const now = Date.now();
  let active = 0;
  let inactive = 0;

  users.forEach(u => {
    const plan = adminGetPlanInfo(u.user);
    if (plan.active) active++;
    else inactive++;
  });

  if (countsEl) {
    countsEl.innerHTML =
      '<span class="admin-count-pill active">' + active + ' ativos</span>' +
      '<span class="admin-count-pill inactive">' + inactive + ' inativos</span>' +
      '<span class="admin-count-pill total">' + users.length + ' total</span>';
  }

  const currentFilter = filter || tableEl.getAttribute('data-filter') || 'all';
  tableEl.setAttribute('data-filter', currentFilter);

  document.querySelectorAll('.admin-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === currentFilter);
  });

  const searchEl = document.getElementById('admin-clients-search');
  const searchTerm = searchEl ? searchEl.value.trim().toLowerCase() : '';

  const filtered = users.filter(u => {
    const plan = adminGetPlanInfo(u.user);
    if (currentFilter === 'active' && !plan.active) return false;
    if (currentFilter === 'inactive' && plan.active) return false;
    if (searchTerm && !u.user.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  if (!filtered.length) {
    tableEl.innerHTML = '<p class="admin-empty">Nenhum cliente neste filtro.</p>';
    return;
  }

  let rows = '';
  filtered.forEach(u => {
    const plan = adminGetPlanInfo(u.user);
    const active = typeof window.getActivePlanForUser === 'function' ? window.getActivePlanForUser(u.user) : null;
    const currentPlanId = active ? active.id : null;
    const expText = plan.expires
      ? plan.expires.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    rows +=
      '<tr>' +
        '<td><span class="admin-user-name">' + escAdmin(u.user) + '</span></td>' +
        '<td><span class="admin-plan-pill' + (plan.active ? ' active' : '') + '">' +
          (plan.active ? escAdmin(plan.label) : 'Inativo') +
        '</span></td>' +
        '<td class="admin-cell-muted">' + escAdmin(expText) + '</td>' +
        '<td class="admin-cell-muted">' + escAdmin(formatAdminDate(u.createdAt)) + '</td>' +
        '<td class="admin-plan-actions">' +
          adminBuildPlanSelect(u.user, currentPlanId) +
          '<button type="button" class="admin-plan-on-btn" data-username="' + escAdmin(u.user) + '">Ligar</button>' +
          (plan.active
            ? '<button type="button" class="admin-plan-off-btn" data-username="' + escAdmin(u.user) + '">Desligar</button>'
            : '') +
        '</td>' +
      '</tr>';
  });

  tableEl.innerHTML =
    '<div class="admin-table-wrap">' +
      '<table class="admin-table admin-table-clients">' +
        '<thead><tr><th>Cliente</th><th>Plano</th><th>Validade</th><th>Cadastro</th><th>Gerenciar</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';

  bindAdminClientPlanActions(tableEl, currentFilter);
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

function bindAdminClientFilters() {
  if (bindAdminClientFilters.done) return;
  document.querySelectorAll('.admin-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => renderAdminClients(btn.getAttribute('data-filter')));
  });
  const searchEl = document.getElementById('admin-clients-search');
  if (searchEl) searchEl.addEventListener('input', () => renderAdminClients());
  bindAdminClientFilters.done = true;
}

function bindAdminResellerSearch() {
  if (bindAdminResellerSearch.done) return;
  const searchEl = document.getElementById('admin-resellers-search');
  if (searchEl) searchEl.addEventListener('input', () => renderAdminResellers());
  bindAdminResellerSearch.done = true;
}

function renderAdminResellers() {
  const tableEl = document.getElementById('admin-resellers-table');
  const countEl = document.getElementById('admin-resellers-count');
  if (!tableEl) return;

  bindAdminResellerSearch();

  const allUsers = adminGetUsers();
  let enabled = 0;
  allUsers.forEach(u => { if (isResellerEnabled(u.user)) enabled++; });

  if (countEl) {
    countEl.textContent = enabled + ' de ' + allUsers.length + ' com revenda ativa';
  }

  const searchEl = document.getElementById('admin-resellers-search');
  const searchTerm = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const users = searchTerm
    ? allUsers.filter(u => u.user.toLowerCase().includes(searchTerm))
    : allUsers;

  if (!allUsers.length) {
    tableEl.innerHTML = '<p class="admin-empty">Nenhum usuário cadastrado ainda.</p>';
    return;
  }

  if (!users.length) {
    tableEl.innerHTML = '<p class="admin-empty">Nenhum resultado para "' + escAdmin(searchTerm) + '".</p>';
    return;
  }

  let cards = '';
  users.forEach(u => {
    const on = isResellerEnabled(u.user);
    const credits = typeof getResellerCredits === 'function' ? getResellerCredits(u.user) : 0;
    const loginsCount = typeof getResellerLoginsFor === 'function'
      ? getResellerLoginsFor(u.user).length
      : 0;
    const userEsc = escAdmin(u.user);

    cards +=
      '<article class="admin-reseller-card' + (on ? ' is-active' : '') + '">' +
        '<div class="admin-reseller-card-top">' +
          '<div class="admin-reseller-card-identity">' +
            '<h4 class="admin-reseller-card-name">' + userEsc + '</h4>' +
            '<p class="admin-reseller-card-meta">' +
              '<span class="admin-reseller-meta-item">' +
                '<strong>' + credits + '</strong> crédito' + (credits === 1 ? '' : 's') +
              '</span>' +
              '<span class="admin-reseller-meta-sep">·</span>' +
              '<span class="admin-reseller-meta-item">' +
                loginsCount + ' login' + (loginsCount === 1 ? '' : 's') + ' criado' + (loginsCount === 1 ? '' : 's') +
              '</span>' +
            '</p>' +
          '</div>' +
          '<span class="admin-reseller-pill' + (on ? ' on' : '') + '">' +
            (on ? 'Revenda ativa' : 'Inativo') +
          '</span>' +
        '</div>' +
        '<div class="admin-reseller-card-actions">' +
          '<button type="button" class="admin-reseller-act admin-reseller-act-primary"' +
            ' data-username="' + userEsc + '" data-reseller-action="credits">' +
            '<span class="admin-reseller-act-title">Adicionar créditos</span>' +
            '<span class="admin-reseller-act-desc">Saldo para criar logins</span>' +
          '</button>' +
          '<button type="button" class="admin-reseller-act"' +
            ' data-username="' + userEsc + '" data-reseller-action="logins">' +
            '<span class="admin-reseller-act-title">Ver logins</span>' +
            '<span class="admin-reseller-act-desc">Contas já geradas</span>' +
          '</button>' +
          '<button type="button" class="admin-reseller-act"' +
            ' data-username="' + userEsc + '" data-reseller-action="panel">' +
            '<span class="admin-reseller-act-title">Abrir painel</span>' +
            '<span class="admin-reseller-act-desc">Visualizar como revendedor</span>' +
          '</button>' +
          '<button type="button" class="admin-reseller-act admin-reseller-act-toggle' + (on ? ' is-on' : '') + '"' +
            ' data-username="' + userEsc + '" data-reseller-action="toggle" data-enabled="' + (on ? 'true' : 'false') + '">' +
            '<span class="admin-reseller-act-title">' + (on ? 'Desativar revenda' : 'Ativar revenda') + '</span>' +
            '<span class="admin-reseller-act-desc">' + (on ? 'Remove menu Revendedor' : 'Libera área de revenda') + '</span>' +
          '</button>' +
        '</div>' +
      '</article>';
  });

  tableEl.innerHTML =
    '<div class="admin-resellers-legend">' +
      '<div class="admin-resellers-legend-item">' +
        '<span class="admin-resellers-legend-dot"></span>' +
        '<span><strong>Créditos</strong> — cada unidade permite gerar 1 login de cliente.</span>' +
      '</div>' +
      '<div class="admin-resellers-legend-item">' +
        '<span class="admin-resellers-legend-dot"></span>' +
        '<span><strong>Revenda ativa</strong> — o usuário vê o menu Revendedor ao entrar.</span>' +
      '</div>' +
    '</div>' +
    '<div class="admin-reseller-list">' + cards + '</div>';

  tableEl.querySelectorAll('[data-reseller-action]').forEach(btn => {
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
    currentEl.textContent = 'Saldo atual: ' + credits + ' crédito' + (credits === 1 ? '' : 's') + ' disponíve' + (credits === 1 ? 'l' : 'is');
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
    if (msgEl) {
      msgEl.textContent = '+' + amt + ' crédito' + (amt === 1 ? '' : 's') + ' adicionado' + (amt === 1 ? '' : 's') + '. Novo saldo: ' + total + '.';
      msgEl.className = 'admin-reseller-credits-msg ok';
    }
    const currentEl = document.getElementById('admin-reseller-credits-current');
    if (currentEl) {
      currentEl.textContent = 'Saldo atual: ' + total + ' crédito' + (total === 1 ? '' : 's') + ' disponíve' + (total === 1 ? 'l' : 'is');
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

  if (titleEl) titleEl.textContent = 'Logins de ' + reseller;
  if (creditsEl) {
    creditsEl.textContent = credits + ' crédito' + (credits === 1 ? '' : 's') + ' não usados · ' + logins.length + ' login' + (logins.length === 1 ? '' : 's') + ' criado' + (logins.length === 1 ? '' : 's');
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
      bindAdminClientFilters();
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
    var svg = b.querySelector('svg');
    if (svg) svg.style.animation = 'adminSyncSpin 0.8s linear infinite';
  });
  try {
    const user = typeof getSession === 'function' ? getSession() : null;
    await DB.syncOnLogin(user);
    renderAdminClients();
    renderAdminResellers();
    if (typeof renderSalesDashboard === 'function') renderSalesDashboard();
    btns.forEach(function(b) {
      b.classList.remove('loading');
      b.classList.add('ok');
    });
    setTimeout(function () {
      btns.forEach(function(b) { b.classList.remove('ok'); });
    }, 2000);
  } catch (e) {
    btns.forEach(function(b) { b.classList.remove('loading'); });
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
    renderAdminView('admin-dashboard');
    if (typeof showAppView === 'function') showAppView('admin-dashboard');
    return;
  }
  if (typeof showAppView === 'function') {
    const view = document.getElementById('view-revendedor');
    if (view && view.classList.contains('active') && !canAccessRevendedor()) {
      showAppView('modules');
    }
  }
})();

