// HUB DE MÓDULOS — tela inicial após login
const PLANS = [
  {
    id: 'diaria',
    period: 'Diária',
    durationLabel: '24 horas',
    price: 5,
    perDay: 5,
    tag: 'Para começar',
    badge: null,
    featured: false,
    saveHint: 'Ideal para testar',
    perks: ['Todos os módulos de consulta', 'Válido por 24 horas'],
  },
  {
    id: 'semana',
    period: '1 Semana',
    durationLabel: '7 dias',
    price: 20,
    perDay: 2.86,
    tag: 'Uso frequente',
    badge: 'Mais vendido',
    featured: true,
    saveHint: 'Economize R$ 15,00',
    perks: ['Consultas ilimitadas no período', 'Melhor que 7 diárias'],
  },
  {
    id: 'mes',
    period: '1 Mês',
    durationLabel: '30 dias',
    price: 25,
    perDay: 0.83,
    tag: 'Melhor valor',
    badge: 'Melhor custo',
    featured: false,
    saveHint: 'Economize R$ 125,00',
    perks: ['Consultas ilimitadas no período', 'Menor custo por dia'],
  },
];

const PLAN_STORE_KEY = typeof window !== 'undefined' && window.PLAN_STORE_KEY
  ? window.PLAN_STORE_KEY
  : 'bds_active_plans';
const PLAN_ADMIN_USER = typeof window !== 'undefined' && window.PLAN_ADMIN_USER
  ? window.PLAN_ADMIN_USER
  : atob('RGFzb3J0ZQ==');
const PLAN_DURATIONS_MS = typeof window !== 'undefined' && window.PLAN_DURATIONS_MS
  ? window.PLAN_DURATIONS_MS
  : { diaria: 86400000, semana: 604800000, mes: 2592000000 };

function hasActivePlan() {
  if (typeof hasActivePlanForSession === 'function') return hasActivePlanForSession();
  const user = typeof getSession === 'function' ? getSession() : null;
  return !!(typeof getActivePlanForUser === 'function' && getActivePlanForUser(user));
}

function isResellerClientAccount() {
  return typeof isResellerClientSession === 'function' && isResellerClientSession();
}

function applyResellerClientNavigation() {
  const hideStore = isResellerClientAccount();
  const navLoja = document.getElementById('nav-loja');
  const viewLoja = document.getElementById('view-loja');
  if (navLoja) {
    navLoja.hidden = hideStore;
    navLoja.setAttribute('aria-hidden', hideStore ? 'true' : 'false');
    if (hideStore) {
      navLoja.style.display = 'none';
      navLoja.classList.remove('active');
    } else {
      navLoja.style.removeProperty('display');
    }
  }
  if (viewLoja && hideStore) {
    viewLoja.classList.remove('active');
    viewLoja.style.display = 'none';
  } else if (viewLoja) {
    viewLoja.style.removeProperty('display');
  }
  document.body.classList.toggle('user-reseller-client', hideStore);
}

function refreshClientPlanState() {
  if (typeof migratePlansStore === 'function') migratePlansStore();
  applyResellerClientNavigation();
  updatePlanBanner();
  updateStoreActivePlan();
}

function activatePlan(planId) {
  const user = typeof getSession === 'function' ? getSession() : null;
  if (!user || user === PLAN_ADMIN_USER) return false;
  const def = PLANS.find(p => p.id === planId);
  if (!def) return false;
  if (typeof setPlanForUser === 'function') {
    setPlanForUser(user, planId);
  } else {
    const store = getPlansStore();
    const key = typeof normalizePlanUsername === 'function' ? normalizePlanUsername(user) : user;
    store[key] = {
      id: planId,
      period: def.period,
      expiresAt: Date.now() + (PLAN_DURATIONS_MS[planId] || PLAN_DURATIONS_MS.diaria),
    };
    savePlansStore(store);
  }
  if (typeof recordSale === 'function') {
    recordSale({
      category: 'plan',
      productId: planId,
      label: def.period,
      amount: def.price,
      buyer: user,
    });
  }
  refreshClientPlanState();
  return true;
}

