// Integração de consulta de dados removida.
// Este arquivo mantém apenas funções de interface (menu, limpar campos).

let selectedIds = new Set(), allEndpoints = [];

function renderPills() {
  const c = document.getElementById('pills-container');
  if (!c) return;
  c.innerHTML = '<span style="font-size:13px;color:var(--text3)">Consulta indisponível.</span>';
}

function togglePill() {}

document.querySelectorAll('.field-input').forEach(inp => {
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') executarBusca(); });
});

['f-cpf|cpf','f-tel|tel','f-cep|cep','f-placa|placa','f-cnpj|cnpj','f-pis|pis'].forEach(pair => {
  const [id, mask] = pair.split('|');
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', function () { applyMask(this, mask); });
});

function executarBusca() {
  const area = document.getElementById('result-area');
  if (area) area.innerHTML = '<div class="status-bar warn">Consulta indisponível.</div>';
}

function showError(msg) {
  const area = document.getElementById('result-area');
  if (area) area.innerHTML = `<div class="status-bar error">${msg}</div>`;
}

function limparTudo() {
  document.querySelectorAll('.field-input').forEach(i => i.value = '');
  selectedIds.clear();
  renderPills();
  const area = document.getElementById('result-area');
  if (area) area.innerHTML = '<div class="empty-state"><p>Consulta indisponível.</p></div>';
}

function toggleSidebar() {
  const btn = document.getElementById('menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  if (sidebar.classList.contains('open')) closeSidebar();
  else {
    btn.classList.add('open');
    sidebar.classList.add('open');
    overlay.classList.add('open');
  }
}

function closeSidebar() {
  document.getElementById('menu-btn')?.classList.remove('open');
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}

function focusField(id) {
  const el = document.getElementById(id);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
}

renderPills();
