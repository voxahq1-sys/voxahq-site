// Public lander renderer: /l/<ws>-<slug>
function pick(variants) {
  const total = variants.reduce((a, v) => a + (v.weight || 1), 0);
  let r = Math.random() * total;
  for (let i = 0; i < variants.length; i++) { r -= (variants[i].weight || 1); if (r <= 0) return i; }
  return 0;
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!env.PASSPORT) return new Response('Not configured', { status: 500 });
  const key = params.slug;
  const raw = await env.PASSPORT.get('pub:' + key);
  if (!raw) return new Response('<h1>Not found</h1>', { status: 404, headers: { 'content-type': 'text/html' } });
  const d = JSON.parse(raw);
  if (!d.variants || !d.variants.length) return new Response('<h1>Not found</h1>', { status: 404, headers: { 'content-type': 'text/html' } });
  const vi = pick(d.variants);
  const v = d.variants[vi];
  const cta = '/lc?k=' + encodeURIComponent(key) + '&v=' + vi + '&to=' + encodeURIComponent(d.offer || '');
  const bullets = (v.bullets || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('');
  const isQuiz = d.template === 'quiz';
  const isList = d.template === 'listicle';
  const isCompare = d.template === 'comparison';
  const badge = isQuiz ? 'Question 1 of 3' : (isList ? 'Editor pick' : (isCompare ? 'Comparison' : 'Sponsored review'));
  const body = isQuiz
    ? '<div class="card"><div class="badge">' + badge + '</div><h1>' + esc(v.headline) + '</h1><p class="sub">' + esc(v.sub) + '</p><div class="quiz">' + (v.bullets || []).map(function (b, i) { return '<div class="opt"><span>' + String.fromCharCode(65 + i) + '</span>' + esc(b) + '</div>'; }).join('') + '</div><a class="cta" href="' + cta + '">' + esc(v.cta) + '</a></div>'
    : '<div class="card"><div class="badge">' + badge + '</div><h1>' + esc(v.headline) + '</h1><p class="sub">' + esc(v.sub) + '</p>' + (bullets ? '<ul>' + bullets + '</ul>' : '') + '<a class="cta" href="' + cta + '">' + esc(v.cta) + '</a></div>';
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' + esc(v.headline) + '</title>'
    + '<style>body{margin:0;background:#F7F6F3;font:17px/1.65 Inter,system-ui,-apple-system,sans-serif;color:#14181F}'
    + '.wrap{max-width:680px;margin:0 auto;padding:22px 18px 60px}.top{display:flex;align-items:center;gap:10px;padding:10px 0 18px;font-size:13px;color:#6B7280}'
    + '.dot{width:22px;height:22px;border-radius:6px;background:' + d.accent + '}.card{background:#fff;border:1px solid #E6E3DB;border-radius:16px;padding:24px}'
    + '.badge{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:' + d.accent + ';background:#F2F8F6;padding:5px 10px;border-radius:999px;margin-bottom:14px}'
    + 'h1{font-size:27px;line-height:1.25;letter-spacing:-.6px;margin:0 0 12px}p.sub{color:#4B5563;margin:0 0 16px}'
    + 'ul{margin:0 0 18px 18px;color:#374151}li{margin-bottom:7px}'
    + '.quiz{display:grid;gap:10px;margin:0 0 18px}.opt{display:flex;gap:10px;align-items:center;border:1px solid #E6E3DB;border-radius:12px;padding:12px 14px;font-size:15.5px}'
    + '.opt span{width:24px;height:24px;border-radius:50%;background:#F2F8F6;color:' + d.accent + ';font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center}'
    + 'a.cta{display:block;text-align:center;background:' + d.accent + ';color:#fff;text-decoration:none;font-weight:700;padding:16px;border-radius:12px;font-size:17px}'
    + '.fine{margin-top:14px;font-size:12px;color:#9CA3AF;line-height:1.5}</style></head><body><div class="wrap">'
    + '<div class="top"><span class="dot"></span><span>' + esc(d.brand || '') + '</span></div>' + body
    + '<div class="fine">This page was built with FabConvert. Claims must match the offer. Results vary.</div></div></body></html>';
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
