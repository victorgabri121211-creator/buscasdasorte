/**
 * BuscasDasorte — Cloudflare Worker (Proxy seguro)
 * ─────────────────────────────────────────────────
 * COMO USAR:
 *  1. Acesse https://dash.cloudflare.com → Workers & Pages → seu worker
 *  2. Cole este arquivo no editor
 *  3. Vá em Settings → Variables and Secrets → adicione:
 *       Nome: API_KEY  |  Valor: <sua_chave_da_api_aqui>
 *  4. Salve e faça o Deploy
 *
 * Com isso, a API Key NUNCA aparece no código do site.
 * Para negativação, o cliente envia sua própria chave via X-Negativ-Key.
 */

// URL base da API real — ajuste se necessário
const API_BASE = 'https://api.fr4ud.center';

export default {
  async fetch(request, env) {

    // ── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Negativ-Key',
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname + url.search;
    const isNegativacao = path.includes('/negativacao/');

    // ── Escolha da chave ────────────────────────────────────────────────────
    let apiKey;
    if (isNegativacao) {
      // Negativação: usa a chave enviada pelo cliente (chave própria do usuário)
      apiKey = request.headers.get('X-Negativ-Key') || '';
      if (!apiKey) {
        return apiResponse({ error: 'Chave de negativação não fornecida.' }, 401);
      }
    } else {
      // Demais consultas: chave fica no servidor, nunca no navegador
      apiKey = env.API_KEY || '';
      if (!apiKey) {
        return apiResponse({ error: 'Configuração interna incorreta.' }, 500);
      }
    }

    // ── Chamada para a API real ─────────────────────────────────────────────
    const targetUrl = API_BASE + path;
    try {
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'X-Api-Key': apiKey },
      });

      const contentType = resp.headers.get('Content-Type') || 'application/json';
      const body = await resp.arrayBuffer();

      return new Response(body, {
        status: resp.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      return apiResponse({ error: 'Erro no proxy: ' + err.message }, 502);
    }
  },
};

function apiResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Negativ-Key',
    },
  });
}
