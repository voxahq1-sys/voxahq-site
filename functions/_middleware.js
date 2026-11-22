// Counts document views on the FabConvert pages and tells the owner the first time a stranger opens one.
const OWNER = 'voxa.hq1@gmail.com';
async function mail(env, subject, html) {
  if (!env.RESEND_API_KEY) return 'no-key';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'FabConvert <alerts@voxahq.in>', to: OWNER, reply_to: OWNER, subject: subject, html: html })
    });
    return 'resend-' + r.status;
  } catch (e) { return 'err-' + (e && e.message ? e.message.slice(0, 40) : 'x'); }
}
export async function onRequest(context) {
  const { request, env, next } = context;
  const res = await next();
  try {
    const u = new URL(request.url);
    const dest = request.headers.get('sec-fetch-dest') || '';
    const cookie = request.headers.get('cookie') || '';
    if (env.PASSPORT && res.status === 200 && dest === 'document' && u.pathname.indexOf('/fabconvert') === 0) {
      const work = (async () => {
        const day = new Date().toISOString().slice(0, 10);
        const pathKey = 'pv:' + day + ':' + (u.pathname.replace(/[^a-z0-9]/gi, '_') || '_root');
        const a = Number((await env.PASSPORT.get(pathKey)) || 0);
        await env.PASSPORT.put(pathKey, String(a + 1), { expirationTtl: 60 * 60 * 24 * 90 });
        const tKey = 'pvt:' + day;
        const b = Number((await env.PASSPORT.get(tKey)) || 0);
        await env.PASSPORT.put(tKey, String(b + 1), { expirationTtl: 60 * 60 * 24 * 90 });
        const hour = new Date().toISOString().slice(0, 13);
        const slot = 'mailv:' + hour;
        let outcome = 'skipped-signed-in';
        if (cookie.indexOf('fc_session=') === -1) {
          const taken = await env.PASSPORT.get(slot);
          if (taken) { outcome = 'skipped-hour-cap'; } else {
            await env.PASSPORT.put(slot, '1', { expirationTtl: 7200 });
            outcome = await mail(env, 'Someone opened FabConvert: ' + u.pathname, '<p><b>Page:</b> ' + u.pathname + '</p><p><b>Time (UTC):</b> ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '</p><p><b>Country:</b> ' + ((request.cf && request.cf.country) || 'unknown') + '</p><p><b>Came from:</b> ' + (request.headers.get('referer') || 'direct') + '</p><p>Views today: ' + (b + 1) + '</p>');
          }
        }
        await env.PASSPORT.put('dbg:' + Date.now(), JSON.stringify({ path: u.pathname, outcome: outcome, key: !!env.RESEND_API_KEY }), { expirationTtl: 86400 });
      })();
      return res;
    }
  } catch (e) {}
  return res;
}