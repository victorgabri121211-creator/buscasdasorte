/**
 * BuscasDasorte — Cloudflare Worker (Proxy seguro)
 * ─────────────────────────────────────────────────
 * COMO USAR:
 *  1. Acesse https://dash.cloudflare.com → Workers & Pages → seu worker
 *  2. Cole este arquivo no editor
 *  3. Vá em Settings → Variables and Secrets → adicione:
 *       Nome: API_KEY         | Valor: <sua_chave_da_api_de_busca>
 *       Nome: MISTICPAY_CI    | Valor: ci_ywbwo1sjb8mtl3d
 *       Nome: MISTICPAY_CS    | Valor: cs_uhr4weycrqrk4c00jlkot58dk
 *  4. Salve e faça o Deploy
 */

const API_BASE      = 'https://apis.fr4ud.center';
const MISTICPAY_URL = 'https://api.misticpay.com/api';

export default {
  async fetch(request, env) {

    // ── CORS preflight ──────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    // ── Rotas de pagamento PIX ──────────────────────────────────────────
    if (path === '/pix/create' && request.method === 'POST') {
      return handlePixCreate(request, env);
    }
    if (path === '/pix/status' && request.method === 'POST') {
      return handlePixStatus(request, env);
    }

    // ── Proxy para a API de busca ───────────────────────────────────────
    const isNegativacao = path.includes('/negativacao/');

    let apiKey;
    if (isNegativacao) {
      apiKey = request.headers.get('X-Negativ-Key') || '';
      if (!apiKey) return apiResponse({ error: 'Chave de negativação não fornecida.' }, 401);
    } else {
      apiKey = env.API_KEY || '';
      if (!apiKey) return apiResponse({ error: 'Configuração interna incorreta.' }, 500);
    }

    const targetUrl = API_BASE + path + url.search;
    try {
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'X-Api-Key': apiKey },
      });

      const contentType = resp.headers.get('Content-Type') || 'application/json';
      const body        = await resp.arrayBuffer();

      return new Response(body, {
        status: resp.status,
        headers: {
          'Content-Type':                contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control':               'no-store',
        },
      });
    } catch (err) {
      return apiResponse({ error: 'Erro no proxy: ' + err.message }, 502);
    }
  },
};

// ── Handler: criar cobrança PIX ─────────────────────────────────────────
async function handlePixCreate(request, env) {
  let body;
  try { body = await request.json(); } catch (_) {
    return apiResponse({ error: 'Body inválido.' }, 400);
  }

  const { amount, payerName, payerDocument, transactionId, description } = body;

  if (!amount || !payerName || !payerDocument || !transactionId) {
    return apiResponse({ error: 'Campos obrigatórios: amount, payerName, payerDocument, transactionId.' }, 400);
  }

  const ci = env.MISTICPAY_CI || '';
  const cs = env.MISTICPAY_CS || '';
  if (!ci || !cs) return apiResponse({ error: 'Credenciais de pagamento não configuradas.' }, 500);

  try {
    const resp = await fetch(MISTICPAY_URL + '/transactions/create', {
      method: 'POST',
      headers: { 'ci': ci, 'cs': cs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, payerName, payerDocument, transactionId, description }),
    });
    const data = await resp.json();
    return apiResponse(data, resp.status);
  } catch (err) {
    return apiResponse({ error: 'Erro ao criar cobrança: ' + err.message }, 502);
  }
}

// ── Handler: verificar status da transação ──────────────────────────────
async function handlePixStatus(request, env) {
  let body;
  try { body = await request.json(); } catch (_) {
    return apiResponse({ error: 'Body inválido.' }, 400);
  }

  const { transactionId } = body;
  if (!transactionId) return apiResponse({ error: 'transactionId obrigatório.' }, 400);

  const ci = env.MISTICPAY_CI || '';
  const cs = env.MISTICPAY_CS || '';
  if (!ci || !cs) return apiResponse({ error: 'Credenciais de pagamento não configuradas.' }, 500);

  try {
    const resp = await fetch(MISTICPAY_URL + '/transactions/check', {
      method: 'POST',
      headers: { 'ci': ci, 'cs': cs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId }),
    });
    const data = await resp.json();
    return apiResponse(data, resp.status);
  } catch (err) {
    return apiResponse({ error: 'Erro ao verificar status: ' + err.message }, 502);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────
function apiResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function corsResponse(body, status = 204) {
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Negativ-Key',
    },
  });
}
