/* VOXA interactions */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var d = document;
  function q(s, c) { return (c || d).querySelector(s); }
  function qa(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }

  /* ---------- loader: removed, paint immediately ---------- */
  d.body.classList.remove('loading');
  d.body.classList.add('loaded');
  (function () { var l = d.getElementById('loader'); if (l && l.parentNode) l.parentNode.removeChild(l); })();
/* ---------- hero line stagger ---------- */
  qa('.line > span').forEach(function (el, i) {
    el.style.transitionDelay = (0.15 + i * 0.12) + 's';
  });

  /* ---------- custom cursor ---------- */
  if (fine && !reduced) {
    var dot = q('#cursorDot'), ring = q('#cursorRing');
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2, rx = cx, ry = cy;
    window.addEventListener('pointermove', function (e) {
      cx = e.clientX; cy = e.clientY;
      d.body.classList.add('has-cursor');
    }, { passive: true });
    (function loop() {
      rx += (cx - rx) * 0.16; ry += (cy - ry) * 0.16;
      if (dot) dot.style.transform = 'translate(' + (cx - 3) + 'px,' + (cy - 3) + 'px)';
      if (ring) ring.style.transform = 'translate(' + (rx - 19) + 'px,' + (ry - 19) + 'px)';
      requestAnimationFrame(loop);
    })();
    d.addEventListener('pointerover', function (e) {
      var t = e.target;
      var hot = t && t.closest && t.closest('a,button,[data-cursor],[data-tilt],.srv__row');
      d.body.classList.toggle('cursor-hover', !!hot);
    });
    window.addEventListener('mouseleave', function () { d.body.classList.add('cursor-hide'); });
    window.addEventListener('mouseenter', function () { d.body.classList.remove('cursor-hide'); });
  }

  /* ---------- word reveal ---------- */
  qa('[data-words]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w) { return '<span class="wd">' + w + '</span>'; }).join(' ');
  });

  /* ---------- observers ---------- */
  function reveal(el) {
    if (!el || el.classList.contains('in')) return;
    if (el.hasAttribute('data-words')) {
      qa('.wd', el).forEach(function (w, i) { setTimeout(function () { w.classList.add('in'); }, i * 26); });
    } else {
      el.classList.add('in');
    }
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      reveal(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: 0.01, rootMargin: '0px 0px -6% 0px' }) : null;

  qa('.rv,[data-words]').forEach(function (el) { if (io) io.observe(el); else el.classList.add('in'); });

  /* failsafe: tall blocks stay visible even if the observer never fires */
  function revealVisible() {
    qa('.rv,[data-words]').forEach(function (el) {
      if (el.classList.contains('in')) return;
      var r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight * 1.15) reveal(el);
    });
  }
  revealVisible();
  requestAnimationFrame(function () { revealVisible(); requestAnimationFrame(revealVisible); });
  setTimeout(revealVisible, 900);
  window.addEventListener('load', function () { setTimeout(revealVisible, 400); });
  window.addEventListener('scroll', function () { setTimeout(revealVisible, 90); }, { passive: true });

  /* ---------- counters ---------- */
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (reduced) { el.textContent = String(target); return; }
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / 1300, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var cio = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { animateCount(en.target); cio.unobserve(en.target); } });
  }, { threshold: 0.5 }) : null;
  qa('[data-count]').forEach(function (el) { if (cio) cio.observe(el); else animateCount(el); });

  /* ---------- marquee duplicate ---------- */
  var mq = q('#marquee');
  if (mq) {
    var html = mq.innerHTML;
    mq.innerHTML = html + html;
  }

  /* ---------- tilt ---------- */
  if (fine && !reduced) {
    qa('[data-tilt]').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(900px) rotateY(' + (px * 9).toFixed(2) + 'deg) rotateX(' + (-py * 9).toFixed(2) + 'deg) translateY(-6px)';
      });
      card.addEventListener('pointerleave', function () { card.style.transform = ''; });
    });

    /* ---------- magnetic buttons ---------- */
    qa('[data-magnet]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * 0.22;
        var y = (e.clientY - (r.top + r.height / 2)) * 0.28;
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });

    /* ---------- service hover preview ---------- */
    var prev = q('#srvPreview');
    if (prev) {
      qa('.srv__row').forEach(function (row) {
        row.addEventListener('pointerenter', function () {
          var g = row.getAttribute('data-preview') || 'g1';
          prev.className = 'srv__preview card__' + g + ' on';
        });
        row.addEventListener('pointermove', function (e) {
          prev.style.left = e.clientX + 'px';
          prev.style.top = e.clientY + 'px';
        });
        row.addEventListener('pointerleave', function () { prev.className = 'srv__preview'; });
      });
    }
  }

  /* ---------- nav + progress ---------- */
  var nav = q('#nav'), bar = q('#progress');
  function onScroll() {
    var y = window.scrollY || 0;
    if (nav) nav.classList.toggle('scrolled', y > 40);
    if (bar) {
      var max = d.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var burger = q('#burger'), links = q('#navLinks');
  if (burger && links) {
    burger.addEventListener('click', function () {
      d.body.classList.toggle('menu-open');
      links.classList.toggle('open');
    });
    qa('a', links).forEach(function (a) {
      a.addEventListener('click', function () {
        d.body.classList.remove('menu-open');
        links.classList.remove('open');
      });
    });
  }

  /* ---------- contact form ---------- */
  var cForm = q('[data-contact-form]');
  if (cForm) {
    var statusEl = q('#formStatus');
    var submitBtn = q('#contactSubmit');
    function setStatus(kind, msg) {
      if (!statusEl) return;
      statusEl.className = 'form-status ' + kind;
      statusEl.textContent = msg;
    }
    function values() {
      return {
        name: (q('#cf-name') || {}).value ? q('#cf-name').value.trim() : '',
        email: (q('#cf-email') || {}).value ? q('#cf-email').value.trim() : '',
        subject: (q('#cf-subject') || {}).value ? q('#cf-subject').value.trim() : 'Website message',
        message: (q('#cf-message') || {}).value ? q('#cf-message').value.trim() : ''
      };
    }
    function openMailApp(v) {
      var body = 'Name: ' + v.name + '\nEmail: ' + v.email + '\n\n' + v.message;
      var href = 'mailto:voxa.hq1@gmail.com?subject=' + encodeURIComponent(v.subject || 'Website message') + '&body=' + encodeURIComponent(body);
      setStatus('ok', 'Opening your email app with the message ready. If nothing opens, write to voxa.hq1@gmail.com.');
      window.location.href = href;
    }
    if (location.search.indexOf('sent=1') > -1) setStatus('ok', 'Message sent. We usually reply within two working days.');
    cForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = values();
      if (!v.name || !v.email || !v.message) {
        setStatus('err', 'Please fill in your name, email and message.');
        return;
      }
      if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.6'; }
      setStatus('pending', 'Sending...');
      var endpoint = 'https://formsubmit.co/ajax/' + (cForm.getAttribute('action').split('/').pop());
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name: v.name, email: v.email, subject: v.subject, message: v.message, _subject: 'New message from the VOXA website' })
      }).then(function (r) { return r.json().catch(function () { return { success: String(r.ok) }; }); })
        .then(function (data) {
          var ok = data && (data.success === true || data.success === 'true');
          if (ok) { cForm.reset(); setStatus('ok', 'Message sent. We usually reply within two working days.'); }
          else { openMailApp(v); }
        })
        .catch(function () { openMailApp(v); })
        .then(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }
        });
    });
  }

  /* ---------- clock + year ---------- */
  var clock = q('#clock'), year = q('#year');
  if (year) year.textContent = String(new Date().getFullYear());
  function setClock() {
    if (!clock) return;
    var n = new Date();
    var p = function (v) { return String(v).padStart(2, '0'); };
    clock.textContent = p(n.getHours()) + ':' + p(n.getMinutes()) + ':' + p(n.getSeconds()) + ' local';
  }
  setClock();
  setInterval(setClock, 1000);
})();


