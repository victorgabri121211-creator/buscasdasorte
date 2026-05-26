// PIX via MisticPay — credenciais ficam no Cloudflare Worker (env vars)

const PIX_PLANS = {
  diaria: { label: 'Diária',   amount: 5.5  },
  semana: { label: '1 Semana', amount: 20.5 },
  mes:    { label: '1 Mês',    amount: 25.5 },
};

let _pixPlan      = null;
let _pixPollTimer = null;
let _pixMode      = 'plan'; // 'plan' | 'reseller'
let _resellerPkg  = null;
let _pixTxId      = null;

// ── Abrir modal (plano cliente) ──────────────────────────────────────────
function openPixPayment(planId) {
  const plan = PIX_PLANS[planId];
  if (!plan) return;
  _pixPlan = planId;
  _pixMode = 'plan';

  const nameEl = document.getElementById('pix-name');
  const cpfEl  = document.getElementById('pix-cpf');
  if (nameEl) nameEl.value = '';
  if (cpfEl)  cpfEl.value  = '';
  _pixMsg('');

  document.getElementById('pix-plan-label').textContent = 'Plano ' + plan.label;
  document.getElementById('pix-plan-price').textContent  =
    'R$ ' + plan.amount.toFixed(2).replace('.', ',');

  _pixState('form');
  document.getElementById('pix-overlay').classList.add('open');
}

// ── Abrir modal (pacote revendedor) ──────────────────────────────────────
function openResellerPixPayment(pkg) {
  if (!pkg) return;
  _resellerPkg = pkg;
  _pixMode = 'reseller';

  const nameEl = document.getElementById('pix-name');
  const cpfEl  = document.getElementById('pix-cpf');
  if (nameEl) nameEl.value = '';
  if (cpfEl)  cpfEl.value  = '';
  _pixMsg('');

  document.getElementById('pix-plan-label').textContent = pkg.logins + ' créditos de login';
  document.getElementById('pix-plan-price').textContent  =
    'R$ ' + pkg.price.toFixed(2).replace('.', ',');

  _pixState('form');
  document.getElementById('pix-overlay').classList.add('open');
}

function closePixPayment() {
  clearInterval(_pixPollTimer);
  document.getElementById('pix-overlay').classList.remove('open');
}

// ── Estado do modal ──────────────────────────────────────────────────────
function _pixState(state) {
  ['pix-form', 'pix-qr', 'pix-success'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = (id !== 'pix-' + state);
  });
}

function _pixMsg(msg) {
  const el = document.getElementById('pix-msg');
  if (el) el.textContent = msg;
}

// ── Enviar formulário → gerar cobrança ───────────────────────────────────
async function submitPixForm() {
  const name = (document.getElementById('pix-name')?.value || '').trim();
  const cpf  = (document.getElementById('pix-cpf')?.value  || '').replace(/\D/g, '');

  if (!name)          { _pixMsg('Informe seu nome completo.');      return; }
  if (cpf.length !== 11) { _pixMsg('CPF inválido — 11 dígitos.'); return; }

  let amount, description;
  if (_pixMode === 'reseller') {
    if (!_resellerPkg) return;
    amount      = _resellerPkg.price;
    description = 'BuscasDasorte - Pacote ' + _resellerPkg.logins + ' logins';
  } else {
    const plan = PIX_PLANS[_pixPlan];
    if (!plan) return;
    amount      = plan.amount;
    description = 'BuscasDasorte - Plano ' + plan.label;
  }

  const btn = document.getElementById('pix-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando…'; }
  _pixMsg('');

  const txId = 'bds' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  _pixTxId = txId;

  try {
    const resp = await fetch(PROXY + '/pix/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        payerName:     name,
        payerDocument: cpf,
        transactionId: txId,
        description,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.message || data.error || 'Erro ao gerar cobrança PIX.');
    }

    // MisticPay retorna { message, data: { qrCodeBase64, copyPaste, ... } }
    const payload   = (data.data && typeof data.data === 'object') ? data.data : data;
    const qrBase64  = payload.qrCodeBase64 || payload.qrcode || payload.qr_code || '';
    const copyPaste = payload.copyPaste    || payload.brcode  || payload.pix     || '';

    if (!qrBase64 && !copyPaste) {
      throw new Error(data.message || 'Erro ao gerar cobrança PIX.');
    }

    if (qrBase64) {
      const src = qrBase64.startsWith('data:') ? qrBase64 : 'data:image/png;base64,' + qrBase64;
      document.getElementById('pix-qr-img').src = src;
    }
    document.getElementById('pix-copy-paste').value = copyPaste;

    _pixState('qr');
    _pixStartPolling(txId);

  } catch (e) {
    _pixMsg(e.message || 'Erro ao gerar PIX. Tente novamente.');
    if (btn) { btn.disabled = false; btn.textContent = 'Gerar PIX'; }
  }
}

