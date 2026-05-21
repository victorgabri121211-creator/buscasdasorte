const PROXY = 'https://ancient-glitter-ad86.victorgabri121211.workers.dev';
// API_KEY removida — injetada pelo Cloudflare Worker (variável de ambiente)

const CPF = '12345678909';
const NOME = encodeURIComponent('DAIANA LASSOLLI');
const TEL = '68984043192';
const CEP = '88370300';
const EMAIL = encodeURIComponent('00213r@gmail.com');
const MAE = encodeURIComponent('LORENI APARECIDA PRESTES');
const PLACA = 'ABC1D23';
const RG = '1234567890';
const BIN = '411111';
const PROCESSO = '00012345620248260001';
const CHASSI = '9BWZZZ377VT004251';

const MODULES = [
  { key: 'cpf', title: 'CONSULTA CPF COMPLETA', path: `/api/v1/search/cpf/${CPF}`, cat: 'Dados básicos' },
  { key: 'rg', title: 'CONSULTA RG', path: `/api/v1/search/rg/${RG}`, cat: 'Dados básicos' },
  { key: 'tse', title: 'TÍTULO DE ELEITOR (TSE)', path: `/api/v1/search/consultcenter/tse/cpf/${CPF}`, cat: 'Dados básicos', appNote: 'Consult Center — horário comercial' },
  { key: 'receita', title: 'CONSULTA RECEITA FEDERAL', path: `/api/v1/search/consultcenter/receita/cpf/${CPF}`, cat: 'Dados básicos', appNote: 'Consult Center — horário comercial' },
  { key: 'nome', title: 'CONSULTA POR NOME', path: `/api/v1/search/nome/${NOME}`, cat: 'Dados básicos' },
  { key: 'foto-cpf', title: 'FOTO BASE CPF', path: `/api/v1/search/foto/cpf/${CPF}`, cat: 'Dados básicos' },
  { key: 'foto-sp', title: 'FOTO (BASE SP)', path: `/api/v1/search/foto/sp/cpf/${CPF}`, cat: 'Dados básicos' },
  { key: 'foto-pe', title: 'FOTO (BASE PE)', path: `/api/v1/search/foto/pe/nome/${NOME}`, cat: 'Dados básicos' },
  { key: 'serasa', title: 'CONSULTA SERASA', path: `/api/v1/search/consultcenter/serasa/cpf/${CPF}`, cat: 'Crédito', appNote: 'Consult Center — horário comercial' },
  { key: 'spc', title: 'CONSULTA SPC', path: `/api/v1/search/consultcenter/spc/cpf/${CPF}`, cat: 'Crédito', appNote: 'Consult Center — horário comercial' },
  { key: 'score', title: 'SCORE DE CRÉDITO', path: `/api/v1/search/score/cpf/${CPF}`, cat: 'Crédito' },
  { key: 'denatran', title: 'CONSULTA DENATRAN', path: `/api/v1/search/consultcenter/denatran/cpf/${CPF}`, cat: 'Crédito', appNote: 'Consult Center — horário comercial' },
  { key: 'bin', title: 'CONSULTA BIN', path: `/api/v1/search/bin/${BIN}`, cat: 'Crédito' },
  { key: 'tel', title: 'CONSULTA TELEFONE', path: `/api/v1/search/telefone/${TEL}`, cat: 'Contato' },
  { key: 'email', title: 'CONSULTA E-MAIL', path: `/api/v1/search/email/${EMAIL}`, cat: 'Contato' },
  { key: 'cep', title: 'CONSULTA CEP', path: `/api/v1/search/cep/${CEP}`, cat: 'Contato' },
  { key: 'placa', title: 'CONSULTA PLACA', path: `/api/v1/search/placa/${PLACA}`, cat: 'Veículos' },
  { key: 'chassi', title: 'CONSULTA CHASSI', path: `/api/v1/search/chassi/${CHASSI}`, cat: 'Veículos' },
  { key: 'processo', title: 'CONSULTA PROCESSO', path: `/api/v1/search/processo/${PROCESSO}`, cat: 'Veículos' },
  { key: 'irmaos', title: 'CONSULTA IRMÃOS', path: `/api/v1/search/familiares/irmaos/${MAE}`, cat: 'Veículos' },
  { key: 'negativacao', title: 'NEGATIVACAO', path: `/api/v1/search/consultcenter/negativacao/cpf/${CPF}`, cat: 'Restrito', appNote: 'Chave API negativacao + horário comercial' },
];

