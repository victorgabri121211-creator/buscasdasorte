// MODAL DE CONSULTA
const MODAL_CONFIG = {
  cpf:      { title: 'Consulta por CPF', sub: 'Digite o CPF para buscar', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/>', mask: 'cpf' },
  serasa:   { title: 'Consulta Serasa', sub: 'Disponível em horário comercial (seg–sex, 8h–18h)', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<polyline points="2 14 6 10 10 14 14 8 18 11 22 6"/><line x1="2" y1="20" x2="22" y2="20"/>', mask: 'cpf' },
  spc:      { title: 'Consulta SPC', sub: 'Digite o CPF para consultar no SPC', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="2"/>', mask: 'cpf' },
  receita:  { title: 'Receita Federal', sub: 'Digite o CPF para consultar na Receita', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<line x1="12" y1="2" x2="12" y2="6"/><path d="M5 12H2l5-7 5 7h-3v5a2 2 0 0 0 4 0v-5h-3l5-7 5 7h-3"/><line x1="12" y1="18" x2="12" y2="22"/>', mask: 'cpf' },
  tse:      { title: 'Consulta TSE', sub: 'Digite o CPF para consultar no TSE', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M3 3h18v4H3z"/><path d="M8 7v14"/><path d="M16 7v14"/><path d="M3 12h18"/>', mask: 'cpf' },
  denatran: { title: 'Consulta Denatran', sub: 'Digite o CPF para consultar no Denatran', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<rect x="1" y="8" width="22" height="10" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>', mask: 'cpf' },
  score:    { title: 'Score de Crédito', sub: 'Digite o CPF para consultar o score', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>', mask: 'cpf' },
  'foto-cpf': { title: 'Foto por CPF', sub: 'Digite o CPF para buscar a foto', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', mask: 'cpf' },
  'foto-sp':  { title: 'Foto SP', sub: 'Digite o CPF para buscar foto em SP', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><path d="M9 13a3 3 0 1 0 6 0"/>', mask: 'cpf' },
  nome:     { title: 'Consulta por Nome', sub: 'Digite o nome completo para buscar', placeholder: 'Nome completo', field: 'f-nome', icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', mask: null },
  tel:      { title: 'Consulta por Telefone', sub: 'Digite o número de telefone', placeholder: '(00) 00000-0000', field: 'f-tel', icon: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.09 3h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.09 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>', mask: 'tel' },
  email:    { title: 'Consulta por Email', sub: 'Digite o endereço de email', placeholder: 'email@exemplo.com', field: 'f-email', icon: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>', mask: null },
  cep:      { title: 'Consulta por CEP', sub: 'Digite o CEP para buscar o endereço', placeholder: '00000-000', field: 'f-cep', icon: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', mask: 'cep' },
  placa:    { title: 'Consulta por Placa', sub: 'Digite a placa do veículo', placeholder: 'ABC-1234', field: 'f-placa', icon: '<rect x="2" y="7" width="20" height="10" rx="2"/><line x1="6" y1="11" x2="6" y2="13"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="18" y1="11" x2="18" y2="13"/>', mask: null },
  rg:       { title: 'Consulta por RG', sub: 'Digite o número do RG', placeholder: 'Número do RG', field: 'f-rg', icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M2 17l4-4 4 4"/><line x1="14" y1="9" x2="20" y2="9"/><line x1="14" y1="13" x2="18" y2="13"/>', mask: null },
  chassi:   { title: 'Consulta por Chassi', sub: 'Digite o número do chassi', placeholder: 'Número do chassi', field: 'f-chassi', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>', mask: null },
  bin:      { title: 'Consulta por BIN', sub: 'Digite os primeiros 6 dígitos do cartão', placeholder: '000000', field: 'f-bin', icon: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>', mask: null },
  processo: { title: 'Consulta de Processo', sub: 'Digite o número do processo judicial', placeholder: 'Número do processo', field: 'f-processo', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', mask: null },
  irmaos:   { title: 'Consulta de Irmãos', sub: 'Digite o nome da mãe para buscar irmãos', placeholder: 'Nome da mãe', field: 'f-irmaos', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', mask: null },
  'foto-pe': { title: 'Foto PE', sub: 'Digite o nome completo para buscar foto em PE', placeholder: 'Nome completo', field: 'f-nome', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>', mask: null },
  'negativacao': { title: 'Negativação', sub: 'Rota restrita — requer chave com cargo "negativacao". Disponível seg–sex, 8h–18h.', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', mask: 'cpf', isNegativacao: true },
};

let currentModalKey = null;

function openModal(key) {
  const cfg = MODAL_CONFIG[key];
  if (!cfg) return;
  currentModalKey = key;

  document.getElementById('modal-icon').innerHTML = cfg.icon;
  document.getElementById('modal-title').textContent = cfg.title;
  document.getElementById('modal-sub').textContent = cfg.sub;
  const inp = document.getElementById('modal-input');
  inp.placeholder = cfg.placeholder;
  inp.value = '';
  inp.setAttribute('data-mask', cfg.mask || '');

  // Negativacao: check key + business hours
  if (cfg.isNegativacao) {
    const negativKey = getNegativKey();
    if (!negativKey) {
      closeModal();
      openNegativSettings();
      return;
    }
    if (!isHorarioComercial()) {
      document.getElementById('modal-overlay').classList.add('open');
      setTimeout(() => {
        inp.disabled = true;
        document.querySelector('.modal-btn-search').disabled = true;
        document.querySelector('.modal-btn-search').style.opacity = '0.4';
        document.getElementById('modal-sub').innerHTML = '⚠️ Fora do horário comercial. Disponível seg–sex, 8h–18h.';
      }, 50);
      return;
    }
    inp.disabled = false;
  }
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => inp.focus(), 120);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  currentModalKey = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

document.getElementById('modal-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') runModalSearch();
});

document.getElementById('modal-input').addEventListener('input', function() {
  applyMask(this, this.getAttribute('data-mask'));
});

function runModalSearch() {
  const cfg = MODAL_CONFIG[currentModalKey];
  if (!cfg) return;
  const val = document.getElementById('modal-input').value.trim();
  if (!val) {
    document.getElementById('modal-input').focus();
    document.getElementById('modal-input').style.borderColor = 'rgba(255,69,58,0.5)';
    setTimeout(() => document.getElementById('modal-input').style.borderColor = '', 1000);
    return;
  }
  // Clear ALL fields and results before new search
  document.querySelectorAll('.field-input').forEach(i => i.value = '');
  selectedIds.clear();
  document.getElementById('result-area').innerHTML = '<div class="empty-state"><p>Preencha um campo e clique em buscar</p></div>';
  // Fill only the selected field and trigger search
  const field = document.getElementById(cfg.field);
  if (field) { field.value = val; field.dispatchEvent(new Event('input')); }

  // Negativacao: direct fetch bypassing pills
  if (currentModalKey === 'negativacao') {
    closeModal();
    const cpf = val.replace(/\D/g,'');
    const ep = { id:'negativacao', label:'Negativação', path:`/api/v1/search/consultcenter/negativacao/cpf/${cpf}`, isNegativacao: true };
    runDirectSearch([ep], 'Negativação', MODAL_CONFIG.negativacao.icon);
    return;
  }

  // For CPF-based consultcenter queries, pre-select only that pill
  if (['serasa','spc','receita','tse','denatran','score','foto-cpf','foto-sp'].includes(currentModalKey)) {
    const pillId = ['serasa','spc','receita','tse','denatran'].includes(currentModalKey)
      ? 'cc-' + currentModalKey
      : currentModalKey;
    selectedIds.clear();
    selectedIds.add(pillId);
    renderPills();
  }

  closeModal();
  setTimeout(() => executarBusca(), 100);
}

async function runDirectSearch(eps, label, iconSvg) {
  const area = document.getElementById('result-area');
  area.innerHTML = '';
  const contEl = document.createElement('div');
  contEl.className = 'status-bar loading';
  contEl.innerHTML = `<span class="spinner"></span><span id="contador"> Consultando ${label}...</span>`;
  area.prepend(contEl);

  const allResults = [];
  await Promise.allSettled(eps.map(ep => fetchComTimeout(ep).then(res => {
    allResults.push(res);
  })));

  contEl.className = 'status-bar success';
  contEl.innerHTML = `${allResults.length} consulta finalizada`;

  const successResults = allResults.filter(r => r && r.ok);
  if (typeof logSearch === 'function') logSearch(label, label, successResults.length);
  if (successResults.length > 0) openDossie(allResults, label.toUpperCase(), iconSvg);
}