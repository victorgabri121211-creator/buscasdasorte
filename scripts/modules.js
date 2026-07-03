// HUB DE MÓDULOS — tela inicial após login

let _countdownTimer = null;

function formatCountdown(expiresAt) {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expirado';
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return 'Expira em ' + days + 'd ' + hours + 'h ' + mins + 'min';
  if (hours > 0) return 'Expira em ' + hours + 'h ' + mins + 'min';
  return 'Expira em ' + mins + 'min';
}

function startCountdown(expiresAt) {
  stopCountdown();
  _countdownTimer = setInterval(function () {
    const el = document.getElementById('plan-countdown-text');
    if (!el) { stopCountdown(); return; }
    el.textContent = formatCountdown(expiresAt);
  }, 60000);
}

function stopCountdown() {
  if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
}

const PLANS = [
  {
    id: 'vitalicio',
    period: 'Vitalício',
    durationLabel: 'Acesso permanente',
    price: 150,
    perDay: 0,
    lifetime: true,
    tag: 'Pague uma vez',
    badge: 'Vitalício',
    featured: false,
    saveHint: 'Pagamento único • sem renovação',
    perks: ['Consultas ilimitadas para sempre', 'Sem mensalidade nem expiração'],
  },
  {
    id: 'mes',
    period: '1 Mês',
    durationLabel: '30 dias',
    price: 25.5,
    perDay: 0.85,
    tag: 'Melhor valor',
    badge: 'Melhor custo',
    featured: false,
    saveHint: 'Economize R$ 229,20',
    perks: ['Consultas ilimitadas no período', 'Menor custo por dia'],
  },
  {
    id: 'semana',
    period: '1 Semana',
    durationLabel: '7 dias',
    price: 20.5,
    perDay: 2.93,
    tag: 'Uso frequente',
    badge: 'Mais vendido',
    featured: true,
    saveHint: 'Economize R$ 38,93',
    perks: ['Consultas ilimitadas no período', 'Melhor que 7 diárias'],
  },
  {
    id: 'diaria',
    period: 'Diária',
    durationLabel: '24 horas',
    price: 8.49,
    perDay: 8.49,
    tag: 'Para começar',
    badge: null,
    featured: false,
    saveHint: 'Ideal para testar',
    perks: ['Todos os módulos de consulta', 'Válido por 24 horas'],
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
  : { diaria: 86400000, semana: 604800000, mes: 2592000000, vitalicio: 3153600000000 };

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
      const isLifetime = plan.id === 'vitalicio';
      const exp = new Date(plan.expiresAt);
      const msLeft = plan.expiresAt - Date.now();
      const hLeft  = Math.ceil(msLeft / 3600000);
      const resellerNote = resellerClient && plan.id === 'reseller'
        ? '<p class="modules-plan-reseller-note">Acesso fornecido pelo seu revendedor</p>'
        : '';

      let expiryBadge = '';
      if (!isLifetime && msLeft < 2 * 3600000) {
        expiryBadge = '<span class="plan-expiry-badge plan-expiry-badge--urgent">Expira em ' + hLeft + 'h</span>';
      } else if (!isLifetime && msLeft < 48 * 3600000) {
        expiryBadge = '<span class="plan-expiry-badge plan-expiry-badge--warn">Expira em ' + hLeft + 'h</span>';
      }

      const subLine = isLifetime
        ? '<div class="plan-active-sub">Acesso vitalício • sem expiração</div>'
        : '<div class="plan-active-sub">Válido até ' + exp.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '</div>';
      const countdownBlock = isLifetime
        ? '<div class="plan-countdown" id="plan-countdown-display"><span class="plan-countdown-dot"></span><span id="plan-countdown-text">Acesso permanente</span></div>'
        : '<div class="plan-countdown" id="plan-countdown-display"><span class="plan-countdown-dot"></span><span id="plan-countdown-text">' + formatCountdown(plan.expiresAt) + '</span></div>';

      activeBanner.hidden = false;
      activeBanner.style.display = '';
      activeBanner.className = 'modules-plan-active';
      activeBanner.innerHTML =
        '<div class="plan-active-icon">' +
          '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
        '</div>' +
        '<div class="plan-active-info">' +
          '<div class="plan-active-title">Plano ativo: ' + (plan.period || plan.id) + expiryBadge + '</div>' +
          subLine +
          resellerNote +
          countdownBlock +
        '</div>';
      if (isLifetime) stopCountdown(); else startCountdown(plan.expiresAt);
    } else {
      activeBanner.hidden = true;
      activeBanner.style.display = 'none';
      activeBanner.innerHTML = '';
      stopCountdown();
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
  { logins: null, unlimited: true, price: 300, tag: 'Crédito infinito', badge: 'Ilimitado', featured: true },
  { logins: 30, price: 139.9, tag: 'Máximo volume',   badge: 'Maior lucro',  featured: false },
  { logins: 20, price: 99.9,  tag: 'Melhor custo',    badge: 'Mais vendido', featured: true  },
  { logins: 10, price: 49.9,  tag: 'Para começar',    badge: null,          featured: false },
  { logins: 1,  price: 5.5,   tag: 'Crédito avulso', badge: null,          featured: false },
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
    desc: 'CPF, RG, CNPJ, NIS/PIS, título de eleitor e Receita Federal',
    sectionIcon: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/>',
    modules: [
      { key: 'cpf', title: 'CONSULTA CPF COMPLETA' },
      { key: 'rg', title: 'CONSULTA RG' },
      { key: 'cnpj', title: 'CONSULTA CNPJ', maintenance: true },
      { key: 'nis', title: 'CONSULTA NIS/PIS', maintenance: true },
      { key: 'tse', title: 'TÍTULO DE ELEITOR (TSE)', hc: true },
      { key: 'receita', title: 'CONSULTA RECEITA FEDERAL', hc: true },
    ],
  },
  {
    title: 'FOTOS & IMAGENS',
    label: 'Fotos cadastrais',
    desc: 'Imagens por CPF — bases regionais de todos os estados',
    sectionIcon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    modules: [
      { key: 'foto-cpf', title: 'FOTO BASE CPF' },
      { key: 'foto-sp', title: 'FOTO (BASE SP)' },
      { key: 'foto-pe', title: 'FOTO (BASE PE)' },
      { key: 'foto-ma', title: 'FOTO (BASE MA)', maintenance: true },
      { key: 'foto-ro', title: 'FOTO (BASE RO)', maintenance: true },
      { key: 'foto-mg', title: 'FOTO (BASE MG)', maintenance: true },
      { key: 'foto-ba', title: 'FOTO (BASE BA)', maintenance: true },
      { key: 'foto-rj', title: 'FOTO (BASE RJ)', maintenance: true },
      { key: 'foto-pr', title: 'FOTO (BASE PR)', maintenance: true },
      { key: 'foto-sc', title: 'FOTO (BASE SC)', maintenance: true },
      { key: 'foto-rs', title: 'FOTO (BASE RS)', maintenance: true },
      { key: 'foto-go', title: 'FOTO (BASE GO)', maintenance: true },
      { key: 'foto-am', title: 'FOTO (BASE AM)', maintenance: true },
      { key: 'foto-ce', title: 'FOTO (BASE CE)', maintenance: true },
      { key: 'foto-mt', title: 'FOTO (BASE MT)', maintenance: true },
      { key: 'foto-al', title: 'FOTO (BASE AL)', maintenance: true },
      { key: 'foto-ac', title: 'FOTO (BASE AC)', maintenance: true },
      { key: 'foto-ap', title: 'FOTO (BASE AP)', maintenance: true },
      { key: 'foto-pa', title: 'FOTO (BASE PA)', maintenance: true },
      { key: 'foto-pi', title: 'FOTO (BASE PI)', maintenance: true },
      { key: 'foto-rn', title: 'FOTO (BASE RN)', maintenance: true },
      { key: 'foto-pb', title: 'FOTO (BASE PB)', maintenance: true },
      { key: 'foto-se', title: 'FOTO (BASE SE)', maintenance: true },
      { key: 'foto-to', title: 'FOTO (BASE TO)', maintenance: true },
      { key: 'foto-rr', title: 'FOTO (BASE RR)', maintenance: true },
      { key: 'foto-ms', title: 'FOTO (BASE MS)', maintenance: true },
      { key: 'foto-es', title: 'FOTO (BASE ES)', maintenance: true },
      { key: 'foto-df', title: 'FOTO (BASE DF)', maintenance: true },
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
    desc: 'Telefone, operadora, e-mail vinculado ao CPF e CEP',
    sectionIcon: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.09 3h3a2 2 0 0 1 2 1.72c.64 2.12 1.86 3.9 3.5 5.11L9.09 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.21.64 2.59 1 4 .99A2 2 0 0 1 22 16.92z"/>',
    modules: [
      { key: 'tel', title: 'CONSULTA TELEFONE' },
      { key: 'operadora', title: 'CONSULTA OPERADORA', maintenance: true },
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
  if (typeof openResellerPixPayment === 'function') {
    openResellerPixPayment(pkg);
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

    let savingsHtml;
    if (pkg.unlimited) {
      savingsHtml = '<span class="reseller-save">Logins sem limite</span>';
    } else {
      const savings = getResellerSavings(pkg);
      if (savings >= 1) {
        savingsHtml = '<span class="reseller-save">Economize R$ ' + formatMoneyBr(savings) + '</span>';
      } else if (pkg.logins === 10) {
        savingsHtml = '<span class="reseller-save">Preço de entrada</span>';
      } else {
        savingsHtml = '<span class="reseller-save">Custo reduzido por login</span>';
      }
    }

    const badgeHtml = pkg.badge
      ? '<span class="reseller-package-badge">' + pkg.badge + '</span>'
      : '';

    const loginsLine = pkg.unlimited
      ? '<div class="reseller-package-logins">∞ <span>logins</span></div>'
      : '<div class="reseller-package-logins">' + pkg.logins + ' <span>logins</span></div>';
    const perLine = pkg.unlimited
      ? '<div class="reseller-package-per">Pagamento único</div>'
      : '<div class="reseller-package-per">R$ ' + formatMoneyBr(getResellerPerLogin(pkg)) + ' / login</div>';
    const perksLine = pkg.unlimited
      ? '<li>Logins ilimitados para revender</li><li>Sem recarga de créditos</li>'
      : '<li>' + pkg.logins + ' acessos para revender</li><li>Margem na revenda</li>';

    card.innerHTML =
      badgeHtml +
      '<span class="reseller-package-tag">' + pkg.tag + '</span>' +
      loginsLine +
      '<div class="reseller-package-price">' + formatResellerPriceHtml(pkg.price) + '</div>' +
      perLine +
      savingsHtml +
      '<ul class="reseller-package-perks">' +
        perksLine +
      '</ul>' +
      '<button type="button" class="service-cta service-cta-orange reseller-cta">Comprar agora</button>';

    const buy = () => buyResellerPackage(pkg);
    card.querySelector('.reseller-cta').addEventListener('click', e => { e.stopPropagation(); buy(); });
    card.addEventListener('click', buy);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buy(); } });

    grid.appendChild(card);
  });
}

