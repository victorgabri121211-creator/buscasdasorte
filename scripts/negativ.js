// NEGATIVAÇÃO
const NEGATIV_KEY_STORE = 'bds_negativ_key';
function getNegativKey() { return localStorage.getItem(NEGATIV_KEY_STORE) || ''; }
function saveNegativKey() {
  const val = document.getElementById('negativ-key-input').value.trim();
  if (!val) {
    showNegativMsg('Cole a chave antes de salvar', 'error'); return;
  }
  localStorage.setItem(NEGATIV_KEY_STORE, val);
  showNegativMsg('Chave salva com sucesso!', 'success');
  setTimeout(() => closeNegativSettings(), 1400);
}
function showNegativMsg(msg, type) {
  const el = document.getElementById('negativ-msg');
  el.textContent = msg; el.className = 'auth-msg ' + type;
}
function openNegativSettings() {
  const inp = document.getElementById('negativ-key-input');
  inp.value = getNegativKey();
  document.getElementById('negativ-msg').className = 'auth-msg';
  document.getElementById('negativ-overlay').classList.add('open');
  setTimeout(() => inp.focus(), 120);
}
function closeNegativSettings() {
  document.getElementById('negativ-overlay').classList.remove('open');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeNegativSettings(); }
});