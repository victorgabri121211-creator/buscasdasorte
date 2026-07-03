// API & ENDPOINTS
const PROXY = 'https://ancient-glitter-ad86.victorgabri121211.workers.dev';
const API_KEY = 'fc_45bd2ea61a686168d52faaddbf62fa702a6f824be0e12307b1baab27';
const CONSULT_TIPOS = ['serasa','spc','receita','tse','denatran'];
const _apiCache = new Map();

function isHorarioComercial() {
  const d=new Date(),day=d.getDay(),h=d.getHours();
  return day>=1&&day<=5&&h>=8&&h<18;
}

function getEndpoints() {
  const val = id => document.getElementById(id)?.value ?? '';
  const cpf    = val('f-cpf').replace(/\D/g,'');
  const nome   = val('f-nome').trim();
  const tel    = val('f-tel').replace(/\D/g,'');
  const cep    = val('f-cep').replace(/\D/g,'');
  const placa  = val('f-placa').replace(/[^a-zA-Z0-9]/g,'');
  const rg     = val('f-rg').trim();
  const bin    = val('f-bin').trim();
  const proc   = val('f-processo').trim();
  const irm    = val('f-irmaos').trim();
  const chassi = val('f-chassi').trim();
  const cnpj   = val('f-cnpj').replace(/\D/g,'');
  const pis    = val('f-pis').replace(/\D/g,'');
  const titulo = val('f-titulo').replace(/\D/g,'');
  const ip     = val('f-ip').trim();
  const eps=[];
  if(cpf){
    eps.push({id:'cpf',label:'CPF',path:`/api/v1/search/cpf/${cpf}`});
    CONSULT_TIPOS.forEach(tipo=>{
      const isS=tipo==='serasa';
      eps.push({id:`cc-${tipo}`,label:tipo.charAt(0).toUpperCase()+tipo.slice(1),path:`/api/v1/search/consultcenter/${tipo}/cpf/${cpf}`,serasaLocked:isS&&!isHorarioComercial(),serasaNote:isS});
    });
    eps.push({id:'foto-cpf',label:'Foto CPF',path:`/api/v1/search/foto/cpf/${cpf}`});
    eps.push({id:'score',label:'Score',path:`/api/v1/search/score/cpf/${cpf}`});
    eps.push({id:'foto-sp',label:'Foto SP',path:`/api/v1/search/foto/sp/cpf/${cpf}`});
    eps.push({id:'pais',label:'Pais',path:`/api/v1/search/familiares/pais/${cpf}`});
    eps.push({id:'filhos',label:'Filhos',path:`/api/v1/search/familiares/filhos/${cpf}`});
    eps.push({id:'endereco',label:'Endereço',path:`/api/v1/search/endereco/cpf/${cpf}`});
    eps.push({id:'beneficio',label:'Benefícios INSS',path:`/api/v1/search/beneficio/cpf/${cpf}`});
    eps.push({id:'emprego',label:'Vínculos',path:`/api/v1/search/emprego/cpf/${cpf}`});
    eps.push({id:'foto-rg',label:'Foto RG',path:`/api/v1/search/foto/rg/cpf/${cpf}`});
  }
  if(nome){
    eps.push({id:'nome',label:'Nome',path:`/api/v1/search/nome/${encodeURIComponent(nome)}`});
    eps.push({id:'foto-pe',label:'Foto PE',path:`/api/v1/search/foto/pe/nome/${encodeURIComponent(nome)}`});
  }
  if(tel) eps.push({id:'tel',label:'Telefone',path:`/api/v1/search/telefone/${tel}`});
  if(cep) eps.push({id:'cep',label:'CEP',path:`/api/v1/search/cep/${cep}`});
  if(placa) eps.push({id:'placa',label:'Placa',path:`/api/v1/search/placa/${placa}`});
  if(chassi) eps.push({id:'chassi',label:'Chassi',path:`/api/v1/search/chassi/${chassi}`});
  if(rg) eps.push({id:'rg',label:'RG',path:`/api/v1/search/rg/${rg}`});
  if(bin) eps.push({id:'bin',label:'BIN',path:`/api/v1/search/bin/${bin}`});
  if(proc) eps.push({id:'proc',label:'Processo',path:`/api/v1/search/processo/${proc}`});
  if(irm) eps.push({id:'irm',label:'Irmãos',path:`/api/v1/search/familiares/irmaos/${encodeURIComponent(irm)}`});
  if(cnpj) eps.push({id:'cnpj',label:'CNPJ',path:`/api/v1/search/cnpj/${cnpj}`});
  if(pis) eps.push({id:'pis',label:'PIS/PASEP',path:`/api/v1/search/pis/${pis}`});
  if(titulo) eps.push({id:'titulo',label:'Título Eleitor',path:`/api/v1/search/titulo/${titulo}`});
  if(ip) eps.push({id:'ip',label:'IP',path:`/api/v1/search/ip/${ip}`});
  return eps;
}

let selectedIds=new Set(), allEndpoints=[];

function renderPills(){
  const c=document.getElementById('pills-container');
  allEndpoints=getEndpoints();
  if(!allEndpoints.length){c.innerHTML='<span style="font-size:13px;color:var(--text3)">Preencha um campo para ver as opções</span>';return;}
  c.innerHTML=allEndpoints.map(ep=>{
    const active=selectedIds.has(ep.id)?'active':'';
    const locked=ep.serasaLocked?'disabled':'';
    const hc=ep.serasaNote?`<span class="hc">H.C.</span>`:'';
    return `<div class="pill ${active} ${locked}" onclick="togglePill('${ep.id}')">${ep.label}${hc}</div>`;
  }).join('');
}