function _rdashMoney(v) {
  return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');
}

// Painel de ganhos + preços de revenda por duração + link de afiliado.
function _resellerEarningsHtml(reseller, readOnly) {
  const esc = typeof escAdmin === 'function' ? escAdmin : (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const e = typeof getResellerEarnings === 'function'
    ? getResellerEarnings(reseller)
    : { prices: { dia: 0, semana: 0, mes: 0 }, loginsTotal: 0, cost: 0, revenue: 0, profit: 0, margin: 0, revenue30: 0, logins30: 0, costCount: 0 };
  const p = e.prices || { dia: 0, semana: 0, mes: 0 };
  const link = typeof getResellerAffiliateLink === 'function' ? getResellerAffiliateLink(reseller) : '';
  const profitClass = e.profit >= 0 ? 'pos' : 'neg';
  const money2 = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');

  const priceField = (id, label, hint, val) =>
    '<div class="rdash-price-field">' +
      '<label class="rdash-price-label">' + label + '<span class="rdash-price-dur">' + hint + '</span></label>' +
      '<div class="rdash-price-row">' +
        '<span class="rdash-price-prefix">R$</span>' +
        '<input type="text" id="' + id + '" class="rdash-price-input" value="' + money2(val) + '" inputmode="decimal"/>' +
      '</div>' +
    '</div>';

  return '<div class="rdash-earn">' +
    '<div class="rdash-earn-head">' +
      '<h4 class="rdash-earn-title">Relatório de ganhos</h4>' +
      '<span class="rdash-earn-hint">Estimativa com base nos seus preços de revenda</span>' +
    '</div>' +
    '<div class="rdash-earn-grid">' +
      '<div class="rdash-earn-cell"><span class="rdash-earn-label">Receita estimada</span><span class="rdash-earn-val">' + _rdashMoney(e.revenue) + '</span><span class="rdash-earn-sub">' + e.loginsTotal + ' acesso' + (e.loginsTotal !== 1 ? 's' : '') + ' vendido' + (e.loginsTotal !== 1 ? 's' : '') + '</span></div>' +
      '<div class="rdash-earn-cell"><span class="rdash-earn-label">Custo (créditos)</span><span class="rdash-earn-val">' + _rdashMoney(e.cost) + '</span><span class="rdash-earn-sub">' + e.costCount + ' compra' + (e.costCount !== 1 ? 's' : '') + '</span></div>' +
      '<div class="rdash-earn-cell"><span class="rdash-earn-label">Lucro estimado</span><span class="rdash-earn-val rdash-earn-' + profitClass + '">' + _rdashMoney(e.profit) + '</span><span class="rdash-earn-sub">margem ' + e.margin + '%</span></div>' +
      '<div class="rdash-earn-cell"><span class="rdash-earn-label">Receita 30 dias</span><span class="rdash-earn-val">' + _rdashMoney(e.revenue30) + '</span><span class="rdash-earn-sub">' + e.logins30 + ' recente' + (e.logins30 !== 1 ? 's' : '') + '</span></div>' +
    '</div>' +
    (readOnly ? '' :
      '<div class="rdash-price-panel">' +
        '<div class="rdash-price-title">Seus preços de revenda</div>' +
        '<p class="rdash-price-explain">Quanto <strong>você cobra do seu cliente</strong> por cada acesso, conforme a duração. Serve só para <strong>estimar sua receita e seu lucro</strong> acima — não cobra nada de ninguém automaticamente.</p>' +
        '<div class="rdash-price-grid">' +
          priceField('rdash-price-dia', 'Diária', '1 dia', p.dia) +
          priceField('rdash-price-semana', 'Semanal', 'até 7 dias', p.semana) +
          priceField('rdash-price-mes', 'Mensal', '15 a 30 dias', p.mes) +
        '</div>' +
        '<button type="button" id="rdash-price-save" class="rdash-price-save rdash-price-save-full">Salvar preços</button>' +
      '</div>' +
      '<div class="rdash-aff-box">' +
        '<label class="rdash-price-label">Seu link de afiliado</label>' +
        '<p class="rdash-price-explain">Divulgue este link. Quem entrar por ele e comprar um plano gera comissão para você.</p>' +
        '<div class="rdash-price-row">' +
          '<input type="text" id="rdash-aff-link" class="rdash-price-input rdash-aff-input" value="' + esc(link) + '" readonly/>' +
          '<button type="button" id="rdash-aff-copy" class="rdash-price-save" data-link="' + esc(link) + '">Copiar</button>' +
        '</div>' +
      '</div>') +
  '</div>';
}

function renderResellerDashboard() {
  const root = document.getElementById('reseller-dashboard-root');
  if (!root) return;

  const esc = typeof escAdmin === 'function' ? escAdmin : (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const reseller = typeof getResellerPanelUser === 'function'
    ? getResellerPanelUser()
    : (typeof getSession === 'function' ? getSession() : '');
  const stats = typeof getResellerStats === 'function'
    ? getResellerStats(reseller)
    : { creditsRemaining: 0, creditsUsed: 0, clientsManaged: 0, clientsActive: 0, created24h: 0, created7d: 0 };
  const logins = typeof getResellerLoginsFor === 'function' ? getResellerLoginsFor(reseller) : [];
  const isAdminView = typeof isAdmin === 'function' && isAdmin() && window._resellerPanelUser;
  const readOnly = isAdminView;
  const creditsUnlimited = typeof isUnlimitedResellerCredits === 'function' && isUnlimitedResellerCredits(reseller);
  const credLow = !creditsUnlimited && stats.creditsRemaining <= 3;
  const creditsDisplay = creditsUnlimited
    ? '∞'
    : (typeof formatResellerCredits === 'function' ? formatResellerCredits(stats.creditsRemaining) : (stats.creditsRemaining || 0));

  // Build client rows
  let clientsBodyHtml = '';
  if (!logins.length) {
    clientsBodyHtml =
      '<div class="rdash-empty">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>' +
        '<p>Nenhum cliente ainda.<br>Use o formulário acima para criar o primeiro acesso.</p>' +
      '</div>';
  } else {
    let rows = '';
    logins.forEach(item => {
      const left = typeof getDaysRemaining === 'function' ? getDaysRemaining(item.expiresAt) : 0;
      const active = left > 0;
      const urgency = left <= 2 ? 'rdash-row--urgent' : left <= 7 ? 'rdash-row--warning' : '';
      const expiring = active && left <= 3;
      const barPct = Math.min(100, Math.round((left / (item.days || 30)) * 100));
      const barColor = left <= 2 ? '#f87171' : left <= 7 ? '#fbbf24' : '#4ade80';
      rows +=
        '<div class="rdash-client-row ' + (active ? '' : 'rdash-row--expired') + ' ' + urgency + '">' +
          '<div class="rdash-row-main">' +
            '<div class="rdash-row-identity">' +
              '<span class="rdash-row-name">' + esc(item.username) + '</span>' +
              (expiring ? '<span class="reseller-expiring-badge">Expira em breve</span>' : '') +
              '<span class="rdash-row-pass">' + esc(item.password) + '</span>' +
            '</div>' +
            '<div class="rdash-row-days">' +
              '<span class="rdash-row-days-val" style="color:' + barColor + '">' + left + 'd</span>' +
              '<div class="rdash-days-bar"><div class="rdash-days-fill" style="width:' + barPct + '%;background:' + barColor + '"></div></div>' +
            '</div>' +
            '<span class="rdash-row-status ' + (active ? 'on' : '') + '">' + (active ? 'Ativo' : 'Expirado') + '</span>' +
            '<div class="rdash-row-actions">' +
              '<button type="button" class="reseller-icon-btn" data-action="info" data-id="' + esc(item.id) + '" title="Ver credenciais">👁</button>' +
              (readOnly ? '' :
                '<button type="button" class="reseller-icon-btn" data-action="renew" data-id="' + esc(item.id) + '" title="Renovar">🔄</button>' +
                '<button type="button" class="rdash-act-btn rdash-act-block" data-action="block" data-id="' + esc(item.id) + '" title="Desativar">⊘</button>' +
                '<button type="button" class="rdash-act-btn rdash-act-del" data-action="delete" data-id="' + esc(item.id) + '" title="Excluir">🗑</button>') +
            '</div>' +
          '</div>' +
        '</div>';
    });
    clientsBodyHtml = '<div class="rdash-client-list">' + rows + '</div>';
  }

  const formHtml = readOnly
    ? '<div class="rdash-readonly-notice">Somente o revendedor pode criar acessos aqui.</div>'
    : '<div class="rdash-form-card">' +
        '<div class="rdash-form-header">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
          'Criar novo acesso' +
        '</div>' +
        '<form class="rdash-form-grid" id="reseller-create-form">' +
          '<div class="field-group"><label class="field-label">Login do cliente</label><input class="field-input" id="reseller-new-user" placeholder="Ex: joaocliente123" autocomplete="off"/></div>' +
          '<div class="field-group"><label class="field-label">Senha <span class="rdash-form-hint">(vazio = aleatória)</span></label><input class="field-input" id="reseller-new-pass" type="text" placeholder="Deixe vazio para gerar" autocomplete="off"/></div>' +
          '<div class="field-group"><label class="field-label">Duração</label><select class="field-input" id="reseller-new-days"><option value="1">1 dia</option><option value="7">7 dias</option><option value="15">15 dias</option><option value="30" selected>30 dias</option></select></div>' +
          '<div class="rdash-form-action"><button type="submit" class="rdash-submit-btn">⚡ Gerar acesso</button><p class="reseller-form-msg" id="reseller-form-msg"></p></div>' +
        '</form>' +
      '</div>';

  root.innerHTML =
    '<div class="rdash-wrap">' +

      (isAdminView
        ? '<div class="rdash-admin-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Visualizando painel de <strong>' + esc(reseller) + '</strong></div>'
        : '') +

      '<div class="sdash-header">' +
        '<div class="sdash-header-left">' +
          '<div class="sdash-header-icon sdash-icon-orange">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
          '</div>' +
          '<div>' +
            '<h3 class="sdash-title">Painel do Revendedor</h3>' +
            '<p class="sdash-sub">' + (isAdminView ? 'Visualizando como <strong style="color:#fb923c">' + esc(reseller) + '</strong>' : 'Olá, <strong style="color:#4ade80">' + esc(reseller) + '</strong>') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="rdash-header-right">' +
          (!readOnly
            ? '<button type="button" class="rdash-buy-btn-top" id="reseller-dash-buy">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
                'Comprar créditos' +
              '</button>'
            : '') +
          '<button type="button" class="view-search-back" id="reseller-dash-back">← Voltar</button>' +
        '</div>' +
      '</div>' +

      '<div class="rdash-kpis">' +
        '<div class="rdash-kpi rdash-kpi-credits' + (credLow ? ' rdash-kpi--low' : '') + '">' +
          '<div class="rdash-kpi-top">' +
            '<div class="rdash-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>' +
            '<span class="rdash-kpi-label">Créditos</span>' +
          '</div>' +
          '<div class="rdash-kpi-amount">' + creditsDisplay + '</div>' +
          '<div class="rdash-kpi-meta">' + (creditsUnlimited ? 'Crédito infinito' : (credLow ? '⚠ Saldo baixo' : (stats.creditsUsed || 0) + ' usados')) + '</div>' +
        '</div>' +
        '<div class="rdash-kpi rdash-kpi-clients">' +
          '<div class="rdash-kpi-top">' +
            '<div class="rdash-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>' +
            '<span class="rdash-kpi-label">Clientes ativos</span>' +
          '</div>' +
          '<div class="rdash-kpi-amount">' + (stats.clientsActive || 0) + '</div>' +
          '<div class="rdash-kpi-meta">' + (stats.clientsManaged || 0) + ' no total</div>' +
        '</div>' +
        '<div class="rdash-kpi rdash-kpi-activity">' +
          '<div class="rdash-kpi-top">' +
            '<div class="rdash-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>' +
            '<span class="rdash-kpi-label">Criados hoje</span>' +
          '</div>' +
          '<div class="rdash-kpi-amount">' + (stats.created24h || 0) + '</div>' +
          '<div class="rdash-kpi-meta">' + (stats.created7d || 0) + ' nos últimos 7 dias</div>' +
        '</div>' +
      '</div>' +

      _resellerEarningsHtml(reseller, readOnly) +

      formHtml +

      '<div class="sdash-recent">' +
        '<div class="sdash-recent-head">' +
          '<span class="sdash-recent-title">Clientes</span>' +
          (logins.length ? '<span class="sdash-recent-badge">' + logins.length + '</span>' : '') +
        '</div>' +
        clientsBodyHtml +
      '</div>' +

    '</div>';

  const backBtn = document.getElementById('reseller-dash-back');
  if (backBtn) backBtn.addEventListener('click', closeResellerPanelView);

  const buyBtn = document.getElementById('reseller-dash-buy');
  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
      if (isAdminView) { if (typeof showToast === 'function') showToast('O revendedor deve comprar créditos na Área do Revendedor.', 'info'); return; }
      showAppView('revendedor');
    });
  }

  // Preços de revenda por duração + recálculo dos ganhos.
  const priceSave = document.getElementById('rdash-price-save');
  if (priceSave) {
    priceSave.addEventListener('click', () => {
      const num = (id) => parseFloat(String((document.getElementById(id) || {}).value || '').replace(',', '.'));
      const dia = num('rdash-price-dia'), semana = num('rdash-price-semana'), mes = num('rdash-price-mes');
      if (!(dia > 0) || !(semana > 0) || !(mes > 0)) {
        if (typeof showToast === 'function') showToast('Informe valores válidos nos três preços.', 'error');
        return;
      }
      if (typeof setResellerPrices === 'function') setResellerPrices(reseller, { dia: dia, semana: semana, mes: mes });
      if (typeof showToast === 'function') showToast('Preços de revenda salvos.');
      renderResellerDashboard();
    });
  }

  // Copiar link de afiliado.
  const affBtn = document.getElementById('rdash-aff-copy');
  if (affBtn) {
    affBtn.addEventListener('click', () => {
      const link = affBtn.getAttribute('data-link') || '';
      const done = () => { if (typeof showToast === 'function') showToast('Link copiado!'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done).catch(() => {
          const inp = document.getElementById('rdash-aff-link'); if (inp) { inp.select(); document.execCommand('copy'); done(); }
        });
      } else {
        const inp = document.getElementById('rdash-aff-link'); if (inp) { inp.select(); document.execCommand('copy'); done(); }
      }
    });
  }

  if (!readOnly) {
    const form = document.getElementById('reseller-create-form');
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const msgEl = document.getElementById('reseller-form-msg');
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Criando...'; }
        if (msgEl) { msgEl.textContent = 'Aguarde...'; msgEl.className = 'reseller-form-msg'; }
        try {
          const days = document.getElementById('reseller-new-days').value;
          const result = await createResellerLogin(reseller, {
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
              showResellerLoginCreatedModal({ username: result.username, password: result.password, days: result.days });
            }
            document.getElementById('reseller-new-user').value = '';
            document.getElementById('reseller-new-pass').value = '';
            renderResellerDashboard();
          }
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '⚡ Gerar acesso'; }
        }
      });
    }
  }

  root.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const item = logins.find(l => l.id === id);
      if (action === 'info' && item) { openResellerCredsModal(item); return; }
      if (action === 'renew' && item && !readOnly) { openResellerRenewModal(reseller, item, () => renderResellerDashboard()); return; }
      if (!id || readOnly) return;
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

