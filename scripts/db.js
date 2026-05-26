// Camada de banco de dados — Supabase
// Substitui localStorage por armazenamento compartilhado entre todos os dispositivos
(function (global) {
  'use strict';

  // ── CONFIGURE AQUI APÓS CRIAR O PROJETO SUPABASE ─────────────────────────
  var SB_URL = 'https://tgpyujrkdkgwnkvrckun.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncHl1anJrZGtnd25rdnJja3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjcwMzcsImV4cCI6MjA5NDkwMzAzN30.kBRmCzxePQTjoBsrr2L74yKEXD1t2PTqoP46VcJGHPQ';
  // ─────────────────────────────────────────────────────────────────────────

  var _APH = '9dc3eba65b8905b9ea4fb08b06c800de0b35256d0ecfdd80bc59d9713b0bed8c';
  var _AU  = atob('RGFzb3J0ZQ==');

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
      const res = await _rpc('bds_admin_full_sync', { p_hash: _APH });
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
        remoteSales.forEach(function (s) {
          if (!localIds.has(s.id)) {
            localSales.push({ id: s.id, txId: s.tx_id, ts: s.ts, category: s.category, productId: s.product_id, label: s.label, amount: s.amount, buyer: s.buyer });
          }
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
      p_hash: _APH, p_username: username, p_plan_id: planId,
      p_period: period, p_expires_at: expiresAt
    });
  }

  function clearUserPlan(username) {
    return _rpc('bds_admin_clear_plan', { p_hash: _APH, p_username: username });
  }

  function setResellerAccess(username, enabled) {
    return _rpc('bds_admin_set_reseller', { p_hash: _APH, p_username: username, p_enabled: enabled });
  }

  function addResellerCredits(username, amount) {
    return _rpc('bds_admin_add_credits', { p_hash: _APH, p_username: username, p_amount: amount });
  }

  // ── Vendas ────────────────────────────────────────────────────────────────

  function recordSale(sale) {
    return _rpc('bds_record_sale', {
      p_id:         sale.id,
      p_tx_id:      sale.txId || null,
      p_ts:         sale.ts || Date.now(),
      p_category:   sale.category || '',
      p_product_id: sale.productId || '',
      p_label:      sale.label || '',
      p_amount:     Number(sale.amount) || 0,
      p_buyer:      sale.buyer || ''
    });
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
    recordSale: recordSale
  };

})(typeof window !== 'undefined' ? window : global);