function updatePlanBanner() {
  const banner = document.getElementById('modules-plan-banner');
  const activeBanner = document.getElementById('modules-plan-active');
  const user = typeof getSession === 'function' ? getSession() : null;
  const plan = typeof getActivePlanForUser === 'function' ? getActivePlanForUser(user) : null;
  const resellerClient = isResellerClientAccount();

  if (activeBanner) {
    if (plan && plan.id !== 'admin') {
      const exp = new Date(plan.expiresAt);
      const resellerNote = resellerClient && plan.id === 'reseller'
        ? '<p class="modules-plan-reseller-note">Acesso fornecido pelo seu revendedor</p>'
        : '';
      activeBanner.hidden = false;
      activeBanner.style.display = '';
      activeBanner.innerHTML =
        '<div class="modules-plan-active-inner">' +
          '<span class="modules-plan-active-icon">✓</span>' +
          '<div><strong>Plano ativo: ' + (plan.period || plan.id) + '</strong>' +
          '<p>Válido até ' + exp.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '</p>' +
          resellerNote +
        '</div>';
    } else {
      activeBanner.hidden = true;
      activeBanner.style.display = 'none';
      activeBanner.innerHTML = '';
    }
  }

  if (!banner) return;

  if (plan) {
    banner.hidden = true;
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  if (resellerClient) {
    banner.hidden = false;
    banner.style.display = '';
    banner.innerHTML =
      '<div class="modules-plan-banner-inner modules-plan-banner-reseller">' +
        '<div class="modules-plan-banner-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' +
        '</div>' +
        '<div class="modules-plan-banner-text">' +
          '<strong>Acesso expirado ou inativo</strong>' +
          '<p>Esta conta é gerenciada por um revendedor. Solicite renovação a quem criou seu login — a Loja de Planos não está disponível para você.</p>' +
        '</div>' +
      '</div>';
    return;
  }

  banner.hidden = false;
  banner.style.display = '';
  banner.innerHTML =
    '<div class="modules-plan-banner-inner">' +
      '<div class="modules-plan-banner-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' +
      '</div>' +
      '<div class="modules-plan-banner-text">' +
        '<strong>Nenhum plano ativo</strong>' +
        '<p>Para usar os módulos de consulta, realize a compra de um plano na Loja de Planos.</p>' +
      '</div>' +
      '<button type="button" class="modules-plan-banner-btn" id="modules-plan-banner-cta">Comprar plano</button>' +
    '</div>';

  const cta = document.getElementById('modules-plan-banner-cta');
  if (cta) {
    cta.addEventListener('click', () => {
      renderPlansGrid();
      showAppView('loja');
    });
  }
}

const REVENDER_REF_PER_LOGIN = 6;

const REVENDER_PACKAGES = [
  { logins: 10, price: 60, tag: 'Para começar', badge: null, featured: false },
  { logins: 20, price: 119.9, tag: 'Melhor custo', badge: 'Mais vendido', featured: true },
  { logins: 30, price: 150, tag: 'Máximo volume', badge: 'Maior lucro', featured: false },
];

function formatMoneyBr(value) {
  return value.toFixed(2).replace('.', ',');
}

function formatResellerPriceHtml(price) {
  const parts = formatMoneyBr(price).split(',');
  return 'R$ ' + parts[0] + '<span>,' + parts[1] + '</span>';
}

function getResellerPerLogin(pkg) {
  return pkg.price / pkg.logins;
}

function getResellerSavings(pkg) {
  const ref = pkg.logins * REVENDER_REF_PER_LOGIN;
  return Math.max(0, Math.round((ref - pkg.price) * 100) / 100);
}

const MODULE_CATEGORIES = [
  {
    title: 'DOCUMENTOS & IDENTIFICAÇÃO',
    label: 'Documentos oficiais',
    desc: 'CPF, RG, título de eleitor e Receita Federal',
    sectionIcon: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/>',
    modules: [
      { key: 'cpf', title: 'CONSULTA CPF COMPLETA' },
      { key: 'rg', title: 'CONSULTA RG' },
      { key: 'tse', title: 'TÍTULO DE ELEITOR (TSE)', hc: true },
      { key: 'receita', title: 'CONSULTA RECEITA FEDERAL', hc: true },
    ],
  },
  {
    title: 'FOTOS & IMAGENS',
    label: 'Fotos cadastrais',
    desc: 'Imagens por CPF e bases regionais (SP, PE)',
    sectionIcon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    modules: [
      { key: 'foto-cpf', title: 'FOTO BASE CPF' },
      { key: 'foto-sp', title: 'FOTO (BASE SP)' },
      { key: 'foto-pe', title: 'FOTO (BASE PE)' },
    ],
  },
  {
    title: 'NOME & VÍNCULOS',
    label: 'Nome e família',
    desc: 'Busca por nome completo e parentes',
    sectionIcon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    modules: [
      { key: 'nome', title: 'CONSULTA POR NOME' },
      { key: 'irmaos', title: 'BUSCA PARENTES / IRMÃOS' },
    ],
  },
  {
    title: 'VÍNCULOS E RELAÇÕES',
    label: 'Contato e localização',
    desc: 'Telefone, e-mail vinculado ao CPF e CEP',
    sectionIcon: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.09 3h3a2 2 0 0 1 2 1.72c.64 2.12 1.86 3.9 3.5 5.11L9.09 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.21.64 2.59 1 4 .99A2 2 0 0 1 22 16.92z"/>',
    modules: [
      { key: 'tel', title: 'CONSULTA TELEFONE' },
      { key: 'email', title: 'BUSCA POR E-MAIL (CPF)', hc: true },
      { key: 'cep', title: 'CONSULTA CEP' },
    ],
  },
  {
    title: 'FINANCEIRO & TRABALHISTA',
    label: 'Financeiro e crédito',
    desc: 'Score, bureaus, SPC e consulta BIN',
    sectionIcon: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
    modules: [
      { key: 'score', title: 'CONSULTA SCORE' },
      { key: 'serasa', title: 'CONSULTA SERASA', hc: true },
      { key: 'spc', title: 'CONSULTA SPC' },
      { key: 'bin', title: 'CONSULTA BIN CARTÃO' },
    ],
  },
  {
    title: 'VEÍCULOS & DETRAN',
    label: 'Veículos',
    desc: 'Denatran, placa e número de chassi',
    sectionIcon: '<rect x="1" y="8" width="22" height="10" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    modules: [
      { key: 'denatran', title: 'CONSULTA DENATRAN', hc: true },
      { key: 'placa', title: 'CONSULTA PLACA' },
      { key: 'chassi', title: 'CONSULTA CHASSI' },
    ],
  },
  {
    title: 'JURÍDICO',
    label: 'Jurídico',
    desc: 'Processos e registros judiciais',
    sectionIcon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    modules: [
      { key: 'processo', title: 'CONSULTA PROCESSO' },
    ],
  },
  {
    title: 'ACESSO RESTRITO',
    label: 'Acesso restrito',
    desc: 'Módulos com permissão e horário especial',
    sectionIcon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    warn: true,
    modules: [
      { key: 'negativacao', title: 'NEGATIVAÇÃO', restricted: true, hc: true },
    ],
  },
];

