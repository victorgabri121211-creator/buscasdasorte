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

    // -- Proxy para a API de busca (Snoop) --
    const apiKey = env.API_KEY || '';
    if (!apiKey) return apiResponse({ error: 'Configuracao interna incorreta.' }, 500, origin);

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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
