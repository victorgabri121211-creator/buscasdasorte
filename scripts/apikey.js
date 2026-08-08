// Painel "Minha API" — chave fixa por cliente para uso em bots externos.
// Ver worker.js (resolveAuth/apiKeyFromRequest) e supabase-api-keys.sql.
// A tabela de endpoints é gerada a partir de MODAL_CONFIG (scripts/modal.js)
// para nunca ficar desatualizada em relação aos módulos do próprio site.

function _apiKeyEsc(s) {
  return typeof escAdmin === 'function' ? escAdmin(s) : String(s == null ? '' : s);
}

function _apiKeyMask(key) {
  if (!key) return '';
  if (key.length <= 16) return key;
  return key.slice(0, 12) + '••••••••' + key.slice(-4);
}

function _apiKeyDocsRows() {
  if (typeof MODAL_CONFIG === 'undefined') return '';
  return Object.keys(MODAL_CONFIG).map(function (id) {
    var cfg = MODAL_CONFIG[id];
    var placeholders = {};
    (cfg.fields || []).forEach(function (f) { placeholders[f.name] = '{' + f.name + '}'; });
    var path = '';
    try { path = cfg.path(placeholders); } catch (e) { path = ''; }
    if (!path) return '';
    return '<tr><td>' + _apiKeyEsc(cfg.title) + '</td><td><code>' + _apiKeyEsc(path) + '</code></td></tr>';
  }).join('');
}

function renderApiKeyView() {
  var root = document.getElementById('api-key-root');
  if (!root) return;
  var user = typeof getSession === 'function' ? getSession() : null;
  if (!user) return;

  root.innerHTML = '<div class="admin-panel" id="api-key-card"><div class="rdash-comm-loading"><span class="spinner"></span> Carregando sua chave…</div></div>';

  if (typeof DB === 'undefined' || !DB.isConfigured() || typeof DB.getApiKey !== 'function') {
    var card0 = document.getElementById('api-key-card');
    if (card0) card0.innerHTML = '<p class="admin-empty">A chave de API fica disponível quando o servidor está conectado.</p>';
    return;
  }

  DB.getApiKey(user).then(function (res) {
    _renderApiKeyCard(res && res.ok ? res.api_key : null);
    _renderApiKeyDocs();
  }).catch(function () {
    _renderApiKeyCard(null);
    _renderApiKeyDocs();
  });
}

var _apiKeyRevealed = false;

function _renderApiKeyCard(key) {
  var card = document.getElementById('api-key-card');
  if (!card) return;
  _apiKeyRevealed = false;

  if (!key) {
    card.innerHTML =
      '<h3 class="sdash-title" style="margin-bottom:8px;">Sua chave</h3>' +
      '<p class="admin-empty">Não foi possível carregar sua chave agora — confirme que seu plano está ativo e tente de novo.</p>' +
      '<button type="button" class="admin-sync-btn" id="api-key-retry-btn">Tentar novamente</button>';
    var retryBtn = document.getElementById('api-key-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', renderApiKeyView);
    return;
  }

  card.innerHTML =
    '<h3 class="sdash-title" style="margin-bottom:4px;">Sua chave</h3>' +
    '<p class="sdash-sub" style="margin-bottom:16px;">Vale enquanto seu plano estiver ativo. Não compartilhe — quem tiver essa chave consulta usando o seu plano.</p>' +
    '<div class="admin-reset-input" id="api-key-display" style="cursor:text;user-select:all;font-family:monospace;">' + _apiKeyEsc(_apiKeyMask(key)) + '</div>' +
    '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">' +
      '<button type="button" class="admin-sync-btn" id="api-key-toggle-btn">Mostrar</button>' +
      '<button type="button" class="admin-sync-btn" id="api-key-copy-btn">Copiar</button>' +
      '<button type="button" class="admin-bulk-btn danger" id="api-key-regen-btn">Gerar nova chave</button>' +
    '</div>' +
    '<p class="admin-cell-muted" id="api-key-msg" style="margin-top:10px;"></p>';

  var toggleBtn = document.getElementById('api-key-toggle-btn');
  var display = document.getElementById('api-key-display');
  if (toggleBtn && display) {
    toggleBtn.addEventListener('click', function () {
      _apiKeyRevealed = !_apiKeyRevealed;
      display.textContent = _apiKeyRevealed ? key : _apiKeyMask(key);
      toggleBtn.textContent = _apiKeyRevealed ? 'Ocultar' : 'Mostrar';
    });
  }

  var copyBtn = document.getElementById('api-key-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var msg = document.getElementById('api-key-msg');
      var done = function (ok) {
        if (msg) msg.textContent = ok ? 'Chave copiada.' : 'Não foi possível copiar — copie manualmente.';
        if (ok && typeof showToast === 'function') showToast('Chave copiada');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(key).then(function () { done(true); }).catch(function () { done(false); });
      } else {
        done(false);
      }
    });
  }

  var regenBtn = document.getElementById('api-key-regen-btn');
  if (regenBtn) {
    regenBtn.addEventListener('click', function () {
      if (!confirm('Gerar uma nova chave? A chave atual para de funcionar imediatamente — atualize qualquer bot que já esteja usando ela.')) return;
      regenBtn.disabled = true;
      var user = typeof getSession === 'function' ? getSession() : null;
      DB.regenerateApiKey(user).then(function (res) {
        regenBtn.disabled = false;
        if (res && res.ok) {
          _renderApiKeyCard(res.api_key);
          if (typeof showToast === 'function') showToast('Nova chave gerada');
        } else {
          var msg = document.getElementById('api-key-msg');
          if (msg) msg.textContent = (res && res.msg) || 'Erro ao gerar nova chave.';
        }
      }).catch(function () {
        regenBtn.disabled = false;
        var msg = document.getElementById('api-key-msg');
        if (msg) msg.textContent = 'Erro ao gerar nova chave.';
      });
    });
  }
}

function _renderApiKeyDocs() {
  var root = document.getElementById('api-key-root');
  if (!root || document.getElementById('api-key-docs')) return;
  var base = typeof PROXY === 'string' ? PROXY : '';
  var docs = document.createElement('div');
  docs.id = 'api-key-docs';
  docs.innerHTML =
    '<div class="service-info-card" style="margin-top:8px;">' +
      '<h3>Como usar</h3>' +
      '<ul>' +
        '<li>Endpoint base: <code>' + _apiKeyEsc(base) + '</code></li>' +
        '<li>Em toda chamada, envie o header <code>Authorization: Bearer SUA_CHAVE</code></li>' +
        '<li>Limite de 30 requisições por minuto por chave</li>' +
        '<li>Se o plano vencer, a chave para de funcionar até você renovar</li>' +
      '</ul>' +
      '<p class="admin-cell-muted" style="margin-top:10px;">Exemplo (cURL):</p>' +
      '<pre class="api-key-example"><code>curl -H "Authorization: Bearer SUA_CHAVE" \\\n  "' + _apiKeyEsc(base) + '/api/v2/generic/cpf?cpf=12345678900"</code></pre>' +
    '</div>' +
    '<div class="admin-panel">' +
      '<h3 class="sdash-title" style="margin-bottom:12px;">Endpoints disponíveis</h3>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Consulta</th><th>Path</th></tr></thead><tbody>' +
        _apiKeyDocsRows() +
      '</tbody></table></div>' +
    '</div>';
  root.appendChild(docs);
}

window.renderApiKeyView = renderApiKeyView;
