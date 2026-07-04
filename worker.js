/**
 * BuscasDasorte - Cloudflare Worker (Proxy seguro)
 * -------------------------------------------------
 * COMO USAR:
 *  1. Acesse https://dash.cloudflare.com -> Workers & Pages -> seu worker
 *  2. Cole este arquivo no editor
 *  3. Va em Settings -> Variables and Secrets -> adicione (NUNCA no codigo):
 *       Nome: API_KEY         | Valor: <sua API Key da Snoop Intelligence>
 *       Nome: MISTICPAY_CI    | Valor: <seu client id da MisticPay>
 *       Nome: MISTICPAY_CS    | Valor: <seu client secret da MisticPay>
 *  4. Salve e faca o Deploy
 *
 * NUNCA cole os valores reais das chaves neste arquivo - ele fica versionado
 * em repositorio publico. As chaves vivem apenas nas Secrets do Worker.
 */

// Snoop Intelligence - proxy da API de consultas.
// O cliente envia o path completo (ex.: /api/v2/generic/cpf?cpf=... ou
// /api/v1/sp/cpf?cpf=...); o worker apenas repassa para a base + injeta o Bearer.
const API_BASE      = 'https://snoopintelligence.cloud';
const MISTICPAY_URL = 'https://api.misticpay.com/api';

// Origens autorizadas a usar este worker (evita abuso por terceiros).
const ALLOWED_ORIGINS = [
  'https://dasortebuscas.com.br',
  'https://www.dasortebuscas.com.br',
];

// Precos canonicos - a fonte da verdade do valor cobrado e o servidor,
// nunca o valor enviado pelo navegador. Mantenha em sincronia com o site.
const PLAN_PRICES = { diaria: 8.49, semana: 20.5, mes: 25.5, vitalicio: 150 };
const RESELLER_PRICES = { '1': 5.5, '10': 49.9, '20': 99.9, '30': 139.9, unlimited: 300 };
// Conjunto de todos os valores validos (fallback p/ clientes sem productId).
const VALID_AMOUNTS = Object.values(PLAN_PRICES).concat(Object.values(RESELLER_PRICES));

function allowedOrigin(request) {
  const o = request.headers.get('Origin');
  return ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0];
}

function amountMatches(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

// Valida o valor contra o preco canonico do produto (ou o whitelist geral).
function isValidAmount(amount, productId, category) {
  const n = Number(amount);
  if (!(n > 0)) return false;
  if (productId) {
    const table = category === 'reseller' ? RESELLER_PRICES : PLAN_PRICES;
    const expected = table[String(productId)];
    if (expected != null) return amountMatches(n, expected);
  }
  // Cliente antigo (sem productId) - aceita apenas valores conhecidos.
  return VALID_AMOUNTS.some(v => amountMatches(n, v));
}

// ── Autenticação (crachá/token) ─────────────────────────────────────────────
// O worker só consulta a Snoop para quem tem token válido (usuário logado +
// plano ativo). O token é um JWT assinado com AUTH_SECRET (Cloudflare Secret);
// ninguém sem esse segredo consegue forjar. Modo SUAVE por padrão: só passa a
// EXIGIR o token quando a env AUTH_ENFORCE = 'true'.
const SB_URL_DEFAULT = 'https://tgpyujrkdkgwnkvrckun.supabase.co';
const ADMIN_USER      = 'Dasorte';
const TOKEN_TTL_MS    = 24 * 60 * 60 * 1000;      // validade do token: 24h
const REFRESH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // renova sem senha por até 30 dias

const _enc = new TextEncoder();

function b64url(bytes) {
  let bin = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJson(obj) { return b64url(_enc.encode(JSON.stringify(obj))); }
function b64urlDecodeToStr(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', _enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function jwtSign(payload, secret) {
  const head = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const data = head + '.' + body;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, _enc.encode(data));
  return data + '.' + b64url(sig);
}
// Verifica assinatura; retorna o payload (mesmo expirado) ou null se inválido.
async function jwtVerify(token, secret) {
  if (!token || token.split('.').length !== 3) return null;
  const [h, b, s] = token.split('.');
  const key = await hmacKey(secret);
  let sigBytes;
  try {
    const bin = b64urlDecodeToStr(s);
    sigBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) sigBytes[i] = bin.charCodeAt(i);
  } catch (_) { return null; }
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, _enc.encode(h + '.' + b));
  if (!ok) return null;
  try { return JSON.parse(b64urlDecodeToStr(b)); } catch (_) { return null; }
}

async function sbRpc(env, fn, params) {
  const url = (env.SUPABASE_URL || SB_URL_DEFAULT) + '/rest/v1/rpc/' + fn;
  const key = env.SUPABASE_ANON_KEY || '';
  if (!key) return null;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(params || {}),
    });
    return await r.json().catch(() => null);
  } catch (_) { return null; }
}

