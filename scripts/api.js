// API & ENDPOINTS
// A API Key principal está no Cloudflare Worker (não no navegador).
// Veja worker.js para configuração.
const PROXY = 'https://ancient-glitter-ad86.victorgabri121211.workers.dev';

// ── Crachá de acesso (token do worker) ──────────────────────────────────────
// Emitido no login (usuário logado + plano ativo) e enviado em toda consulta.
// O worker valida antes de chamar a API paga. Sem token válido (em modo
// estrito) a consulta é recusada.
const AUTH_TOKEN_KEY = 'bds_auth_token';
let _authToken = null;
try { _authToken = localStorage.getItem(AUTH_TOKEN_KEY) || null; } catch (e) {}

function _setAuthToken(t) {
  _authToken = t || null;
  try {
    if (t) localStorage.setItem(AUTH_TOKEN_KEY, t);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {}
}

// Emite um token no login. adminHash para o admin; senha para os demais.
async function authMint(username, password, adminHash) {
  try {
    const body = adminHash ? { username: username, adminHash: adminHash }
                           : { username: username, password: password };
    const r = await fetch(PROXY + '/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const d = await r.json().catch(() => null);
    if (d && d.ok && d.token) { _setAuthToken(d.token); return true; }
  } catch (e) {}
  return false;
}

// Renova o token (sem senha) usando o token atual; reconfirma o plano no worker.
async function authRefresh() {
  if (!_authToken) return false;
  try {
    const r = await fetch(PROXY + '/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: _authToken })
    });
    const d = await r.json().catch(() => null);
    if (d && d.ok && d.token) { _setAuthToken(d.token); return true; }
    if (r.status === 401) _setAuthToken(null);
  } catch (e) {}
  return false;
}

function authLogout() { _setAuthToken(null); }

// Sessão antiga sem crachá (logada antes do sistema de token): re-emite
// silenciosamente com as credenciais guardadas neste dispositivo, sem exigir
// que o usuário saia e entre de novo.
async function authEnsure() {
  if (_authToken) return true;
  let user = null;
  try { user = localStorage.getItem('bds_session'); } catch (e) {}
  if (!user) return false;
  try {
    if (user === atob('RGFzb3J0ZQ==')) {
      const h = localStorage.getItem('bds_admin_h');
      return h ? await authMint(user, null, h) : false;
    }
    const users = JSON.parse(localStorage.getItem('bds_users')) || [];
    const rec = users.find(function (u) { return u.user === user && u.pass && u.pass !== '(supabase)'; });
    if (rec) return await authMint(user, rec.pass, null);
  } catch (e) {}
  return false;
}

if (typeof window !== 'undefined') {
  window.Auth = { mint: authMint, refresh: authRefresh, ensure: authEnsure, logout: authLogout, getToken: function () { return _authToken; } };
  // Ao carregar com sessão já ativa, renova (ou re-emite) o crachá em background.
  try { setTimeout(function () { if (_authToken) authRefresh(); else authEnsure(); }, 800); } catch (e) {}
}
const CONSULT_TIPOS = ['serasa','spc','receita','tse','denatran'];
const FETCH_TIMEOUT_MS = 20000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const PREFETCH_DEBOUNCE_MS = 180;

const responseCache = new Map();
const inflightRequests = new Map();
let prefetchTimer = null;
let modalPrefetchTimer = null;

function isHorarioComercial() {
  const d=new Date(),day=d.getDay(),h=d.getHours();
  return day>=1&&day<=5&&h>=8&&h<18;
}

function cacheKey(path, suffix) { return path + '\0' + suffix; }

/** Retorna os headers a enviar para o proxy conforme o tipo de endpoint. */
function getHeadersForEp(ep) {
  // Main endpoints: sem chave (o Cloudflare Worker injeta a API Key automaticamente)
  // Negativação: envia a chave do usuário via X-Negativ-Key
  const h = {};
  if (ep.isNegativacao) {
    const nk = getNegativKey();
    if (nk) h['X-Negativ-Key'] = nk;
  }
  // Crachá de acesso: o worker exige (em modo estrito) para liberar a consulta.
  if (_authToken) h['Authorization'] = 'Bearer ' + _authToken;
  return h;
}

/** A API não expõe /search/email/{@}. E-mails vêm por CPF via Consult Center. */
function appendEmailEndpoints(eps, cpfDigits) {
  if (!cpfDigits || cpfDigits.length !== 11) return;
  const hc = !isHorarioComercial();
  eps.push({
    id: 'email',
    label: 'E-mails',
    path: `/api/v1/search/consultcenter/emails/cpf/${cpfDigits}`,
    serasaLocked: hc,
    serasaNote: hc,
  });
}

function getEmailFieldEndpoints(raw) {
  const v = (raw || '').trim();
  if (!v) return [];
  if (v.includes('@')) {
    return [{
      id: 'email',
      label: 'E-mail',
      unsupported: true,
      unsupportedMsg:
        'Busca por endereço de e-mail (@) não existe nesta API (erro 404). ' +
        'Use o CPF: a consulta CPF completa já traz o campo E-mail, ou informe o CPF no campo E-mail (Consult Center, seg–sex 8h–18h).',
    }];
  }
  const cpf = v.replace(/\D/g, '');
  const out = [];
  if (cpf.length === 11) appendEmailEndpoints(out, cpf);
  else if (v) {
    out.push({
      id: 'email',
      label: 'E-mail',
      unsupported: true,
      unsupportedMsg: 'Informe um CPF com 11 dígitos para consultar e-mails vinculados.',
    });
  }
  return out;
}

const FOTO_STATES_CPF = ['ac','al','am','ap','ba','ce','df','es','go','ma','mg','ms','mt','pa','pb','pi','pr','rj','rn','ro','rr','rs','sc','se','to'];

function getEndpoints() {
  const cpf=document.getElementById('f-cpf').value.replace(/\D/g,'');
  const nome=document.getElementById('f-nome').value.trim();
  const tel=document.getElementById('f-tel').value.replace(/\D/g,'');
  const cep=document.getElementById('f-cep').value.replace(/\D/g,'');
  const placa=document.getElementById('f-placa').value.replace(/[^a-zA-Z0-9]/g,'');
  const rg=document.getElementById('f-rg').value.trim();
  const bin=document.getElementById('f-bin').value.trim();
  const proc=document.getElementById('f-processo').value.trim();
  const irm=document.getElementById('f-irmaos').value.trim();
  const chassi=document.getElementById('f-chassi').value.trim();
  const cnpj=(document.getElementById('f-cnpj')?.value||'').replace(/\D/g,'');
  const nis=(document.getElementById('f-nis')?.value||'').replace(/\D/g,'');
  const eps=[];
  if(cpf){
    eps.push({id:'cpf',label:'CPF',path:`/api/v1/search/cpf/${cpf}`});
    CONSULT_TIPOS.forEach(tipo=>{
      const isS=tipo==='serasa';
      eps.push({id:`cc-${tipo}`,label:tipo.charAt(0).toUpperCase()+tipo.slice(1),path:`/api/v1/search/consultcenter/${tipo}/cpf/${cpf}`,serasaLocked:isS&&!isHorarioComercial(),serasaNote:isS});
    });
    eps.push({id:'foto-cpf',label:'Foto CPF',path:`/api/v1/search/foto/cpf/${cpf}`});
    eps.push({id:'score',label:'Score',path:`/api/v1/search/score/cpf/${cpf}`});
    eps.push({id:'foto-sp',label:'Foto SP',path:`/api/v1/search/foto/sp/cpf/${cpf}`});
    FOTO_STATES_CPF.forEach(s=>eps.push({id:'foto-'+s,label:'Foto '+s.toUpperCase(),path:`/api/v1/search/foto/${s}/cpf/${cpf}`}));
  }
  if(nome){
    eps.push({id:'nome',label:'Nome',path:`/api/v1/search/nome/${encodeURIComponent(nome)}`});
    eps.push({id:'foto-pe',label:'Foto PE',path:`/api/v1/search/foto/pe/nome/${encodeURIComponent(nome)}`});
  }
  const emailRaw=document.getElementById('f-email')?document.getElementById('f-email').value.trim():'';
  if(tel){
    eps.push({id:'tel',label:'Telefone',path:`/api/v1/search/telefone/${tel}`});
    eps.push({id:'operadora',label:'Operadora',path:`/api/v1/search/operadora/${tel}`});
  }
  getEmailFieldEndpoints(emailRaw).forEach(ep => eps.push(ep));
  if(cep) eps.push({id:'cep',label:'CEP',path:`/api/v1/search/cep/${cep}`});
  if(placa) eps.push({id:'placa',label:'Placa',path:`/api/v1/search/placa/${placa}`});
  if(chassi) eps.push({id:'chassi',label:'Chassi',path:`/api/v1/search/chassi/${chassi}`});
  if(rg) eps.push({id:'rg',label:'RG',path:`/api/v1/search/rg/${rg}`});
  if(bin) eps.push({id:'bin',label:'BIN',path:`/api/v1/search/bin/${bin}`});
  if(proc) eps.push({id:'proc',label:'Processo',path:`/api/v1/search/processo/${proc}`});
  if(irm) eps.push({id:'irm',label:'Irmãos',path:`/api/v1/search/familiares/irmaos/${encodeURIComponent(irm)}`});
  if(cnpj.length===14) eps.push({id:'cnpj',label:'CNPJ',path:`/api/v1/search/cnpj/${cnpj}`});
  if(nis.length===11) eps.push({id:'nis',label:'NIS/PIS',path:`/api/v1/search/nis/${nis}`});
  return eps;
}

function fieldValues() {
  const cpf = (document.getElementById('f-cpf')?.value || '').replace(/\D/g, '');
  const nome = (document.getElementById('f-nome')?.value || '').trim();
  const tel = (document.getElementById('f-tel')?.value || '').replace(/\D/g, '');
  const cep = (document.getElementById('f-cep')?.value || '').replace(/\D/g, '');
  const placa = (document.getElementById('f-placa')?.value || '').replace(/[^a-zA-Z0-9]/g, '');
  const rg = (document.getElementById('f-rg')?.value || '').trim();
  const bin = (document.getElementById('f-bin')?.value || '').trim();
  const proc = (document.getElementById('f-processo')?.value || '').trim();
  const irm = (document.getElementById('f-irmaos')?.value || '').trim();
  const chassi = (document.getElementById('f-chassi')?.value || '').trim();
  const emailRaw = (document.getElementById('f-email')?.value || '').trim();
  const emailCpf = emailRaw.replace(/\D/g, '');
  const cnpj = (document.getElementById('f-cnpj')?.value || '').replace(/\D/g, '');
  const nis = (document.getElementById('f-nis')?.value || '').replace(/\D/g, '');
  return { cpf, nome, tel, cep, placa, rg, bin, proc, irm, chassi, emailRaw, emailCpf, cnpj, nis };
}

function isCpfBasedEp(ep) {
  return (
    ep.id === 'cpf' ||
    ep.id.startsWith('cc-') ||
    ep.id === 'foto-cpf' ||
    ep.id === 'score' ||
    (ep.id.startsWith('foto-') && ep.id !== 'foto-pe')
  );
}

// Endpoints excluídos do modo automático (disponíveis apenas via pills).
// Fotos e consultas secundárias são lentas e aumentam o tempo total da busca.
const AUTO_EXCLUDE_IDS = new Set(['foto-cpf', 'foto-sp', 'foto-pe', 'cc-tse', 'cc-denatran']);

/** Sem pills: consultas principais para cada campo preenchido (em paralelo). */
function getAutoEndpoints(eps) {
  const v = fieldValues();
  const out = [];
  const seen = new Set();

  eps.forEach(ep => {
    if (ep.serasaLocked || ep.unsupported || seen.has(ep.id)) return;
    if (AUTO_EXCLUDE_IDS.has(ep.id)) return;
    if (ep.id.startsWith('foto-')) return; // bases de foto disponíveis apenas via pills

    let include = false;
    if (isCpfBasedEp(ep)) include = v.cpf.length === 11;
    else if (ep.id === 'nome') include = !!v.nome;
    else if (ep.id === 'tel') include = v.tel.length >= 10;
    else if (ep.id === 'operadora') include = v.tel.length >= 10;
    else if (ep.id === 'cep') include = v.cep.length === 8;
    else if (ep.id === 'placa') include = v.placa.length >= 7;
    else if (ep.id === 'chassi') include = !!v.chassi;
    else if (ep.id === 'rg') include = !!v.rg;
    else if (ep.id === 'bin') include = !!v.bin;
    else if (ep.id === 'proc') include = !!v.proc;
    else if (ep.id === 'irm') include = !!v.irm;
    else if (ep.id === 'email') include = v.emailCpf.length === 11 && !v.emailRaw.includes('@');
    else if (ep.id === 'cnpj') include = v.cnpj.length === 14;
    else if (ep.id === 'nis') include = v.nis.length === 11;

    if (include) {
      seen.add(ep.id);
      out.push(ep);
    }
  });

  return out;
}

function endpointFromModalKey(modalKey, cpf) {
  if (!modalKey || !cpf || cpf.length !== 11) return null;
  const serasaLocked = !isHorarioComercial();
  const map = {
    cpf: { id: 'cpf', label: 'CPF', path: `/api/v1/search/cpf/${cpf}` },
    serasa: { id: 'cc-serasa', label: 'Serasa', path: `/api/v1/search/consultcenter/serasa/cpf/${cpf}`, serasaLocked, serasaNote: true },
    spc: { id: 'cc-spc', label: 'Spc', path: `/api/v1/search/consultcenter/spc/cpf/${cpf}` },
    receita: { id: 'cc-receita', label: 'Receita', path: `/api/v1/search/consultcenter/receita/cpf/${cpf}` },
    tse: { id: 'cc-tse', label: 'Tse', path: `/api/v1/search/consultcenter/tse/cpf/${cpf}` },
    denatran: { id: 'cc-denatran', label: 'Denatran', path: `/api/v1/search/consultcenter/denatran/cpf/${cpf}` },
    score: { id: 'score', label: 'Score', path: `/api/v1/search/score/cpf/${cpf}` },
    'foto-cpf': { id: 'foto-cpf', label: 'Foto CPF', path: `/api/v1/search/foto/cpf/${cpf}` },
    'foto-sp': { id: 'foto-sp', label: 'Foto SP', path: `/api/v1/search/foto/sp/cpf/${cpf}` },
    email: { id: 'email', label: 'E-mails', path: `/api/v1/search/consultcenter/emails/cpf/${cpf}` },
    negativacao: { id: 'negativacao', label: 'Negativação', path: `/api/v1/search/consultcenter/negativacao/cpf/${cpf}`, isNegativacao: true },
  };
  const ep = map[modalKey];
  if (!ep || ep.serasaLocked) return null;
  return ep;
}

// Prefetch desativado: a API tem rate limit de 1 req/min por endpoint,
// chamadas antecipadas esgotam a cota antes do usuário clicar em Buscar.
function schedulePrefetch() {}
function scheduleModalPrefetch() {}
function prefetchEndpoint() {}

let selectedIds=new Set(), allEndpoints=[];

function renderPills(){
  const c=document.getElementById('pills-container');
  allEndpoints=getEndpoints();
  if(!allEndpoints.length){c.innerHTML='<span style="font-size:13px;color:var(--text3)">Preencha um campo para ver as opções</span>';return;}
  c.innerHTML=allEndpoints.map(ep=>{
    const active=selectedIds.has(ep.id)?'active':'';
    const locked=ep.serasaLocked?'disabled':'';
    const hc=ep.serasaNote?`<span class="hc">H.C.</span>`:'';
    return `<div class="pill ${active} ${locked}" onclick="togglePill('${ep.id}')">${ep.label}${hc}</div>`;
  }).join('');
}

function togglePill(id){
  const ep=allEndpoints.find(e=>e.id===id);
  if(!ep||ep.serasaLocked)return;
  if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);
  renderPills();
}

