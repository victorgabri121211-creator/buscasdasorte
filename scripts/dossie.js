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
  // Snoop Intelligence
  all_addresses: 'OUTROS ENDEREÇOS',
  serasa_completo: 'SERASA COMPLETO',
  poder_aquisitivo: 'PODER AQUISITIVO',
  data_coverage: 'COBERTURA DE DADOS',
  data_quality: 'QUALIDADE DOS DADOS',
  contact_summary: 'RESUMO DE CONTATO',
  social_class: 'CLASSE SOCIAL',
  completeness: 'COMPLETUDE',
  parentes: 'PARENTES',
  vizinhos: 'VIZINHOS',
  emails: 'E-MAILS',
  sources: 'FONTES',
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
  // Snoop Intelligence (sobrescreve/estende os acima)
  name: 'NOME',
  first_name: 'PRIMEIRO NOME',
  last_name: 'SOBRENOME',
  cpf_masked: 'CPF',
  cpfmask: 'CPF',
  birth_date: 'NASCIMENTO',
  birth_city: 'CIDADE NATAL',
  income: 'RENDA',
  income_bracket: 'FAIXA DE RENDA',
  federal_status: 'SITUAÇÃO NA RECEITA',
  death_flag: 'ÓBITO',
  death_date: 'DATA DE ÓBITO',
  deceased: 'FALECIDO',
  occupation: 'OCUPAÇÃO',
  cbo: 'CBO',
  rg_issuer: 'ÓRGÃO EMISSOR (RG)',
  rg_state: 'UF DO RG',
  voter_id: 'TÍTULO DE ELEITOR',
  cns: 'CNS (CARTÃO SUS)',
  mosaic: 'MOSAIC',
  mosaic_new: 'MOSAIC',
  social_class: 'CLASSE SOCIAL',
  sub_social_class: 'SUBCLASSE SOCIAL',
  marital_status: 'ESTADO CIVIL',
  nationality: 'NACIONALIDADE',
  street: 'LOGRADOURO',
  number: 'NÚMERO',
  complement: 'COMPLEMENTO',
  neighborhood: 'BAIRRO',
  city: 'CIDADE',
  state: 'UF',
  uf: 'UF',
  zip_code: 'CEP',
  type: 'TIPO',
  source: 'FONTE',
  count: 'QUANTIDADE',
  value: 'VALOR',
  range: 'FAIXA',
  marca: 'MARCA',
  modelo: 'MODELO',
  cor: 'COR',
  ano: 'ANO',
  proprietario: 'PROPRIETÁRIO',
  cpf_cnpj: 'CPF/CNPJ',
  operadora: 'OPERADORA',
  poder_aquisitivo: 'PODER AQUISITIVO',
  renda_poder_aquisitivo: 'RENDA ESTIMADA',
  fx_poder_aquisitivo: 'FAIXA DE PODER AQUISITIVO',
  parentes: 'PARENTES',
  vizinhos: 'VIZINHOS',
  pis: 'PIS',
  tse: 'TÍTULO (TSE)',
  status_date: 'DATA DA SITUAÇÃO',
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
  // Snoop API: os dados vêm em { statusCode, body: { ... } }
  if (data.body != null && typeof data.body === 'object') return data.body;
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
  // Snoop pode responder HTTP 200 com erro no corpo (statusCode >= 400)
  if (typeof res.data.statusCode === 'number' && res.data.statusCode >= 400) return false;
  return payloadHasValues(getResultPayload(res.data));
}

