// MODAL DE CONSULTA — Snoop Intelligence API v2
// Cada módulo = 1 endpoint. O modal renderiza os campos definidos em `fields`
// e monta a rota via `path(v)`, onde `v` é um objeto { <campo>: valor }.
// Ícones reutilizados por getModuleIcon() em modules.js.

// Helpers de sanitização de valor
const _d   = s => String(s || '').replace(/\D/g, '');            // só dígitos
const _enc = s => encodeURIComponent(String(s || '').trim());     // texto livre
const _plc = s => String(s || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); // placa

// Ícones (SVG interno)
const IC = {
  cpf:    '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/>',
  nome:   '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  tel:    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.09 3h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.09 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  rg:     '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M2 17l4-4 4 4"/><line x1="14" y1="9" x2="20" y2="9"/><line x1="14" y1="13" x2="18" y2="13"/>',
  doc:    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  users:  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  home:   '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  pin:    '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  map:    '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  mail:   '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  hash:   '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  bars:   '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
  money:  '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  brief:  '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  card:   '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  bank:   '<path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  plate:  '<rect x="2" y="7" width="20" height="10" rx="2"/><line x1="6" y1="11" x2="6" y2="13"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="18" y1="11" x2="18" y2="13"/>',
  signal: '<path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.48"/><path d="M16.24 7.76a6 6 0 0 1 0 8.48"/><circle cx="12" cy="12" r="1.5"/>',
  dice:   '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.3"/><circle cx="15.5" cy="15.5" r="1.3"/><circle cx="15.5" cy="8.5" r="1.3"/><circle cx="8.5" cy="15.5" r="1.3"/>',
  car:    '<rect x="1" y="8" width="22" height="10" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>',
  geo:    '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  work:   '<path d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/><line x1="12" y1="12" x2="12" y2="12"/>',
};

// Campos reutilizáveis
const F = {
  cpf:   { name: 'cpf',   label: 'CPF',        ph: '000.000.000-00', mask: 'cpf', sane: _d },
  nome:  { name: 'nome',  label: 'Nome',       ph: 'Nome completo',              sane: _enc },
  tel:   { name: 'tel',   label: 'Telefone',   ph: '(00) 00000-0000', mask: 'tel', sane: _d },
  cep:   { name: 'cep',   label: 'CEP',        ph: '00000-000', mask: 'cep', sane: _d },
  placa: { name: 'placa', label: 'Placa',      ph: 'ABC1234', mask: 'placa', sane: _plc },
  uf:    { name: 'uf',    label: 'UF',         ph: 'SP', upper: true, sane: s => _enc(String(s).toUpperCase().slice(0,2)) },
};