function openResellerCredsModal(item) {
  let overlay = document.getElementById('reseller-creds-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'reseller-creds-overlay';
    overlay.className = 'reseller-creds-overlay';
    overlay.innerHTML =
      '<div class="reseller-creds-box">' +
        '<div class="reseller-creds-title">Credenciais do cliente</div>' +
        '<div class="reseller-creds-field">' +
          '<div class="reseller-creds-label">Usuário</div>' +
          '<div class="reseller-creds-value-row">' +
            '<div class="reseller-creds-value" id="rc-username"></div>' +
            '<button class="reseller-creds-copy" data-copy="rc-username">Copiar</button>' +
          '</div>' +
        '</div>' +
        '<div class="reseller-creds-field">' +
          '<div class="reseller-creds-label">Senha</div>' +
          '<div class="reseller-creds-value-row">' +
            '<div class="reseller-creds-value" id="rc-password"></div>' +
            '<button class="reseller-creds-copy" data-copy="rc-password">Copiar</button>' +
          '</div>' +
        '</div>' +
        '<div class="reseller-creds-field">' +
          '<div class="reseller-creds-label">Dias contratados</div>' +
          '<div class="reseller-creds-value" id="rc-days"></div>' +
        '</div>' +
        '<button class="reseller-creds-copy-all" id="rc-copy-all">Copiar tudo</button>' +
        '<button class="reseller-creds-close" onclick="document.getElementById(\'reseller-creds-overlay\').classList.remove(\'open\')">Fechar</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
    overlay.querySelectorAll('.reseller-creds-copy[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = document.getElementById(btn.getAttribute('data-copy'))?.textContent || '';
        navigator.clipboard.writeText(val).then(() => {
          const prev = btn.textContent; btn.textContent = '✓ Copiado';
          setTimeout(() => { btn.textContent = prev; }, 1500);
        });
      });
    });
    document.getElementById('rc-copy-all').addEventListener('click', () => {
      const u = document.getElementById('rc-username')?.textContent || '';
      const p = document.getElementById('rc-password')?.textContent || '';
      const d = document.getElementById('rc-days')?.textContent || '';
      const text = 'Usuário: ' + u + '\nSenha: ' + p + '\nDias: ' + d;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('rc-copy-all');
        const prev = btn.textContent; btn.textContent = '✓ Tudo copiado!';
        setTimeout(() => { btn.textContent = prev; }, 1500);
        if (typeof showToast === 'function') showToast('Credenciais copiadas');
      });
    });
  }
  document.getElementById('rc-username').textContent = item.username || '';
  document.getElementById('rc-password').textContent = item.password || '';
  document.getElementById('rc-days').textContent = (item.days || '—') + (item.days ? (item.days === 1 ? ' dia' : ' dias') : '');
  overlay.classList.add('open');
}