const CATEGORY_ICON = '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>';

const APP_VIEWS = ['modules', 'search', 'revendedor', 'revendedor-painel', 'loja', 'admin-dashboard', 'admin-clientes', 'admin-revendedores'];

function showAppView(view) {
  if (view === 'loja' && isResellerClientAccount()) {
    view = 'modules';
  }
  if (view === 'revendedor' && typeof canAccessRevendedor === 'function' && !canAccessRevendedor()) {
    view = 'modules';
  }
  if (view === 'revendedor-painel') {
    const adminView = typeof isAdmin === 'function' && isAdmin() && window._resellerPanelUser;
    if (!adminView && typeof canAccessRevendedor === 'function' && !canAccessRevendedor()) {
      view = 'modules';
    }
  }

  APP_VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (!el) return;
    const on = v === view;
    el.classList.toggle('active', on);
    el.style.display = on ? 'block' : 'none';
  });
  if (view === 'revendedor') {
    renderResellerPackages();
  }
  if (view === 'revendedor-painel' && typeof renderResellerDashboard === 'function') {
    renderResellerDashboard();
  }
  if (view === 'modules') refreshClientPlanState();
  if (view === 'loja') renderPlansGrid();
  if (typeof setUserNavActive === 'function') setUserNavActive(view);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setUserNavActive(view) {
  const map = {
    modules: 'nav-modulos',
    revendedor: 'nav-revendedor',
    'revendedor-painel': 'nav-revendedor',
    loja: 'nav-loja',
  };
  const activeId = map[view];
  document.querySelectorAll('#sidebar-user-menu .sidebar-item').forEach(el => {
    el.classList.toggle('active', !!activeId && el.id === activeId);
  });
}

function buyResellerPackage(pkg) {
  const ok = confirm(
    'Comprar pacote ' + pkg.logins + ' logins por R$ ' + formatMoneyBr(pkg.price) + '?\n\n' +
    'R$ ' + formatMoneyBr(getResellerPerLogin(pkg)) + ' por login'
  );
  if (!ok) return;
  const user = typeof getSession === 'function' ? getSession() : '—';
  if (typeof recordSale === 'function') {
    recordSale({
      category: 'reseller',
      productId: String(pkg.logins),
      label: pkg.logins + ' logins',
      amount: pkg.price,
      buyer: user,
    });
  }
  if (typeof addResellerCredits === 'function') addResellerCredits(user, pkg.logins);
  alert('Venda registrada! ' + pkg.logins + ' crédito(s) de login adicionados.');
  if (typeof renderResellerDashboard === 'function') renderResellerDashboard();
  if (typeof isAdmin === 'function' && isAdmin()) {
    if (typeof renderAdminView === 'function') renderAdminView('admin-dashboard');
    showAppView('admin-dashboard');
  }
}