function getSearchErrorMessage(res) {
  if (!res) return 'Não foi possível concluir a consulta. Tente novamente.';
  const d = res.data || {};
  const status = Number(res.status) || Number(d.statusCode) || 0;
  const raw = String(d.error || d.message || d.detail || '').toLowerCase();

  // Sem conexão / tempo esgotado (status 0 = falha de rede ou timeout)
  if (status === 0) {
    if (raw.indexOf('timeout') !== -1 || raw.indexOf('demor') !== -1) {
      return 'A consulta demorou mais que o esperado. Tente novamente.';
    }
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }

  // Limite de consultas (a API permite ~1 por minuto por tipo)
  if (status === 429) {
    return 'Muitas consultas em pouco tempo. Aguarde cerca de 1 minuto e tente de novo.';
  }

  // Serviço de consultas fora do ar: erros 5xx e erros de origem do
  // Cloudflare (ex.: "error code: 1016") caem aqui.
  if (status >= 500 || raw.indexOf('1016') !== -1 || raw.indexOf('indispon') !== -1) {
    return 'Serviço de consultas temporariamente indisponível. Tente novamente em alguns minutos.';
  }

  // Não autorizado (ex.: chave da API com problema)
  if (status === 401 || status === 403) {
    return 'A consulta não foi autorizada no momento. Se continuar, avise o administrador.';
  }

  // Erros de validação (400/422): a mensagem da API costuma ser útil (ex.: "CPF inválido")
  if (status === 400 || status === 422) {
    return d.message || d.error || 'Dados inválidos. Confira o que foi digitado e tente novamente.';
  }

  // Não encontrado
  if (status === 404) {
    return 'Nenhum dado encontrado para os dados informados.';
  }

  // A API respondeu, mas sem dados
  if (d.success === false) {
    return d.message || d.error || 'A fonte não retornou dados para esta consulta.';
  }

  // Falha genérica: não expõe código técnico ao usuário
  if (!res.ok) {
    return 'Não foi possível concluir a consulta. Tente novamente em instantes.';
  }

  return 'Nenhum dado encontrado para os dados informados.';
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

  // Mantém a ordem de inserção: consulta primária primeiro, depois o
  // enriquecimento (parentes/vizinhos/telefone/foto) na sequência em que chega.
  const successful = dossieResults.filter(isSearchSuccess);

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

  requestAnimationFrame(() => {
    renderDossiePanels();
    const body = document.getElementById('dossie-body');
    if (body) body.scrollTop = 0;
  });
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

// ── Lista de pessoas (multiplos resultados: nome, parentes, vizinhos...) ──
const REC_NAME_KEYS  = ['nome', 'name', 'nome_completo', 'full_name', 'razao_social', 'nomecompleto'];
const REC_BIRTH_KEYS = ['nascimento', 'birth_date', 'data_nascimento', 'dt_nascimento', 'nasc', 'data_nasc', 'birthdate', 'dt_nasc'];
const REC_REL_KEYS   = ['parentesco', 'relacao', 'vinculo', 'grau', 'relationship'];

function recFindCpf(rec) {
  if (!rec || typeof rec !== 'object') return null;
  for (const k of Object.keys(rec)) {
    const kl = k.toLowerCase();
    const v = rec[k];
    if ((kl.includes('cpf') || kl === 'documento' || kl === 'doc') && (typeof v === 'string' || typeof v === 'number')) {
      const d = String(v).replace(/\D/g, '');
      if (d.length === 11) return d;
    }
  }
  return null;
}

function pickRecordField(rec, keys) {
  if (!rec || typeof rec !== 'object') return null;
  const lower = {};
  Object.keys(rec).forEach(k => { lower[k.toLowerCase()] = rec[k]; });
  for (const key of keys) {
    const v = lower[key];
    if (v != null && v !== '' && typeof v !== 'object') return String(v);
  }
  return null;
}

// Retorna um array de registros (com CPF) se o payload for uma lista de pessoas.
function detectRecordList(payload) {
  if (!payload || typeof payload !== 'object') return null;
  let arr = null;
  if (Array.isArray(payload)) {
    arr = payload;
  } else {
    const cands = ['results', 'result', 'data', 'list', 'items', 'pessoas', 'registros', 'matches', 'records', 'rows', 'lista', 'resultados'];
    for (const c of cands) { if (Array.isArray(payload[c])) { arr = payload[c]; break; } }
    if (!arr) {
      for (const k of Object.keys(payload)) {
        const v = payload[k];
        if (Array.isArray(v) && v.length && typeof v[0] === 'object' && recFindCpf(v[0])) { arr = v; break; }
      }
    }
  }
  if (!arr || !arr.length) return null;
  const objs = arr.filter(x => x && typeof x === 'object' && !Array.isArray(x));
  if (!objs.length || !objs.some(recFindCpf)) return null;
  return objs;
}

function formatCpfMask(d) {
  const s = String(d).replace(/\D/g, '');
  if (s.length !== 11) return String(d);
  return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function createRecordListView(items) {
  const wrap = document.createElement('div');
  wrap.className = 'dossie-source-inner';

  const head = document.createElement('div');
  head.className = 'dossie-section-sub';
  head.style.marginBottom = '10px';
  head.textContent = items.length + (items.length === 1 ? ' pessoa encontrada' : ' pessoas encontradas') +
    ' — clique para ver o perfil completo';
  wrap.appendChild(head);

  items.forEach(rec => {
    const cpf  = recFindCpf(rec);
    const nome = pickRecordField(rec, REC_NAME_KEYS) || '—';
    const nasc = pickRecordField(rec, REC_BIRTH_KEYS);
    const rel  = pickRecordField(rec, REC_REL_KEYS);

    let meta = 'CPF: ' + (cpf ? formatCpfMask(cpf) : '—');
    if (nasc) meta += '  •  Nasc.: ' + nasc;
    if (rel)  meta += '  •  ' + rel;

    const card = document.createElement('div');
    card.style.cssText = 'display:flex;flex-direction:column;gap:3px;padding:12px 14px;margin-bottom:8px;' +
      'border:1px solid rgba(48,209,88,0.18);border-radius:12px;background:rgba(48,209,88,0.04);' +
      (cpf ? 'cursor:pointer;transition:background .15s;' : '');
    card.innerHTML =
      '<div style="font-weight:600;font-size:14px;color:#fff">' + escHtml(nome) + '</div>' +
      '<div style="font-size:12px;color:rgba(255,255,255,0.55)">' + escHtml(meta) + '</div>' +
      (cpf ? '<div style="font-size:11px;color:#30d158;margin-top:2px">Ver perfil completo →</div>' : '');
    if (cpf) {
      card.addEventListener('click', () => { if (typeof consultarCpf === 'function') consultarCpf(cpf); });
      card.addEventListener('mouseenter', () => { card.style.background = 'rgba(48,209,88,0.1)'; });
      card.addEventListener('mouseleave', () => { card.style.background = 'rgba(48,209,88,0.04)'; });
    }
    wrap.appendChild(card);
  });
  return wrap;
}

function buildResultPanel(result, idx) {
  const panel = document.createElement('div');
  const data = result.data;
  const root = getResultPayload(data);

  const block = document.createElement('div');
  block.className = 'dossie-alvo-block dossie-tactical-panel';
  block.appendChild(createAlvoHeader(idx, result.ep.label));

  // Multiplos resultados (homonimos, parentes, vizinhos): lista clicavel.
  const recList = detectRecordList(root);
  if (recList && recList.length >= 2) {
    block.appendChild(createRecordListView(recList));
    panel.appendChild(block);
    return panel;
  }

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
window.detectRecordList = detectRecordList;

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