let _renewReseller = null, _renewItem = null, _renewCb = null, _renewDays = 1;
function openResellerRenewModal(reseller, item, cb) {
  _renewReseller = reseller; _renewItem = item; _renewCb = cb; _renewDays = 1;
  const credits = typeof getResellerCredits === 'function' ? getResellerCredits(reseller) : 0;
  let overlay = document.getElementById('reseller-renew-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'reseller-renew-overlay';
    overlay.className = 'reseller-renew-overlay';
    overlay.innerHTML =
      '<div class="reseller-renew-box">' +
        '<div class="reseller-renew-title" id="rr-title">Renovar cliente</div>' +
        '<div class="reseller-renew-sub" id="rr-sub"></div>' +
        '<div class="reseller-renew-days-row">' +
          [1,7,15,30].map(d =>
            '<button class="reseller-renew-day-btn' + (d === 1 ? ' selected' : '') + '" data-days="' + d + '">' + d + ' dia' + (d > 1 ? 's' : '') + '</button>'
          ).join('') +
        '</div>' +
        '<div class="reseller-renew-cost" id="rr-cost"></div>' +
        '<button class="reseller-renew-confirm" id="rr-confirm">Renovar (1 crédito)</button>' +
        '<button class="reseller-renew-cancel" id="rr-cancel">Cancelar</button>' +
        '<div class="reseller-renew-msg" id="rr-msg"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
    overlay.querySelectorAll('.reseller-renew-day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.reseller-renew-day-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        _renewDays = parseInt(btn.getAttribute('data-days'), 10);
        updateRenewCost();
      });
    });
    document.getElementById('rr-cancel').addEventListener('click', () => overlay.classList.remove('open'));
    document.getElementById('rr-confirm').addEventListener('click', () => {
      const msgEl = document.getElementById('rr-msg');
      if (!_renewReseller || !_renewItem) return;
      const result = typeof renewResellerClient === 'function'
        ? renewResellerClient(_renewReseller, _renewItem.id, _renewDays)
        : { ok: false, msg: 'Função indisponível.' };
      if (msgEl) { msgEl.textContent = result.msg; msgEl.className = 'reseller-renew-msg ' + (result.ok ? 'ok' : 'err'); }
      if (result.ok) {
        if (typeof showToast === 'function') showToast(result.msg);
        setTimeout(() => {
          overlay.classList.remove('open');
          if (typeof _renewCb === 'function') _renewCb();
        }, 1000);
      }
    });
  }
  function updateRenewCost() {
    const costEl = document.getElementById('rr-cost');
    if (!costEl) return;
    const unlimited = typeof isUnlimitedResellerCredits === 'function' && isUnlimitedResellerCredits(reseller);
    if (unlimited) {
      costEl.textContent = 'Crédito infinito — renovações ilimitadas sem custo de saldo';
      return;
    }
    const newCr = credits - 1;
    costEl.textContent = 'Custo: 1 crédito — Saldo atual: ' + credits + ' → ' + (newCr >= 0 ? newCr : 0) + ' após renovação';
  }
  document.getElementById('rr-title').textContent = 'Renovar: ' + item.username;
  document.getElementById('rr-sub').textContent = 'Selecione quantos dias adicionar ao plano do cliente.';
  document.getElementById('rr-msg').textContent = '';
  overlay.querySelectorAll('.reseller-renew-day-btn').forEach(b => b.classList.toggle('selected', parseInt(b.getAttribute('data-days')) === 1));
  _renewDays = 1;
  updateRenewCost();
  overlay.classList.add('open');
}