function renderResellerPackages() {
  const grid = document.getElementById('reseller-packages-grid');
  if (!grid) return;
  grid.innerHTML = '';

  REVENDER_PACKAGES.forEach(pkg => {
    const card = document.createElement('article');
    card.className = 'reseller-package-card' + (pkg.featured ? ' reseller-package-card-featured' : '');
    card.setAttribute('role', 'listitem');
    card.tabIndex = 0;

    const savings = getResellerSavings(pkg);
    let savingsHtml;
    if (savings >= 1) {
      savingsHtml = '<span class="reseller-save">Economize R$ ' + formatMoneyBr(savings) + '</span>';
    } else if (pkg.logins === 10) {
      savingsHtml = '<span class="reseller-save">Preço de entrada</span>';
    } else {
      savingsHtml = '<span class="reseller-save">Custo reduzido por login</span>';
    }

    const badgeHtml = pkg.badge
      ? '<span class="reseller-package-badge">' + pkg.badge + '</span>'
      : '';

    card.innerHTML =
      badgeHtml +
      '<span class="reseller-package-tag">' + pkg.tag + '</span>' +
      '<div class="reseller-package-logins">' + pkg.logins + ' <span>logins</span></div>' +
      '<div class="reseller-package-price">' + formatResellerPriceHtml(pkg.price) + '</div>' +
      '<div class="reseller-package-per">R$ ' + formatMoneyBr(getResellerPerLogin(pkg)) + ' / login</div>' +
      savingsHtml +
      '<ul class="reseller-package-perks">' +
        '<li>' + pkg.logins + ' acessos para revender</li>' +
        '<li>Margem na revenda</li>' +
      '</ul>' +
      '<button type="button" class="service-cta service-cta-orange reseller-cta">Comprar agora</button>';

    const buy = () => buyResellerPackage(pkg);
    card.querySelector('.reseller-cta').addEventListener('click', e => { e.stopPropagation(); buy(); });
    card.addEventListener('click', buy);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buy(); } });

    grid.appendChild(card);
  });
}

