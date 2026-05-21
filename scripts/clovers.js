// Trevo — apenas 4 folhas (coração + veio + brilho), sem caule
(function () {
  'use strict';

  var LEAF =
    'M0,-10.2C-5.3,-10.2 -8,-4.7 -7.3,-0.2C-6.6,3.9 -2,5.9 0,3.5C2,5.9 6.6,3.9 7.3,-0.2C8,-4.7 5.3,-10.2 0,-10.2Z';
  var VEIN = 'M0,-7.4 L0,-2.2';

  function leafAt(dx, dy, rot) {
    return (
      '<g transform="translate(' + dx + ',' + dy + ') rotate(' + rot + ')">' +
        '<path d="' + LEAF + '" fill="#22c55e" stroke="#14532d" stroke-width="1.15" stroke-linejoin="round"/>' +
        '<path d="' + LEAF + '" fill="#4ade80" fill-opacity="0.28" transform="scale(0.7)"/>' +
        '<path d="' + VEIN + '" fill="none" stroke="#d9f99d" stroke-width="1.2" stroke-linecap="round" opacity="0.92"/>' +
      '</g>'
    );
  }

  function buildCloverSvg() {
    return (
      '<svg class="bds-clover-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<g transform="translate(24,24)">' +
          leafAt(0, -9.8, 0) +
          leafAt(9.8, 0, 90) +
          leafAt(0, 9.8, 180) +
          leafAt(-9.8, 0, 270) +
          '<circle cx="0" cy="0" r="2.2" fill="#15803d" stroke="#bbf7d0" stroke-width="0.6" opacity="0.9"/>' +
        '</g>' +
      '</svg>'
    );
  }

  var CLOVER_SVG = buildCloverSvg();
  window.BDS_CLOVER_SVG = CLOVER_SVG;
  window.BDS_CLOVER_FULL_SVG = CLOVER_SVG;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function initBrandLogos() {
    document.querySelectorAll('.brand-logo-icon').forEach(function (el) {
      if (el.dataset.ready === '1') return;
      el.dataset.ready = '1';
      el.innerHTML = CLOVER_SVG;
    });
  }

  function initFallingClovers() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var root = document.getElementById('bg-clovers');
    if (!root || root.dataset.ready === '1') return;
    root.dataset.ready = '1';

    var count = window.matchMedia('(max-width: 768px)').matches ? 10 : 18;
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < count; i++) {
      var el = document.createElement('span');
      el.className = 'bg-clover';
      el.innerHTML = CLOVER_SVG;
      el.style.setProperty('--clover-left', rand(2, 98) + '%');
      el.style.setProperty('--clover-size', rand(34, 48) + 'px');
      el.style.setProperty('--clover-opacity', rand(0.16, 0.3).toFixed(2));
      el.style.setProperty('--clover-duration', rand(55, 95) + 's');
      el.style.setProperty('--clover-delay', rand(-95, 0) + 's');
      el.style.setProperty('--clover-drift', rand(-40, 40) + 'px');
      el.style.setProperty('--clover-rotate-start', rand(-25, 25) + 'deg');
      el.style.setProperty('--clover-rotate-end', rand(120, 280) + 'deg');
      fragment.appendChild(el);
    }

    root.appendChild(fragment);
  }

  function boot() {
    initBrandLogos();
    initFallingClovers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
