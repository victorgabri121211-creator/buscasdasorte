// DOSSIÊ

function showToast(msg, duration) {
  duration = duration || 2500;
  var container = document.getElementById('bds-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'bds-toast-container';
    document.body.appendChild(container);
  }
  var toast = document.createElement('div');
  toast.className = 'bds-toast';
  toast.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
    escHtml(msg);
  container.appendChild(toast);
  setTimeout(function () {
    toast.classList.add('out');
    setTimeout(function () { toast.remove(); }, 260);
  }, duration);
}
window.showToast = showToast;

let dossieResults = [];
let dossieStreamMeta = { label: '', icon: '' };
let dossieLoading = false;
let dossieRenderQueued = false;
let dossieLoadingTimer = null;

const CROSSHAIR_SVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>';

const FOLDER_SVG =
  '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';

const SECTION_TITLE_MAP = {
  cadsus: 'CADSUS',
  credilink: 'CREDILINK',
  credilink_basic: 'CREDILINK BÁSICO',
  serasa: 'SERASA COMPLETO',
  spc: 'SPC',
  score: 'SCORE',
  endereco: 'ENDEREÇO',
  enderecos: 'ENDEREÇOS',
  address: 'ENDEREÇO',
  telefones: 'TELEFONES',
  telefone: 'TELEFONES',
  phones: 'DATASUS PHONES',
  vehicles: 'VEHICLES',
  veiculos: 'VEÍCULOS',
  receita: 'RECEITA FEDERAL',
  dados_cadastrais: 'DADOS CADASTRAIS',
  cadastro: 'DADOS CADASTRAIS',
};

const DOSSIE_EMPTY_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.75"/>' +
    '<line x1="15" y1="15" x2="20" y2="20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
    '<path d="M17.5 5.5a4 4 0 0 1 0 5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<circle cx="19" cy="6" r="2.25" fill="none" stroke="currentColor" stroke-width="1.25"/>' +
  '</svg>';

const FIELD_LABEL_MAP = {
  cpf: 'CPF',
  cpf_masked: 'CPF MASKED',
  cpfmask: 'CPF MASKED',
  nome: 'NOME',
  nome_completo: 'NOME COMPLETO',
  full_name: 'NOME COMPLETO',
  first_name: 'FIRST NAME',
  last_name: 'LAST NAME',
  genero: 'GÊNERO',
  gender: 'GÊNERO',
  sexo: 'GÊNERO',
  birth_date: 'BIRTH DATE',
  data_nascimento: 'BIRTH DATE',
  nascimento: 'BIRTH DATE',
  nome_mae: 'NOME DA MÃE',
  mother_name: 'NOME DA MÃE',
  mae: 'NOME DA MÃE',
  NOME_MAE: 'NOME DA MÃE',
  NOME: 'NOME',
  DT_NASCIMENTO: 'DATA NASCIMENTO',
  TELEFONES: 'TELEFONES',
  RENDA_PRESUMIDA: 'RENDA PRESUMIDA',
  STATUS_RECEITA_FEDERAL: 'STATUS RECEITA',
  municipio: 'MUNICÍPIO',
  logradouro: 'LOGRADOURO',
  nome_pai: 'NOME DO PAI',
  father_name: 'NOME DO PAI',
  email: 'EMAIL',
  telefone: 'TELEFONE',
  phone: 'TELEFONE',
  cep: 'CEP',
  endereco: 'ENDEREÇO',
  placa: 'PLACA',
  rg: 'RG',
  score: 'SCORE',
  foto: 'FOTO',
  imagem: 'IMAGEM',
  photo: 'FOTO',
  image: 'IMAGEM',
};

const FIELD_ORDER = [
  'cpf', 'cpf_masked', 'cpfmask', 'nome_completo', 'full_name', 'nome',
  'first_name', 'last_name', 'genero', 'gender', 'sexo',
  'birth_date', 'data_nascimento', 'nascimento',
  'nome_mae', 'mother_name', 'mae', 'nome_pai', 'father_name',
  'email', 'telefone', 'phone', 'cep', 'endereco', 'placa', 'rg', 'score',
];