function renderResellerDashboard() {
  const root = document.getElementById('reseller-dashboard-root');
  if (!root) return;

  const reseller = typeof getResellerPanelUser === 'function'
    ? getResellerPanelUser()
    : (typeof getSession === 'function' ? getSession() : '');
  const stats = typeof getResellerStats === 'function'
    ? getResellerStats(reseller)
    : { creditsRemaining: 0, creditsUsed: 0, loginsCreated: 0, clientsManaged: 0, clientsActive: 0 };
  const logins = typeof getResellerLoginsFor === 'function'
    ? getResellerLoginsFor(reseller)
    : [];
  const isAdminView = typeof isAdmin === 'function' && isAdmin() && window._resellerPanelUser;
  const readOnly = isAdminView;

  let adminBanner = '';
  if (isAdminView) {
    adminBanner =
      '<div class="reseller-dash-admin-banner">Visualizando painel de <strong>' + reseller + '</strong></div>';
  }

  root.innerHTML =
    '<div class="reseller-dash">' +
      '<div class="reseller-dash-head">' +
        '<button type="button" class="view-search-back" id="reseller-dash-back">← Voltar</button>' +
        '<div>' +
          '<h2>Painel do Revendedor</h2>' +
          '<p>Créditos, logins criados e clientes ativos.</p>' +
        '</div>' +
      '</div>' +
      adminBanner +
      '<div class="reseller-dash-stats">' +
        '<div class="reseller-stat-card">' +
          '<span class="reseller-stat-label">Créditos disponíveis</span>' +
          '<strong class="reseller-stat-value">' + stats.creditsRemaining + '</strong>' +
        '</div>' +
        '<div class="reseller-stat-card">' +
          '<span class="reseller-stat-label">Créditos usados</span>' +
          '<strong class="reseller-stat-value">' + stats.creditsUsed + '</strong>' +
        '</div>' +
        '<div class="reseller-stat-card">' +
          '<span class="reseller-stat-label">Clientes gerenciados</span>' +
          '<strong class="reseller-stat-value">' + stats.clientsManaged + '</strong>' +
        '</div>' +
        '<div class="reseller-stat-card reseller-stat-card-action">' +
          '<span class="reseller-stat-label">Recarga</span>' +
          '<button type="button" class="reseller-stat-link" id="reseller-dash-buy">Comprar créditos</button>' +
        '</div>' +
      '</div>' +
      '<div class="reseller-dash-layout">' +
        '<aside class="reseller-dash-aside">' +
          '<h3>Gerar novo acesso</h3>' +
          (readOnly
            ? '<p class="reseller-dash-readonly">Somente o revendedor pode criar logins aqui.</p>'
            : '<form class="reseller-dash-form" id="reseller-create-form">' +
                '<div class="field-group"><label class="field-label">Login do cliente</label>' +
                  '<input class="field-input" id="reseller-new-user" placeholder="Ex: joaocliente123" autocomplete="off"/></div>' +
                '<div class="field-group"><label class="field-label">Senha de acesso</label>' +
                  '<input class="field-input" id="reseller-new-pass" type="text" placeholder="Em branco = aleatória" autocomplete="off"/></div>' +
                '<div class="field-group"><label class="field-label">Duração</label>' +
                  '<select class="field-input" id="reseller-new-days">' +
                    '<option value="1">1 dia</option>' +
                    '<option value="7">7 dias</option>' +
                    '<option value="30" selected>30 dias</option>' +
                  '</select></div>' +
                '<button type="submit" class="reseller-dash-submit">⚡ Gerar conta</button>' +
                '<p class="reseller-form-msg" id="reseller-form-msg"></p>' +
              '</form>') +
        '</aside>' +
        '<section class="reseller-dash-main">' +
          '<h3>Seus clientes ativos <span class="reseller-dash-count">' + stats.clientsManaged + '</span></h3>' +
          '<div id="reseller-dash-clients-table"></div>' +
        '</section>' +
      '</div>' +
    '</div>';

  const tableWrap = document.getElementById('reseller-dash-clients-table');
  if (!logins.length) {
    tableWrap.innerHTML = '<p class="reseller-empty-logins">Nenhum cliente criado ainda.</p>';
  } else {
    let rows = '';
    logins.forEach(item => {
      const left = typeof getDaysRemaining === 'function' ? getDaysRemaining(item.expiresAt) : 0;
      const active = left > 0;
      rows +=
        '<tr>' +
          '<td><span class="reseller-client-name">' + item.username + '</span></td>' +
          '<td><span class="reseller-days-left">' + left + ' dia' + (left === 1 ? '' : 's') + '</span></td>' +
          '<td><span class="reseller-client-status' + (active ? ' on' : '') + '">' + (active ? 'Ativo' : 'Expirado') + '</span></td>' +
          '<td class="reseller-client-actions">' +
            '<button type="button" class="reseller-icon-btn" data-action="info" data-id="' + item.id + '" title="Ver login e senha">👁</button>' +
            (readOnly ? '' :
              '<button type="button" class="reseller-icon-btn" data-action="block" data-id="' + item.id + '" title="Desativar">⊘</button>' +
              '<button type="button" class="reseller-icon-btn danger" data-action="delete" data-id="' + item.id + '" title="Excluir">🗑</button>') +
          '</td>' +
        '</tr>';
    });
    tableWrap.innerHTML =
      '<div class="reseller-table-wrap">' +
        '<table class="reseller-table reseller-dash-table">' +
          '<thead><tr><th>Usuário</th><th>Dias restantes</th><th>Status</th><th>Ações</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table></div>';
  }

  const backBtn = document.getElementById('reseller-dash-back');
  if (backBtn) backBtn.addEventListener('click', closeResellerPanelView);

  const buyBtn = document.getElementById('reseller-dash-buy');
  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
      if (isAdminView) {
        alert('O revendedor deve comprar créditos na Área do Revendedor.');
        return;
      }
      showAppView('revendedor');
    });
  }

  if (!readOnly) {
    const form = document.getElementById('reseller-create-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const msgEl = document.getElementById('reseller-form-msg');
        const days = document.getElementById('reseller-new-days').value;
        const result = createResellerLogin(reseller, {
          username: document.getElementById('reseller-new-user').value,
          password: document.getElementById('reseller-new-pass').value,
          days: days,
        });
        if (msgEl) {
          msgEl.textContent = result.msg;
          msgEl.className = 'reseller-form-msg ' + (result.ok ? 'ok' : 'err');
        }
        if (result.ok) {
          if (typeof showResellerLoginCreatedModal === 'function') {
            showResellerLoginCreatedModal({
              username: result.username,
              password: result.password,
              days: result.days,
            });
          }
          document.getElementById('reseller-new-user').value = '';
          document.getElementById('reseller-new-pass').value = '';
          renderResellerDashboard();
        }
      });
    }
  }

  if (tableWrap) {
    tableWrap.querySelectorAll('.reseller-icon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        if (!id) return;
        const item = logins.find(l => l.id === id);
        if (action === 'info' && item) {
          alert('Usuário: ' + item.username + '\nSenha: ' + item.password + '\nPlano: ' + item.days + ' dias');
          return;
        }
        if (readOnly) return;
        if (action === 'block') {
          if (!confirm('Desativar este cliente agora?')) return;
          deactivateResellerClient(reseller, id);
        } else if (action === 'delete') {
          if (!confirm('Excluir este cliente permanentemente?')) return;
          deleteResellerClient(reseller, id);
        }
        renderResellerDashboard();
      });
    });
  }
}

