// Planos ativos — fonte única (admin, loja, módulos, revenda)
(function (global) {
  'use strict';

  var PLAN_STORE_KEY = 'bds_active_plans';
  var PLAN_ADMIN_USER = atob('RGFzb3J0ZQ==');
  var PLAN_DURATIONS_MS = {
    diaria: 24 * 60 * 60 * 1000,
    semana: 7 * 24 * 60 * 60 * 1000,
    mes: 30 * 24 * 60 * 60 * 1000,
  };

  var PLAN_LABELS = {
    diaria: 'Diária',
    semana: '1 Semana',
    mes: '1 Mês',
    reseller: 'Revenda',
  };

  function getPlansStore() {
    try { return JSON.parse(localStorage.getItem(PLAN_STORE_KEY)) || {}; } catch (e) { return {}; }
  }

  function savePlansStore(store) {
    localStorage.setItem(PLAN_STORE_KEY, JSON.stringify(store));
    try {
      global.dispatchEvent(new CustomEvent('bds-plans-changed'));
    } catch (e) { /* ignore */ }
  }

  function normalizePlanUsername(user) {
    return user ? String(user).trim() : '';
  }

  function migratePlansStore() {
    var store = getPlansStore();
    var next = {};
    var changed = false;
    Object.keys(store).forEach(function (k) {
      var nk = normalizePlanUsername(k);
      if (!nk) return;
      var plan = store[k];
      if (!plan) return;
      if (plan.expiresAt != null) plan.expiresAt = Number(plan.expiresAt);
      if (!next[nk] || Number(plan.expiresAt) > Number(next[nk].expiresAt)) {
        next[nk] = plan;
      }
      if (nk !== k) changed = true;
    });
    if (changed || Object.keys(next).length !== Object.keys(store).length) {
      savePlansStore(next);
    }
  }

  function findUserPlanEntry(user) {
    var key = normalizePlanUsername(user);
    if (!key) return null;
    var store = getPlansStore();
    if (store[key]) return { key: key, plan: store[key] };
    var lower = key.toLowerCase();
    var keys = Object.keys(store);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (String(k).trim().toLowerCase() === lower) {
        return { key: k, plan: store[k] };
      }
    }
    return null;
  }

  function getActivePlanForUser(user) {
    var key = normalizePlanUsername(user);
    if (!key) return null;
    if (key === PLAN_ADMIN_USER) {
      return { id: 'admin', period: 'Administrador', expiresAt: Number.MAX_SAFE_INTEGER };
    }
    var found = findUserPlanEntry(key);
    if (!found || !found.plan) return null;
    var expiresAt = Number(found.plan.expiresAt);
    if (!expiresAt || isNaN(expiresAt) || expiresAt <= Date.now()) return null;
    return Object.assign({}, found.plan, { expiresAt: expiresAt });
  }

  function setPlanForUser(username, planId) {
    var key = normalizePlanUsername(username);
    if (!key || key === PLAN_ADMIN_USER) return false;
    var ms = PLAN_DURATIONS_MS[planId];
    if (!ms) return false;
    var expiresAt = Date.now() + ms;
    var period = PLAN_LABELS[planId] || planId;
    var store = getPlansStore();
    store[key] = { id: planId, period: period, expiresAt: expiresAt, grantedByAdmin: true };
    savePlansStore(store);
    // Sincroniza com Supabase em background
    if (typeof global.DB !== 'undefined' && global.DB.isConfigured()) {
      global.DB.setUserPlan(key, planId, period, expiresAt).catch(function() {});
    }
    return true;
  }

  function clearPlanForUser(username) {
    var key = normalizePlanUsername(username);
    if (!key) return false;
    var store = getPlansStore();
    var lower = key.toLowerCase();
    Object.keys(store).forEach(function (k) {
      if (String(k).trim().toLowerCase() === lower) delete store[k];
    });
    savePlansStore(store);
    // Sincroniza com Supabase em background
    if (typeof global.DB !== 'undefined' && global.DB.isConfigured()) {
      global.DB.clearUserPlan(key).catch(function() {});
    }
    return true;
  }

  function hasActivePlanForSession() {
    var user = typeof global.getSession === 'function' ? global.getSession() : null;
    return !!getActivePlanForUser(user);
  }

  migratePlansStore();

  global.PLAN_STORE_KEY = PLAN_STORE_KEY;
  global.PLAN_ADMIN_USER = PLAN_ADMIN_USER;
  global.PLAN_DURATIONS_MS = PLAN_DURATIONS_MS;
  global.getPlansStore = getPlansStore;
  global.savePlansStore = savePlansStore;
  global.normalizePlanUsername = normalizePlanUsername;
  global.getActivePlanForUser = getActivePlanForUser;
  global.setPlanForUser = setPlanForUser;
  global.clearPlanForUser = clearPlanForUser;
  global.hasActivePlanForSession = hasActivePlanForSession;
  global.migratePlansStore = migratePlansStore;
})(typeof window !== 'undefined' ? window : global);