function isModuleMaintenance(key) {
  for (var i = 0; i < MODULE_CATEGORIES.length; i++) {
    var mod = MODULE_CATEGORIES[i].modules.find(function(m) { return m.key === key; });
    if (mod && mod.maintenance) return true;
  }
  return false;
}

function accessModule(key) {
  if (typeof isAdmin === 'function' && isAdmin()) return;
  if (isModuleMaintenance(key)) {
    if (typeof showToast === 'function') showToast('Este módulo está temporariamente em manutenção. Volte em breve.', 'warn');
    return;
  }
  if (!hasActivePlan()) {
    updatePlanBanner();
    if (isResellerClientAccount()) {
      if (typeof showToast === 'function') {
        showToast('Seu acesso não está ativo. Entre em contato com seu revendedor para renovar.', 'warn', 5000);
      }
      return;
    }
    if (typeof showToast === 'function') {
      showToast('Nenhum plano ativo. Acesse a Loja de Planos para realizar a compra.', 'info', 4000);
    }
    renderPlansGrid();
    showAppView('loja');
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

    const activeTopicMods = cat.modules.filter(mod => !mod.maintenance);
    const maintenanceTopicMods = cat.modules.filter(mod => mod.maintenance);

    function buildTopicItem(mod) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'topic-item' + (cat.warn || mod.restricted ? ' topic-item-warn' : '') + (mod.maintenance ? ' topic-item-maintenance' : '');
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

      if (mod.maintenance) {
        const tag = document.createElement('span');
        tag.className = 'topic-item-tag topic-item-tag-maintenance';
        tag.textContent = 'Manutenção';
        item.appendChild(tag);
      } else if (mod.hc) {
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
      return item;
    }

    activeTopicMods.forEach(mod => list.appendChild(buildTopicItem(mod)));

    if (maintenanceTopicMods.length > 0) {
      const collapseWrap = document.createElement('div');
      collapseWrap.className = 'maintenance-collapse';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'maintenance-collapse-toggle';
      toggle.innerHTML =
        '<svg class="maintenance-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        'Em manutenção (' + maintenanceTopicMods.length + ')';

      const body = document.createElement('div');
      body.className = 'maintenance-collapse-body';

      maintenanceTopicMods.forEach(mod => body.appendChild(buildTopicItem(mod)));

      toggle.addEventListener('click', function () {
        const open = body.classList.toggle('open');
        toggle.classList.toggle('open', open);
      });

      collapseWrap.appendChild(toggle);
      collapseWrap.appendChild(body);
      list.appendChild(collapseWrap);
    }

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
  const expText = plan.id === 'vitalicio'
    ? 'acesso vitalício • sem expiração'
    : 'válido até ' + exp.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  el.hidden = false;
  el.innerHTML =
    '<span class="store-active-plan-label">Plano ativo</span>' +
    '<strong>' + plan.period + '</strong>' +
    '<span class="store-active-plan-exp">' + expText + '</span>';
}

function buyPlan(plan) {
  if (typeof openPixPayment === 'function') {
    openPixPayment(plan.id);
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

    const perLine = plan.lifetime
      ? '<div class="store-plan-per">Pagamento único</div>'
      : '<div class="store-plan-per">~ R$ ' + formatMoneyBr(plan.perDay) + ' / dia</div>';

    card.innerHTML =
      badgeHtml +
      '<span class="store-plan-tag">' + plan.tag + '</span>' +
      '<div class="store-plan-period">' + plan.period + ' <span>' + plan.durationLabel + '</span></div>' +
      '<div class="store-plan-price">' + formatResellerPriceHtml(plan.price) + '</div>' +
      perLine +
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

    const activeModules = cat.modules.filter(mod => !mod.maintenance);
    const maintenanceModules = cat.modules.filter(mod => mod.maintenance);

    function buildModCard(mod) {
      const card = document.createElement('article');
      card.className = 'mod-card' + (cat.warn || mod.restricted ? ' mod-warn' : '') + (mod.maintenance ? ' mod-maintenance' : '');
      card.setAttribute('role', 'button');
      card.tabIndex = 0;

      let badge = planActive ? '<span class="mod-online-dot"></span>ONLINE' : 'Plano necessário';
      let badgeClass = 'mod-badge' + (planActive ? ' mod-badge-online' : ' mod-badge-locked');
      if (planActive && mod.hc) { badge = 'Horário Comercial'; badgeClass = 'mod-badge hc'; }
      if (mod.restricted) { badge = 'Acesso Restrito'; badgeClass = 'mod-badge restricted'; }
      if (mod.maintenance) { badge = 'Em Manutenção'; badgeClass = 'mod-badge mod-badge-maintenance'; }

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
      return card;
    }

    activeModules.forEach(mod => grid.appendChild(buildModCard(mod)));

    if (maintenanceModules.length > 0) {
      const collapseWrap = document.createElement('div');
      collapseWrap.className = 'maintenance-collapse mod-grid-full-row';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'maintenance-collapse-toggle';
      toggle.innerHTML =
        '<svg class="maintenance-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        'Em manutenção (' + maintenanceModules.length + ')';

      const body = document.createElement('div');
      body.className = 'maintenance-collapse-body';

      const innerGrid = document.createElement('div');
      innerGrid.className = 'mod-grid';
      maintenanceModules.forEach(mod => innerGrid.appendChild(buildModCard(mod)));
      body.appendChild(innerGrid);

      toggle.addEventListener('click', function () {
        const open = body.classList.toggle('open');
        toggle.classList.toggle('open', open);
      });

      collapseWrap.appendChild(toggle);
      collapseWrap.appendChild(body);
      grid.appendChild(collapseWrap);
    }

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
  if (typeof updateAppNavigation === 'function') updateAppNavigation();
  const dashView = document.getElementById('view-revendedor-painel');
  if (dashView && dashView.classList.contains('active') && typeof renderResellerDashboard === 'function') {
    renderResellerDashboard();
  }
  const revendedorView = document.getElementById('view-revendedor');
  if (revendedorView && revendedorView.classList.contains('active')) {
    renderResellerPackages();
  }
});

window.addEventListener('storage', function (e) {
  const watchKeys = [PLAN_STORE_KEY, 'bds_reseller_access', 'bds_reseller_credits', 'bds_reseller_logins'];
  if (!watchKeys.includes(e.key)) return;
  if (typeof getSession !== 'function' || !getSession()) return;
  refreshClientPlanState();
  const root = document.getElementById('modules-categories');
  if (root && root.children.length) renderModulesHub();
  if (typeof renderSidebarConsultas === 'function') renderSidebarConsultas();
  updateSidebarUserFooter();
  if (typeof updateAppNavigation === 'function') updateAppNavigation();
  const dashView = document.getElementById('view-revendedor-painel');
  if (dashView && dashView.classList.contains('active') && typeof renderResellerDashboard === 'function') {
    renderResellerDashboard();
  }
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

  if (typeof DB !== 'undefined' && DB.isConfigured()) {
    DB.startBackgroundSync(getSession());
  }
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
