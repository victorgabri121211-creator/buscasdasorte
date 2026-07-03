// UTILITÁRIOS
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function applyMask(input, maskType) {
  let v = input.value;
  if (maskType === 'cpf') {
    v = v.replace(/\D/g,'').slice(0,11);
    if(v.length>9) v=v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,'$1.$2.$3-$4');
    else if(v.length>6) v=v.replace(/(\d{3})(\d{3})(\d{0,3})/,'$1.$2.$3');
    else if(v.length>3) v=v.replace(/(\d{3})(\d{0,3})/,'$1.$2');
  } else if (maskType === 'tel') {
    v = v.replace(/\D/g,'').slice(0,11);
    if(v.length>7) v=v.length===11
      ? v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3')
      : v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
    else if(v.length>2) v=v.replace(/(\d{2})(\d{0,5})/,'($1) $2');
  } else if (maskType === 'cep') {
    v = v.replace(/\D/g,'').slice(0,8);
    if(v.length>5) v=v.replace(/(\d{5})(\d{0,3})/,'$1-$2');
  } else if (maskType === 'placa') {
    v = v.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,7);
    if(v.length>3) v=v.slice(0,3)+'-'+v.slice(3);
  } else if (maskType === 'cnpj') {
    v = v.replace(/\D/g,'').slice(0,14);
    if(v.length>12) v=v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,'$1.$2.$3/$4-$5');
    else if(v.length>8) v=v.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/,'$1.$2.$3/$4');
    else if(v.length>5) v=v.replace(/(\d{2})(\d{3})(\d{0,3})/,'$1.$2.$3');
    else if(v.length>2) v=v.replace(/(\d{2})(\d{0,3})/,'$1.$2');
  } else if (maskType === 'pis') {
    v = v.replace(/\D/g,'').slice(0,11);
    if(v.length>9) v=v.replace(/(\d{3})(\d{5})(\d{2})(\d{0,1})/,'$1.$2.$3-$4');
    else if(v.length>8) v=v.replace(/(\d{3})(\d{5})(\d{0,2})/,'$1.$2.$3');
    else if(v.length>3) v=v.replace(/(\d{3})(\d{0,5})/,'$1.$2');
  }
  input.value = v;
}