// ── Polling de status ─────────────────────────────────────────────────────
const _PIX_OK  = new Set(['APPROVED','COMPLETO','PAID','COMPLETED','PAGO','CONCLUIDO','CONCLUÍDA','SUCCESS','SUCESSO','DONE','AUTHORIZED','AUTORIZADO']);
const _PIX_ERR = new Set(['FALHA','FAILED','REFUSED','RECUSADO','REJECTED','CANCELADO','CANCELLED','EXPIRED','EXPIRADO','ERROR']);

function _pixFindStatus(obj, depth) {
  if (!obj || typeof obj !== 'object' || depth > 4) return '';
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string' && val.length > 2 && val.length < 30) {
      const up = val.toUpperCase();
      if (_PIX_OK.has(up) || _PIX_ERR.has(up)) return up;
    }
    if (typeof val === 'object') {
      const found = _pixFindStatus(val, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

function _pixStartPolling(txId) {
  clearInterval(_pixPollTimer);
  _pixPollTimer = setInterval(async () => {
    try {
      const resp = await fetch(PROXY + '/pix/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId }),
      });
      const data = await resp.json();
      console.log('[PIX poll]', JSON.stringify(data));

      const status = _pixFindStatus(data, 0);

      if (_PIX_OK.has(status)) {
        clearInterval(_pixPollTimer);
        _pixOnConfirmed();
      } else if (_PIX_ERR.has(status)) {
        clearInterval(_pixPollTimer);
        _pixState('form');
        _pixMsg('Pagamento não aprovado. Tente novamente.');
      }
    } catch (_) { /* ignora erros de rede no polling */ }
  }, 5000);
}

// ── Pagamento confirmado ─────────────────────────────────────────────────
function _pixOnConfirmed() {
  const subtitleEl = document.querySelector('#pix-success .pix-subtitle');
  const actionBtn  = document.getElementById('pix-success-btn');

  if (_pixMode === 'reseller') {
    const user = typeof getSession === 'function' ? getSession() : null;
    if (user && typeof addResellerCredits === 'function' && _resellerPkg) {
      addResellerCredits(user, _resellerPkg.logins);
    }
    if (typeof recordSale === 'function' && _resellerPkg) {
      recordSale({
        txId:      _pixTxId,
        category:  'reseller',
        productId: String(_resellerPkg.logins),
        label:     _resellerPkg.logins + ' logins',
        amount:    _resellerPkg.price,
        buyer:     user || '—',
      });
    }
    if (subtitleEl) subtitleEl.textContent = (_resellerPkg ? _resellerPkg.logins : '') + ' créditos adicionados. Você já pode criar logins!';
    if (actionBtn) {
      actionBtn.textContent = 'Abrir painel';
      actionBtn.onclick = () => {
        closePixPayment();
        if (typeof openResellerPanel === 'function') openResellerPanel();
      };
    }
    if (typeof renderResellerDashboard === 'function') renderResellerDashboard();
  } else {
    const user = typeof getSession === 'function' ? getSession() : null;
    if (typeof activatePlan === 'function') activatePlan(_pixPlan);
    const planDef = PIX_PLANS[_pixPlan];
    if (typeof recordSale === 'function' && planDef) {
      recordSale({
        txId:      _pixTxId,
        category:  'plan',
        productId: _pixPlan,
        label:     'Plano ' + planDef.label,
        amount:    planDef.amount,
        buyer:     user || '—',
      });
    }
    if (subtitleEl) subtitleEl.textContent = 'Seu plano foi ativado. Boas consultas!';
    if (actionBtn) {
      actionBtn.textContent = 'Acessar módulos';
      actionBtn.onclick = () => { closePixPayment(); showAppView('modules'); };
    }
  }

  _pixState('success');
}

// ── Copiar código PIX ────────────────────────────────────────────────────
function pixCopyCode() {
  const val = document.getElementById('pix-copy-paste')?.value || '';
  if (!val) return;
  const btn = document.getElementById('pix-copy-btn');
  navigator.clipboard.writeText(val).then(() => {
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Copiado!';
      setTimeout(() => btn.textContent = orig, 2000);
    }
  }).catch(() => {
    const el = document.getElementById('pix-copy-paste');
    if (el) { el.select(); document.execCommand('copy'); }
  });
}

// ── Máscara CPF no formulário de pagamento ───────────────────────────────
const _pixCpfEl = document.getElementById('pix-cpf');
if (_pixCpfEl) {
  _pixCpfEl.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
    this.value = v;
  });
  _pixCpfEl.addEventListener('keydown', e => { if (e.key === 'Enter') submitPixForm(); });
}

window.openPixPayment         = openPixPayment;
window.openResellerPixPayment = openResellerPixPayment;
window.closePixPayment        = closePixPayment;
window.submitPixForm          = submitPixForm;
window.pixCopyCode            = pixCopyCode;