function togglePill(id){
  const ep=allEndpoints.find(e=>e.id===id);
  if(!ep||ep.serasaLocked)return;
  if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);
  renderPills();
}

let _dPillTimer;
document.querySelectorAll('.field-input').forEach(inp=>{
  inp.addEventListener('input',()=>{selectedIds.clear();clearTimeout(_dPillTimer);_dPillTimer=setTimeout(renderPills,150);});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')executarBusca();});
});

document.getElementById('f-cpf').addEventListener('input', function() { applyMask(this, 'cpf'); });
document.getElementById('f-tel').addEventListener('input', function() { applyMask(this, 'tel'); });
document.getElementById('f-cep').addEventListener('input', function() { applyMask(this, 'cep'); });
document.getElementById('f-placa').addEventListener('input', function() { applyMask(this, 'placa'); });
document.getElementById('f-cnpj').addEventListener('input', function() { applyMask(this, 'cnpj'); });
document.getElementById('f-pis').addEventListener('input', function() { applyMask(this, 'pis'); });

function fetchComTimeout(ep){
  const cacheKey = ep.path + '|' + (ep.isNegativacao ? getNegativKey() : API_KEY);
  if (_apiCache.has(cacheKey)) return Promise.resolve(_apiCache.get(cacheKey));
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),15000);
  const key = ep.isNegativacao ? getNegativKey() : API_KEY;
  return fetch(PROXY+ep.path,{headers:{'X-Api-Key':key},signal:ctrl.signal})
    .then(r=>r.json().then(d=>{
      clearTimeout(t);
      const res={ep,ok:r.ok,status:r.status,data:d};
      if(r.ok) _apiCache.set(cacheKey,res);
      return res;
    }))
    .catch(err=>{clearTimeout(t);return{ep,ok:false,status:0,data:{error:err.name==='AbortError'?'Timeout (15s)':err.message}};});
}

async function executarBusca(){
  allEndpoints=getEndpoints();
  let toSearch=allEndpoints.filter(ep=>selectedIds.has(ep.id)&&!ep.serasaLocked);
  if(!toSearch.length)toSearch=allEndpoints.filter(ep=>!ep.serasaLocked);
  if(!toSearch.length){showError('Nenhum campo preenchido.');return;}

  const area=document.getElementById('result-area');
  area.innerHTML='';

  const serasaLocked=allEndpoints.filter(ep=>ep.serasaLocked);
  if(serasaLocked.length){
    const w=document.createElement('div');w.className='status-bar warn';
    w.textContent='Serasa disponível apenas em horário comercial (seg–sex, 8h–18h)';
    area.appendChild(w);
  }

  const contEl=document.createElement('div');contEl.className='status-bar loading';
  contEl.innerHTML=`<span class="spinner"></span><span id="contador"> 0 de ${toSearch.length} consultas concluídas</span>`;
  area.prepend(contEl);

  let done=0;
  const allResults = [];
  await Promise.allSettled(toSearch.map(ep=>fetchComTimeout(ep).then(res=>{
    done++;
    allResults.push(res);
    const el=document.getElementById('contador');
    if(el)el.textContent=` ${done} de ${toSearch.length} consultas concluídas`;
  })));

  contEl.className='status-bar success';
  contEl.innerHTML=`${done} consulta${done!==1?'s':''} finalizada${done!==1?'s':''}`;

  const successResults = allResults.filter(r => r && r.ok);

  if (typeof logSearch === 'function') {
    const queryVal = ['f-cpf','f-nome','f-tel','f-email','f-cep','f-placa','f-rg','f-cnpj','f-pis','f-titulo','f-ip']
      .map(id=>document.getElementById(id)?.value?.trim()).find(v=>v) || '';
    logSearch(toSearch.map(e=>e.label).join(', '), queryVal, successResults.length);
  }

  if (successResults.length > 0) {
    const cfg = currentModalKey ? MODAL_CONFIG[currentModalKey] : null;
    const icon = cfg ? cfg.icon : '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>';
    const label = (toSearch[0] ? toSearch[0].label : 'Consulta') + (toSearch.length > 1 ? ' + ' + (toSearch.length-1) + ' mais' : '');
    openDossie(allResults, label.toUpperCase(), icon);
  }
}

function showError(msg){document.getElementById('result-area').innerHTML=`<div class="status-bar error">${msg}</div>`;}

function limparTudo(){
  document.querySelectorAll('.field-input').forEach(i=>i.value='');
  selectedIds.clear();renderPills();
  document.getElementById('result-area').innerHTML='<div class="empty-state"><p>Preencha um campo e clique em buscar</p></div>';
}

function toggleSidebar() {
  const btn = document.getElementById('menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) closeSidebar();
  else {
    btn.classList.add('open');
    sidebar.classList.add('open');
    overlay.classList.add('open');
  }
}

function closeSidebar() {
  document.getElementById('menu-btn').classList.remove('open');
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function focusField(id) {
  const el = document.getElementById(id);
  if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); el.focus(); }
}

renderPills();
