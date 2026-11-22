// Lander click counter, then redirect to the offer.
export async function onRequestGet(context) {
  const { request, env } = context;
  const u = new URL(request.url);
  const key = u.searchParams.get('k') || '';
  const v = String(parseInt(u.searchParams.get('v') || '0', 10));
  const to = u.searchParams.get('to') || '';
  const pname = (u.searchParams.get('p') || 'sub1').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24);
  if (env.PASSPORT && key) {
    const ck = 'clicks:' + key + ':' + v;
    try {
      const n = Number((await env.PASSPORT.get(ck)) || 0);
      await env.PASSPORT.put(ck, String(n + 1), { expirationTtl: 60 * 60 * 24 * 180 });
      const d2 = new Date().toISOString().slice(0, 10);
      const dkc = 'day:c:' + key + ':' + d2;
      await env.PASSPORT.put(dkc, String(Number((await env.PASSPORT.get(dkc)) || 0) + 1), { expirationTtl: 60 * 60 * 24 * 120 });
    } catch (e) {}
  }
  let dest = 'https://voxahq.in/fabconvert';
  try { const t = new URL(to); if (/^https?:$/.test(t.protocol)) dest = t.toString(); } catch (e) {}
  // fill placeholders some networks ask for, so braces never reach the offer
  const tag = key + '-v' + v;
  dest = dest.replace(/\{sub1\}|\{clickid\}|\{click_id\}/gi, tag);
  // pass the variant through, so a tracker can read it
  try {
    const t = new URL(dest);
    if (!t.searchParams.has('fcv')) t.searchParams.set('fcv', v);
    if (!t.searchParams.has(pname)) t.searchParams.set(pname, tag);
    dest = t.toString();
  } catch (e) {}
  return new Response(null, { status: 302, headers: { location: dest, 'cache-control': 'no-store' } });
}
