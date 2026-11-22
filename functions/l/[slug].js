// Public lander renderer: /l/<ws>-<slug>
function pick(vs, stats) {
  var w = vs.map(function (v, i) {
    var base = v.weight || 1;
    var s = stats[i] || { views: 0, clicks: 0, sales: 0 };
    if (s.sales > 0) base = base * (1 + 3 * s.sales);
    else if (s.clicks >= 50) base = base * 0.2;
    return base;
  });
  var t = w.reduce(function (a, b) { return a + b; }, 0);
  var r = Math.random() * t;
  for (var i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
export async function onRequestGet(context) {
  const { env, params } = context;
  if (!env.PASSPORT) return new Response('Not configured', { status: 500 });
  const raw = await env.PASSPORT.get('pub:' + params.slug);
  if (!raw) return new Response('<h1>Not found</h1>', { status: 404, headers: { 'content-type': 'text/html' } });
  const d = JSON.parse(raw);
  if (!d.variants || !d.variants.length) return new Response('<h1>Not found</h1>', { status: 404, headers: { 'content-type': 'text/html' } });
  const stats = [];
  for (let si = 0; si < d.variants.length; si++) {
    const vw = Number((await env.PASSPORT.get('views:' + params.slug + ':' + si)) || 0);
    const cl = Number((await env.PASSPORT.get('clicks:' + params.slug + ':' + si)) || 0);
    const sl = Number((await env.PASSPORT.get('lconv:' + params.slug + ':' + si)) || 0);
    stats.push({ views: vw, clicks: cl, sales: sl });
  }
  const urlGeo = (new URL(context.request.url).searchParams.get('geo') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  const country = urlGeo || ((context.request.cf && context.request.cf.country) || '').toUpperCase();
  const idxAll = d.variants.map(function (v, i) { return i; });
  const idxGeo = idxAll.filter(function (i) {
    const list = (d.variants[i].geo || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return list.length === 0 || (country && list.indexOf(country) > -1);
  });
  const pool = idxGeo.length ? idxGeo : idxAll;
  const subStats = pool.map(function (i) { return stats[i]; });
  const subVars = pool.map(function (i) { return d.variants[i]; });
  const localIdx = pick(subVars, subStats);
  const vi = pool[localIdx] !== undefined ? pool[localIdx] : 0;
  const v = d.variants[vi];
  try {
    const vk = 'views:' + params.slug + ':' + vi;
    await env.PASSPORT.put(vk, String((stats[vi].views || 0) + 1), { expirationTtl: 60 * 60 * 24 * 180 });
    const day1 = new Date().toISOString().slice(0, 10);
    const dk1 = 'day:v:' + params.slug + ':' + day1;
    await env.PASSPORT.put(dk1, String(Number((await env.PASSPORT.get(dk1)) || 0) + 1), { expirationTtl: 60 * 60 * 24 * 120 });
  } catch (e) {}
  const cta = '/lc?k=' + encodeURIComponent(params.slug) + '&v=' + vi + '&p=' + encodeURIComponent(d.cidParam || 'sub1') + '&to=' + encodeURIComponent(d.offer || '');
  const bullets = v.bullets || [];
  const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const read = Math.max(2, Math.round(((v.headline || '').split(' ').length + (v.sub || '').split(' ').length + bullets.join(' ').split(' ').length) / 120) + 2);
  const hero = d.hero ? '<img class="hero" src="' + esc(d.hero) + '" alt="">' : '';
  let inner = '';
  if (d.template === 'quiz') {
    inner = '<span class="pill">Question 1 of 3</span><h1>' + esc(v.headline) + '</h1><p class="sub">' + esc(v.sub) + '</p>'
      + '<div class="quiz">' + bullets.map(function (b, i) { return '<button class="opt" data-i="' + i + '"><span>' + String.fromCharCode(65 + i) + '</span>' + esc(b) + '</button>'; }).join('') + '</div>'
      + '<a class="cta" href="' + cta + '">' + esc(v.cta) + '</a><p class="fine">No sign-up needed to see the next step.</p>';
  } else if (d.template === 'listicle') {
    inner = '<span class="pill">' + bullets.length + ' things</span><h1>' + esc(v.headline) + '</h1><p class="sub">' + esc(v.sub) + '</p>'
      + '<ol class="list">' + bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ol>'
      + '<a class="cta" href="' + cta + '">' + esc(v.cta) + '</a>';
  } else if (d.template === 'comparison') {
    inner = '<span class="pill">Comparison</span><h1>' + esc(v.headline) + '</h1><p class="sub">' + esc(v.sub) + '</p>'
      + '<table class="cmp"><thead><tr><th></th><th>This</th><th>Typical</th></tr></thead><tbody>'
      + bullets.map(function (b) { const parts = b.split('|'); return '<tr><td>' + esc(parts[0] || '') + '</td><td class="yes">' + esc(parts[1] || 'Yes') + '</td><td class="no">' + esc(parts[2] || '') + '</td></tr>'; }).join('')
      + '</tbody></table><a class="cta" href="' + cta + '">' + esc(v.cta) + '</a>';
  } else {
    inner = '<span class="pill">Sponsored review</span><h1>' + esc(v.headline) + '</h1>'
      + '<div class="byline">By the ' + esc(d.brand || 'editorial') + ' team · ' + month + ' · ' + read + ' min read</div>'
      + hero + '<p class="sub">' + esc(v.sub) + '</p>'
      + (bullets.length ? '<ul class="ticks">' + bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' : '')
      + '<a class="cta" href="' + cta + '">' + esc(v.cta) + '</a><p class="fine">Claims on this page must match the offer. Results vary by person.</p>';
  }
  const pixel = d.pixel ? d.pixel : '';
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' + esc(v.headline) + '</title>'
    + pixel + '<style>*{box-sizing:border-box}body{margin:0;background:#F6F5F1;color:#141821;font:17px/1.7 Inter,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}'
    + '.wrap{max-width:660px;margin:0 auto;padding:16px 18px 70px}'
    + '.top{display:flex;align-items:center;gap:10px;padding:8px 0 16px;font-size:13.5px;color:#6B7280;font-weight:600}'
    + '.dot{width:24px;height:24px;border-radius:7px;background:' + d.accent + ';flex:none}'
    + '.card{background:#fff;border:1px solid #E7E3DA;border-radius:18px;padding:26px 24px;box-shadow:0 1px 2px rgba(16,24,40,.04)}'
    + '.pill{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + d.accent + ';background:#F1F8F5;padding:6px 11px;border-radius:999px;margin-bottom:16px}'
    + 'h1{font-size:30px;line-height:1.22;letter-spacing:-.8px;margin:0 0 12px;font-weight:800}'
    + '.byline{font-size:13px;color:#8A93A0;margin:0 0 18px}'
    + 'p.sub{color:#495260;margin:0 0 20px;font-size:17.5px}'
    + 'img.hero{width:100%;height:auto;border-radius:14px;margin:4px 0 20px;display:block}'
    + 'ul.ticks{list-style:none;margin:0 0 22px;padding:0}ul.ticks li{position:relative;padding-left:28px;margin-bottom:10px;color:#374151}'
    + 'ul.ticks li:before{content:"";position:absolute;left:0;top:7px;width:16px;height:16px;border-radius:50%;background:#E8F5F0}'
    + 'ul.ticks li:after{content:"";position:absolute;left:5px;top:11px;width:6px;height:3px;border-left:2px solid ' + d.accent + ';border-bottom:2px solid ' + d.accent + ';transform:rotate(-45deg)}'
    + 'ol.list{margin:0 0 22px 22px;color:#374151}ol.list li{margin-bottom:10px;padding-left:4px}'
    + '.quiz{display:grid;gap:10px;margin:0 0 20px}'
    + '.opt{display:flex;gap:12px;align-items:center;width:100%;text-align:left;border:1px solid #E7E3DA;border-radius:12px;padding:14px 16px;font:inherit;font-size:16px;background:#fff;cursor:pointer;transition:.15s}'
    + '.opt:hover{border-color:' + d.accent + ';background:#FAFDFB}.opt.sel{border-color:' + d.accent + ';background:#F1F8F5}'
    + '.opt span{width:26px;height:26px;border-radius:50%;background:#F1F8F5;color:' + d.accent + ';font-weight:800;font-size:12.5px;display:flex;align-items:center;justify-content:center;flex:none}'
    + 'a.cta{display:block;text-align:center;background:' + d.accent + ';color:#fff;text-decoration:none;font-weight:700;padding:17px;border-radius:13px;font-size:17.5px;box-shadow:0 8px 20px rgba(14,124,102,.18)}'
    + 'table.cmp{width:100%;border-collapse:collapse;margin:0 0 22px;font-size:15px}'
    + 'table.cmp th{text-align:left;font-size:11px;letter-spacing:.7px;text-transform:uppercase;color:#8A93A0;padding:8px 6px;border-bottom:1px solid #E7E3DA}'
    + 'table.cmp td{padding:10px 6px;border-bottom:1px solid #F0EDE6;color:#374151}'
    + 'table.cmp td.yes{color:' + d.accent + ';font-weight:700}table.cmp td.no{color:#9AA3AF}'
    + '.fine{margin-top:16px;font-size:12px;color:#9AA3AF;line-height:1.55}'
    + '.sbar{position:fixed;left:0;right:0;bottom:0;padding:10px 16px 14px;background:rgba(255,255,255,.96);border-top:1px solid #E7E3DA;transform:translateY(115%);transition:transform .25s ease;z-index:40}'
    + '.sbar.on{transform:none}.sbar a.cta{padding:15px;font-size:16.5px}'
    + '@media(min-width:641px){.sbar{display:none}}'
    + '@media(max-width:520px){h1{font-size:25px}.card{padding:22px 18px}}'
    + '</style></head><body><div class="wrap"><div class="top"><span class="dot"></span><span>' + esc(d.brand || '') + '</span></div><div class="card">' + inner + '</div>'
    + '<div class="fine">Built with FabConvert. This page is not indexed and carries no third-party trackers.</div></div>'
    + '<script>document.querySelectorAll(".opt").forEach(function(b){b.addEventListener("click",function(){document.querySelectorAll(".opt").forEach(function(x){x.classList.remove("sel")});b.classList.add("sel");});});</script>'
    + (d.template === 'quiz' ? '' : '<div class="sbar" id="sbar"><a class="cta" href="' + cta + '">' + esc(v.cta) + '</a></div><script>var sb=document.getElementById("sbar");if(sb){var shown=false;window.addEventListener("scroll",function(){if(shown)return;if(window.scrollY>window.innerHeight*0.45){sb.classList.add("on");shown=true;}});}</script>')
    + '</body></html>';
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
