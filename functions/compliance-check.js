// FabConvert compliance check: runs the rules server side so usage can be metered.
let CACHE = null;
function json(o, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
function secret(env) { return env.FABCONVERT_SECRET || env.RESEND_API_KEY || ''; }
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_').slice(0, 40);
}
async function wsFor(env, email) { return (await hmac(secret(env), 'ws:' + email)).slice(0, 18); }
async function rules(request) {
  if (CACHE) return CACHE;
  const r = await fetch(new URL('/fabconvert/rules.json', request.url).toString(), { cf: { cacheTtl: 600 } });
  CACHE = await r.json();
  return CACHE;
}
async function whoFrom(request, env) {
  const key = request.headers.get('x-api-key') || '';
  if (key && env.PASSPORT) {
    const email = await env.PASSPORT.get('key:' + await sha256(key));
    if (email) return { email, via: 'api key' };
  }
  const c = request.headers.get('cookie') || '';
  const m = c.match(/(?:^|; )fc_session=([^;]+)/);
  if (!m) return null;
  const raw = m[1];
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const email = decodeURIComponent(raw.slice(0, i)), sig = raw.slice(i + 1);
  const want = await hmac(secret(env), 's:' + email);
  return sig === want ? { email, via: 'session' } : null;
}
function limitFor(plan) { return plan === 'agency' ? 10000 : (plan === 'solo' ? 2000 : 50); }
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage is not configured.' }, 500);
  const who = await whoFrom(request, env);
  if (!who) return json({ ok: false, error: 'Sign in or send an API key.' }, 401);
  let body = {};
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'Send JSON.' }, 400); }
  const ads = Array.isArray(body.ads) ? body.ads.slice(0, 200) : (body.copy ? [String(body.copy) + (body.imageText ? ' ' + body.imageText : '')] : []);
  if (!ads.length) return json({ ok: false, error: 'No ad text in the request.' }, 400);
  const ws = await wsFor(env, who.email);
  const plan = (await env.PASSPORT.get('plan:' + who.email)) || 'free';
  const limit = limitFor(plan);
  const month = new Date().toISOString().slice(0, 7);
  const usageKey = 'u:' + ws + ':' + month;
  const used = Number((await env.PASSPORT.get(usageKey)) || 0);
  if (used + ads.length > limit) {
    return json({ ok: false, error: 'Monthly limit reached (' + used + ' of ' + limit + ').', plan, usage: { used, limit } }, 429);
  }
  const R = await rules(request);
  const results = ads.map(function (raw) {
    const text = String(raw || '');
    const hits = [];
    for (const r of R) {
      if (r.id === 'long-headline') continue;
      let m;
      try { m = text.match(new RegExp(r.pattern, r.flags)); } catch (e) { continue; }
      if (m) hits.push({ id: r.id, sev: r.sev, cat: r.cat, match: m[0], why: r.why, fix: r.fix });
    }
    const blocks = hits.filter(h => h.sev === 'block');
    const warns = hits.filter(h => h.sev === 'warn');
    return { ad: text.slice(0, 240), verdict: blocks.length ? 'red' : (warns.length ? 'amber' : 'green'), score: Math.max(0, 100 - blocks.length * 25 - warns.length * 8), blocks, warns };
  });
  await env.PASSPORT.put(usageKey, String(used + ads.length), { expirationTtl: 60 * 60 * 24 * 70 });
  return json({ ok: true, results, rules: R.length, plan, usage: { used: used + ads.length, limit } });
}
export async function onRequestGet() {
  return json({ ok: true, use: 'POST { "ads": ["..."] } with a session cookie or an x-api-key header.' });
}
