/* VOXA newsletter forms: popup on tool pages, audit popup on home, inline on service pages */
(function () {
  var path = location.pathname;
  var isTool = /^\/tools\//.test(path);
  var isService = /^\/services/.test(path);
  var isHome = path === '/' || path === '/index.html';
  if (!isTool && !isService && !isHome) return;
  if (window.__voxaNl) return;
  window.__voxaNl = true;

  var css = document.createElement('style');
  css.textContent = [
    '.vnl-wrap{position:fixed;inset:0;z-index:9998;display:none;align-items:center;justify-content:center;background:rgba(15,23,41,.55);padding:18px}',
    '.vnl-wrap.on{display:flex}',
    '.vnl-card{background:#FDFDFC;border-radius:16px;max-width:430px;width:100%;padding:26px 24px 22px;box-shadow:0 24px 70px rgba(15,23,41,.28);position:relative;font-family:Inter,system-ui,-apple-system,sans-serif}',
    '.vnl-x{position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:22px;line-height:1;color:#8b93a1;cursor:pointer;padding:6px}',
    '.vnl-h{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-weight:800;font-size:21px;line-height:1.3;color:#0F1729;margin:0 0 8px;letter-spacing:-.4px}',
    '.vnl-p{font-size:14px;line-height:1.6;color:#4A5568;margin:0 0 14px}',
    '.vnl-form{display:flex;gap:8px;flex-wrap:wrap}',
    '.vnl-in{flex:1 1 190px;min-width:0;border:1px solid #DAD4C8;border-radius:10px;padding:11px 12px;font-size:14px;color:#0F1729;background:#fff}',
    '.vnl-btn{flex:0 0 auto;background:#0E7C66;color:#fff;border:0;border-radius:10px;padding:11px 16px;font-size:14px;font-weight:600;cursor:pointer}',
    '.vnl-btn:disabled{opacity:.6;cursor:default}',
    '.vnl-note{font-size:12px;color:#6b7280;margin:10px 0 0}',
    '.vnl-ok{font-size:14px;color:#0E7C66;font-weight:600;margin:6px 0 0}',
    '.vnl-inline{max-width:860px;margin:34px auto 0;padding:22px 24px;border:1px solid #DAD4C8;border-radius:14px;background:#F6F5F3;font-family:Inter,system-ui,sans-serif}',
    '.vnl-inline .vnl-h{font-size:19px}',
    '@media(max-width:520px){.vnl-card{padding:22px 18px 18px}.vnl-h{font-size:19px}}'
  ].join('');
  document.head.appendChild(css);

  function post(email) {
    return fetch('/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email, src: isTool ? 'tools' : (isService ? 'services' : 'home') })
    }).then(function (r) { return r.json(); });
  }

  function build(copy) {
    var wrap = document.createElement('div');
    wrap.className = 'vnl-wrap';
    wrap.innerHTML = '<div class="vnl-card" role="dialog" aria-modal="true">' +
      '<button class="vnl-x" aria-label="Close">&times;</button>' +
      '<h3 class="vnl-h">' + copy.h + '</h3>' +
      '<p class="vnl-p">' + copy.p + '</p>' +
      '<form class="vnl-form"><input class="vnl-in" type="email" required placeholder="you@company.com" aria-label="Email">' +
      '<button class="vnl-btn" type="submit">' + copy.b + '</button></form>' +
      '<p class="vnl-note">' + copy.n + '</p></div>';
    document.body.appendChild(wrap);
    var form = wrap.querySelector('form');
    var btn = wrap.querySelector('.vnl-btn');
    wrap.querySelector('.vnl-x').addEventListener('click', function () { wrap.classList.remove('on'); });
    wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.classList.remove('on'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = wrap.querySelector('.vnl-in').value.trim();
      if (!email) return;
      btn.disabled = true; btn.textContent = 'Sending';
      post(email).then(function (res) {
        if (res && res.ok) {
          form.outerHTML = '<p class="vnl-ok">You are in. Check your inbox for the confirmation.</p>';
        } else {
          btn.disabled = false; btn.textContent = copy.b;
          wrap.querySelector('.vnl-note').textContent = (res && res.error) || 'That did not go through. Try again.';
        }
      }).catch(function () { btn.disabled = false; btn.textContent = copy.b; });
    });
    return { wrap: wrap, show: function () { wrap.classList.add('on'); } };
  }

  var TOOL = {
    h: 'Stop overpaying for AI tools.',
    p: 'One email with every price change, every free-tier cut and the cheaper alternative that actually works.',
    b: 'Subscribe to the newspaper',
    n: 'Subscribers also get 12% off any VOXA service.'
  };
  var HOME = {
    h: 'Free 48-hour audit of your site.',
    p: 'Send your email and reply with your URL. You get the three faults that cost you the most, in plain English, within 48 hours. No pitch until you ask.',
    b: 'Get my free audit',
    n: 'Subscribers also get 12% off any service.'
  };

  if (isService) {
    var box = document.createElement('div');
    box.className = 'vnl-inline';
    box.innerHTML = '<h3 class="vnl-h">Subscribe and get 12% off any service.</h3>' +
      '<p class="vnl-p">Weekly AI price changes and free-tier cuts, plus a one-time 12% code for any VOXA service.</p>' +
      '<form class="vnl-form"><input class="vnl-in" type="email" required placeholder="you@company.com" aria-label="Email">' +
      '<button class="vnl-btn" type="submit">Subscribe and get 12% off</button></form>' +
      '<p class="vnl-note">The code arrives in the confirmation email. One use per subscriber.</p>';
    var foot = document.querySelector('footer');
    if (foot && foot.parentElement) { foot.parentElement.insertBefore(box, foot); }
    else { (document.querySelector('main') || document.body).appendChild(box); }
    var f = box.querySelector('form'), b2 = box.querySelector('.vnl-btn');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = box.querySelector('.vnl-in').value.trim();
      if (!em) return;
      b2.disabled = true; b2.textContent = 'Sending';
      post(em).then(function (res) {
        if (res && res.ok) { f.outerHTML = '<p class="vnl-ok">You are in. Your 12% code is in the confirmation email.</p>'; }
        else { b2.disabled = false; b2.textContent = 'Subscribe and get 12% off'; }
      }).catch(function () { b2.disabled = false; b2.textContent = 'Subscribe and get 12% off'; });
    });
    return;
  }

  var modal = build(isTool ? TOOL : HOME);
  var shown = false;
  function fire() { if (shown) return; shown = true; modal.show(); }

  if (isTool) {
    window.addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (h > 0 && window.scrollY / h >= 0.5) fire();
    }, { passive: true });
  } else {
    setTimeout(fire, 9000);
  }
})();

/* rev 3: inline block sits above the footer */
