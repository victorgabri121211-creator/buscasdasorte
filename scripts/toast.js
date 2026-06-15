// Sistema de toast — substitui alert() em toda a aplicação
(function (global) {
  'use strict';

  var _container = null;

  function _getContainer() {
    if (_container) return _container;
    _container = document.createElement('div');
    _container.id = 'bds-toast-container';
    _container.setAttribute('aria-live', 'polite');
    _container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(_container);
    return _container;
  }

  function showToast(msg, type, durationMs) {
    var container = _getContainer();
    var toast = document.createElement('div');
    toast.className = 'bds-toast bds-toast--' + (type || 'info');
    toast.setAttribute('role', 'alert');

    var icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
      error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warn:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    toast.innerHTML =
      '<span class="bds-toast__icon" aria-hidden="true">' + (icons[type] || icons.info) + '</span>' +
      '<span class="bds-toast__msg">' + String(msg).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span>' +
      '<button class="bds-toast__close" aria-label="Fechar" type="button">&#x2715;</button>';

    toast.querySelector('.bds-toast__close').addEventListener('click', function () {
      _dismiss(toast);
    });

    container.appendChild(toast);

    // força reflow para animação de entrada
    void toast.offsetWidth;
    toast.classList.add('bds-toast--in');

    var ms = typeof durationMs === 'number' ? durationMs : (type === 'error' ? 5000 : 3500);
    var timer = setTimeout(function () { _dismiss(toast); }, ms);

    toast._timer = timer;
    return toast;
  }

  function _dismiss(toast) {
    if (!toast || toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timer);
    toast.classList.remove('bds-toast--in');
    toast.classList.add('bds-toast--out');
    toast.addEventListener('animationend', function handler() {
      toast.removeEventListener('animationend', handler);
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  }

  global.showToast = showToast;

})(typeof window !== 'undefined' ? window : global);
