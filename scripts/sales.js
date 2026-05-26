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
  list.push({
    id:        's' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    txId:      sale.txId || null,
    ts:        Number(sale.ts) || Date.now(),
    category:  sale.category,
    productId: sale.productId,
    label:     sale.label,
    amount:    Number(sale.amount) || 0,
    buyer:     sale.buyer || '—',
  });
  saveSalesList(list);
}

async function importSalesFromMisticPay() {
  const resp = await fetch(PROXY + '/pix/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!resp.ok) throw new Error('Erro HTTP ' + resp.status);
  const data = await resp.json();

  const APPROVED = new Set(['APPROVED','COMPLETO','PAID','COMPLETED','PAGO','CONCLUIDO']);
  const txList = Array.isArray(data) ? data
    : (data.data && Array.isArray(data.data)) ? data.data : [];

  if (!txList.length && data.error) throw new Error(data.error);

  let imported = 0, skipped = 0;

  txList.forEach(tx => {
    const state = (tx.transactionState || tx.status || tx.state || '').toUpperCase();
    if (!APPROVED.has(state)) return;

    const txId   = tx.transactionId || tx.id || null;
    const desc   = String(tx.description || '');
    const amount = Number(tx.amount) || 0;
    const buyer  = tx.payerName || tx.payer_name || '—';
    const ts     = tx.createdAt   ? new Date(tx.createdAt).getTime()
                 : tx.created_at  ? new Date(tx.created_at).getTime()
                 : Date.now();

    const existing = getSalesList();
    if (txId && existing.some(s => s.txId === txId)) { skipped++; return; }

    const dl = desc.toLowerCase();
    let category, productId, label;
    if (dl.includes('logins') || dl.includes('pacote')) {
      category = 'reseller';
      const m = desc.match(/(\d+)\s*logins?/i);
      productId = m ? m[1] : '?';
      label     = (m ? m[1] : '?') + ' logins';
    } else if (dl.includes('diária') || dl.includes('diaria')) {
      category = 'plan'; productId = 'diaria'; label = 'Plano Diária';
    } else if (dl.includes('semana')) {
      category = 'plan'; productId = 'semana'; label = 'Plano 1 Semana';
    } else if (dl.includes('mês') || dl.includes('mes')) {
      category = 'plan'; productId = 'mes'; label = 'Plano 1 Mês';
    } else {
      category = 'plan'; productId = 'outro'; label = desc || 'Venda';
    }

    recordSale({ txId, ts, category, productId, label, amount, buyer });
    imported++;
  });

  return { imported, skipped, total: txList.length };
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
