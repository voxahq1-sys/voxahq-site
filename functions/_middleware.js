// Counts document views on the FabConvert pages only. No cookies, no IP, no per person record.
export async function onRequest(context) {
  const { request, env, next } = context;
  const res = await next();
  try {
    const u = new URL(request.url);
    const dest = request.headers.get('sec-fetch-dest') || '';
    if (env.PASSPORT && res.status === 200 && dest === 'document' && u.pathname.indexOf('/fabconvert') === 0) {
      const work = (async () => {
        const day = new Date().toISOString().slice(0, 10);
        const pathKey = 'pv:' + day + ':' + (u.pathname.replace(/[^a-z0-9]/gi, '_') || '_root');
        const a = Number((await env.PASSPORT.get(pathKey)) || 0);
        await env.PASSPORT.put(pathKey, String(a + 1), { expirationTtl: 60 * 60 * 24 * 90 });
        const tKey = 'pvt:' + day;
        const b = Number((await env.PASSPORT.get(tKey)) || 0);
        await env.PASSPORT.put(tKey, String(b + 1), { expirationTtl: 60 * 60 * 24 * 90 });
      })();
      if (context.waitUntil) context.waitUntil(work); else await work;
    }
  } catch (e) {}
  return res;
}