// Registro de módulos Snoop.  path(v) recebe os valores já saneados.
const MODAL_CONFIG = {
  // ── Consultas Básicas ──────────────────────────────────────────────
  cpf:   { title: 'Consulta CPF', sub: 'Dados completos por CPF', icon: IC.cpf, fields: [F.cpf], path: v => `/api/v2/generic/cpf?cpf=${v.cpf}` },
  nome:  { title: 'Consulta por Nome', sub: 'Busca por nome completo', icon: IC.nome, fields: [F.nome], path: v => `/api/v2/nome?nome=${v.nome}` },
  tel:   { title: 'Consulta Telefone', sub: 'Dados por número de telefone', icon: IC.tel, fields: [F.tel], path: v => `/api/v2/telefone?telefone=${v.tel}` },

  // ── Documentos ─────────────────────────────────────────────────────
  rg:     { title: 'Consulta RG', sub: 'Dados por número do RG', icon: IC.rg, fields: [{ name: 'rg', label: 'RG', ph: 'Número do RG', sane: _d }], path: v => `/api/v2/rg?rg=${v.rg}` },
  titulo: { title: 'Título de Eleitor', sub: 'Dados por título de eleitor', icon: IC.doc, fields: [{ name: 'titulo', label: 'Título', ph: 'Número do título', sane: _d }], path: v => `/api/v2/titulo?titulo=${v.titulo}` },
  pis:    { title: 'Consulta PIS', sub: 'Dados por PIS', icon: IC.doc, fields: [{ name: 'pis', label: 'PIS', ph: 'Número do PIS', sane: _d }], path: v => `/api/v2/pis?pis=${v.pis}` },
  nis:    { title: 'Consulta NIS', sub: 'Dados por NIS', icon: IC.doc, fields: [{ name: 'nis', label: 'NIS', ph: 'Número do NIS', sane: _d }], path: v => `/api/v2/nis?nis=${v.nis}` },

  // ── Relações ───────────────────────────────────────────────────────
  parentes: { title: 'Parentes', sub: 'Vínculos familiares por CPF', icon: IC.users, fields: [F.cpf], path: v => `/api/v2/parentes?cpf=${v.cpf}` },
  vizinhos: { title: 'Vizinhos', sub: 'Vizinhos por CPF', icon: IC.home, fields: [F.cpf], path: v => `/api/v2/vizinhos?cpf=${v.cpf}` },

  // ── Localização ────────────────────────────────────────────────────
  cep:   { title: 'Consulta CEP', sub: 'Endereço por CEP', icon: IC.pin, fields: [F.cep], path: v => `/api/v2/cep?cep=${v.cep}` },
  cep2:  { title: 'Consulta CEP (2)', sub: 'Base alternativa por CEP', icon: IC.pin, fields: [F.cep], path: v => `/api/v2/cep2?cep=${v.cep}` },
  cep3:  { title: 'Consulta CEP (3)', sub: 'Base alternativa por CEP', icon: IC.pin, fields: [F.cep], path: v => `/api/v2/cep3?cep=${v.cep}` },
  cep4:  { title: 'Consulta CEP (4)', sub: 'CEP + nome', icon: IC.pin, fields: [F.cep, F.nome], path: v => `/api/v2/cep4?cep=${v.cep}&nome=${v.nome}` },
  endereco: { title: 'Consulta Endereço', sub: 'Por UF e logradouro', icon: IC.map, fields: [F.uf, { name: 'logradouro', label: 'Logradouro', ph: 'RUA EXEMPLO', sane: _enc }], path: v => `/api/v2/endereco?uf=${v.uf}&logradouro=${v.logradouro}` },
  estado: { title: 'Consulta por Estado', sub: 'Registros por UF', icon: IC.map, fields: [F.uf], path: v => `/api/v2/estado?uf=${v.uf}` },

  // ── Busca por Nome (variações) ─────────────────────────────────────
  nome2: { title: 'Nome (base 2)', sub: 'Busca alternativa por nome', icon: IC.nome, fields: [F.nome], path: v => `/api/v2/nome2?nome=${v.nome}` },
  nome3: { title: 'Nome (base 3)', sub: 'Busca alternativa por nome', icon: IC.nome, fields: [F.nome], path: v => `/api/v2/nome3?nome=${v.nome}` },
  nome4: { title: 'Nome (base 4)', sub: 'Busca alternativa por nome', icon: IC.nome, fields: [F.nome], path: v => `/api/v2/nome4?nome=${v.nome}` },
  nome5: { title: 'Nome (base 5)', sub: 'Busca alternativa por nome', icon: IC.nome, fields: [F.nome], path: v => `/api/v2/nome5?nome=${v.nome}` },

  // ── Contato ────────────────────────────────────────────────────────
  email:     { title: 'Consulta E-mail', sub: 'Busca reversa por e-mail', icon: IC.mail, fields: [{ name: 'email', label: 'E-mail', ph: 'email@exemplo.com', sane: _enc }], path: v => `/api/v2/email?email=${v.email}` },
  'tel-ddd': { title: 'Telefones por DDD', sub: 'Lista por DDD', icon: IC.tel, fields: [{ name: 'ddd', label: 'DDD', ph: '11', sane: _d }], path: v => `/api/v2/telefone/ddd?ddd=${v.ddd}` },
  'tel-full':{ title: 'Telefone (Full)', sub: 'Dados completos por telefone', icon: IC.tel, fields: [F.tel], path: v => `/api/v2/telefone/full?phone=${v.tel}` },
  'tel-cpf': { title: 'Telefones por CPF', sub: 'Telefones vinculados ao CPF', icon: IC.tel, fields: [F.cpf], path: v => `/api/v2/telefone/cpf?cpf=${v.cpf}` },

  // ── Financeiro ─────────────────────────────────────────────────────
  score: { title: 'Consulta Score', sub: 'Score de crédito por CPF', icon: IC.bars, fields: [F.cpf], path: v => `/api/v2/score?cpf=${v.cpf}` },
  renda: { title: 'Consulta Renda', sub: 'Faixa de renda (min/max)', icon: IC.money, fields: [{ name: 'min', label: 'Mínimo', ph: '3000', sane: _d }, { name: 'max', label: 'Máximo', ph: '15000', sane: _d }], path: v => `/api/v2/renda?min=${v.min}&max=${v.max}&limit=10` },
  cbo:   { title: 'Consulta CBO', sub: 'Ocupação por código CBO', icon: IC.work, fields: [{ name: 'cbo', label: 'CBO', ph: '2231', sane: _d }], path: v => `/api/v2/cbo?cbo=${v.cbo}` },
  profissao: { title: 'Consulta Profissão', sub: 'Por código de profissão', icon: IC.work, fields: [{ name: 'profissao', label: 'Profissão', ph: '2231', sane: _d }], path: v => `/api/v2/profissao?profissao=${v.profissao}` },
  bin:   { title: 'Consulta BIN', sub: 'Dados do cartão por BIN', icon: IC.card, fields: [{ name: 'bin', label: 'BIN', ph: '123456', sane: _d }], path: v => `/api/v2/bin?bin=${v.bin}` },
  banco: { title: 'Consulta Banco', sub: 'Por código do banco', icon: IC.bank, fields: [{ name: 'codigo', label: 'Código', ph: '001', sane: _d }], path: v => `/api/v2/banco?codigo=${v.codigo}` },

  // ── Fotos ──────────────────────────────────────────────────────────
  foto:      { title: 'Foto', sub: 'Foto cadastral por CPF', icon: IC.camera, fields: [F.cpf], path: v => `/api/v2/foto?cpf=${v.cpf}` },
  'foto-all':{ title: 'Foto (todas as bases)', sub: 'Todas as fotos por CPF', icon: IC.camera, fields: [F.cpf], path: v => `/api/v2/foto/all?cpf=${v.cpf}` },
  'foto-sp': { title: 'Foto (Base SP)', sub: 'Foto SP por CPF', icon: IC.camera, fields: [F.cpf], path: v => `/api/v1/sp/cpf?cpf=${v.cpf}` },
  'foto-ma': { title: 'Foto (Base MA)', sub: 'Foto MA por CPF', icon: IC.camera, fields: [F.cpf], path: v => `/api/v1/ma/cpf?cpf=${v.cpf}` },
  'foto-ro': { title: 'Foto (Base RO)', sub: 'Foto RO por CPF', icon: IC.camera, fields: [F.cpf], path: v => `/api/v1/ro/cpf?cpf=${v.cpf}` },

  // ── Veículos e Outros ──────────────────────────────────────────────
  placa:     { title: 'Consulta Placa', sub: 'Dados do veículo por placa', icon: IC.plate, fields: [F.placa], path: v => `/api/v2/placa?placa=${v.placa}` },
  operadora: { title: 'Consulta Operadora', sub: 'Operadora por telefone', icon: IC.signal, fields: [F.tel], path: v => `/api/v2/operadora?telefone=${v.tel}` },
  random:    { title: 'Registro Aleatório', sub: 'Amostra aleatória (UF opcional)', icon: IC.dice, fields: [{ name: 'uf', label: 'UF (opcional)', ph: 'SP', optional: true, sane: s => _enc(String(s).toUpperCase().slice(0,2)) }], path: v => v.uf ? `/api/v2/random?uf=${v.uf}` : `/api/v2/random` },

  // ── Profissional & Veículos ────────────────────────────────────────
  profissionais: { title: 'Profissionais', sub: 'Lista por profissão', icon: IC.work, fields: [{ name: 'profissao', label: 'Profissão', ph: 'MEDICO', sane: _enc }], path: v => `/api/v2/profissionais?profissao=${v.profissao}&limit=10` },
  'veiculos-jbr': { title: 'Veículos (JBR)', sub: 'Base JBR por placa', icon: IC.car, fields: [F.placa], path: v => `/api/v2/veiculos/jbr?placa=${v.placa}` },
  geo:   { title: 'Geolocalização', sub: 'Coordenadas por CEP', icon: IC.geo, fields: [F.cep], path: v => `/api/v2/geo?cep=${v.cep}&limit=10` },
};