function mintToken(secret, username, validUntil) {
  const now = Date.now();
  // exp = mais cedo entre 24h e o vencimento do plano (se houver).
  let exp = now + TOKEN_TTL_MS;
  if (validUntil && Number(validUntil) > now) exp = Math.min(exp, Number(validUntil));
  return jwtSign({ sub: username, iat: now, exp: exp }, secret);
}

// POST /auth/login {username, password} ou {username, adminHash}
async function handleAuthLogin(request, env, origin) {
  const secret = env.AUTH_SECRET || '';
  if (!secret) return apiResponse({ ok: false, error: 'Auth nao configurado.' }, 500, origin);
  let body;
  try { body = await request.json(); } catch (_) { return apiResponse({ ok: false, error: 'Body invalido.' }, 400, origin); }
  const username = String(body.username || '').trim();
  if (!username) return apiResponse({ ok: false, error: 'username obrigatorio.' }, 400, origin);

  // Admin: valida pelo hash.
  if (username.toLowerCase() === ADMIN_USER.toLowerCase() && body.adminHash) {
    const res = await sbRpc(env, 'bds_admin_check', { p_hash: body.adminHash });
    if (res && res.ok) {
      const token = await mintToken(secret, ADMIN_USER, null);
      return apiResponse({ ok: true, token }, 200, origin);
    }
    return apiResponse({ ok: false, error: 'Admin invalido.' }, 401, origin);
  }

  // Usuário normal / cliente de revendedor: credenciais + plano.
  const res = await sbRpc(env, 'bds_access_check', { p_username: username, p_password: String(body.password || '') });
  if (res && res.ok) {
    const token = await mintToken(secret, res.username || username, res.valid_until);
    return apiResponse({ ok: true, token }, 200, origin);
  }
  return apiResponse({ ok: false, error: 'Sem acesso.', reason: (res && res.reason) || 'unauthorized' }, 401, origin);
}

// POST /auth/refresh {token} — renova sem senha se o token (mesmo expirado) foi
// emitido nos últimos 30 dias e o plano continua válido.
async function handleAuthRefresh(request, env, origin) {
  const secret = env.AUTH_SECRET || '';
  if (!secret) return apiResponse({ ok: false, error: 'Auth nao configurado.' }, 500, origin);
  let body;
  try { body = await request.json(); } catch (_) { return apiResponse({ ok: false, error: 'Body invalido.' }, 400, origin); }
  const payload = await jwtVerify(String(body.token || ''), secret);
  if (!payload || !payload.sub) return apiResponse({ ok: false, error: 'Token invalido.' }, 401, origin);
  if (!payload.iat || (Date.now() - Number(payload.iat)) > REFRESH_WINDOW_MS) {
    return apiResponse({ ok: false, error: 'Sessao expirada.' }, 401, origin);
  }
  // Admin: re-emite direto (não há plano a checar).
  if (String(payload.sub).toLowerCase() === ADMIN_USER.toLowerCase()) {
    const token = await mintToken(secret, ADMIN_USER, null);
    return apiResponse({ ok: true, token }, 200, origin);
  }
  // Reconfirma plano ativo (sem senha) via checagem por usuário.
  const res = await sbRpc(env, 'bds_get_plan', { p_username: payload.sub });
  const plan = res && res.ok ? res.plan : null;
  const now = Date.now();
  const active = plan && (plan.expiresAt == null || Number(plan.expiresAt) > now);
  if (!active) return apiResponse({ ok: false, error: 'Plano inativo.' }, 401, origin);
  const token = await mintToken(secret, payload.sub, plan.expiresAt);
  return apiResponse({ ok: true, token }, 200, origin);
}

// Extrai e valida o Bearer do request. Retorna payload válido (não expirado) ou null.
async function authFromRequest(request, env) {
  const secret = env.AUTH_SECRET || '';
  if (!secret) return null;
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = await jwtVerify(m[1], secret);
  if (!payload || !payload.exp || Date.now() >= Number(payload.exp)) return null;
  return payload;
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request);

    // -- CORS preflight --
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, origin);
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    // -- Rotas de pagamento PIX --
    if (path === '/pix/create' && request.method === 'POST') {
      return handlePixCreate(request, env, origin);
    }
    if (path === '/pix/status' && request.method === 'POST') {
      return handlePixStatus(request, env, origin);
    }
    if (path === '/pix/history' && request.method === 'POST') {
      return handlePixHistory(request, env, origin);
    }

    // -- Autenticação (emissão/renovação de token) --
    if (path === '/auth/login' && request.method === 'POST') {
      return handleAuthLogin(request, env, origin);
    }
    if (path === '/auth/refresh' && request.method === 'POST') {
      return handleAuthRefresh(request, env, origin);
    }

    // -- Proxy para a API de busca (Snoop) --
    const apiKey = env.API_KEY || '';
    if (!apiKey) return apiResponse({ error: 'Configuracao interna incorreta.' }, 500, origin);

    // Exige token válido para consultar. Enquanto AUTH_ENFORCE != 'true' fica em
    // modo SUAVE (não bloqueia) para não derrubar clientes durante a migração.
    const auth = await authFromRequest(request, env);
    if (env.AUTH_ENFORCE === 'true' && !auth) {
      return apiResponse({ error: 'Acesso nao autorizado. Faca login com um plano ativo.' }, 401, origin);
    }

    const targetUrl = API_BASE + path + url.search;
    try {
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + apiKey },
      });

      const contentType = resp.headers.get('Content-Type') || 'application/json';
      const body        = await resp.arrayBuffer();

      return new Response(body, {
        status: resp.status,
        headers: {
          'Content-Type':                contentType,
          'Access-Control-Allow-Origin': origin,
          'Vary':                        'Origin',
          'Cache-Control':               'no-store',
        },
      });
    } catch (err) {
      return apiResponse({ error: 'Erro no proxy: ' + err.message }, 502, origin);
    }
  },
};

