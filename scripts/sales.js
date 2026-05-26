// Registro e dashboard de vendas (planos + revenda)
const SALES_STORE_KEY = 'bds_sales';
const DAY_MS = 24 * 60 * 60 * 1000;

function getSalesList() {
  try { return JSON.parse(localStorage.getItem(SALES_STORE_KEY)) || []; } catch { return []; }
}

function saveSalesList(list) {
  localStorage.setItem(SALES_STORE_KEY, JSON.stringify(list));
}

function startOfLocalDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

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

function renderSalesDashboard() {
  const root = document.getElementById('sales-dashboard');
  if (!root) return;

  const stats = getSalesDashboardStats();

  root.innerHTML =
    '<div class="sales-dashboard-head">' +
      '<h3>Dashboard de vendas</h3>' +
      '<p>Resumo financeiro da plataforma</p>' +
    '</div>' +
    '<div class="sales-dashboard-grid">' +
      '<article class="sales-dash-card sales-dash-card-today">' +
        '<span class="sales-dash-period">Hoje</span>' +
        '<span class="sales-dash-amount">' + formatSaleMoney(stats.today.total) + '</span>' +
        '<span class="sales-dash-meta">' + stats.today.count + ' venda' + (stats.today.count !== 1 ? 's' : '') + '</span>' +
      '</article>' +
      '<article class="sales-dash-card sales-dash-card-week">' +
        '<span class="sales-dash-period">Últimos 7 dias</span>' +
        '<span class="sales-dash-amount">' + formatSaleMoney(stats.days7.total) + '</span>' +
        '<span class="sales-dash-meta">' + stats.days7.count + ' venda' + (stats.days7.count !== 1 ? 's' : '') + '</span>' +
      '</article>' +
      '<article class="sales-dash-card sales-dash-card-month">' +
        '<span class="sales-dash-period">Últimos 30 dias</span>' +
        '<span class="sales-dash-amount">' + formatSaleMoney(stats.days30.total) + '</span>' +
        '<span class="sales-dash-meta">' + stats.days30.count + ' venda' + (stats.days30.count !== 1 ? 's' : '') + '</span>' +
      '</article>' +
    '</div>';

  const recentEl = document.getElementById('sales-recent');
  if (!recentEl) return;

  const recent = getSalesList()
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);

  if (!recent.length) {
    recentEl.innerHTML = '<p class="sales-recent-empty">Nenhuma venda registrada ainda.</p>';
    return;
  }

  let rows = '';
  recent.forEach(s => {
    const cat = s.category === 'reseller' ? 'Revenda' : 'Plano';
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

function escSale(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