/* ---------- newsletter CTA (injected on article pages) ---------- */
(function () {
  var path = location.pathname;
  var isArticle = /^\/(news|guides|notes)\/.+/.test(path) && !/\/(index\.html)?$/.test(path);
  if (!isArticle) return;
  if (document.querySelector('.vx-sub')) return;
  var page = document.querySelector('.page');
  var foot = document.querySelector('footer');
  if (!page || !foot) return;
  var d = document.createElement('section');
  d.className = 'wrap vx-sub';
  d.style.cssText = 'padding:0 0 48px';
  d.innerHTML = '<div style="border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:26px 26px;background:rgba(255,255,255,.04);display:flex;gap:20px;flex-wrap:wrap;align-items:center;justify-content:space-between">' +
    '<div style="max-width:60ch"><p class="mono" style="margin:0 0 8px;letter-spacing:.14em;font-size:11px;text-transform:uppercase;opacity:.65">Weekly brief</p>' +
    '<h3 style="margin:0 0 6px;font-size:22px;line-height:1.25">One email a week: what changed in AI tools, and what it costs.</h3>' +
    '<p style="margin:0;opacity:.7">No hype, no sponsored picks. Unsubscribe in one click.</p></div>' +
    '<a class="btn" href="/start"><span>Get the brief</span></a></div>';
  page.insertBefore(d, foot);
})();


