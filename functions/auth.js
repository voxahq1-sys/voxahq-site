// FabConvert auth: email code login, signed session cookie, per-account workspace.
function json(o, s = 200, extra = {}) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
}
function secret(env) { return env.FABCONVERT_SECRET || env.RESEND_API_KEY || ''; }
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
async function wsFor(env, email) { return (await hmac(secret(env), 'ws:' + email)).slice(0, 18); }
function cookieOf(request, name) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? m[1] : '';
}
async function emailFrom(request, env) {
  const raw = cookieOf(request, 'fc_session');
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const email = decodeURIComponent(raw.slice(0, i)), sig = raw.slice(i + 1);
  const exp = Number((await hmac(secret(env), 'exp:' + email)).slice(0, 0)) || 0;
  const want = await hmac(secret(env), 's:' + email);
  return sig === want ? email : null;
}
export async function onRequestGet(context) {
  const { request, env } = context;
  const email = await emailFrom(request, env);
  if (!email) return json({ ok: true, signedIn: false });
  return json({ ok: true, signedIn: true, email, ws: await wsFor(env, email) });
}
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage is not configured.' }, 500);
  const u = new URL(request.url);
  const action = u.searchParams.get('action') || '';
  let b = {};
  try { b = await request.json(); } catch (e) {}
  if (action === 'logout') {
    return json({ ok: true }, 200, { 'set-cookie': 'fc_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' });
  }
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return json({ ok: false, error: 'Enter a valid email.' }, 400);
  if (action === 'send') {
    const attemptsKey = 'otp_try:' + email;
    const tries = Number((await env.PASSPORT.get(attemptsKey)) || 0);
    if (tries > 8) return json({ ok: false, error: 'Too many codes requested. Try again later.' }, 429);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await env.PASSPORT.put('otp:' + email, code, { expirationTtl: 600 });
    await env.PASSPORT.put(attemptsKey, String(tries + 1), { expirationTtl: 3600 });
    let sent = false;
    if (env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.RESEND_API_KEY },
        body: JSON.stringify({
          from: 'FabConvert <alerts@voxahq.in>',
      reply_to: 'voxa.hq1@gmail.com',
          to: [email],
          subject: 'Your FabConvert sign-in code: ' + code,
          html: '<div style="font-family:system-ui,sans-serif;max-width:520px"><h2 style="margin:0 0 8px">Your sign-in code</h2><p style="font-size:28px;letter-spacing:6px;font-weight:800;margin:12px 0">' + code + '</p><p style="color:#555">It expires in 10 minutes. If you did not ask for it, ignore this email.</p><p style="color:#777;font-size:13px">FabConvert by VOXA, voxahq.in</p></div>'
        })
      });
      sent = r.ok;
    }
    if (!sent) return json({ ok: false, error: 'Could not send the email right now.' }, 502);
    return json({ ok: true, sent: true });
  }
  if (action === 'verify') {
    const code = String(b.code || '').trim();
    const wrongKey = 'otp_bad:' + email;
    const wrong = Number((await env.PASSPORT.get(wrongKey)) || 0);
    if (wrong >= 5) return json({ ok: false, error: 'Too many wrong codes. Ask for a new one in 15 minutes.' }, 429);
    const saved = await env.PASSPORT.get('otp:' + email);
    if (!saved || saved !== code) {
      await env.PASSPORT.put(wrongKey, String(wrong + 1), { expirationTtl: 900 });
      if (wrong + 1 >= 5) await env.PASSPORT.delete('otp:' + email);
      return json({ ok: false, error: 'That code is wrong or expired.' }, 401);
    }
    await env.PASSPORT.delete('otp:' + email);
    await env.PASSPORT.delete(wrongKey);
    const sig = await hmac(secret(env), 's:' + email);
    const ws = await wsFor(env, email);
    const known = await env.PASSPORT.get('wowner:' + ws);
    if (!known) {
      await env.PASSPORT.put('wowner:' + ws, email);
      await env.PASSPORT.put('signup:' + Date.now() + ':' + email, JSON.stringify({ email, ts: Date.now(), ua: String(request.headers.get('user-agent') || '').slice(0, 120) }));
    }
    const cookie = 'fc_session=' + encodeURIComponent(email) + '.' + sig + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000';
    return json({ ok: true, email, ws: await wsFor(env, email) }, 200, { 'set-cookie': cookie });
  }
  return json({ ok: false, error: 'Unknown action.' }, 400);
}