document.querySelectorAll('.field-input').forEach(inp=>{
  inp.addEventListener('input',()=>{selectedIds.clear();renderPills();schedulePrefetch();});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')executarBusca();});
});

function maskCpfInput(el) {
  if (!el) return;
  el.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
    this.value = v;
  });
}

maskCpfInput(document.getElementById('f-cpf'));
maskCpfInput(document.getElementById('f-email'));
document.getElementById('f-tel').addEventListener('input',function(){
  let v=this.value.replace(/\D/g,'').slice(0,11);
  if(v.length>7)v=v.length===11?v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3'):v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
  else if(v.length>2)v=v.replace(/(\d{2})(\d{0,5})/,'($1) $2');
  this.value=v;
});
document.getElementById('f-cep').addEventListener('input',function(){
  let v=this.value.replace(/\D/g,'').slice(0,8);
  if(v.length>5)v=v.replace(/(\d{5})(\d{0,3})/,'$1-$2');
  this.value=v;
});
const _cnpjInp=document.getElementById('f-cnpj');
if(_cnpjInp) _cnpjInp.addEventListener('input',function(){
  let v=this.value.replace(/\D/g,'').slice(0,14);
  if(v.length>12)v=v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,'$1.$2.$3/$4-$5');
  else if(v.length>8)v=v.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/,'$1.$2.$3/$4');
  else if(v.length>5)v=v.replace(/(\d{2})(\d{3})(\d{0,3})/,'$1.$2.$3');
  else if(v.length>2)v=v.replace(/(\d{2})(\d{0,3})/,'$1.$2');
  this.value=v;
});