function accessModule(key) {
  if (typeof isAdmin === 'function' && isAdmin()) return;
  if (!hasActivePlan()) {
    updatePlanBanner();
    if (isResellerClientAccount()) {
      alert(
        'Seu acesso não está ativo.\n\nEsta conta foi criada por um revendedor. ' +
        'Entre em contato com quem forneceu seu login para renovar os dias de puxada.'
      );
      return;
    }
    const goShop = confirm(
      'Você ainda não possui um plano ativo.\n\nDeseja ir para a Loja de Planos e realizar a compra?'
    );
    if (goShop) {
      renderPlansGrid();
      showAppView('loja');
    }
    return;
  }
  if (typeof openModal === 'function') openModal(key);
}

function getModuleIcon(key) {
  const cfg = typeof MODAL_CONFIG !== 'undefined' ? MODAL_CONFIG[key] : null;
  return cfg && cfg.icon ? cfg.icon : '<circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/>';
}

function openConsultModule(key, fromSidebar) {
  if (fromSidebar) {
    if (typeof closeSidebar === 'function') closeSidebar();
    if (typeof isAdmin === 'function' && isAdmin()) {
      if (typeof openModal === 'function') openModal(key);
      return;
    }
  }
  accessModule(key);
}

function renderTopicSections(root, opts) {
  if (!root) return;
  const fromSidebar = !!(opts && opts.sidebar);
  const showPlanHint = !!(opts && opts.showPlanHint);
  const planActive = hasActivePlan();
  root.innerHTML = '';

  MODULE_CATEGORIES.forEach(cat => {
    const section = document.createElement('section');
    section.className = 'topic-section' + (cat.warn ? ' topic-section-warn' : '');

    const head = document.createElement('div');
    head.className = 'topic-section-head';

    const headIcon = document.createElement('span');
    headIcon.className = 'topic-section-icon';
    headIcon.setAttribute('aria-hidden', 'true');
    headIcon.innerHTML = '<svg viewBox="0 0 24 24">' + (cat.sectionIcon || CATEGORY_ICON) + '</svg>';

    const headText = document.createElement('div');
    headText.className = 'topic-section-text';

    const headLabel = document.createElement('span');
    headLabel.className = 'topic-section-label';
    headLabel.textContent = cat.label || cat.title;

    headText.appendChild(headLabel);

    if (cat.desc) {
      const headDesc = document.createElement('span');
      headDesc.className = 'topic-section-desc';
      headDesc.textContent = cat.desc;
      headText.appendChild(headDesc);
    }

    head.appendChild(headIcon);
    head.appendChild(headText);
    section.appendChild(head);

    const list = document.createElement('div');
    list.className = 'topic-list';
    list.setAttribute('role', 'list');

    cat.modules.forEach(mod => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'topic-item' + (cat.warn || mod.restricted ? ' topic-item-warn' : '');
      item.setAttribute('role', 'listitem');

      const icon = document.createElement('span');
      icon.className = 'topic-item-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 24 24">' + getModuleIcon(mod.key) + '</svg>';

      const label = document.createElement('span');
      label.className = 'topic-item-label';
      label.textContent = mod.title;

      item.appendChild(icon);
      item.appendChild(label);

      if (mod.hc) {
        const tag = document.createElement('span');
        tag.className = 'topic-item-tag';
        tag.textContent = 'H.C.';
        item.appendChild(tag);
      }

      if (showPlanHint && !planActive && !(typeof isAdmin === 'function' && isAdmin())) {
        const lock = document.createElement('span');
        lock.className = 'topic-item-tag topic-item-tag-lock';
        lock.textContent = 'Plano';
        item.appendChild(lock);
      }

      item.addEventListener('click', () => openConsultModule(mod.key, fromSidebar));
      list.appendChild(item);
    });

    section.appendChild(list);
    root.appendChild(section);
  });
}

function renderSidebarConsultas() {
  const root = document.getElementById('sidebar-consultas-list');
  if (!root) return;
  renderTopicSections(root, { sidebar: true });
}

function getUnlimitedBadgeHtml() {
  return (
    '<span class="sidebar-user-badge">' +
      '<span class="sidebar-user-badge-text">Puxadas ilimitadas</span>' +
    '</span>'
  );
}

function getSidebarCloverAvatarHtml() {
  if (typeof window.BDS_CLOVER_SVG === 'string') return window.BDS_CLOVER_SVG;
  return (
    '<svg viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<g fill="currentColor" transform="translate(26 26)">' +
        '<circle cx="0" cy="-8" r="7"/><circle cx="8" cy="0" r="7"/>' +
        '<circle cx="0" cy="8" r="7"/><circle cx="-8" cy="0" r="7"/>' +
      '</g></svg>'
  );
}

