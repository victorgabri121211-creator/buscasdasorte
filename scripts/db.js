// Camada de banco de dados — Supabase
// Substitui localStorage por armazenamento compartilhado entre todos os dispositivos
(function (global) {
  'use strict';

  // ── CONFIGURE AQUI APÓS CRIAR O PROJETO SUPABASE ─────────────────────────
  var SB_URL = 'https://tgpyujrkdkgwnkvrckun.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncHl1anJrZGtnd25rdnJja3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjcwMzcsImV4cCI6MjA5NDkwMzAzN30.kBRmCzxePQTjoBsrr2L74yKEXD1t2PTqoP46VcJGHPQ';
  // ─────────────────────────────────────────────────────────────────────────

  var _AU  = atob('RGFzb3J0ZQ==');

  // Hash de admin: NAO fica embutido no codigo. E derivado da senha que o
  // admin digita no login (validado no servidor) e guardado so na sessao.
  var _adminHash = null;
  try { _adminHash = localStorage.getItem('bds_admin_h') || null; } catch (e) {}
  function setAdminHash(h) {
    _adminHash = h || null;
    try {
      if (h) localStorage.setItem('bds_admin_h', h);
      else localStorage.removeItem('bds_admin_h');
    } catch (e) {}
  }
  function adminCheck(hash) {
    return _rpc('bds_admin_check', { p_hash: hash });
  }

  function _ok() {
    return SB_URL !== 'SUPABASE_URL' && SB_KEY !== 'SUPABASE_ANON_KEY';
  }

  function _rpc(fn, params) {
    if (!_ok()) return Promise.resolve(null);
    return fetch(SB_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY
      },
      body: JSON.stringify(params || {})
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          console.warn('[DB] ' + fn + ' HTTP ' + r.status + ':', data);
          return null; // erro HTTP → fallback para localStorage
        }
        return data;
      });
    }).catch(function (e) {
      console.warn('[DB] ' + fn + ':', e.message);
      return null;
    });
  }

  function _get(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) || def; } catch (e) { return def; }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function registerUser(username, password, createdByReseller) {
    const res = await _rpc('bds_register', {
      p_username: username,
      p_password: password,
      p_created_by_reseller: createdByReseller || null
    });
    if (res && res.ok) {
      try {
        const users = _get('bds_users', []);
        if (!users.find(function (u) { return u.user === username; })) {
          users.push({ user: username, pass: password, createdAt: Date.now(), createdByReseller: createdByReseller || null });
          localStorage.setItem('bds_users', JSON.stringify(users));
        }
      } catch (e) {}
    }
    return res;
  }

  function loginUser(username, password) {
    return _rpc('bds_login', { p_username: username, p_password: password });
  }

  // ── Sync: Supabase → localStorage ─────────────────────────────────────────

  async function syncOnLogin(username) {
    if (!username || !_ok()) return;

    if (username === _AU) {
      const res = await _rpc('bds_admin_full_sync', { p_hash: _adminHash });
      if (!res || !res.ok) return;

      const supaUsers = res.users || [];
      const localUsers = _get('bds_users', []);

      const merged = supaUsers.map(function (su) {
        const local = localUsers.find(function (lu) { return lu.user === su.user; });
        return {
          user: su.user,
          pass: local ? local.pass : '(supabase)',
          createdAt: su.created_at || Date.now(),
          createdByReseller: su.created_by_reseller || null
        };
      });
      localStorage.setItem('bds_users', JSON.stringify(merged));

      const plans = {};
      supaUsers.forEach(function (u) { if (u.plan) plans[u.user] = u.plan; });
      localStorage.setItem('bds_active_plans', JSON.stringify(plans));

      const access = {};
      supaUsers.forEach(function (u) { if (u.reseller_enabled) access[u.user] = true; });
      localStorage.setItem('bds_reseller_access', JSON.stringify(access));

      const credits = {};
      supaUsers.forEach(function (u) { if (u.reseller_credits > 0) credits[u.user] = u.reseller_credits; });
      localStorage.setItem('bds_reseller_credits', JSON.stringify(credits));

      const logins = {};
      (res.reseller_logins || []).forEach(function (l) {
        if (!logins[l.reseller_username]) logins[l.reseller_username] = [];
        logins[l.reseller_username].push({
          id: l.id, username: l.username, password: l.password,
          days: l.days, createdAt: l.created_at, expiresAt: l.expires_at
        });
      });
      localStorage.setItem('bds_reseller_logins', JSON.stringify(logins));

      const remoteSales = res.sales || [];
      if (remoteSales.length) {
        const localSales = _get('bds_sales', []);
        const localIds = new Set(localSales.map(function (s) { return s.id; }));
        const localTxIds = new Set(localSales.filter(function (s) { return s.txId; }).map(function (s) { return s.txId; }));
        remoteSales.forEach(function (s) {
          if (_isSaleDup(localSales, localIds, localTxIds, s)) return;
          const txId = s.tx_id || null;
          localSales.push({ id: s.id, txId: txId, ts: s.ts, category: s.category, productId: s.product_id, label: s.label, amount: s.amount, buyer: s.buyer });
          localIds.add(s.id);
          if (txId) localTxIds.add(txId);
        });
        localSales.sort(function (a, b) { return b.ts - a.ts; });
        localStorage.setItem('bds_sales', JSON.stringify(localSales));
      }
    } else {
      const [planRes, accessRes, creditsRes, loginsRes] = await Promise.all([
        _rpc('bds_get_plan', { p_username: username }),
        _rpc('bds_get_reseller_access', { p_username: username }),
        _rpc('bds_get_reseller_credits', { p_username: username }),
        _rpc('bds_get_reseller_logins', { p_reseller: username })
      ]);

      const plans = _get('bds_active_plans', {});
      if (planRes && planRes.ok) {
        if (planRes.plan) plans[username] = planRes.plan;
        else delete plans[username];
        localStorage.setItem('bds_active_plans', JSON.stringify(plans));
      }

      if (accessRes && accessRes.ok) {
        const acc = _get('bds_reseller_access', {});
        if (accessRes.enabled) acc[username] = true;
        else delete acc[username];
        localStorage.setItem('bds_reseller_access', JSON.stringify(acc));
      }

      if (creditsRes && creditsRes.ok) {
        const creds = _get('bds_reseller_credits', {});
        creds[username] = creditsRes.credits || 0;
        localStorage.setItem('bds_reseller_credits', JSON.stringify(creds));
      }

      if (loginsRes && loginsRes.ok) {
        const lg = _get('bds_reseller_logins', {});
        lg[username] = (loginsRes.logins || []).map(function (l) {
          return { id: l.id, username: l.username, password: l.password, days: l.days, createdAt: l.created_at, expiresAt: l.expires_at };
        });
        localStorage.setItem('bds_reseller_logins', JSON.stringify(lg));
      }
    }

    try { global.dispatchEvent(new CustomEvent('bds-plans-changed')); } catch (e) {}
  }

  // ── Admin: escritas ────────────────────────────────────────────────────────

  function setUserPlan(username, planId, period, expiresAt) {
    return _rpc('bds_admin_set_plan', {
      p_hash: _adminHash, p_username: username, p_plan_id: planId,
      p_period: period, p_expires_at: expiresAt
    });
  }

  function clearUserPlan(username) {
    return _rpc('bds_admin_clear_plan', { p_hash: _adminHash, p_username: username });
  }

  function setResellerAccess(username, enabled) {
    return _rpc('bds_admin_set_reseller', { p_hash: _adminHash, p_username: username, p_enabled: enabled });
  }

  function addResellerCredits(username, amount) {
    return _rpc('bds_admin_add_credits', { p_hash: _adminHash, p_username: username, p_amount: amount });
  }

  // ── Vendas ────────────────────────────────────────────────────────────────

  function recordSale(sale) {
    var base = {
      p_id:         sale.id,
      p_tx_id:      sale.txId || null,
      p_ts:         sale.ts || Date.now(),
      p_category:   sale.category || '',
      p_product_id: sale.productId || '',
      p_label:      sale.label || '',
      p_amount:     Number(sale.amount) || 0,
      p_buyer:      sale.buyer || ''
    };
    var ref = null;
    try { ref = localStorage.getItem('bds_affiliate_ref') || null; } catch (e) {}
    if (!ref) return _rpc('bds_record_sale', base);
    // Tenta com afiliado; se a função ainda não tiver o parâmetro p_ref
    // (migração não aplicada), refaz sem — sem perder o registro da venda.
    var withRef = Object.assign({}, base, { p_ref: ref });
    return _rpc('bds_record_sale', withRef).then(function (r) {
      if (r && r.ok) return r;
      return _rpc('bds_record_sale', base);
    });
  }

  // Relatório de indicações do afiliado (revendedor).
  function getAffiliateReport(reseller) {
    return _rpc('bds_get_affiliate_report', { p_reseller: reseller });
  }

  // ── Revendedor: logins ─────────────────────────────────────────────────────

  function createResellerLogin(reseller, username, password, days) {
    return _rpc('bds_create_reseller_login', {
      p_reseller: reseller, p_username: username, p_password: password, p_days: days
    });
  }

  function deactivateResellerLogin(reseller, loginId) {
    return _rpc('bds_deactivate_reseller_login', { p_reseller: reseller, p_login_id: loginId });
  }

  function deleteResellerLogin(reseller, loginId) {
    return _rpc('bds_delete_reseller_login', { p_reseller: reseller, p_login_id: loginId });
  }

  function _isSaleDup(localSales, localIds, localTxIds, s) {
    const txId = s.tx_id || null;
    if (localIds.has(s.id)) return true;
    if (txId && localTxIds.has(txId)) return true;
    if (!txId) {
      // Records synced from Supabase sometimes have no txId; detect by amount+buyer+productId within 10s
      for (var i = 0; i < localSales.length; i++) {
        var l = localSales[i];
        if (l.amount === s.amount && l.buyer === s.buyer && l.productId === s.product_id &&
            Math.abs(l.ts - s.ts) < 10000) return true;
      }
    }
    return false;
  }

  // ── Sync de vendas (admin) ────────────────────────────────────────────────

  async function syncSales() {
    if (!_ok()) return null;
    const res = await _rpc('bds_admin_full_sync', { p_hash: _adminHash });
    if (!res || !res.ok) return null;
    const remoteSales = res.sales || [];
    const localSales = _get('bds_sales', []);
    const localIds = new Set(localSales.map(function (s) { return s.id; }));
    const localTxIds = new Set(localSales.filter(function (s) { return s.txId; }).map(function (s) { return s.txId; }));
    var changed = false;
    remoteSales.forEach(function (s) {
      if (_isSaleDup(localSales, localIds, localTxIds, s)) return;
      const txId = s.tx_id || null;
      localSales.push({ id: s.id, txId: txId, ts: s.ts, category: s.category, productId: s.product_id, label: s.label, amount: s.amount, buyer: s.buyer });
      localIds.add(s.id);
      if (txId) localTxIds.add(txId);
      changed = true;
    });
    if (changed) {
      localSales.sort(function (a, b) { return b.ts - a.ts; });
      localStorage.setItem('bds_sales', JSON.stringify(localSales));
    }
    return localSales;
  }

  // ── Sync periódico em background ─────────────────────────────────────────

  var _bgSyncUser  = null;
  var _bgSyncTimer = null;
  var BG_SYNC_MS   = 30 * 1000; // a cada 30 segundos

  function startBackgroundSync(username) {
    stopBackgroundSync();
    if (!username || !_ok() || username === _AU) return;
    _bgSyncUser = username;
    _bgSyncTimer = setInterval(function () {
      if (!_bgSyncUser) return;
      syncOnLogin(_bgSyncUser).catch(function () {});
    }, BG_SYNC_MS);
  }

  function stopBackgroundSync() {
    if (_bgSyncTimer) { clearInterval(_bgSyncTimer); _bgSyncTimer = null; }
    _bgSyncUser = null;
  }

  global.DB = {
    isConfigured: _ok,
    adminCheck: adminCheck,
    setAdminHash: setAdminHash,
    registerUser: registerUser,
    loginUser: loginUser,
    syncOnLogin: syncOnLogin,
    startBackgroundSync: startBackgroundSync,
    stopBackgroundSync: stopBackgroundSync,
    setUserPlan: setUserPlan,
    clearUserPlan: clearUserPlan,
    setResellerAccess: setResellerAccess,
    addResellerCredits: addResellerCredits,
    createResellerLogin: createResellerLogin,
    deactivateResellerLogin: deactivateResellerLogin,
    deleteResellerLogin: deleteResellerLogin,
    recordSale: recordSale,
    getAffiliateReport: getAffiliateReport,
    syncSales: syncSales
  };

})(typeof window !== 'undefined' ? window : global);
