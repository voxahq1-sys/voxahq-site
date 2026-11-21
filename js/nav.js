(function () {
  if (window.__vxNavInit) return;
  window.__vxNavInit = true;
  var CSS = [
    '.vx-burger{display:none}',
    '@media(max-width:960px){',
      '.nav{height:64px;gap:12px}',
      '.navbar .navlinks,.navbar .navright{display:none!important}',
      '.vx-burger{display:inline-flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;margin-left:auto;width:44px;height:44px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.38);border-radius:12px;cursor:pointer;padding:0}',
      '.vx-burger span{display:block;width:18px;height:2px;background:#fff;border-radius:2px}',
      '.navbar{position:sticky;top:0;z-index:60}',
    '}',
    '.vx-drawer{position:fixed;top:0;right:0;height:100%;width:min(86vw,340px);background:#FDFDFC;z-index:200;transform:translateX(100%);transition:transform .26s ease;display:flex;flex-direction:column;box-shadow:-18px 0 40px rgba(15,23,41,.18);overflow-y:auto;-webkit-overflow-scrolling:touch}',
    '.vx-drawer.open{transform:translateX(0)}',
    '.vx-drawer__top{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #DAD4C8;position:sticky;top:0;background:#FDFDFC;z-index:2}',
    '.vx-drawer__brand{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-weight:800;font-size:18px;color:#0E7C66;letter-spacing:-.4px}',
    '.vx-drawer__close{background:none;border:0;font-size:30px;line-height:1;color:#0F1729;cursor:pointer;padding:0 2px}',
    '.vx-drawer__links{display:flex;flex-direction:column;padding:6px 0}',
    '.vx-link{display:block;padding:14px 20px;font-size:16.5px;font-weight:600;color:#0F1729;border-bottom:1px solid #F0EDE7}',
    '.vx-link--sub{font-size:15px;font-weight:500;color:#4A5568;padding:12px 20px 12px 34px;background:#FBFAF9}',
    '.vx-drawer__cta{margin-top:auto;padding:16px 20px 28px;display:flex;flex-direction:column;gap:10px}',
    '.vx-drawer__cta a{display:flex;align-items:center;justify-content:center;padding:13px 16px;border-radius:10px;font-size:15px;font-weight:600}',
    '.vx-drawer__cta a.primary{background:#0E7C66;color:#fff}',
    '.vx-drawer__cta a.ghost{border:1px solid #DAD4C8;color:#0F1729}',
    '.vx-backdrop{position:fixed;inset:0;background:rgba(15,23,41,.45);z-index:190;opacity:0;pointer-events:none;transition:opacity .26s ease}',
    '.vx-backdrop.open{opacity:1;pointer-events:auto}',
    'body.vx-lock{overflow:hidden}'
  ].join('');
  var st = document.createElement('style');
  st.id = 'vx-nav-styles';
  st.appendChild(document.createTextNode(CSS));
  document.head.appendChild(st);

  function init() {
    var nav = document.querySelector('.navbar .nav');
    if (!nav || nav.querySelector('.vx-burger')) return;
    var linksBox = nav.querySelector('.navlinks');
    var rightBox = nav.querySelector('.navright');

    var burger = document.createElement('button');
    burger.className = 'vx-burger';
    burger.type = 'button';
    burger.setAttribute('aria-label', 'Open menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(burger);

    var backdrop = document.createElement('div');
    backdrop.className = 'vx-backdrop';
    document.body.appendChild(backdrop);

    var drawer = document.createElement('div');
    drawer.className = 'vx-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'Menu');
    var html = '<div class="vx-drawer__top"><span class="vx-drawer__brand">VOXA</span><button class="vx-drawer__close" type="button" aria-label="Close menu">&times;</button></div><nav class="vx-drawer__links">';

    var items = [];
    if (linksBox) {
      var anchors = linksBox.querySelectorAll('a');
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var sub = a.parentNode && a.parentNode.className && a.parentNode.className.indexOf('navdrop__menu') > -1;
        items.push({ href: a.getAttribute('href'), text: a.textContent.replace('\u25BE', '').trim(), sub: sub });
      }
    }
    items.forEach(function (it) {
      html += '<a class="vx-link' + (it.sub ? ' vx-link--sub' : '') + '" href="' + it.href + '">' + it.text + '</a>';
    });
    html += '</nav><div class="vx-drawer__cta">';
    if (rightBox) {
      var cta = rightBox.querySelectorAll('a');
      for (var k = 0; k < cta.length; k++) {
        var c = cta[k];
        var cls = /white/.test(c.className) ? 'primary' : 'ghost';
        html += '<a class="' + cls + '" href="' + c.getAttribute('href') + '">' + c.textContent.trim() + '</a>';
      }
    }
    html += '</div>';
    drawer.innerHTML = html;
    document.body.appendChild(drawer);

    var closeBtn = drawer.querySelector('.vx-drawer__close');

    function open() {
      drawer.classList.add('open');
      backdrop.classList.add('open');
      document.body.classList.add('vx-lock');
      burger.setAttribute('aria-expanded', 'true');
    }
    function close() {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.classList.remove('vx-lock');
      burger.setAttribute('aria-expanded', 'false');
    }
    burger.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    drawer.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 960) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
