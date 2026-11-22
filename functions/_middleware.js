// Counts document views on the FabConvert pages and tells the owner the first time a stranger opens one.
// No cookies are set for counting, no IP is stored.
const OWNER = 'voxa.hq1@gmail.com';
async function mail(env, subject, html) {
  if (!env.RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'FabConvert <alerts@voxahq.in>', to: OWNER, reply_to: OWNER, subject: subject, html: html })
    });
  } catch (e) {}
}
export async function onRequest(context) {
  const { request, env, next } = context;
  const res = await next();
  try {
    const u = new URL(request.url);
    const dest = request.headers.get('sec-fetch-dest') || '';
    const signedIn = (request.headers.get('cookie') || '').indexOf('fc_session=') > -1;
    if (env.PASSPORT && res.status === 200 && dest === 'document' && u.pathname.indexOf('/fabconvert') === 0) {
      const work = (async () => {
        const day = new Date().toISOString().slice(0, 10);
        const pathKey = 'pv:' + day + ':' + (u.pathname.replace(/[^a-z0-9]/gi, '_') || '_root');
        const a = Number((await env.PASSPORT.get(pathKey)) || 0);
        await env.PASSPORT.put(pathKey, String(a + 1), { expirationTtl: 60 * 60 * 24 * 90 });
        const tKey = 'pvt:' + day;
        const b = Number((await env.PASSPORT.get(tKey)) || 0);
        await env.PASSPORT.put(tKey, String(b + 1), { expirationTtl: 60 * 60 * 24 * 90 });
        // one mail per hour at most, and never for the owner's own browsing
        if (!signedIn) {
          const hour = new Date().toISOString().slice(0, 13);
          const slot = 'mailv:' + hour;
          if (!(await env.PASSPORT.get(slot))) {
            await env.PASSPORT.put(slot, '1', { expirationTtl: 7200 });
            const country = (request.cf && request.cf.country) || 'unknown';
            const ref = request.headers.get('referer') || 'direct';
            await mail(env, 'Someone opened FabConvert: ' + u.pathname, '<p><b>Page:</b> ' + u.pathname + '</p><p><b>Time (UTC):</b> ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '</p><p><b>Country:</b> ' + country + '</p><p><b>Came from:</b> ' + ref + '</p><p><b>Device:</b> ' + String(request.headers.get('user-agent') || '').slice(0, 90) + '</p><p>This is the first visitor in the last hour. Total views today: ' + (b + 1) + '.</p>');
          }
        }
      })();
      if (context.waitUntil) context.waitUntil(work); else await work;
    }
  } catch (e) {}
  return res;
}