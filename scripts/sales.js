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

function getSalesDashboardStats() {
  const now = Date.now();
  const todayStart = startOfLocalDay(now);
  const weekStart = todayStart - 6 * DAY_MS;
  const monthStart = todayStart - 29 * DAY_MS;

  return {
    today: sumSalesInRange(todayStart, now),
    days7: sumSalesInRange(weekStart, now),
    days30: sumSalesInRange(monthStart, now),
  };
}

function formatSaleMoney(value) {
  return 'R$ ' + value.toFixed(2).replace('.', ',');
}

function _sdashKpi(label, stat, type, icon) {
  return '<div class="sdash-kpi sdash-kpi-' + type + '">' +
    '<div class="sdash-kpi-top">' +
      '<div class="sdash-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg></div>' +
      '<span class="sdash-kpi-label">' + escSale(label) + '</span>' +
    '</div>' +
    '<div class="sdash-kpi-amount">' + formatSaleMoney(stat.total) + '</div>' +
    '<div class="sdash-kpi-meta">' +
      '<span class="sdash-kpi-num">' + stat.count + '</span>' +
      ' venda' + (stat.count !== 1 ? 's' : '') +
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

  var rows = '';
  list.forEach(function(s) {
    var cat = s.category === 'reseller' ? 'Revenda' : 'Plano';
    rows +=
      '<li class="sales-recent-item">' +
        '<span class="sales-recent-cat">' + cat + '</span>' +
        '<span class="sales-recent-label">' + escSale(s.label) + '</span>' +
        '<span class="sales-recent-buyer">' + escSale(s.buyer) + '</span>' +
        '<span class="sales-recent-amount">' + formatSaleMoney(s.amount) + '</span>' +
        '<span class="sales-recent-time">' + new Date(s.ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '</span>' +
      '</li>';
  });
  recentEl.innerHTML = '<ul class="sales-recent-list">' + rows + '</ul>';
}

window.switchSalesTab = function(tab) {
  _salesTab = tab;
  document.querySelectorAll('.sales-tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });
  renderSalesPanel();
};

function renderSalesDashboard() {
  const root = document.getElementById('sales-dashboard');
  if (!root) return;

  const stats = getSalesDashboardStats();

  root.innerHTML =
    '<div class="sdash-wrap">' +

    '<div class="sdash-header">' +
      '<div class="sdash-header-left">' +
        '<div class="sdash-header-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' +
        '</div>' +
        '<div>' +
          '<h3 class="sdash-title">Vendas</h3>' +
          '<p class="sdash-sub">Faturamento em tempo real da plataforma</p>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="admin-sync-btn" onclick="adminSyncFromSupabase()">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
        'Sincronizar' +
      '</button>' +
    '</div>' +

    '<div class="sdash-kpis">' +
      _sdashKpi('Hoje', stats.today, 'today',
        '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>') +
      _sdashKpi('Últimos 7 dias', stats.days7, 'week',
        '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>') +
      _sdashKpi('Últimos 30 dias', stats.days30, 'month',
        '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>') +
    '</div>' +

    '</div>';

  renderSalesPanel();
}

function escSale(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