function formatFieldLabel(key) {
  const bare = key.replace(/^\./, '').split('.').pop().toLowerCase();
  if (FIELD_LABEL_MAP[bare]) return FIELD_LABEL_MAP[bare];
  return bare.replace(/_/g, ' ').toUpperCase();
}

function fieldSortKey(key) {
  const bare = key.replace(/^\./, '').split('.').pop().toLowerCase();
  const i = FIELD_ORDER.indexOf(bare);
  return i === -1 ? 999 : i;
}

function getResultPayload(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.success === true && data.data != null) return data.data;
  if (data.data != null && typeof data.data === 'object') return data.data;
  if (data.result != null) return data.result;
  return data;
}

function collectResultFields(obj, prefix, out) {
  if (obj == null) return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const next = prefix + (obj.length > 1 ? '[' + i + ']' : '');
      collectResultFields(item, next, out);
    });
    return;
  }
  if (typeof obj !== 'object') {
    out.push({ key: prefix || 'resultado', val: obj });
    return;
  }
  Object.entries(obj).forEach(([k, v]) => {
    const key = prefix ? prefix + '.' + k : k;
    if (v != null && typeof v === 'object') collectResultFields(v, key, out);
    else out.push({ key, val: v });
  });
}

function payloadHasValues(payload) {
  if (payload == null) return false;
  if (typeof payload !== 'object') return payload !== '' && payload != null && String(payload) !== 'null';
  if (Array.isArray(payload)) return payload.length > 0;
  for (const v of Object.values(payload)) {
    if (v == null || v === '' || v === 'null') continue;
    if (typeof v !== 'object') return true;
    if (payloadHasValues(v)) return true;
  }
  return false;
}

function isSearchSuccess(res) {
  if (!res || !res.ok || !res.data) return false;
  if (res.data.error) return false;
  if (res.data.success === false) return false;
  return payloadHasValues(getResultPayload(res.data));
}

function getSearchErrorMessage(res) {
  if (!res) return 'Erro na consulta.';
  const d = res.data || {};
  if (!res.ok) return d.message || d.error || d.detail || ('Erro HTTP ' + (res.status || ''));
  if (d.success === false) return d.message || d.error || 'A API não retornou dados para esta consulta.';
  if (d.error) return String(d.error);
  return 'Nenhum dado encontrado para os critérios informados.';
}

function getEmptySearchMessage(res) {
  if (res && res.ok) return 'Consulta concluída, porém a fonte não retornou dados.';
  return getSearchErrorMessage(res);
}

function createDossieEmptyState(message, isError) {
  const wrap = document.createElement('div');
  wrap.className = 'dossie-empty' + (isError ? ' dossie-empty-error' : '');
  wrap.innerHTML =
    '<div class="dossie-empty-panel">' +
      '<div class="dossie-empty-status">' +
        '<span class="dossie-empty-icon">' + DOSSIE_EMPTY_ICON_SVG + '</span>' +
        '<p class="dossie-empty-msg">' + escHtml(message) + '</p>' +
      '</div>' +
    '</div>';
  return wrap;
}

function createAlvoHeader(idx, sourceLabel) {
  const head = document.createElement('div');
  head.className = 'dossie-section-head';
  const title = sourceLabel
    ? escHtml(String(sourceLabel).toUpperCase())
    : 'ALVO ' + String(idx + 1).padStart(2, '0');
  head.innerHTML =
    '<div class="dossie-section-head-row">' +
      '<span class="dossie-section-icon">' + CROSSHAIR_SVG + '</span>' +
      '<span class="dossie-section-title">' + title + '</span>' +
    '</div>' +
    '<div class="dossie-section-line"></div>';
  return head;
}

function hasFieldValue(f) {
  return f.val != null && f.val !== '' && f.val !== 'null' && f.val !== undefined;
}

function formatSectionTitle(key) {
  const bare = String(key).replace(/^\./, '').split('.').pop().toLowerCase();
  if (SECTION_TITLE_MAP[bare]) return SECTION_TITLE_MAP[bare];
  return bare.replace(/_/g, ' ').toUpperCase();
}

