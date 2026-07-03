// Registro e dashboard de vendas (planos + revenda)
const SALES_STORE_KEY = 'bds_sales';
const DAY_MS = 24 * 60 * 60 * 1000;
var _salesTab = 'recent';

function getSalesList() {
  try {
    const raw = JSON.parse(localStorage.getItem(SALES_STORE_KEY)) || [];
    const seen = new Set();
    return raw.filter(function(s) {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  } catch { return []; }
}

function saveSalesList(list) {
  localStorage.setItem(SALES_STORE_KEY, JSON.stringify(list));
}

function startOfLocalDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function deduplicateSalesList() {
  const list = getSalesList();
  if (!list.length) return;

  const seenIds = new Set();
  const seenTxIds = new Set();

  // Sort so records with txId are evaluated first (preferred)
  const sorted = list.slice().sort(function (a, b) {
    if (a.txId && !b.txId) return -1;
    if (!a.txId && b.txId) return 1;
    return 0;
  });

  // Pass 1: dedup by id and txId
  const pass1 = [];
  sorted.forEach(function (s) {
    if (seenIds.has(s.id)) return;
    seenIds.add(s.id);
    if (s.txId) {
      if (seenTxIds.has(s.txId)) return;
      seenTxIds.add(s.txId);
    }
    pass1.push(s);
  });

  // Pass 2: remove txId-less records that match a txId record on amount+buyer+productId within 10s
  const final = pass1.filter(function (s) {
    if (s.txId) return true;
    return !pass1.some(function (other) {
      return other.txId &&
        other.amount === s.amount &&
        other.buyer === s.buyer &&
        other.productId === s.productId &&
        Math.abs(other.ts - s.ts) < 10000;
    });
  });

  if (final.length !== list.length) {
    saveSalesList(final);
  }
}

deduplicateSalesList();

function recordSale(sale) {
  const list = getSalesList();
  if (sale.txId && list.some(s => s.txId === sale.txId)) return; // dedup
  const entry = {
    id:        's' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    txId:      sale.txId || null,
    ts:        Number(sale.ts) || Date.now(),
    category:  sale.category,
    productId: sale.productId,
    label:     sale.label,
    amount:    Number(sale.amount) || 0,
    buyer:     sale.buyer || '—',
  };
  list.push(entry);
  saveSalesList(list);
  if (typeof DB !== 'undefined' && DB.isConfigured()) {
    DB.recordSale(entry).catch(function () {});
  }
}


function sumSalesInRange(fromTs, toTs) {
  const sales = getSalesList();
  let total = 0;
  let count = 0;
  sales.forEach(s => {
    if (s.ts >= fromTs && s.ts <= toTs) {
      total += s.amount;
      count++;
    }
  });
  return { total, count };
}

function sumByCategoryInRange(fromTs, toTs) {
  const sales = getSalesList();
  let plan = 0, reseller = 0;
  sales.forEach(s => {
    if (s.ts >= fromTs && s.ts <= toTs) {
      if (s.category === 'reseller') reseller += s.amount; else plan += s.amount;
    }
  });
  return { plan: plan, reseller: reseller };
}

function getSalesDashboardStats() {
  const now = Date.now();
  const todayStart = startOfLocalDay(now);
  const weekStart = todayStart - 6 * DAY_MS;
  const monthStart = todayStart - 29 * DAY_MS;
  const yesterdayStart = todayStart - DAY_MS;
  const prevWeekStart = weekStart - 7 * DAY_MS;
  const prevMonthStart = monthStart - 30 * DAY_MS;

  const all = getSalesList();
  const total = all.reduce((a, s) => a + s.amount, 0);

  return {
    today:  sumSalesInRange(todayStart, now),
    days7:  sumSalesInRange(weekStart, now),
    days30: sumSalesInRange(monthStart, now),
    total:  { total: total, count: all.length },
    prevToday: sumSalesInRange(yesterdayStart, todayStart - 1),
    prev7:     sumSalesInRange(prevWeekStart, weekStart - 1),
    prev30:    sumSalesInRange(prevMonthStart, monthStart - 1),
    split30:   sumByCategoryInRange(monthStart, now),
  };
}

// Contagens administrativas (clientes, planos ativos, revendedores)
function getAdminOverviewCounts() {
  let clientes = 0, planosAtivos = 0, revendedores = 0;
  try {
    const users = typeof adminGetUsers === 'function' ? adminGetUsers() : [];
    clientes = users.length;
    if (typeof isResellerEnabled === 'function') {
      revendedores = users.filter(u => isResellerEnabled(u.user)).length;
    }
  } catch (e) { /* ignore */ }
  try {
    const store = typeof getPlansStore === 'function' ? getPlansStore() : {};
    const now = Date.now();
    planosAtivos = Object.keys(store).filter(k => Number(store[k] && store[k].expiresAt) > now).length;
  } catch (e) { /* ignore */ }
  return { clientes: clientes, planosAtivos: planosAtivos, revendedores: revendedores };
}

// Chip de variação percentual vs. período anterior
function _sdashDelta(cur, prev) {
  if (prev <= 0) {
    return cur > 0
      ? '<span class="sdash-delta sdash-delta-up">Novo</span>'
      : '<span class="sdash-delta sdash-delta-flat">—</span>';
  }
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return '<span class="sdash-delta sdash-delta-flat">0%</span>';
  const up = pct > 0;
  return '<span class="sdash-delta sdash-delta-' + (up ? 'up' : 'down') + '">' +
    (up ? '↑' : '↓') + ' ' + Math.abs(pct) + '%</span>';
}

function formatSaleMoney(value) {
  return 'R$ ' + value.toFixed(2).replace('.', ',');
}

function _sdashKpi(opts) {
  const stat = opts.stat || { total: 0, count: 0 };
  const sub = opts.sub != null
    ? opts.sub
    : ('<span class="sdash-kpi-num">' + stat.count + '</span> venda' + (stat.count !== 1 ? 's' : ''));
  return '<div class="sdash-kpi sdash-kpi-' + opts.type + '">' +
    '<div class="sdash-kpi-top">' +
      '<span class="sdash-kpi-label">' + escSale(opts.label) + '</span>' +
      '<div class="sdash-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + opts.icon + '</svg></div>' +
    '</div>' +
    '<div class="sdash-kpi-amount">' + formatSaleMoney(stat.total) + '</div>' +
    '<div class="sdash-kpi-meta">' + (opts.delta || '') + '<span class="sdash-kpi-sub">' + sub + '</span></div>' +
  '</div>';
}

// Tile compacto de contagem (clientes, planos, revendedores, ticket)
function _sdashStat(label, value, icon, accent) {
  return '<div class="sdash-stat sdash-stat-' + accent + '">' +
    '<div class="sdash-stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg></div>' +
    '<div class="sdash-stat-body">' +
      '<div class="sdash-stat-val">' + value + '</div>' +
      '<div class="sdash-stat-label">' + escSale(label) + '</div>' +
    '</div>' +
  '</div>';
}

function _sdashFeed(list) {
  var html = '';
  list.forEach(function (s) {
    var isReseller = s.category === 'reseller';
    var initials = String(s.buyer || '?').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '??';
    var d = new Date(s.ts);
    var now = new Date();
    var isToday = d.toDateString() === now.toDateString();
    var timeStr = isToday
      ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    html +=
      '<div class="sdash-item">' +
        '<div class="sdash-avatar ' + (isReseller ? 'sdash-avatar-orange' : 'sdash-avatar-blue') + '">' + escSale(initials) + '</div>' +
        '<div class="sdash-item-body">' +
          '<span class="sdash-item-name">' + escSale(s.label) + '</span>' +
          '<span class="sdash-item-buyer">' + escSale(s.buyer) + '</span>' +
        '</div>' +
        '<span class="sdash-badge ' + (isReseller ? 'sdash-badge-reseller' : 'sdash-badge-plan') + '">' +
          (isReseller ? 'Revenda' : 'Plano') +
        '</span>' +
        '<div class="sdash-item-tail">' +
          '<span class="sdash-item-amount">' + formatSaleMoney(s.amount) + '</span>' +
          '<span class="sdash-item-time">' + escSale(timeStr) + '</span>' +
        '</div>' +
      '</div>';
  });
  return html;
}

function renderSalesPanel() {
  var recentEl = document.getElementById('sales-recent');
  if (!recentEl) return;

  var allSales = getSalesList().slice().sort(function(a, b) { return b.ts - a.ts; });
  var list = _salesTab === 'all' ? allSales : allSales.slice(0, 8);

  if (!list.length) {
    recentEl.innerHTML = '<p class="sales-recent-empty">Nenhuma venda registrada ainda.</p>';
    return;
  }

  recentEl.innerHTML = '<div class="sdash-feed">' + _sdashFeed(list) + '</div>';
}

window.switchSalesTab = function(tab) {
  _salesTab = tab;
  document.querySelectorAll('.sales-tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });
  renderSalesPanel();
};

function getSalesLast7Days() {
  const sales = getSalesList();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const start = d.getTime();
    const end = start + DAY_MS - 1;
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const dayLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    let plan = 0, reseller = 0;
    sales.forEach(s => {
      if (s.ts >= start && s.ts <= end) {
        if (s.category === 'reseller') reseller += s.amount; else plan += s.amount;
      }
    });
    days.push({ label: label, dayLabel: dayLabel, plan: plan, reseller: reseller, total: plan + reseller, isToday: i === 0 });
  }
  return days;
}

// "nice" ceiling para o eixo Y (ex: 137 -> 150, 1240 -> 1500)
function _sdashNiceMax(v) {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function renderSalesChart() {
  const chartWrap = document.getElementById('sales-chart-wrap');
  if (!chartWrap) return;
  const days = getSalesLast7Days();
  const rawMax = Math.max.apply(null, days.map(d => d.total).concat([1]));
  const max = _sdashNiceMax(rawMax);

  // linhas de grade + rótulos do eixo Y (4 divisões)
  let gridHtml = '';
  for (let g = 4; g >= 0; g--) {
    const val = (max / 4) * g;
    gridHtml +=
      '<div class="sdash-grid-row">' +
        '<span class="sdash-grid-tick">' + (val >= 1000 ? 'R$' + Math.round(val / 1000) + 'k' : 'R$' + Math.round(val)) + '</span>' +
        '<span class="sdash-grid-line"></span>' +
      '</div>';
  }

  const bars = days.map(d => {
    const planH = Math.round((d.plan / max) * 100);
    const resH  = Math.round((d.reseller / max) * 100);
    const tip = escSale(d.label + ' ' + d.dayLabel) +
      ' • Planos ' + formatSaleMoney(d.plan) +
      ' • Revenda ' + formatSaleMoney(d.reseller) +
      ' • Total ' + formatSaleMoney(d.total);
    const totalLabel = d.total > 0
      ? '<div class="sdash-col-total">' + (d.total >= 1000 ? 'R$' + (d.total / 1000).toFixed(1) + 'k' : 'R$' + Math.round(d.total)) + '</div>'
      : '';
    const planSeg = d.plan > 0 ? '<div class="sdash-seg sdash-seg-plan" style="height:' + Math.max(planH, 2) + '%"></div>' : '';
    const resSeg  = d.reseller > 0 ? '<div class="sdash-seg sdash-seg-res" style="height:' + Math.max(resH, 2) + '%"></div>' : '';
    return (
      '<div class="sdash-col' + (d.isToday ? ' is-today' : '') + '" data-tip="' + tip + '" tabindex="0">' +
        totalLabel +
        '<div class="sdash-stack">' + resSeg + planSeg + '</div>' +
        '<div class="sdash-col-label">' + escSale(d.label) + '</div>' +
      '</div>'
    );
  }).join('');

  chartWrap.innerHTML =
    '<div class="sdash-chart">' +
      '<div class="sdash-chart-grid">' + gridHtml + '</div>' +
      '<div class="sdash-chart-cols">' + bars + '</div>' +
    '</div>' +
    '<div class="sdash-tip" id="sdash-tip" hidden></div>';

  // Tooltip leve no hover/focus das colunas
  const tipEl = document.getElementById('sdash-tip');
  chartWrap.querySelectorAll('.sdash-col').forEach(col => {
    const show = () => {
      if (!tipEl) return;
      tipEl.textContent = col.getAttribute('data-tip');
      tipEl.hidden = false;
      const cr = chartWrap.getBoundingClientRect();
      const br = col.getBoundingClientRect();
      let x = br.left - cr.left + br.width / 2;
      x = Math.max(4, Math.min(x, cr.width - 4));
      tipEl.style.left = x + 'px';
    };
    const hide = () => { if (tipEl) tipEl.hidden = true; };
    col.addEventListener('mouseenter', show);
    col.addEventListener('mousemove', show);
    col.addEventListener('mouseleave', hide);
    col.addEventListener('focus', show);
    col.addEventListener('blur', hide);
  });
}

function renderSalesDashboard() {
  const root = document.getElementById('sales-dashboard');
  if (!root) return;

  const stats = getSalesDashboardStats();
  const counts = getAdminOverviewCounts();
  const ticket = stats.days30.count > 0 ? stats.days30.total / stats.days30.count : 0;

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // composição plano vs revenda (últimos 30 dias)
  const split = stats.split30;
  const splitTotal = split.plan + split.reseller;
  const planPct = splitTotal > 0 ? Math.round((split.plan / splitTotal) * 100) : 0;
  const resPct = splitTotal > 0 ? 100 - planPct : 0;

  root.innerHTML =
    '<div class="sdash-wrap">' +

    '<div class="sdash-header">' +
      '<div class="sdash-header-left">' +
        '<div class="sdash-header-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>' +
        '</div>' +
        '<div>' +
          '<h3 class="sdash-title">Painel Administrativo</h3>' +
          '<p class="sdash-sub">' + escSale(hoje.charAt(0).toUpperCase() + hoje.slice(1)) + '</p>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="admin-sync-btn" onclick="adminSyncFromSupabase()">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
        'Sincronizar' +
      '</button>' +
    '</div>' +

    '<div class="sdash-kpis">' +
      _sdashKpi({ label: 'Hoje', stat: stats.today, type: 'today',
        icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        delta: _sdashDelta(stats.today.total, stats.prevToday.total) }) +
      _sdashKpi({ label: 'Últimos 7 dias', stat: stats.days7, type: 'week',
        icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
        delta: _sdashDelta(stats.days7.total, stats.prev7.total) }) +
      _sdashKpi({ label: 'Últimos 30 dias', stat: stats.days30, type: 'month',
        icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        delta: _sdashDelta(stats.days30.total, stats.prev30.total) }) +
      _sdashKpi({ label: 'Faturamento total', stat: stats.total, type: 'total',
        icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
        sub: 'acumulado' }) +
    '</div>' +

    '<div class="sdash-stats">' +
      _sdashStat('Clientes', counts.clientes,
        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 'blue') +
      _sdashStat('Planos ativos', counts.planosAtivos,
        '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', 'green') +
      _sdashStat('Revendedores', counts.revendedores,
        '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>', 'orange') +
      _sdashStat('Ticket médio', formatSaleMoney(ticket),
        '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>', 'purple') +
    '</div>' +

    '<div class="sdash-panel">' +
      '<div class="sdash-panel-head">' +
        '<h4 class="sdash-panel-title">Receita dos últimos 7 dias</h4>' +
        '<div class="sdash-legend">' +
          '<span class="sdash-legend-item"><span class="sdash-legend-dot sdash-dot-plan"></span>Planos</span>' +
          '<span class="sdash-legend-item"><span class="sdash-legend-dot sdash-dot-res"></span>Revenda</span>' +
        '</div>' +
      '</div>' +
      '<div class="sales-chart-wrap" id="sales-chart-wrap"></div>' +
      (splitTotal > 0
        ? '<div class="sdash-compose">' +
            '<div class="sdash-compose-bar">' +
              '<span class="sdash-compose-plan" style="width:' + planPct + '%"></span>' +
              '<span class="sdash-compose-res" style="width:' + resPct + '%"></span>' +
            '</div>' +
            '<div class="sdash-compose-legend">' +
              '<span><span class="sdash-legend-dot sdash-dot-plan"></span>Planos ' + planPct + '% · ' + formatSaleMoney(split.plan) + '</span>' +
              '<span><span class="sdash-legend-dot sdash-dot-res"></span>Revenda ' + resPct + '% · ' + formatSaleMoney(split.reseller) + '</span>' +
            '</div>' +
          '</div>'
        : '') +
    '</div>' +

    '</div>';

  renderSalesChart();
  renderSalesPanel();
}

function escSale(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
