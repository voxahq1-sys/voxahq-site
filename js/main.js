/* VOXA interactions */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var d = document;
  function q(s, c) { return (c || d).querySelector(s); }
  function qa(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }

  /* ---------- loader (first visit in a session only) ---------- */
  var countEl = q('#loaderCount');
  var barEl = q('#loaderBar');
  var pct = 0;
  var firstVisit = true;
  try {
    firstVisit = !sessionStorage.getItem('voxa_seen');
    sessionStorage.setItem('voxa_seen', '1');
  } catch (e) { firstVisit = true; }
  function done() {
    d.body.classList.remove('loading');
    d.body.classList.add('loaded');
    setTimeout(function () { var l = q('#loader'); if (l && l.parentNode) l.parentNode.removeChild(l); }, 1200);
  }
  function tick() {
    pct = Math.min(100, pct + 3 + Math.random() * 6);
    if (countEl) countEl.textContent = String(Math.floor(pct));
    if (barEl) barEl.style.width = pct + '%';
    if (pct < 100) { setTimeout(tick, 30); } else { setTimeout(done, 350); }
  }
  if (reduced || !firstVisit) { done(); } else { setTimeout(tick, 120); }
  setTimeout(function () { if (d.body.classList.contains('loading')) done(); }, 4000);

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
