// FabConvert postback: /pb?w=<ws>&cid=&payout=&offer=&txid=&status=
// One record per transaction, so a duplicate fire updates instead of double counting.
function json(o, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage is not configured.' }, 500);
  const u = new URL(request.url);
  const w = (u.searchParams.get('w') || u.searchParams.get('ws') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (!w) return json({ ok: false, error: 'Missing workspace key (w).' }, 400);
  const cid = (u.searchParams.get('cid') || u.searchParams.get('clickid') || u.searchParams.get('sub1') || '').trim().slice(0, 64);
  if (!cid) return json({ ok: false, error: 'Missing cid (click id).' }, 400);
  const payoutRaw = u.searchParams.get('payout') || u.searchParams.get('amount') || '0';
  const payout = Math.round(Number(payoutRaw) * 100) / 100;
  if (!isFinite(payout)) return json({ ok: false, error: 'Payout must be a number.' }, 400);
  const offer = (u.searchParams.get('offer') || '').slice(0, 80);
  const rawStatus = (u.searchParams.get('status') || 'sale').toLowerCase();
  const status = /refund|chargeback|reversal|cancel/.test(rawStatus) ? 'refund' : (rawStatus === 'lead' ? 'lead' : 'sale');
  const txid = (u.searchParams.get('txid') || u.searchParams.get('tx') || u.searchParams.get('transaction_id') || u.searchParams.get('orderid') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  const key = txid ? ('t:' + txid) : ('h:' + cid + '-' + payout);
  const ts = Date.now();
  const rec = { cid, payout, offer, status, txid: txid || null, ts, updated: ts };
  await env.PASSPORT.put('w:' + w + ':p:' + key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 180 });
  return json({ ok: true, saved: rec, dedupe: txid ? 'by transaction id' : 'by click id and payout' });
}
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
}
