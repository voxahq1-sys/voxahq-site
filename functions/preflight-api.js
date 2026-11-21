// Preflight API: POST { ads: ["..."] } with header x-api-key. Returns a verdict per ad.
let CACHE = null;
async function loadRules(request) {
  if (CACHE) return CACHE;
  const u = new URL('/preflight/rules.json', request.url);
  const r = await fetch(u.toString(), { cf: { cacheTtl: 600 } });
  CACHE = await r.json();
  return CACHE;
}
function json(b, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
export async function onRequestPost(context) {
  const { request, env } = context;
  if (env.PREFLIGHT_KEY) {
    const key = request.headers.get('x-api-key') || '';
    if (key !== env.PREFLIGHT_KEY) return json({ ok: false, error: 'Bad API key.' }, 401);
  }
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'Send JSON.' }, 400); }
  const ads = Array.isArray(body.ads) ? body.ads.slice(0, 200) : (body.text ? [body.text] : []);
  if (!ads.length) return json({ ok: false, error: 'No ads in the request.' }, 400);
  const rules = await loadRules(request);
  const results = ads.map(function (raw) {
    const text = String(raw || '');
    const hits = [];
    for (const r of rules) {
      if (r.id === 'long-headline') continue;
      let m;
      try { m = text.match(new RegExp(r.pattern, r.flags)); } catch (e) { continue; }
      if (m) hits.push({ id: r.id, sev: r.sev, cat: r.cat, match: m[0], why: r.why, fix: r.fix });
    }
    const blocks = hits.filter(h => h.sev === 'block');
    const warns = hits.filter(h => h.sev === 'warn');
    return {
      ad: text.slice(0, 200),
      verdict: blocks.length ? 'red' : (warns.length ? 'amber' : 'green'),
      score: Math.max(0, 100 - blocks.length * 25 - warns.length * 8),
      blocks: blocks, warns: warns
    };
  });
  return json({ ok: true, count: results.length, rules: rules.length, results: results });
}
export async function onRequestGet() {
  return json({ ok: true, use: 'POST { "ads": ["your ad copy"] } with x-api-key when a key is configured.' });
}