function partitionFields(fields) {
  const withVal = fields.filter(hasFieldValue).sort((a, b) => fieldSortKey(a.key) - fieldSortKey(b.key));
  const nullFields = fields.filter(f => !hasFieldValue(f)).sort((a, b) => fieldSortKey(a.key) - fieldSortKey(b.key));
  return { withVal, nullFields };
}

/** Maior = mais prioritário: % preenchido, seções só vazias por último, depois quantidade. */
function resultDataSortKey(res) {
  const root = getResultPayload(res.data);
  if (!root) return -1;

  let withVal = 0;
  let empty = 0;
  let sectionsOnlyEmpty = 0;

  splitPayloadIntoSections(root).forEach(sec => {
    const p = partitionFields(sec.fields);
    withVal += p.withVal.length;
    empty += p.nullFields.length;
    if (!p.withVal.length && p.nullFields.length) sectionsOnlyEmpty++;
  });

  if (withVal === 0) return -1;

  const total = withVal + empty;
  const fillRatio = total > 0 ? withVal / total : 1;
  const noEmptySections = sectionsOnlyEmpty === 0 ? 1 : 0;

  return Math.round(noEmptySections * 1e6 + fillRatio * 1e5 + withVal);
}

function sortResultsByDataPriority(results) {
  return results.slice().sort((a, b) => resultDataSortKey(b) - resultDataSortKey(a));
}

function splitPayloadIntoSections(root) {
  if (root == null) return [{ title: null, fields: [] }];
  if (Array.isArray(root)) {
    const fields = [];
    collectResultFields(root, '', fields);
    return [{ title: null, fields }];
  }
  if (typeof root !== 'object') {
    return [{ title: null, fields: [{ key: 'resultado', val: root }] }];
  }

  const keys = Object.keys(root);
  const sectionKeys = keys.filter(k => root[k] != null && typeof root[k] === 'object');
  const primitiveKeys = keys.filter(k => root[k] == null || typeof root[k] !== 'object');

  const sections = [];

  if (primitiveKeys.length) {
    const fields = primitiveKeys.map(k => ({ key: k, val: root[k] }));
    if (fields.length) sections.push({ title: null, fields });
  }

  sectionKeys.forEach(k => {
    const fields = [];
    collectResultFields(root[k], k, fields);
    if (fields.length) sections.push({ title: formatSectionTitle(k), fields });
  });

  if (!sections.length) {
    const fields = [];
    collectResultFields(root, '', fields);
    sections.push({ title: null, fields });
  }

  return sections;
}

function isPhotoFieldKey(key) {
  const bare = String(key).replace(/^\./, '').split('.').pop().toLowerCase();
  return bare === 'foto' || bare.includes('foto') || bare.includes('imagem') ||
    bare === 'image' || bare === 'photo' || bare === 'foto_base64';
}

function isBase64ImageValue(val) {
  if (val == null) return false;
  const s = String(val).trim();
  if (s.startsWith('data:image/')) return true;
  if (s.length < 60) return false;
  return /^\/9j\//.test(s) ||
    /^iVBORw0KGgo/.test(s) ||
    /^R0lGOD/.test(s) ||
    /^UklGR/.test(s);
}

function base64ToDataUrl(val) {
  const s = String(val).trim();
  if (s.startsWith('data:image/')) return s;
  if (s.startsWith('/9j/')) return 'data:image/jpeg;base64,' + s;
  if (s.startsWith('iVBORw0KGgo')) return 'data:image/png;base64,' + s;
  if (s.startsWith('R0lGOD')) return 'data:image/gif;base64,' + s;
  if (s.startsWith('UklGR')) return 'data:image/webp;base64,' + s;
  return 'data:image/jpeg;base64,' + s;
}

