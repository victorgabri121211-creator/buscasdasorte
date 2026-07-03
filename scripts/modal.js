// MODAL DE CONSULTA
const MODAL_CONFIG = {
  // Documentos oficiais
  cpf:      { title: 'Consulta CPF Completa', sub: 'Digite o CPF para buscar', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/>', mask: 'cpf' },
  rg:       { title: 'Consulta RG', sub: 'Digite o número do RG', placeholder: 'Número do RG', field: 'f-rg', icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M2 17l4-4 4 4"/><line x1="14" y1="9" x2="20" y2="9"/><line x1="14" y1="13" x2="18" y2="13"/>', mask: null },
  cnpj:     { title: 'Consulta CNPJ', sub: 'Digite o CNPJ para buscar a empresa', placeholder: '00.000.000/0000-00', field: 'f-cnpj', icon: '<path d="M3 21h18"/><path d="M5 21V4h9v17"/><path d="M14 9h5v12"/><line x1="8" y1="8" x2="10" y2="8"/><line x1="8" y1="12" x2="10" y2="12"/>', mask: 'cnpj' },
  pis:      { title: 'Consulta NIS / PIS', sub: 'Digite o número do NIS/PIS', placeholder: '000.00000.00-0', field: 'f-pis', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>', mask: 'pis' },
  tse:      { title: 'Título de Eleitor (TSE)', sub: 'Disponível em horário comercial (seg–sex, 8h–18h)', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M3 3h18v4H3z"/><path d="M8 7v14"/><path d="M16 7v14"/><path d="M3 12h18"/>', mask: 'cpf' },
  receita:  { title: 'Consulta Receita Federal', sub: 'Disponível em horário comercial (seg–sex, 8h–18h)', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<line x1="12" y1="2" x2="12" y2="6"/><path d="M5 12H2l5-7 5 7h-3v5a2 2 0 0 0 4 0v-5h-3l5-7 5 7h-3"/><line x1="12" y1="18" x2="12" y2="22"/>', mask: 'cpf' },

  // Fotos cadastrais
  'foto-cpf': { title: 'Foto Base CPF', sub: 'Digite o CPF para buscar a foto', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', mask: 'cpf' },
  'foto-sp':  { title: 'Foto (Base SP)', sub: 'Digite o CPF para buscar foto na base SP', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><path d="M9 13a3 3 0 1 0 6 0"/>', mask: 'cpf' },
  'foto-pe':  { title: 'Foto (Base PE)', sub: 'Digite o CPF para buscar foto na base PE', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>', mask: 'cpf' },
  'foto-ma':  { title: 'Foto (Base MA)', sub: 'Digite o CPF para buscar foto na base MA', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', mask: 'cpf' },
  'foto-ro':  { title: 'Foto (Base RO)', sub: 'Digite o CPF para buscar foto na base RO', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', mask: 'cpf' },

  // Nome e família
  nome:     { title: 'Consulta por Nome', sub: 'Digite o nome completo para buscar', placeholder: 'Nome completo', field: 'f-nome', icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', mask: null },
  irmaos:   { title: 'Busca Parentes / Irmãos', sub: 'Digite o nome da mãe para buscar parentes', placeholder: 'Nome da mãe', field: 'f-irmaos', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', mask: null },
  vizinhos: { title: 'Busca Vizinhos', sub: 'Digite o CPF para buscar vizinhos', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', mask: 'cpf' },

  // Contato e localização
  tel:      { title: 'Consulta Telefone', sub: 'Digite o número de telefone', placeholder: '(00) 00000-0000', field: 'f-tel', icon: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.09 3h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.09 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>', mask: 'tel' },
  operadora:{ title: 'Consulta Operadora', sub: 'Digite o telefone para identificar a operadora', placeholder: '(00) 00000-0000', field: 'f-tel', icon: '<path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.48"/><path d="M16.24 7.76a6 6 0 0 1 0 8.48"/><circle cx="12" cy="12" r="1.5"/>', mask: 'tel' },
  email:    { title: 'Busca por E-mail (CPF)', sub: 'Digite o e-mail vinculado ao CPF', placeholder: 'email@exemplo.com', field: 'f-email', icon: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>', mask: null },
  cep:      { title: 'Consulta CEP', sub: 'Digite o CEP para buscar o endereço', placeholder: '00000-000', field: 'f-cep', icon: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', mask: 'cep' },

  // Financeiro e crédito
  score:    { title: 'Consulta Score', sub: 'Digite o CPF para consultar o score', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>', mask: 'cpf' },
  renda:    { title: 'Consulta Renda', sub: 'Digite o CPF para estimar a renda', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', mask: 'cpf' },
  serasa:   { title: 'Consulta Serasa', sub: 'Disponível em horário comercial (seg–sex, 8h–18h)', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<polyline points="2 14 6 10 10 14 14 8 18 11 22 6"/><line x1="2" y1="20" x2="22" y2="20"/>', mask: 'cpf' },
  spc:      { title: 'Consulta SPC', sub: 'Digite o CPF para consultar no SPC', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="2"/>', mask: 'cpf' },
  bin:      { title: 'Consulta BIN Cartão', sub: 'Digite os primeiros 6 dígitos do cartão', placeholder: '000000', field: 'f-bin', icon: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>', mask: null },

  // Veículos
  denatran: { title: 'Consulta Denatran', sub: 'Disponível em horário comercial (seg–sex, 8h–18h)', placeholder: '000.000.000-00', field: 'f-cpf', icon: '<rect x="1" y="8" width="22" height="10" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>', mask: 'cpf' },
  placa:    { title: 'Consulta Placa', sub: 'Digite a placa do veículo', placeholder: 'ABC-1234', field: 'f-placa', icon: '<rect x="2" y="7" width="20" height="10" rx="2"/><line x1="6" y1="11" x2="6" y2="13"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="18" y1="11" x2="18" y2="13"/>', mask: null },
  chassi:   { title: 'Consulta Chassi', sub: 'Digite o número do chassi', placeholder: 'Número do chassi', field: 'f-chassi', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>', mask: null },

  // Jurídico
  processo: { title: 'Consulta Processo', sub: 'Digite o número do processo judicial', placeholder: 'Número do processo', field: 'f-processo', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', mask: null },
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
  document.querySelectorAll('.field-input').forEach(i => i.value = '');
  selectedIds.clear();

  closeModal();
  executarBusca();
}