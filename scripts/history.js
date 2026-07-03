// Histórico de consultas do usuário (recentes + favoritos + busca em lote)
(function (global) {
  'use strict';

  var HISTORY_KEY = 'bds_search_history';
  var MAX_PER_USER = 120;

  function _user() {
    return typeof getSession === 'function' ? (getSession() || '') : '';
  }

  function _store() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {}; } catch (e) { return {}; }
  }

  function _save(store) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(store)); } catch (e) {}
  }

  function getHistory(user) {
    var u = user || _user();
    if (!u) return [];
    var list = _store()[u];
    return Array.isArray(list) ? list : [];
  }

  // Registra uma consulta. Dedup: mesma chave+termo em 60s só atualiza.
  function recordSearch(entry) {
    var u = _user();
    if (!u || !entry) return;
    var term = String(entry.term || '').trim();
    if (!term) return;
    var store = _store();
    if (!Array.isArray(store[u])) store[u] = [];
    var list = store[u];

    var now = Date.now();
    var dup = list.find(function (h) {
      return h.field === entry.field && h.term === term && (now - h.ts) < 60000;
    });
    if (dup) {
      dup.ts = now;
      dup.count = entry.count != null ? entry.count : dup.count;
      dup.label = entry.label || dup.label;
    } else {
      list.unshift({
        id: 'h' + now + Math.random().toString(36).slice(2, 6),
        ts: now,
        label: entry.label || 'Consulta',
        term: term,
        field: entry.field || '',
        key: entry.key || '',
        count: entry.count != null ? entry.count : null,
        fav: false,
      });
    }
    // Mantém favoritos + os mais recentes até o limite.
    if (list.length > MAX_PER_USER) {
      var favs = list.filter(function (h) { return h.fav; });
      var rest = list.filter(function (h) { return !h.fav; }).slice(0, MAX_PER_USER - favs.length);
      store[u] = favs.concat(rest).sort(function (a, b) { return b.ts - a.ts; });
    }
    _save(store);
  }

  function toggleFavorite(id) {
    var u = _user();
    var store = _store();
    var list = store[u] || [];
    var it = list.find(function (h) { return h.id === id; });
    if (it) { it.fav = !it.fav; _save(store); }
    return it ? it.fav : false;
  }

  function removeEntry(id) {
    var u = _user();
    var store = _store();
    if (!Array.isArray(store[u])) return;
    store[u] = store[u].filter(function (h) { return h.id !== id; });
    _save(store);
  }

  function clearHistory(keepFavorites) {
    var u = _user();
    var store = _store();
    if (keepFavorites) {
      store[u] = (store[u] || []).filter(function (h) { return h.fav; });
    } else {
      store[u] = [];
    }
    _save(store);
  }

  // Reexecuta uma consulta preenchendo o campo primário e disparando a busca.
  function rerunSearch(id) {
    var it = getHistory().find(function (h) { return h.id === id; });
    if (!it) return;
    closeHistoryPanel();
    if (typeof showAppView === 'function') showAppView('search');
    setTimeout(function () {
      try {
        document.querySelectorAll('.field-input').forEach(function (i) { i.value = ''; });
        if (typeof selectedIds !== 'undefined' && selectedIds.clear) selectedIds.clear();
        var field = it.field ? document.getElementById(it.field) : null;
        if (field) {
          field.value = it.term;
          field.dispatchEvent(new Event('input'));
        }
        if (typeof executarBusca === 'function') executarBusca();
      } catch (e) {}
    }, 60);
  }

  // ── Painel ────────────────────────────────────────────────────────────────
  var _histTab = 'recent';

  function _fmtTime(ts) {
    var d = new Date(ts);
    var now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return 'Hoje ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
           d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _rows(list) {
    if (!list.length) {
      return '<p class="hist-empty">Nenhuma consulta ' + (_histTab === 'fav' ? 'favoritada' : 'registrada') + ' ainda.</p>';
    }
    return list.map(function (h) {
      var countTxt = h.count == null ? '' :
        '<span class="hist-count">' + h.count + ' resultado' + (h.count !== 1 ? 's' : '') + '</span>';
      return '<div class="hist-row">' +
        '<button type="button" class="hist-fav' + (h.fav ? ' on' : '') + '" data-hist-fav="' + h.id + '" title="Favoritar" aria-label="Favoritar">' +
          '<svg viewBox="0 0 24 24" fill="' + (h.fav ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
        '</button>' +
        '<div class="hist-main" data-hist-run="' + h.id + '">' +
          '<div class="hist-line"><span class="hist-label">' + _esc(h.label) + '</span>' + countTxt + '</div>' +
          '<div class="hist-term">' + _esc(h.term) + '</div>' +
        '</div>' +
        '<div class="hist-tail">' +
          '<span class="hist-time">' + _esc(_fmtTime(h.ts)) + '</span>' +
          '<button type="button" class="hist-rerun" data-hist-run="' + h.id + '" title="Refazer consulta">↻</button>' +
          '<button type="button" class="hist-del" data-hist-del="' + h.id + '" title="Remover">✕</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderHistoryPanel() {
    var body = document.getElementById('hist-body');
    if (!body) return;
    var all = getHistory().slice().sort(function (a, b) { return b.ts - a.ts; });
    var list = _histTab === 'fav' ? all.filter(function (h) { return h.fav; }) : all;
    body.innerHTML = '<div class="hist-list">' + _rows(list) + '</div>';

    body.querySelectorAll('[data-hist-run]').forEach(function (el) {
      el.addEventListener('click', function () { rerunSearch(el.getAttribute('data-hist-run')); });
    });
    body.querySelectorAll('[data-hist-fav]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleFavorite(el.getAttribute('data-hist-fav'));
        renderHistoryPanel();
      });
    });
    body.querySelectorAll('[data-hist-del]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        removeEntry(el.getAttribute('data-hist-del'));
        renderHistoryPanel();
      });
    });
  }

  function _ensurePanel() {
    var overlay = document.getElementById('hist-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'hist-overlay';
    overlay.className = 'hist-overlay';
    overlay.innerHTML =
      '<div class="hist-box" role="dialog" aria-label="Histórico de consultas">' +
        '<div class="hist-header">' +
          '<div class="hist-header-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>' +
          '</div>' +
          '<div class="hist-title-wrap"><h3 class="hist-title">Histórico de consultas</h3>' +
          '<p class="hist-sub">Suas buscas recentes e favoritas</p></div>' +
          '<button type="button" class="hist-close" onclick="closeHistoryPanel()" aria-label="Fechar">&#x2715;</button>' +
        '</div>' +
        '<div class="hist-tabs">' +
          '<button type="button" class="hist-tab active" data-hist-tab="recent">Recentes</button>' +
          '<button type="button" class="hist-tab" data-hist-tab="fav">Favoritas</button>' +
          '<button type="button" class="hist-clear" onclick="histClear()">Limpar</button>' +
        '</div>' +
        '<div class="hist-body" id="hist-body"></div>' +
      '</div>';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeHistoryPanel(); });
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.hist-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _histTab = btn.getAttribute('data-hist-tab');
        overlay.querySelectorAll('.hist-tab').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        renderHistoryPanel();
      });
    });
    return overlay;
  }

  function openHistoryPanel() {
    var overlay = _ensurePanel();
    _histTab = 'recent';
    overlay.querySelectorAll('.hist-tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-hist-tab') === 'recent');
    });
    renderHistoryPanel();
    overlay.classList.add('open');
  }

  function closeHistoryPanel() {
    var overlay = document.getElementById('hist-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  global.histClear = function () {
    clearHistory(true); // mantém favoritos
    renderHistoryPanel();
    if (typeof showToast === 'function') showToast('Histórico limpo (favoritos mantidos)');
  };

  // ── Busca em lote (fila de CPFs) ────────────────────────────────────────
  // A API limita 1 req/min por endpoint, então o lote é uma FILA: o usuário
  // cola vários CPFs e consulta um a um (sem disparo automático em massa).
  var _queue = [];

  function _validCpf(raw) {
    var d = String(raw).replace(/\D/g, '');
    return d.length === 11 ? d : null;
  }

  function _fmtCpf(d) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  function startBatchFromText(text) {
    var seen = {};
    _queue = String(text || '').split(/[\s,;]+/).map(_validCpf).filter(function (d) {
      if (!d || seen[d]) return false;
      seen[d] = true;
      return true;
    }).map(function (d) { return { cpf: d, status: 'pending' }; });
    return _queue.length;
  }

  function renderBatchQueue() {
    var area = document.getElementById('result-area');
    if (!area) return;
    if (!_queue.length) {
      area.innerHTML = '<div class="empty-state"><p>Nenhum CPF válido na lista.</p></div>';
      return;
    }
    var doneN = _queue.filter(function (q) { return q.status === 'done'; }).length;
    var rows = _queue.map(function (q, i) {
      var st = q.status === 'done'
        ? '<span class="batch-badge done">consultado</span>'
        : '<span class="batch-badge">pendente</span>';
      return '<div class="batch-row' + (q.status === 'done' ? ' is-done' : '') + '">' +
        '<span class="batch-idx">' + (i + 1) + '</span>' +
        '<span class="batch-cpf">' + _fmtCpf(q.cpf) + '</span>' +
        st +
        '<button type="button" class="batch-go" data-batch-run="' + i + '">Consultar</button>' +
      '</div>';
    }).join('');
    area.innerHTML =
      '<div class="batch-panel">' +
        '<div class="batch-head">' +
          '<span class="batch-title">Fila de consultas — ' + doneN + '/' + _queue.length + '</span>' +
          '<button type="button" class="batch-clear" onclick="batchClear()">Limpar fila</button>' +
        '</div>' +
        '<p class="batch-note">A API permite 1 consulta por minuto por tipo. Clique para consultar cada CPF.</p>' +
        '<div class="batch-list">' + rows + '</div>' +
      '</div>';
    area.querySelectorAll('[data-batch-run]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.getAttribute('data-batch-run'));
        _runBatchOne(idx);
      });
    });
  }

  function _runBatchOne(idx) {
    var item = _queue[idx];
    if (!item) return;
    item.status = 'done';
    var cpfField = document.getElementById('f-cpf');
    if (typeof selectedIds !== 'undefined' && selectedIds.clear) selectedIds.clear();
    document.querySelectorAll('.field-input').forEach(function (i) { i.value = ''; });
    if (cpfField) {
      cpfField.value = _fmtCpf(item.cpf);
      cpfField.dispatchEvent(new Event('input'));
    }
    if (typeof executarBusca === 'function') executarBusca();
    // Re-renderiza a fila quando o dossiê fechar (mantém contexto do lote).
    setTimeout(function () {
      var ov = document.getElementById('dossie-overlay');
      if (ov) {
        var obs = new MutationObserver(function () {
          if (!ov.classList.contains('open')) { obs.disconnect(); renderBatchQueue(); }
        });
        obs.observe(ov, { attributes: true, attributeFilter: ['class'] });
      }
    }, 100);
  }

  function openBatchModal() {
    var overlay = document.getElementById('batch-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'batch-overlay';
      overlay.className = 'hist-overlay';
      overlay.innerHTML =
        '<div class="hist-box batch-box" role="dialog" aria-label="Busca em lote">' +
          '<div class="hist-header">' +
            '<div class="hist-header-icon">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>' +
            '</div>' +
            '<div class="hist-title-wrap"><h3 class="hist-title">Busca em lote (CPF)</h3>' +
            '<p class="hist-sub">Cole vários CPFs — um por linha</p></div>' +
            '<button type="button" class="hist-close" onclick="closeBatchModal()" aria-label="Fechar">&#x2715;</button>' +
          '</div>' +
          '<div class="batch-modal-body">' +
            '<textarea id="batch-input" class="batch-textarea" placeholder="000.000.000-00&#10;111.111.111-11&#10;..."></textarea>' +
            '<button type="button" class="batch-submit" onclick="batchSubmit()">Montar fila</button>' +
          '</div>' +
        '</div>';
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeBatchModal(); });
      document.body.appendChild(overlay);
    }
    overlay.classList.add('open');
    var ta = document.getElementById('batch-input');
    if (ta) { ta.value = ''; setTimeout(function () { ta.focus(); }, 50); }
  }

  global.closeBatchModal = function () {
    var o = document.getElementById('batch-overlay');
    if (o) o.classList.remove('open');
  };

  global.batchSubmit = function () {
    var ta = document.getElementById('batch-input');
    var n = startBatchFromText(ta ? ta.value : '');
    if (!n) {
      if (typeof showToast === 'function') showToast('Nenhum CPF válido encontrado', 'error');
      return;
    }
    global.closeBatchModal();
    if (typeof showAppView === 'function') showAppView('search');
    setTimeout(renderBatchQueue, 60);
    if (typeof showToast === 'function') showToast(n + ' CPF' + (n !== 1 ? 's' : '') + ' na fila');
  };

  global.batchClear = function () {
    _queue = [];
    var area = document.getElementById('result-area');
    if (area) area.innerHTML = '<div class="empty-state"><p>Preencha um campo e clique em buscar</p></div>';
  };

  global.openBatchModal = openBatchModal;

  global.SearchHistory = {
    record: recordSearch,
    get: getHistory,
    toggleFavorite: toggleFavorite,
    clear: clearHistory,
    rerun: rerunSearch,
    startBatch: startBatchFromText,
  };
  global.openHistoryPanel = openHistoryPanel;
  global.closeHistoryPanel = closeHistoryPanel;

})(typeof window !== 'undefined' ? window : this);