function formatFieldValueHtml(f) {
  if (!hasFieldValue(f)) return '<div class="dossie-field-val null-val">—</div>';
  const raw = String(f.val).trim();
  if (isBase64ImageValue(raw) || (isPhotoFieldKey(f.key) && raw.length > 200 && /^[A-Za-z0-9+/=]+$/.test(raw.slice(0, 200)))) {
    const src = base64ToDataUrl(raw);
    return (
      '<div class="dossie-field-val dossie-field-photo">' +
        '<img class="dossie-photo-img" src="' + src.replace(/"/g, '&quot;') + '" alt="Foto retornada pela consulta" loading="lazy"/>' +
      '</div>'
    );
  }
  if (raw.length > 280 && isBase64ImageValue(raw.slice(0, 40))) {
    const src = base64ToDataUrl(raw);
    return (
      '<div class="dossie-field-val dossie-field-photo">' +
        '<img class="dossie-photo-img" src="' + src.replace(/"/g, '&quot;') + '" alt="Imagem retornada pela consulta" loading="lazy"/>' +
      '</div>'
    );
  }
  return '<div class="dossie-field-val">' + escHtml(raw) + '</div>';
}

function createFieldGrid(fields, muted) {
  const grid = document.createElement('div');
  grid.className = 'dossie-grid dossie-tactical-grid' + (muted ? ' dossie-grid-muted' : '');
  fields.forEach(f => {
    const cell = document.createElement('div');
    const isPhoto = hasFieldValue(f) && (
      isBase64ImageValue(String(f.val)) ||
      (isPhotoFieldKey(f.key) && String(f.val).length > 200)
    );
    cell.className = 'dossie-field dossie-tactical-cell' + (isPhoto ? ' dossie-field-photo-cell' : '');
    cell.innerHTML =
      '<div class="dossie-field-key">' + escHtml(formatFieldLabel(f.key)) + '</div>' +
      formatFieldValueHtml(f);
    grid.appendChild(cell);
  });
  return grid;
}

function createSourceSection(title, fields, muted) {
  const wrap = document.createElement('div');
  wrap.className = 'dossie-source-section' + (muted ? ' dossie-source-section-muted' : '');

  const head = document.createElement('div');
  head.className = 'dossie-source-head';
  head.innerHTML =
    '<span class="dossie-source-icon">' + FOLDER_SVG + '</span>' +
    '<span class="dossie-source-title">' + escHtml(title) + '</span>';
  wrap.appendChild(head);

  const inner = document.createElement('div');
  inner.className = 'dossie-source-inner';
  inner.appendChild(createFieldGrid(fields, muted));
  wrap.appendChild(inner);
  return wrap;
}

function renderDossiePanels() {
  const tabsNav = document.getElementById('dossie-tabs-nav');
  const content = document.getElementById('dossie-content');
  const box = document.getElementById('dossie-box');
  if (box) box.classList.remove('dossie-box-loading');
  dossieLoading = false;
  tabsNav.innerHTML = '';
  content.innerHTML = '';

  const successful = sortResultsByDataPriority(dossieResults.filter(isSearchSuccess));

  if (successful.length === 0) {
    if (box) {
      box.classList.add('dossie-box-empty');
      box.classList.remove('dossie-box-has-data');
    }
    tabsNav.style.display = 'none';
    const errRes = dossieResults.find(r => r && r.ok) || dossieResults[0];
    const isError = !!(errRes && !errRes.ok);
    const msg = errRes
      ? (isError ? getSearchErrorMessage(errRes) : getEmptySearchMessage(errRes))
      : 'Consulta concluída, porém a fonte não retornou dados.';
    content.innerHTML = '';
    content.appendChild(createDossieEmptyState(msg, isError));
    return;
  }

  if (box) {
    box.classList.remove('dossie-box-empty');
    box.classList.add('dossie-box-has-data');
  }

  tabsNav.style.display = 'none';

  const stack = document.createElement('div');
  stack.className = 'dossie-stack';

  successful.forEach((r, i) => {
    const panel = buildResultPanel(r, i);
    panel.className = 'dossie-stack-panel';
    stack.appendChild(panel);
  });

  content.appendChild(stack);
}

function openDossieLoading(queryLabel, iconSvg) {
  dossieResults = [];
  dossieLoading = true;
  dossieStreamMeta = { label: queryLabel || 'Consulta', icon: iconSvg || '' };

  clearTimeout(dossieLoadingTimer);
  dossieLoadingTimer = setTimeout(() => {
    if (!dossieLoading) return;
    dossieLoading = false;
    const content = document.getElementById('dossie-content');
    const box = document.getElementById('dossie-box');
    if (box) { box.classList.remove('dossie-box-loading'); box.classList.add('dossie-box-empty'); }
    if (content) content.innerHTML =
      '<div class="dossie-loading">' +
        '<p style="color:#f87171">Tempo limite atingido. Verifique sua conexão e tente novamente.</p>' +
      '</div>';
  }, 30000);

  const now = new Date();
  document.getElementById('dossie-datetime').textContent =
    'Data: ' + now.toLocaleDateString('pt-BR') + ', ' + now.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
  if (iconSvg) document.getElementById('dossie-hdr-icon').innerHTML = iconSvg;
  document.getElementById('dossie-hdr-title').textContent = dossieStreamMeta.label;

  const tabsNav = document.getElementById('dossie-tabs-nav');
  const content = document.getElementById('dossie-content');
  const box = document.getElementById('dossie-box');
  tabsNav.innerHTML = '';
  tabsNav.style.display = 'none';
  if (box) {
    box.classList.add('dossie-box-loading');
    box.classList.remove('dossie-box-has-data', 'dossie-box-empty');
  }
  content.innerHTML =
    '<div class="dossie-skeleton-wrap">' +
      '<div class="dossie-skeleton-card">' +
        '<div class="sk-line sk-title"></div>' +
        '<div class="sk-line sk-full"></div>' +
        '<div class="sk-line sk-med"></div>' +
        '<div class="sk-grid">' +
          '<div class="sk-cell"></div><div class="sk-cell"></div>' +
          '<div class="sk-cell"></div><div class="sk-cell"></div>' +
        '</div>' +
      '</div>' +
      '<div class="dossie-skeleton-card">' +
        '<div class="sk-line sk-title"></div>' +
        '<div class="sk-line sk-short"></div>' +
        '<div class="sk-line sk-full"></div>' +
        '<div class="sk-grid">' +
          '<div class="sk-cell"></div><div class="sk-cell"></div>' +
          '<div class="sk-cell"></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('dossie-overlay').classList.add('open');
}

function dossieIsLoading() {
  return dossieLoading;
}

function openDossie(results, queryLabel, iconSvg) {
  clearTimeout(dossieLoadingTimer);
  dossieResults = results.slice();
  dossieLoading = false;
  dossieStreamMeta = { label: queryLabel || 'Resultado da Consulta', icon: iconSvg || '' };

  const now = new Date();
  document.getElementById('dossie-datetime').textContent =
    'Data: ' + now.toLocaleDateString('pt-BR') + ', ' + now.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
  if (iconSvg) document.getElementById('dossie-hdr-icon').innerHTML = iconSvg;
  document.getElementById('dossie-hdr-title').textContent = dossieStreamMeta.label;

  requestAnimationFrame(() => renderDossiePanels());
  document.getElementById('dossie-overlay').classList.add('open');
}

function queueDossieRender() {
  if (dossieRenderQueued) return;
  dossieRenderQueued = true;
  requestAnimationFrame(() => {
    dossieRenderQueued = false;
    renderDossiePanels();
  });
}

function appendDossieResult(res) {
  if (!isSearchSuccess(res)) return;
  if (dossieResults.some(r => r.ep.id === res.ep.id)) return;
  dossieResults.push(res);
  queueDossieRender();
}

function buildResultPanel(result, idx) {
  const panel = document.createElement('div');
  const data = result.data;
  const root = getResultPayload(data);

  const block = document.createElement('div');
  block.className = 'dossie-alvo-block dossie-tactical-panel';
  block.appendChild(createAlvoHeader(idx, result.ep.label));

  const sections = splitPayloadIntoSections(root).slice().sort((a, b) => {
    const pa = partitionFields(a.fields);
    const pb = partitionFields(b.fields);
    const aHas = pa.withVal.length > 0 ? 0 : 1;
    const bHas = pb.withVal.length > 0 ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;
    return pb.withVal.length - pa.withVal.length;
  });

  const parts = [];
  let hasRendered = false;

  sections.forEach(sec => {
    const { withVal, nullFields } = partitionFields(sec.fields);
    if (!withVal.length && !nullFields.length) return;

    if (sec.title) {
      if (withVal.length) {
        parts.push({
          priority: 0,
          node: createSourceSection(sec.title, withVal, false),
        });
        hasRendered = true;
      }
      if (nullFields.length) {
        parts.push({
          priority: 1,
          node: createSourceSection(sec.title + ' — SEM DADOS', nullFields, true),
        });
      }
    } else {
      if (withVal.length) {
        const inner = document.createElement('div');
        inner.className = 'dossie-source-inner dossie-source-inner-primary';
        inner.appendChild(createFieldGrid(withVal, false));
        parts.push({ priority: 0, node: inner });
        hasRendered = true;
      }
      if (nullFields.length) {
        const innerMuted = document.createElement('div');
        innerMuted.className = 'dossie-source-inner dossie-source-inner-muted';
        const sub = document.createElement('div');
        sub.className = 'dossie-section-sub';
        sub.textContent = 'Campos sem dados (' + nullFields.length + ')';
        innerMuted.appendChild(sub);
        innerMuted.appendChild(createFieldGrid(nullFields, true));
        parts.push({ priority: 1, node: innerMuted });
      }
    }
  });

  parts
    .sort((a, b) => a.priority - b.priority)
    .forEach(p => block.appendChild(p.node));

  if (!hasRendered) {
    const msg = getEmptySearchMessage({ ok: true, data: data });
    block.appendChild(createDossieEmptyState(msg, false));
  }

  panel.appendChild(block);
  return panel;
}

function closeDossie() {
  clearTimeout(dossieLoadingTimer);
  dossieLoading = false;
  document.getElementById('dossie-overlay').classList.remove('open');
}

window.openDossieLoading = openDossieLoading;
window.dossieIsLoading = dossieIsLoading;
window.openDossie = openDossie;
window.closeDossie = closeDossie;
window.dossieAction = dossieAction;
window.appendDossieResult = appendDossieResult;
window.isSearchSuccess = isSearchSuccess;
window.getSearchErrorMessage = getSearchErrorMessage;
window.getEmptySearchMessage = getEmptySearchMessage;
window.getResultPayload = getResultPayload;

function dossieAction(type) {
  const allText = dossieResults.map(r =>
    '=== ' + r.ep.label.toUpperCase() + ' ===\n' + JSON.stringify(r.data, null, 2)
  ).join('\n\n');

  if (type === 'copy') {
    navigator.clipboard.writeText(allText).then(() => {
      const btn = document.querySelector('.dossie-btn-copy');
      const orig = btn.innerHTML;
      btn.textContent = '✓ Copiado';
      setTimeout(() => btn.innerHTML = orig, 1800);
      if (typeof showToast === 'function') showToast('Resultado copiado para a área de transferência');
    });
  } else if (type === 'txt') {
    const blob = new Blob([allText], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'buscasdasorte_resultado.txt';
    a.click();
    if (typeof showToast === 'function') showToast('Arquivo TXT gerado e baixado');
  } else if (type === 'pdf') {
    const s = 'body{font-family:monospace;background:#020604;color:#4ade80;padding:32px;font-size:13px;line-height:1.7}h1{color:#ecfdf5;margin-bottom:16px}p{color:rgba(107,158,122,0.8);margin-bottom:16px}pre{white-space:pre-wrap;word-break:break-all}';
    const d = new Date().toLocaleString('pt-BR');
    const t = allText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const pwin = window.open('', '_blank');
    pwin.document.open();
    pwin.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BuscasDasorte<\/title><style>' + s + '<\/style><\/head><body><h1>BuscasDasorte<\/h1><p>Data: ' + d + '<\/p><pre>' + t + '<\/pre><\/body><\/html>');
    pwin.document.close();
    pwin.print();
    if (typeof showToast === 'function') showToast('PDF aberto para impressão');
  }
}
