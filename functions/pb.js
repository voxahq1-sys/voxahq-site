// FabConvert postback: /pb?w=<workspace>&cid=...&payout=...&offer=...
function json(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } }); }
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage is not configured.' }, 500);
  const u = new URL(request.url);
  const w = (u.searchParams.get('w') || u.searchParams.get('ws') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (!w) return json({ ok: false, error: 'Missing workspace key (w).' }, 400);
  const cid = (u.searchParams.get('cid') || u.searchParams.get('clickid') || u.searchParams.get('sub1') || '').trim().slice(0, 64);
  if (!cid) return json({ ok: false, error: 'Missing cid (click id).' }, 400);
  const payout = Number(u.searchParams.get('payout') || u.searchParams.get('amount') || 0);
  const offer = (u.searchParams.get('offer') || '').slice(0, 80);
  const status = (u.searchParams.get('status') || 'sale').slice(0, 20);
  const ts = Date.now();
  const rec = { cid, payout: isFinite(payout) ? payout : 0, offer, status, ts };
  await env.PASSPORT.put('w:' + w + ':p:' + ts + ':' + cid, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 180 });
  return json({ ok: true, saved: rec });
}
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
}