function formatDisplayName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function getUserChipCloverHtml() {
  if (typeof window.BDS_CLOVER_SVG === 'string') return window.BDS_CLOVER_SVG;
  return getSidebarCloverAvatarHtml();
}

function updateTopbarUsername(user) {
  const chip = document.getElementById('topbar-username');
  if (!chip) return;
  const nameEl = chip.querySelector('.user-chip-name');
  const avatarEl = chip.querySelector('.user-chip-avatar');
  const display = user ? formatDisplayName(user) : '';
  if (nameEl) nameEl.textContent = display;
  else chip.textContent = display;
  if (avatarEl) {
    avatarEl.innerHTML = getUserChipCloverHtml();
    avatarEl.classList.add('user-chip-avatar--clover');
  }
  chip.title = display || user || '';
  chip.classList.remove('user-chip--reveal');
  void chip.offsetWidth;
  chip.classList.add('user-chip--reveal');
}

function updateSidebarUserFooter() {
  const user = typeof getSession === 'function' ? getSession() : null;
  const nameEl = document.getElementById('sidebar-user-name');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const accessEl = document.getElementById('sidebar-user-access');
  if (!nameEl) return;

  applyResellerClientNavigation();

  if (avatarEl) avatarEl.innerHTML = getSidebarCloverAvatarHtml();

  if (!user) {
    nameEl.textContent = 'Convidado';
    if (accessEl) {
      accessEl.classList.remove('sidebar-user-access-unlimited');
      accessEl.innerHTML = '<span class="sidebar-user-badge sidebar-user-badge-muted">Faça login</span>';
    }
    return;
  }

  nameEl.textContent = formatDisplayName(user);

  const unlimited = (typeof isAdmin === 'function' && isAdmin()) || hasActivePlan();
  if (!accessEl) return;

  if (unlimited) {
    accessEl.classList.add('sidebar-user-access-unlimited');
    accessEl.innerHTML = getUnlimitedBadgeHtml();
  } else if (isResellerClientAccount()) {
    accessEl.classList.remove('sidebar-user-access-unlimited');
    accessEl.innerHTML = '<span class="sidebar-user-badge sidebar-user-badge-muted">Fale com revendedor</span>';
  } else {
    accessEl.classList.remove('sidebar-user-access-unlimited');
    accessEl.innerHTML = '<span class="sidebar-user-badge sidebar-user-badge-muted">Sem plano ativo</span>';
  }
}

function updateStoreActivePlan() {
  const el = document.getElementById('store-active-plan');
  if (!el) return;
  const user = typeof getSession === 'function' ? getSession() : null;
  const plan = getActivePlanForUser(user);
  if (!plan || plan.id === 'admin') {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const exp = new Date(plan.expiresAt);
  el.hidden = false;
  el.innerHTML =
    '<span class="store-active-plan-label">Plano ativo</span>' +
    '<strong>' + plan.period + '</strong>' +
    '<span class="store-active-plan-exp">válido até ' + exp.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '</span>';
}

function buyPlan(plan) {
  const ok = confirm(
    'Comprar plano ' + plan.period + ' por R$ ' + formatMoneyBr(plan.price) + '?\n\n' +
    'Duração: ' + plan.durationLabel + '\n\n' +
    '(Demonstração: o plano será ativado após confirmar.)'
  );
  if (!ok) return;
  if (activatePlan(plan.id)) {
    updateStoreActivePlan();
    alert('Plano ' + plan.period + ' ativado com sucesso! Acesse os módulos agora.');
    showAppView('modules');
  } else {
    alert('Não foi possível ativar o plano. Faça login novamente.');
  }
}

function renderPlansGrid() {
  const grid = document.getElementById('plans-grid');
  if (!grid) return;
  updateStoreActivePlan();
  grid.innerHTML = '';

  PLANS.forEach(plan => {
    const card = document.createElement('article');
    card.className = 'store-plan-card' + (plan.featured ? ' store-plan-card-featured' : '');
    card.setAttribute('role', 'listitem');
    card.tabIndex = 0;

    const badgeHtml = plan.badge
      ? '<span class="store-plan-badge">' + plan.badge + '</span>'
      : '';

    card.innerHTML =
      badgeHtml +
      '<span class="store-plan-tag">' + plan.tag + '</span>' +
      '<div class="store-plan-period">' + plan.period + ' <span>' + plan.durationLabel + '</span></div>' +
      '<div class="store-plan-price">' + formatResellerPriceHtml(plan.price) + '</div>' +
      '<div class="store-plan-per">~ R$ ' + formatMoneyBr(plan.perDay) + ' / dia</div>' +
      '<span class="store-save">' + plan.saveHint + '</span>' +
      '<ul class="store-plan-perks">' +
        plan.perks.map(p => '<li>' + p + '</li>').join('') +
      '</ul>' +
      '<button type="button" class="service-cta service-cta-green store-cta">Comprar agora</button>';

    const buy = () => buyPlan(plan);
    card.querySelector('.store-cta').addEventListener('click', e => { e.stopPropagation(); buy(); });
    card.addEventListener('click', buy);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buy(); } });

    grid.appendChild(card);
  });
}