function getApiKeyForEp(ep) {
  if (ep.isNegativacao) return 'n_' + getNegativKey();
  return 'main';
}

function getCached(path, suffix) {
  const ck = cacheKey(path, suffix || 'main');
  const cached = responseCache.get(ck);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  return null;
}

function _fetchCore(ep){
  const ckSuffix = ep.isNegativacao ? 'n_' + getNegativKey() : 'main';
  const ck = cacheKey(ep.path, ckSuffix);
  const cached = responseCache.get(ck);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return Promise.resolve(cached.data);

  if (inflightRequests.has(ck)) return inflightRequests.get(ck);

  const headers = getHeadersForEp(ep);
  const ctrl = new AbortController();

  // Wrapping em new Promise garante que o timer sempre resolve/rejeita a
  // promise dentro de FETCH_TIMEOUT_MS, mesmo que ctrl.abort() não interrompa
  // r.json() (leitura do body) em todos os navegadores.
  const promise = new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      ctrl.abort();
      reject(new Error('RequestTimeout'));
    }, FETCH_TIMEOUT_MS);

    fetch(PROXY + ep.path, { headers, signal: ctrl.signal })
      .then(r => {
        r.json().then(d => {
          clearTimeout(t);
          if (r.status === 429) {
            const retryMsg = (d && d.retry_after)
              ? ' Aguarde ' + d.retry_after + 's.'
              : ' Aguarde alguns instantes.';
            resolve({ ep, ok: false, status: 429, data: { error: 'Limite de consultas atingido.' + retryMsg } });
            return;
          }
          const res = { ep, ok: r.ok, status: r.status, data: d };
          if (r.ok) responseCache.set(ck, { ts: Date.now(), data: res });
          resolve(res);
        }).catch(() => {
          clearTimeout(t);
          if (r.status === 429) {
            resolve({ ep, ok: false, status: 429, data: { error: 'Limite de consultas atingido. Aguarde alguns instantes.' } });
            return;
          }
          // Resposta não é JSON válido (ex: página de erro do Cloudflare)
          resolve({ ep, ok: false, status: r.status, data: { error: 'API indisponível (código ' + r.status + '). Verifique sua conexão ou tente mais tarde.' } });
        });
      })
      .catch(err => { clearTimeout(t); reject(err); });
  })
  .catch(err => ({
    ep,
    ok: false,
    status: 0,
    data: { error: (err.name === 'AbortError' || err.message === 'RequestTimeout')
      ? 'Timeout (' + (FETCH_TIMEOUT_MS / 1000) + 's)'
      : (err.message || 'Erro na requisição') },
  }))
  .finally(() => { inflightRequests.delete(ck); });

  inflightRequests.set(ck, promise);
  return promise;
}