/* ---------- footer social links ---------- */
(function () {
  var foot = document.querySelector('footer .foot');
  if (!foot || document.querySelector('.vx-social')) return;
  var col = foot.firstElementChild;
  if (!col) return;
  var links = [
    ['Instagram', 'https://www.instagram.com/voxahq.in/', '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>'],
    ['YouTube', 'https://www.youtube.com/channel/UC0g1ZJmWyHnwCJBLl19FRkQ', '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8A26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.2V8.8l6 3.2-6 3.2Z"/></svg>'],
    ['LinkedIn', 'https://www.linkedin.com/in/voxa-hq-8a337a446/', '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.05a4.2 4.2 0 0 1 3.75-2.05C20.4 8.65 22 10.6 22 14.1V21h-4v-6.2c0-1.5-.5-2.5-1.9-2.5-1.2 0-1.9.8-2.2 1.6-.1.3-.1.7-.1 1.1V21H9V9Z"/></svg>'],
    ['X', 'https://x.com/Voxahqai', '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-6.4L6.3 22H3l7.3-8.4L3 2h6.5l4.4 5.9L18.9 2Zm-1.1 18h1.7L7.3 3.7H5.5L17.8 20Z"/></svg>']
  ];
  var wrap = document.createElement('div');
  wrap.className = 'vx-social';
  wrap.style.cssText = 'display:flex;gap:14px;margin-top:18px';
  links.forEach(function (l) {
    var a = document.createElement('a');
    a.href = l[1];
    a.target = '_blank';
    a.rel = 'me noopener';
    a.setAttribute('aria-label', l[0]);
    a.title = l[0];
    a.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid rgba(255,255,255,.16);border-radius:9px;color:inherit;opacity:.75;transition:opacity .2s,border-color .2s';
    a.innerHTML = l[2];
    a.addEventListener('mouseenter', function () { a.style.opacity = '1'; a.style.borderColor = 'rgba(255,255,255,.4)'; });
    a.addEventListener('mouseleave', function () { a.style.opacity = '.75'; a.style.borderColor = 'rgba(255,255,255,.16)'; });
    wrap.appendChild(a);
  });
  col.appendChild(wrap);
})();


/* ---------- article share bar ---------- */
(function () {
  var path = location.pathname;
  var isArticle = /^\/(news|guides|notes)\/.+/.test(path) && !/\/(index\.html)?$/.test(path);
  if (!isArticle) return;
  if (document.querySelector('.vx-share')) return;
  var quick = document.querySelector('.quick');
  if (!quick) return;
  var url = location.origin + path;
  var title = (document.querySelector('h1') || {}).innerText || document.title;
  var items = [
    ['WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(title + ' ' + url), '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-4-4.5-4.2-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.7 1.1 1.5 1.8 1 .9 1.8 1.2 2 1.3.2.1.4.1.6-.1l.8-.9c.2-.2.4-.2.6-.1l2 .9c.2.1.4.1.4.2.1.2.1.9-.1 1.5Z"/></svg>'],
    ['X', 'https://x.com/intent/tweet?text=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(url), '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-6.4L6.3 22H3l7.3-8.4L3 2h6.5l4.4 5.9L18.9 2Z"/></svg>'],
    ['LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url), '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.05a4.2 4.2 0 0 1 3.75-2.05C20.4 8.65 22 10.6 22 14.1V21h-4v-6.2c0-1.5-.5-2.5-1.9-2.5-1.2 0-1.9.8-2.2 1.6-.1.3-.1.7-.1 1.1V21H9V9Z"/></svg>']
  ];
  var bar = document.createElement('div');
  bar.className = 'vx-share';
  bar.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 22px';
  var lab = document.createElement('span');
  lab.className = 'mono';
  lab.style.cssText = 'font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.55';
  lab.textContent = 'Share';
  bar.appendChild(lab);
  function mk(label, href, icon) {
    var a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'Share on ' + label);
    a.style.cssText = 'display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid rgba(255,255,255,.16);border-radius:999px;font-size:13px;color:inherit;opacity:.8;text-decoration:none';
    a.innerHTML = icon + '<span>' + label + '</span>';
    a.addEventListener('mouseenter', function(){ a.style.opacity='1'; a.style.borderColor='rgba(255,255,255,.4)'; });
    a.addEventListener('mouseleave', function(){ a.style.opacity='.8'; a.style.borderColor='rgba(255,255,255,.16)'; });
    return a;
  }
  items.forEach(function (it) { bar.appendChild(mk(it[0], it[1], it[2])); });
  var copy = document.createElement('button');
  copy.type = 'button';
  copy.setAttribute('aria-label', 'Copy link');
  copy.style.cssText = 'display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid rgba(255,255,255,.16);border-radius:999px;font-size:13px;background:none;color:inherit;opacity:.8;cursor:pointer;font-family:inherit';
  copy.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a2 2 0 0 0-2 2v9"/></svg><span>Copy link</span>';
  copy.addEventListener('click', function () {
    var t = url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function(){ copy.querySelector('span').textContent = 'Copied'; setTimeout(function(){ copy.querySelector('span').textContent = 'Copy link'; }, 1800); });
    }
  });
  bar.appendChild(copy);
  quick.parentNode.insertBefore(bar, quick);
})();

/* GA4 - covers pages built without the inline Google tag */
(function () {
  try {
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', 'G-JFBST9ZHJP');
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-JFBST9ZHJP';
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {}
})();