function renderModulesHub() {
  refreshClientPlanState();

  const root = document.getElementById('modules-categories');
  if (!root) return;
  root.innerHTML = '';

  const planActive = hasActivePlan();

  MODULE_CATEGORIES.forEach(cat => {
    const section = document.createElement('section');
    section.className = 'mod-category' + (cat.warn ? ' mod-category-warn' : '');

    const head = document.createElement('div');
    head.className = 'mod-category-head';
    head.innerHTML = '<svg viewBox="0 0 24 24">' + CATEGORY_ICON + '</svg><span>' + cat.title + '</span>';
    section.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'mod-grid';

    cat.modules.forEach(mod => {
      const card = document.createElement('article');
      card.className = 'mod-card' + (cat.warn || mod.restricted ? ' mod-warn' : '');
      card.setAttribute('role', 'button');
      card.tabIndex = 0;

      let badge = planActive ? 'Módulo Ativo' : 'Plano necessário';
      let badgeClass = 'mod-badge' + (planActive ? '' : ' mod-badge-locked');
      if (planActive && mod.hc) { badge = 'Horário Comercial'; badgeClass += ' hc'; }
      if (mod.restricted) { badge = 'Acesso Restrito'; badgeClass += ' restricted'; }

      card.innerHTML =
        '<span class="' + badgeClass + '">' + badge + '</span>' +
        '<div class="mod-card-icon"><svg viewBox="0 0 24 24">' + getModuleIcon(mod.key) + '</svg></div>' +
        '<h3 class="mod-card-title">' + mod.title + '</h3>' +
        '<button type="button" class="mod-card-btn">ACESSAR MÓDULO</button>';

      const open = () => accessModule(mod.key);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      card.querySelector('.mod-card-btn').addEventListener('click', e => e.stopPropagation());
      card.querySelector('.mod-card-btn').addEventListener('click', open);

      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        card.classList.add('mod-hover');
      });
      card.addEventListener('mouseleave', () => card.classList.remove('mod-hover'));

      grid.appendChild(card);
    });

    section.appendChild(grid);
    root.appendChild(section);
  });
}

window.addEventListener('bds-plans-changed', function () {
  if (typeof getSession !== 'function' || !getSession()) return;
  refreshClientPlanState();
  const root = document.getElementById('modules-categories');
  if (root && root.children.length) renderModulesHub();
  if (typeof renderSidebarConsultas === 'function') renderSidebarConsultas();
  updateSidebarUserFooter();
});

window.addEventListener('storage', function (e) {
  if (e.key !== PLAN_STORE_KEY) return;
  if (typeof getSession !== 'function' || !getSession()) return;
  refreshClientPlanState();
  const root = document.getElementById('modules-categories');
  if (root && root.children.length) renderModulesHub();
  if (typeof renderSidebarConsultas === 'function') renderSidebarConsultas();
  updateSidebarUserFooter();
});

function bootAppAfterScripts() {
  if (typeof getSession !== 'function' || !getSession()) return;
  const app = document.getElementById('app');
  const auth = document.getElementById('auth-screen');
  if (!app || !auth) return;

  if (app.style.display !== 'block') {
    enterApp(getSession());
    return;
  }

  refreshClientPlanState();
  renderModulesHub();
  renderSidebarConsultas();
  updateSidebarUserFooter();
  renderResellerPackages();
  renderPlansGrid();
  if (typeof updateAppNavigation === 'function') updateAppNavigation();
}

window.bootAppAfterScripts = bootAppAfterScripts;
window.renderSidebarConsultas = renderSidebarConsultas;
window.renderModulesHub = renderModulesHub;
window.updateTopbarUsername = updateTopbarUsername;
window.updateSidebarUserFooter = updateSidebarUserFooter;
window.refreshClientPlanState = refreshClientPlanState;
window.renderResellerDashboard = renderResellerDashboard;
window.showAppView = showAppView;
window.setUserNavActive = setUserNavActive;
if (typeof openResellerPanel !== 'function') {
  window.openResellerPanel = function () {
    window._resellerPanelUser = null;
    showAppView('revendedor-painel');
  };
}