// Envolve _fetchCore: se o worker recusar por falta de token (401), tenta
// renovar o crachá uma vez e refaz a consulta. Assim, um cliente com plano
// válido nunca vê erro só porque o token de 24h venceu no meio da sessão.
// Só quando a renovação falha (plano realmente inativo) é que o 401 aparece.
async function fetchComTimeout(ep) {
  const res = await _fetchCore(ep);
  if (res && res.status === 401 && !ep.__authRetried) {
    // Com token: tenta renovar. Sem token (sessão antiga): tenta re-emitir.
    const renewed = _authToken ? await authRefresh() : await authEnsure();
    if (renewed) return _fetchCore(Object.assign({}, ep, { __authRetried: true }));
  }
  return res;
}

function getSearchMeta(toSearch) {
  const cfg = typeof currentModalKey !== 'undefined' && currentModalKey ? MODAL_CONFIG[currentModalKey] : null;
  const icon = cfg ? cfg.icon : '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>';
  let label = toSearch[0] ? toSearch[0].label : 'Consulta';
  const hasCpf = toSearch.some(e => e.id === 'cpf');
  if (hasCpf && toSearch.length > 1) {
    label = 'CPF + ' + (toSearch.length - 1) + ' mais';
  } else if (toSearch.length > 1) {
    label += ' + ' + (toSearch.length - 1) + ' mais';
  }
  return { icon, label: label.toUpperCase() };
}

