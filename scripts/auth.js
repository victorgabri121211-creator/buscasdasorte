// Spotlight / hover na tela de login (IIFE evita conflito com script inline em index.html)
(function () {
  'use strict';

  function initAuthSpotlight() {
    const screen = document.getElementById('auth-screen');
    const card = document.getElementById('auth-card');
    const spotlight = document.getElementById('auth-card-spotlight');
    const borderGlow = document.querySelector('.auth-card-border-glow');
    const cursorGlow = document.getElementById('auth-cursor-glow');
    const tabs = document.querySelector('.auth-tabs');
    if (!screen || !card) return;

    function isAuthVisible() {
      return screen.style.display !== 'none' && getComputedStyle(screen).display !== 'none';
    }

    function setGlowPosition(clientX, clientY) {
      const rect = card.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const px = x + 'px';
      const py = y + 'px';

      card.style.setProperty('--mouse-x', px);
      card.style.setProperty('--mouse-y', py);

      const spot = 'radial-gradient(480px circle at ' + px + ' ' + py + ', rgba(74, 222, 128, 0.55) 0%, rgba(34, 197, 94, 0.28) 22%, rgba(34, 197, 94, 0.1) 42%, transparent 68%)';
      if (spotlight) spotlight.style.background = spot;
      if (borderGlow) {
        borderGlow.style.background = 'radial-gradient(400px circle at ' + px + ' ' + py + ', rgba(74, 222, 128, 1) 0%, rgba(34, 197, 94, 0.55) 30%, transparent 58%)';
      }
      if (tabs) {
        const tr = tabs.getBoundingClientRect();
        tabs.style.setProperty('--tab-x', clientX - tr.left + 'px');
        tabs.style.setProperty('--tab-y', clientY - tr.top + 'px');
      }
    }

    function onMove(e) {
      if (!isAuthVisible()) return;
      setGlowPosition(e.clientX, e.clientY);
      card.classList.add('auth-active');
      screen.classList.add('auth-hover');
      if (cursorGlow) {
        cursorGlow.style.left = e.clientX + 'px';
        cursorGlow.style.top = e.clientY + 'px';
      }
    }

    function onLeave() {
      card.classList.remove('auth-active');
      screen.classList.remove('auth-hover');
      const r = card.getBoundingClientRect();
      setGlowPosition(r.left + r.width * 0.2, r.top + r.height * 0.1);
    }

    screen.addEventListener('mousemove', onMove, { passive: true });
    screen.addEventListener('mouseleave', onLeave);

    const r = card.getBoundingClientRect();
    setGlowPosition(r.left + r.width * 0.2, r.top + r.height * 0.1);
    card.classList.add('auth-active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthSpotlight);
  } else {
    initAuthSpotlight();
  }
})();
