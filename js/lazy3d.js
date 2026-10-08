/* VOXA — loads the WebGL background after the page is interactive.
   Content paints first, then the 3D world starts. Never blocks first render. */
(function () {
  'use strict';
  var tag = document.currentScript;
  var scenePath = (tag && tag.getAttribute('data-scene-src')) || 'js/scene.js';
  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';

  function addScript(src, onload) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (onload) s.onload = onload;
    document.body.appendChild(s);
  }

  function start() {
    if (window.__voxa3dStarted) return;
    window.__voxa3dStarted = true;
    addScript(THREE_URL, function () { addScript(scenePath); });
  }
  window.__voxaStart3d = start;

  function schedule() {
    if ('requestIdleCallback' in window) { requestIdleCallback(start, { timeout: 2500 }); }
    else { setTimeout(start, 500); }
  }

  if (document.readyState === 'complete') { schedule(); }
  else { window.addEventListener('load', schedule); }

  // or as soon as the visitor does anything
  window.addEventListener('scroll', start, { passive: true, once: true });
  window.addEventListener('pointerdown', start, { passive: true, once: true });
  window.addEventListener('keydown', start, { once: true });
})();