function collectFields(obj, prefix, out) {
  if (obj == null) return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => collectFields(item, prefix + (obj.length > 1 ? `[${i}]` : ''), out));
    return;
  }
  if (typeof obj !== 'object') {
    out.push({ val: obj });
    return;
  }
  for (const v of Object.values(obj)) {
    if (v != null && typeof v === 'object') collectFields(v, '', out);
    else out.push({ val: v });
  }
}

function hasData(data) {
  if (!data || data.success === false) return false;
  const payload = data.success === true && data.data != null ? data.data : data.data || data;
  const fields = [];
  collectFields(payload, '', fields);
  return fields.some(f => f.val != null && f.val !== '' && String(f.val) !== 'null');
}

function classify(mod, status, data) {
  const msg = data?.message || data?.error || '';
  if (status === 403 && /horario|comercial/i.test(String(msg))) {
    return { status: 'bloqueado_horario', err: 'Fora do horário comercial (seg–sex 8h–18h)' };
  }
  if (status === 403) return { status: 'bloqueado', err: msg || 'HTTP 403' };
  if (!status || status >= 500) return { status: 'erro_api', err: `HTTP ${status || '?'}` + (msg ? ': ' + msg : '') };
  if (status === 404) return { status: 'erro_api', err: 'Endpoint não encontrado (404)' };
  if (status === 200 && data?.success !== false && hasData(data)) {
    return { status: 'ok', err: null, sources: data.meta?.sources_returned };
  }
  if (status === 200) return { status: 'vazio', err: msg || 'Resposta sem dados para o exemplo testado' };
  return { status: 'erro_api', err: `HTTP ${status}` };
}

async function testModule(mod) {
  const url = PROXY + mod.path;
  const t0 = Date.now();
  try {
    await new Promise(r => setTimeout(r, 400));
    const res = await fetch(url, { headers: { 'X-Api-Key': API_KEY }, signal: AbortSignal.timeout(25000) });
    let data = {};
    try { data = await res.json(); } catch { data = {}; }
    const ms = Date.now() - t0;
    const c = classify(mod, res.status, data);
    return { ...mod, http: res.status, ms, ...c };
  } catch (e) {
    return { ...mod, http: 0, ms: Date.now() - t0, status: 'erro_api', err: e.message, sources: null };
  }
}

const results = [];
for (const mod of MODULES) {
  results.push(await testModule(mod));
}

const ok = results.filter(r => r.status === 'ok');
const horario = results.filter(r => r.status === 'bloqueado_horario');
const vazio = results.filter(r => r.status === 'vazio');
const erro = results.filter(r => r.status === 'erro_api' || r.status === 'bloqueado');

console.log(JSON.stringify({ ok: ok.map(r => r.key), horario: horario.map(r => r.key), vazio: vazio.map(r => r.key), erro: erro.map(r => ({ key: r.key, err: r.err })) }, null, 2));

console.log('\n--- DETALHE ---');
results.forEach(r => {
  const tag = r.status === 'ok' ? 'OK ' : r.status === 'bloqueado_horario' ? 'HC ' : r.status === 'vazio' ? 'VAZ' : 'ERR';
  console.log(`${tag} ${r.key.padEnd(12)} ${r.err || (r.sources || []).join(', ')}`);
});
