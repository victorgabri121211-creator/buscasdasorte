// DOSSIÊ
let dossieResults = [];

function fmtKey(key) {
  return key
    .replace(/^\./, '')
    .replace(/\[(\d+)\]/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\./g, ' › ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim() || key;
}

function openDossie(results, queryLabel, iconSvg) {
  dossieResults = results;
  const now = new Date();
  document.getElementById('dossie-datetime').textContent =
    'Data: ' + now.toLocaleDateString('pt-BR') + ', ' + now.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
  if (iconSvg) document.getElementById('dossie-hdr-icon').innerHTML = iconSvg;
  document.getElementById('dossie-hdr-title').textContent = queryLabel || 'Resultado da Consulta';

  const tabsNav = document.getElementById('dossie-tabs-nav');
  const content = document.getElementById('dossie-content');
  tabsNav.innerHTML = '';
  content.innerHTML = '';

  const successful = results.filter(r => r.ok && r.data && !r.data.error);
  const failed = results.filter(r => !r.ok || (r.data && r.data.error));

  if (failed.length > 0 && successful.length > 0) {
    const errSec = document.createElement('div');
    errSec.style.cssText = 'background:rgba(255,69,58,0.04);border:1px solid rgba(255,69,58,0.12);border-radius:10px;margin-bottom:16px;padding:12px 16px';
    errSec.innerHTML = '<div style="font-size:10px;color:rgba(255,69,58,0.6);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Erros (' + failed.length + ')</div>' +
      failed.map(r => `<div style="font-size:12px;color:rgba(255,69,58,0.45);margin-bottom:2px">• ${escHtml(r.ep.label)}: ${escHtml(String(r.data?.error || r.data?.message || 'Erro ' + r.status))}</div>`).join('');
    content.appendChild(errSec);
  }

  if (successful.length === 0) {
    content.innerHTML = '<div style="text-align:center;padding:40px 0;color:rgba(255,255,255,0.2);font-size:14px">Nenhum dado retornado para esta consulta</div>';
  } else if (successful.length === 1) {
    tabsNav.style.display = 'none';
    content.appendChild(buildResultPanel(successful[0], 0));
  } else {
    tabsNav.style.display = 'flex';
    successful.forEach((r, i) => {
      const tab = document.createElement('button');
      tab.className = 'dossie-tab' + (i === 0 ? ' active' : '');
      tab.textContent = r.ep.label;
      tab.onclick = () => {
        document.querySelectorAll('.dossie-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.dossie-tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('dossie-panel-' + i).classList.add('active');
      };
      tabsNav.appendChild(tab);
      const panel = buildResultPanel(r, i);
      panel.id = 'dossie-panel-' + i;
      panel.className = 'dossie-tab-panel' + (i === 0 ? ' active' : '');
      content.appendChild(panel);
    });
  }

  document.getElementById('dossie-overlay').classList.add('open');
}

function buildResultPanel(result, idx) {
  const panel = document.createElement('div');
  const data = result.data;

  // Try to parse structured data
  let fields = [];
  function extractFields(obj, prefix) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => extractFields(item, prefix ? prefix + '[' + i + ']' : '[' + i + ']'));
      return;
    }
    Object.entries(obj).forEach(([k, v]) => {
      const key = prefix ? prefix + '.' + k : k;
      if (v !== null && typeof v === 'object') extractFields(v, key);
      else fields.push({ key, val: v });
    });
  }

  // Smart extraction: look for data key first
  const root = data.data || data;
  if (typeof root === 'object' && !Array.isArray(root)) {
    extractFields(root, '');
  } else {
    fields = [{ key: 'resultado', val: JSON.stringify(data) }];
  }

  // Split nulls from values
  const withVal = fields.filter(f => f.val !== null && f.val !== '' && f.val !== 'null' && f.val !== undefined);
  const nullFields = fields.filter(f => f.val === null || f.val === '' || f.val === 'null' || f.val === undefined);

  // Section: data with values
  if (withVal.length > 0) {
    const sec = document.createElement('div');
    sec.className = 'dossie-section';
    sec.innerHTML = '<div class="dossie-section-label">Alvo ' + String(idx + 1).padStart(2, '0') + ' — Dados encontrados</div>';
    const grid = document.createElement('div');
    grid.className = 'dossie-grid';
    withVal.forEach(f => {
      const cell = document.createElement('div');
      cell.className = 'dossie-field';
      cell.innerHTML = '<div class="dossie-field-key">' + escHtml(fmtKey(f.key)) + '</div>' +
        '<div class="dossie-field-val">' + escHtml(String(f.val)) + '</div>';
      grid.appendChild(cell);
    });
    sec.appendChild(grid);
    panel.appendChild(sec);
  }

  // Section: null fields (collapsed, smaller)
  if (nullFields.length > 0 && withVal.length > 0) {
    const sec = document.createElement('div');
    sec.className = 'dossie-section';
    sec.innerHTML = '<div class="dossie-section-label" style="opacity:0.4">Campos sem dados (' + nullFields.length + ')</div>';
    const grid = document.createElement('div');
    grid.className = 'dossie-grid';
    nullFields.forEach(f => {
      const cell = document.createElement('div');
      cell.className = 'dossie-field';
      cell.innerHTML = '<div class="dossie-field-key">' + escHtml(fmtKey(f.key)) + '</div>' +
        '<div class="dossie-field-val null-val">—</div>';
      grid.appendChild(cell);
    });
    sec.appendChild(grid);
    panel.appendChild(sec);
  }

  // Fallback: raw JSON
  if (withVal.length === 0) {
    const sec = document.createElement('div');
    sec.className = 'dossie-section';
    sec.innerHTML = '<div class="dossie-section-label">Dados brutos</div>';
    const raw = document.createElement('div');
    raw.className = 'dossie-raw';
    raw.innerHTML = '<pre>' + escHtml(JSON.stringify(data, null, 2)) + '</pre>';
    sec.appendChild(raw);
    panel.appendChild(sec);
  }

  return panel;
}

function closeDossie() {
  document.getElementById('dossie-overlay').classList.remove('open');
}

function dossieAction(type) {
  const allText = dossieResults.filter(r => r.ok && r.data && !r.data.error).map(r =>
    '=== ' + r.ep.label.toUpperCase() + ' ===\n' + JSON.stringify(r.data, null, 2)
  ).join('\n\n');

  if (type === 'copy') {
    navigator.clipboard.writeText(allText).then(() => {
      const btn = document.querySelector('.dossie-btn-copy');
      const orig = btn.innerHTML;
      btn.textContent = '✓ Copiado';
      setTimeout(() => btn.innerHTML = orig, 1800);
    });
  } else if (type === 'txt') {
    const blob = new Blob([allText], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'buscasdasorte_resultado.txt';
    a.click();
  } else if (type === 'pdf') {
    const s = 'body{font-family:monospace;background:#000;color:#30d158;padding:32px;font-size:13px;line-height:1.7}h1{color:#fff;margin-bottom:16px}p{color:rgba(255,255,255,0.35);margin-bottom:16px}pre{white-space:pre-wrap;word-break:break-all}';
    const d = new Date().toLocaleString('pt-BR');
    const t = escHtml(allText);
    const pwin = window.open('', '_blank');
    pwin.document.open();
    pwin.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BuscasDasorte<\/title><style>' + s + '<\/style><\/head><body><h1>BuscasDasorte<\/h1><p>Data: ' + d + '<\/p><pre>' + t + '<\/pre><\/body><\/html>');
    pwin.document.close();
    pwin.print();
  }
}