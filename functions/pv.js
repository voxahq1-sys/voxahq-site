// Page view beacon for the FabConvert pages: counts the visit and mails the owner the first time a stranger opens one.
// No cookies are set here, and no IP address is stored.
const OWNER = 'voxa.hq1@gmail.com';
function json(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); }
async function mail(env, subject, html) {
  if (!env.RESEND_API_KEY) return 'no-key';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'FabConvert <alerts@voxahq.in>', to: OWNER, reply_to: OWNER, subject: subject, html: html })
    });
    return 'resend-' + r.status;
  } catch (e) { return 'err'; }
}
export async function onRequestGet(context) {
  const { request, env } = context;
  const u = new URL(request.url);
  let p = String(u.searchParams.get('p') || '/').slice(0, 120);
  if (p.indexOf('/fabconvert') !== 0) p = '/fabconvert' + (p === '/' ? '/' : p);
  const ref = String(u.searchParams.get('r') || 'direct').slice(0, 120);
  let outcome = 'ok';
  try {
    const day = new Date().toISOString().slice(0, 10);
    const pathKey = 'pv:' + day + ':' + (p.replace(/[^a-z0-9]/gi, '_') || '_root');
    const a = Number((await env.PASSPORT.get(pathKey)) || 0);
    await env.PASSPORT.put(pathKey, String(a + 1), { expirationTtl: 60 * 60 * 24 * 90 });
    const tKey = 'pvt:' + day;
    const b = Number((await env.PASSPORT.get(tKey)) || 0);
    await env.PASSPORT.put(tKey, String(b + 1), { expirationTtl: 60 * 60 * 24 * 90 });
    const cookie = request.headers.get('cookie') || '';
    if (cookie.indexOf('fc_session=') > -1) {
      outcome = 'owner-view';
    } else {
      const hour = new Date().toISOString().slice(0, 13);
      const slot = 'mailv:' + hour;
      if (await env.PASSPORT.get(slot)) {
        outcome = 'hour-cap';
      } else {
        await env.PASSPORT.put(slot, '1', { expirationTtl: 7200 });
        outcome = await mail(env, 'Someone opened FabConvert: ' + p, '<p><b>Page:</b> ' + p + '</p><p><b>Time (UTC):</b> ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '</p><p><b>Country:</b> ' + ((request.cf && request.cf.country) || 'unknown') + '</p><p><b>Came from:</b> ' + ref + '</p><p><b>Device:</b> ' + String(request.headers.get('user-agent') || '').slice(0, 80) + '</p><p>Views today: ' + (b + 1) + '</p>');
      }
    }
  } catch (e) { outcome = 'err'; }
  return json({ ok: true, counted: true, outcome: outcome });
}