let currentModalKey = null;

function openModal(key) {
  const cfg = MODAL_CONFIG[key];
  if (!cfg) return;
  currentModalKey = key;

  document.getElementById('modal-icon').innerHTML = cfg.icon;
  document.getElementById('modal-title').textContent = cfg.title;
  document.getElementById('modal-sub').textContent = cfg.sub || 'Preencha o campo abaixo para buscar';

  // Renderiza os campos do módulo dentro do wrap
  const wrap = document.getElementById('modal-input-wrap');
  wrap.innerHTML = cfg.fields.map((f, i) => {
    const ml = f.mask ? ` data-mask="${f.mask}"` : '';
    const up = f.upper ? ' style="text-transform:uppercase"' : '';
    return `<input class="modal-input" id="modal-f-${f.name}" type="text" placeholder="${f.ph || 'Digite aqui...'}"${ml}${up} autocomplete="off"${i === 0 ? '' : ' style="margin-top:8px"'}/>`;
  }).join('');

  // Liga máscara e Enter para cada input
  cfg.fields.forEach(f => {
    const el = document.getElementById('modal-f-' + f.name);
    if (!el) return;
    if (f.mask) el.addEventListener('input', function () { applyMask(this, f.mask); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') runModalSearch(); });
  });

  document.getElementById('modal-overlay').classList.add('open');
  const first = document.getElementById('modal-f-' + cfg.fields[0].name);
  setTimeout(() => first && first.focus(), 120);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  currentModalKey = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

function runModalSearch() {
  const key = currentModalKey;
  const cfg = MODAL_CONFIG[key];
  if (!cfg) return;

  // Coleta e valida os valores dos campos
  const values = {};
  let firstRaw = '';
  for (const f of cfg.fields) {
    const el = document.getElementById('modal-f-' + f.name);
    const raw = el ? el.value.trim() : '';
    if (!raw && !f.optional) {
      if (el) {
        el.focus();
        el.style.borderColor = 'rgba(255,69,58,0.5)';
        setTimeout(() => (el.style.borderColor = ''), 1000);
      }
      return;
    }
    if (!firstRaw && raw) firstRaw = raw;
    values[f.name] = f.sane ? f.sane(raw) : raw;
  }

  closeModal();
  runModuleSearch(key, cfg, values, firstRaw);
}

// Executa a consulta primária e, se um CPF for encontrado, enriquece o dossiê.
async function runModuleSearch(key, cfg, values, term) {
  const label = cfg.title;
  const icon = cfg.icon;
  const ep = { id: key, label, path: cfg.path(values) };

  const area = document.getElementById('result-area');
  if (area) area.innerHTML = '';
  if (typeof openDossieLoading === 'function') openDossieLoading(label.toUpperCase(), icon);

  let primary;
  try {
    primary = await fetchComTimeout(ep);
  } catch (e) {
    primary = { ep, ok: false, status: 0, data: { error: 'Erro na consulta.' } };
  }

  const ok = (typeof isSearchSuccess === 'function') ? isSearchSuccess(primary) : !!primary.ok;
  if (typeof openDossie === 'function') openDossie([primary], label.toUpperCase(), icon);

  if (term && typeof SearchHistory !== 'undefined') {
    try { SearchHistory.record({ term: term, field: key, label: label, count: ok ? 1 : 0 }); } catch (_) {}
  }

  // Se veio uma lista de pessoas (homônimos), o dossiê mostra a lista clicável
  // e NÃO enriquece automaticamente. Senão, puxa o perfil completo por CPF.
  if (ok) {
    const payload = (typeof getResultPayload === 'function') ? getResultPayload(primary.data) : primary.data;
    const list = (typeof detectRecordList === 'function') ? detectRecordList(payload) : null;
    if (!(list && list.length >= 2)) {
      let cpf = (values.cpf && values.cpf.length === 11) ? values.cpf : extractCpfFromData(primary.data);
      if (cpf && cpf.length === 11) enrichFromCpf(cpf, key);
    }
  }
}

// Abre o perfil completo de um CPF (ao clicar num item da lista de pessoas).
function consultarCpf(cpf) {
  const clean = String(cpf).replace(/\D/g, '');
  if (clean.length !== 11) return;
  const cfg = MODAL_CONFIG.cpf;
  if (cfg) runModuleSearch('cpf', cfg, { cpf: clean }, clean);
}
if (typeof window !== 'undefined') window.consultarCpf = consultarCpf;

// Endpoints por CPF disparados no enriquecimento (sequencial, para nao bater
// no limite de "consultas simultaneas de CPF" da Snoop).
const CPF_ENRICH_KEYS = ['cpf', 'parentes', 'vizinhos', 'tel-cpf', 'foto'];

async function enrichFromCpf(cpf, primaryKey) {
  for (const k of CPF_ENRICH_KEYS) {
    if (k === primaryKey) continue;
    const cfg = MODAL_CONFIG[k];
    if (!cfg) continue;
    const ep = { id: k, label: cfg.title, path: cfg.path({ cpf }) };
    try {
      const res = await fetchComTimeout(ep);
      if (typeof appendDossieResult === 'function') appendDossieResult(res);
    } catch (_) { /* ignora falha de um endpoint */ }
    await new Promise(r => setTimeout(r, 350));
  }
}

// Procura um CPF (11 digitos em campo cuja chave contem "cpf") no resultado.
function extractCpfFromData(data) {
  const payload = (typeof getResultPayload === 'function')
    ? getResultPayload(data)
    : (data && (data.body || data.data || data));
  if (!payload || typeof payload !== 'object') return null;

  function scan(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 6) return null;
    if (Array.isArray(obj)) {
      for (const it of obj) { const r = scan(it, depth + 1); if (r) return r; }
      return null;
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string' || typeof v === 'number') {
        const digits = String(v).replace(/\D/g, '');
        const kl = k.toLowerCase();
        if (digits.length === 11 && (kl.includes('cpf') || kl === 'documento' || kl === 'doc')) {
          return digits;
        }
      } else if (v && typeof v === 'object') {
        const found = scan(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return scan(payload, 0);
}

// Mantido para compatibilidade (buscas diretas por lista de endpoints).
function runDirectSearch(eps, label, iconSvg) {
  const area = document.getElementById('result-area');
  if (area) area.innerHTML = '';
  runSearchBatch(eps, { label: String(label).toUpperCase(), icon: iconSvg });
}