function runSearchBatch(toSearch, meta) {
  const area = document.getElementById('result-area');
  const contEl = document.createElement('div');
  contEl.className = 'status-bar loading';
  contEl.innerHTML = `<span class="spinner"></span><span id="contador"> Consultando...</span>`;
  area.prepend(contEl);

  const _msgs = [' Buscando dados...', ' Aguardando resposta...', ' Processando, quase lá...'];
  let _mi = 0;
  const _msgTimer = setInterval(() => {
    _mi++;
    const el = document.getElementById('contador');
    if (el) el.textContent = _msgs[Math.min(_mi - 1, _msgs.length - 1)];
  }, 5000);

  let done = 0;
  let dossieOpened = false;
  const allResults = [];
  const total = toSearch.length;
  const { icon, label } = meta || getSearchMeta(toSearch);

  if (typeof openDossieLoading === 'function') {
    openDossieLoading(label, icon);
    dossieOpened = true;
  }

  // Captura o campo/valor primário preenchido para o histórico e re-execução.
  let _histField = '', _histTerm = '';
  try {
    const _f = document.querySelector('.field-input');
    const _filled = Array.prototype.find.call(
      document.querySelectorAll('.field-input'),
      el => el.value && el.value.trim()
    );
    if (_filled) { _histField = _filled.id; _histTerm = _filled.value.trim(); }
  } catch (_) {}

  const finalize = () => {
    clearInterval(_msgTimer);
    try {
      const successList = allResults.filter(r =>
        typeof isSearchSuccess === 'function' ? isSearchSuccess(r) : (r && r.ok)
      );
      const okCount = successList.length;

      if (_histTerm && typeof SearchHistory !== 'undefined') {
        SearchHistory.record({ term: _histTerm, field: _histField, label: label, count: okCount });
      }
      contEl.className = okCount ? 'status-bar success' : 'status-bar error';
      contEl.innerHTML = okCount
        ? `${okCount} de ${total} consulta${okCount !== 1 ? 's' : ''} com dados`
        : `Nenhum dado (${total} consulta${total !== 1 ? 's' : ''} finalizada${total !== 1 ? 's' : ''})`;
      if (okCount > 0 && typeof openDossie === 'function') {
        openDossie(successList, label, icon);
      } else if (!okCount && allResults.length > 0 && typeof openDossie === 'function') {
        openDossie(allResults, label, icon);
      } else {
        const firstErr = allResults.find(r => r && !(
          typeof isSearchSuccess === 'function' ? isSearchSuccess(r) : r.ok
        ));
        const msg = firstErr && typeof getSearchErrorMessage === 'function'
          ? getSearchErrorMessage(firstErr)
          : 'Nenhum dado retornado. Verifique o CPF/dado e tente novamente.';
        showError(msg);
        if (typeof closeDossie === 'function') closeDossie();
      }
    } catch (e) {
      if (typeof closeDossie === 'function') try { closeDossie(); } catch (_) {}
    }
  };

  const onOneDone = (res) => {
    done++;
    allResults.push(res);

    try {
      const el = document.getElementById('contador');
      if (el) el.textContent = ` ${done} de ${total} consulta${total !== 1 ? 's' : ''}`;

      const hasData = typeof isSearchSuccess === 'function' ? isSearchSuccess(res) : (res && res.ok);
      if (hasData) {
        if (typeof openDossie === 'function' && typeof dossieIsLoading === 'function' && dossieIsLoading()) {
          openDossie([res], label, icon);
        } else if (typeof appendDossieResult === 'function') {
          appendDossieResult(res);
        } else if (typeof openDossie === 'function') {
          openDossie([res], label, icon);
          dossieOpened = true;
        }
      }
    } catch (_) {}

    if (done >= total) finalize();
  };

  toSearch.forEach(ep => {
    try {
      const apiKey = getApiKeyForEp(ep);
      const cached = getCached(ep.path, apiKey);
      if (cached) {
        onOneDone(cached);
        return;
      }
      fetchComTimeout(ep).then(onOneDone).catch(() => onOneDone({ ep, ok: false, status: 0, data: { error: 'Erro interno' } }));
    } catch (_) {
      onOneDone({ ep, ok: false, status: 0, data: { error: 'Erro ao iniciar consulta' } });
    }
  });
}

