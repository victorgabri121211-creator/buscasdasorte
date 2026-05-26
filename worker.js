const API_BASE = 'https://apis.fr4ud.center';
const MISTICPAY_URL = 'https://api.misticpay.com/api';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return corsResp();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/pix/create' && request.method === 'POST') {
      return pixCreate(request, env);
    }

    if (path === '/pix/status' && request.method === 'POST') {
      return pixStatus(request, env);
    }

    return proxySearch(request, env, url, path);
  }
};

async function proxySearch(request, env, url, path) {
  const neg = path.indexOf('/negativacao/') !== -1;
  const key = neg
    ? request.headers.get('X-Negativ-Key') || ''
    : env.API_KEY || '';

  if (!key) {
    return json({ error: 'Chave nao configurada.' }, 401);
  }

  const target = API_BASE + path + url.search;

  return fetch(target, { method: 'GET', headers: { 'X-Api-Key': key } })
    .then(function(r) {
      const ct = r.headers.get('Content-Type') || 'application/json';
      return r.arrayBuffer().then(function(buf) {
        return new Response(buf, {
          status: r.status,
          headers: {
            'Content-Type': ct,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          }
        });
      });
    })
    .catch(function(e) {
      return json({ error: 'Proxy error: ' + e.message }, 502);
    });
}

async function pixCreate(request, env) {
  const ci = env.MISTICPAY_CI || '';
  const cs = env.MISTICPAY_CS || '';
  if (!ci || !cs) return json({ error: 'Credenciais nao configuradas.' }, 500);

  const b = await request.json().catch(function() { return null; });
  if (!b || !b.amount || !b.payerName || !b.payerDocument || !b.transactionId) {
    return json({ error: 'Campos obrigatorios ausentes.' }, 400);
  }

  return fetch(MISTICPAY_URL + '/transactions/create', {
    method: 'POST',
    headers: { ci: ci, cs: cs, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: b.amount,
      payerName: b.payerName,
      payerDocument: b.payerDocument,
      transactionId: b.transactionId,
      description: b.description || ''
    })
  })
    .then(function(r) { return r.json().then(function(d) { return json(d, r.status); }); })
    .catch(function(e) { return json({ error: 'Erro PIX create: ' + e.message }, 502); });
}

async function pixStatus(request, env) {
  const ci = env.MISTICPAY_CI || '';
  const cs = env.MISTICPAY_CS || '';
  if (!ci || !cs) return json({ error: 'Credenciais nao configuradas.' }, 500);

  const b = await request.json().catch(function() { return null; });
  if (!b || !b.transactionId) return json({ error: 'transactionId ausente.' }, 400);

  return fetch(MISTICPAY_URL + '/transactions/check', {
    method: 'POST',
    headers: { ci: ci, cs: cs, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId: b.transactionId })
  })
    .then(function(r) { return r.json().then(function(d) { return json(d, r.status); }); })
    .catch(function(e) { return json({ error: 'Erro PIX status: ' + e.message }, 502); });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function corsResp() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Negativ-Key'
    }
  });
}
