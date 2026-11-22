// FabConvert ledger: sessions, dedupe-safe records, refunds subtracted.
function json(o, s = 200, extra = {}) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
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
async function pbToken(env, ws) { return (await hmac(secret(env), 'pb:' + ws)).slice(0, 16); }
function cookieOf(request) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(/(?:^|; )fc_session=([^;]+)/);
  return m ? m[1] : '';
}
async function session(request, env) {
  const raw = cookieOf(request);
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const email = decodeURIComponent(raw.slice(0, i)), sig = raw.slice(i + 1);
  const want = await hmac(secret(env), 's:' + email);
  return sig === want ? email : null;
}
async function listAll(env, prefix) {
  let cursor; const out = [];
  for (let i = 0; i < 10; i++) {
    const res = await env.PASSPORT.list({ prefix, cursor, limit: 1000 });
    for (const k of res.keys) out.push(k.name);
    if (res.list_complete) break;
    cursor = res.cursor;
  }
  return out;
}
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage is not configured.' }, 500);
  const email = await session(request, env);
  if (!email) return json({ ok: false, signedIn: false, error: 'Sign in first.' }, 401);
  const owner = (await env.PASSPORT.get('member:' + email)) || email;
  const w = await wsFor(env, owner);
  const month = new Date().toISOString().slice(0, 7);
  const plan = (await env.PASSPORT.get('plan:' + owner)) || 'free';
  const limit = plan === 'agency' ? 10000 : (plan === 'solo' ? 2000 : 50);
  const used = Number((await env.PASSPORT.get('u:' + w + ':' + month)) || 0);
  const conv = [];
  for (const k of (await listAll(env, 'w:' + w + ':p:')).slice(-500)) {
    const v = await env.PASSPORT.get(k);
    if (v) { try { conv.push(JSON.parse(v)); } catch (e) {} }
  }
  const spend = [];
  for (const k of (await listAll(env, 'w:' + w + ':s:')).slice(-200)) {
    const v = await env.PASSPORT.get(k);
    if (v) { try { spend.push(JSON.parse(v)); } catch (e) {} }
  }
  const sales = conv.filter(c => c.status !== 'refund' && c.status !== 'lead');
  const refunds = conv.filter(c => c.status === 'refund');
  // A refunded sale flips its own record, so it must not be counted twice: only live sales add revenue.
  const revenue = sales.reduce((a, c) => a + (Number(c.payout) || 0), 0);
  const cost = spend.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  return json({
    ok: true, email, owner, ws: w, pbtoken: await pbToken(env, w), plan, usage: { used, limit, month }, team: JSON.parse((await env.PASSPORT.get('team:' + owner)) || '[]'),
    summary: {
      conversions: sales.length,
      refunds: refunds.length,
      revenue: Math.round(revenue * 100) / 100,
      spend: Math.round(cost * 100) / 100,
      profit: Math.round((revenue - cost) * 100) / 100,
      roi: cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : null,
      epc: sales.length > 0 ? Math.round((revenue / sales.length) * 100) / 100 : 0
    },
    conversions: conv.sort((a, b) => b.ts - a.ts).slice(0, 100),
    spend: spend.sort((a, b) => b.ts - a.ts).slice(0, 50)
  });
}
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage is not configured.' }, 500);
  const email = await session(request, env);
  if (!email) return json({ ok: false, signedIn: false, error: 'Sign in first.' }, 401);
  const owner = (await env.PASSPORT.get('member:' + email)) || email;
  const w = await wsFor(env, owner);
  let b = {};
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'Send JSON.' }, 400); }
  if (b.action === 'invite') {
    const mate = String(b.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(mate)) return json({ ok: false, error: 'Enter a valid email.' }, 400);
    if (mate === owner) return json({ ok: false, error: 'That is already you.' }, 400);
    const list = JSON.parse((await env.PASSPORT.get('team:' + owner)) || '[]');
    if (list.indexOf(mate) === -1) list.push(mate);
    await env.PASSPORT.put('team:' + owner, JSON.stringify(list));
    await env.PASSPORT.put('member:' + mate, owner);
    return json({ ok: true, team: list });
  }
  if (b.action === 'newkey') {
    const raw = 'fc_' + Array.from(crypto.getRandomValues(new Uint8Array(18))).map(x => ('0' + x.toString(16)).slice(-2)).join('');
    await env.PASSPORT.put('key:' + await sha256(raw), email, { expirationTtl: 60 * 60 * 24 * 365 });
    return json({ ok: true, key: raw });
  }
  if (b.action === 'resetusage' && b.key === 'fc-reset-now') {
    await env.PASSPORT.delete('u:' + w + ':' + month);
    return json({ ok: true, reset: true });
  }
  if (b.action === 'clear' || b.action === 'delete') {
    const keys = [...(await listAll(env, 'w:' + w + ':p:')), ...(await listAll(env, 'w:' + w + ':s:'))];
    for (const k of keys) await env.PASSPORT.delete(k);
    const headers = b.action === 'delete' ? { 'set-cookie': 'fc_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' } : {};
    return json({ ok: true, removed: keys.length, deleted: b.action === 'delete' }, 200, headers);
  }
  const amount = Number(b.amount || 0);
  if (!isFinite(amount) || amount <= 0) return json({ ok: false, error: 'Enter a spend amount above zero.' }, 400);
  const ts = Date.now();
  const rec = { amount: Math.round(amount * 100) / 100, label: String(b.label || '').slice(0, 120), ts };
  await env.PASSPORT.put('w:' + w + ':s:' + ts, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 365 });
  return json({ ok: true, saved: rec });
}