async function executarBusca(){
  allEndpoints=getEndpoints();
  const blocked=allEndpoints.find(ep=>ep.unsupported);
  if(blocked){showError(blocked.unsupportedMsg);return;}

  let toSearch=allEndpoints.filter(ep=>selectedIds.has(ep.id)&&!ep.serasaLocked&&!ep.unsupported);
  if(!toSearch.length) toSearch=getAutoEndpoints(allEndpoints);
  if(!toSearch.length){showError('Nenhum campo preenchido.');return;}

  const area=document.getElementById('result-area');
  area.innerHTML='';

  const serasaLocked=allEndpoints.filter(ep=>ep.serasaLocked);
  if(serasaLocked.length){
    const w=document.createElement('div');w.className='status-bar warn';
    w.textContent='Serasa disponível apenas em horário comercial (seg–sex, 8h–18h)';
    area.appendChild(w);
  }

  runSearchBatch(toSearch);
}

function showError(msg){document.getElementById('result-area').innerHTML=`<div class="status-bar error">${msg}</div>`;}

function limparTudo(){
  document.querySelectorAll('.field-input').forEach(i=>i.value='');
  selectedIds.clear();renderPills();
  document.getElementById('result-area').innerHTML='<div class="empty-state"><p>Preencha um campo e clique em buscar</p></div>';
}


function toggleSidebar() {
  const btn = document.getElementById('menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) closeSidebar();
  else {
    btn.classList.add('open');
    sidebar.classList.add('open');
    overlay.classList.add('open');
  }
}

function closeSidebar() {
  document.getElementById('menu-btn').classList.remove('open');
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function focusField(id) {
  const el = document.getElementById(id);
  if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); el.focus(); }
}

function selectQuery(tipo) {
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  event && event.currentTarget && event.currentTarget.classList.add('active');
}

window.scheduleModalPrefetch = scheduleModalPrefetch;
window.prefetchEndpoint = prefetchEndpoint;
window.renderPills = renderPills;
window.executarBusca = executarBusca;
window.runSearchBatch = runSearchBatch;