// -- Handler: criar cobranca PIX --
async function handlePixCreate(request, env, origin) {
  let body;
  try { body = await request.json(); } catch (_) {
    return apiResponse({ error: 'Body invalido.' }, 400, origin);
  }

  const { amount, payerName, payerDocument, transactionId, description, productId, category } = body;

  if (!amount || !payerName || !payerDocument || !transactionId) {
    return apiResponse({ error: 'Campos obrigatorios: amount, payerName, payerDocument, transactionId.' }, 400, origin);
  }

  // Seguranca: o valor precisa bater com um preco conhecido do servidor.
  if (!isValidAmount(amount, productId, category)) {
    return apiResponse({ error: 'Valor de cobranca invalido.' }, 422, origin);
  }

  const ci = env.MISTICPAY_CI || '';
  const cs = env.MISTICPAY_CS || '';
  if (!ci || !cs) return apiResponse({ error: 'Credenciais de pagamento nao configuradas.' }, 500, origin);

  try {
    const resp = await fetch(MISTICPAY_URL + '/transactions/create', {
      method: 'POST',
      headers: { 'ci': ci, 'cs': cs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, payerName, payerDocument, transactionId, description }),
    });
    const data = await resp.json();
    return apiResponse(data, resp.status, origin);
  } catch (err) {
    return apiResponse({ error: 'Erro ao criar cobranca: ' + err.message }, 502, origin);
  }
}

// -- Handler: verificar status da transacao --
async function handlePixStatus(request, env, origin) {
  let body;
  try { body = await request.json(); } catch (_) {
    return apiResponse({ error: 'Body invalido.' }, 400, origin);
  }

  const { transactionId } = body;
  if (!transactionId) return apiResponse({ error: 'transactionId obrigatorio.' }, 400, origin);

  const ci = env.MISTICPAY_CI || '';
  const cs = env.MISTICPAY_CS || '';
  if (!ci || !cs) return apiResponse({ error: 'Credenciais de pagamento nao configuradas.' }, 500, origin);

  try {
    const resp = await fetch(MISTICPAY_URL + '/transactions/check', {
      method: 'POST',
      headers: { 'ci': ci, 'cs': cs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId }),
    });
    const data = await resp.json();
    return apiResponse(data, resp.status, origin);
  } catch (err) {
    return apiResponse({ error: 'Erro ao verificar status: ' + err.message }, 502, origin);
  }
}

// -- Handler: historico de transacoes --
async function handlePixHistory(request, env, origin) {
  const ci = env.MISTICPAY_CI || '';
  const cs = env.MISTICPAY_CS || '';
  if (!ci || !cs) return apiResponse({ error: 'Credenciais nao configuradas.' }, 500, origin);

  const headers = { 'ci': ci, 'cs': cs, 'Content-Type': 'application/json' };

  const attempts = [
    { url: MISTICPAY_URL + '/transactions/list',    method: 'POST', body: '{}' },
    { url: MISTICPAY_URL + '/transactions/history', method: 'POST', body: '{}' },
    { url: MISTICPAY_URL + '/transactions',         method: 'POST', body: '{}' },
    { url: MISTICPAY_URL + '/transactions',         method: 'GET',  body: null },
  ];

  let lastStatus = 530;
  let lastData   = { error: 'Endpoint de historico nao encontrado na MisticPay.' };

  for (const att of attempts) {
    try {
      const opts = { method: att.method, headers };
      if (att.body) opts.body = att.body;
      const resp = await fetch(att.url, opts);
      const data = await resp.json().catch(() => ({}));
      if (resp.status >= 200 && resp.status < 300) {
        return apiResponse(data, 200, origin);
      }
      lastStatus = resp.status;
      lastData   = data;
    } catch (_) { /* tenta o proximo */ }
  }

  return apiResponse(lastData, lastStatus, origin);
}

// -- Helpers --
function apiResponse(data, status = 200, origin = ALLOWED_ORIGINS[0]) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': origin,
      'Vary':                        'Origin',
    },
  });
}

function corsResponse(body, status = 204, origin = ALLOWED_ORIGINS[0]) {
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin':  origin,
      'Vary':                         'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
