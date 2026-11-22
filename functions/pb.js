// FabConvert postback: /pb?w=<ws>&cid=&payout=&offer=&txid=&status=
// One record per transaction, so a duplicate fire updates instead of double counting.
function secret(env) { return env.FABCONVERT_SECRET || env.RESEND_API_KEY || ''; }
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function json(o, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage is not configured.' }, 500);
  const u = new URL(request.url);
  const w = (u.searchParams.get('w') || u.searchParams.get('ws') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (!w) return json({ ok: false, error: 'Missing workspace key (w).' }, 400);
  const tok = (u.searchParams.get('t') || u.searchParams.get('token') || '').slice(0, 40);
  const wantTok = (await hmac(secret(env), 'pb:' + w)).slice(0, 16);
  if (tok !== wantTok) return json({ ok: false, error: 'Bad or missing token (t). Copy the postback URL from the ledger page.' }, 403);
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
  const lcMatch = cid.match(/^(.*)-v(\d+)$/);
  if (lcMatch) {
    try {
      const lk = 'lconv:' + lcMatch[1] + ':' + lcMatch[2];
      const nL = Number((await env.PASSPORT.get(lk)) || 0);
      await env.PASSPORT.put(lk, String(nL + 1), { expirationTtl: 60 * 60 * 24 * 180 });
      const d3 = new Date().toISOString().slice(0, 10);
      const dks = 'day:s:' + lcMatch[1] + ':' + d3;
      await env.PASSPORT.put(dks, String(Number((await env.PASSPORT.get(dks)) || 0) + 1), { expirationTtl: 60 * 60 * 24 * 120 });
    } catch (e) {}
  }
  const ts = Date.now();
  const rec = { cid, payout, offer, status, txid: txid || null, ts, updated: ts };
  await env.PASSPORT.put('w:' + w + ':p:' + key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 180 });
  try {
    const owner = await env.PASSPORT.get('wowner:' + w);
    const worth = status === 'refund' || payout >= 100;
    if (owner && worth && env.RESEND_API_KEY) {
      const subject = status === 'refund' ? ('Refund recorded: ' + payout) : ('Sale recorded: ' + payout);
      const body = '<div style="font-family:system-ui,sans-serif;max-width:520px"><h2 style="margin:0 0 6px;font-size:18px">' + subject + '</h2><p style="color:#555">Offer: ' + (offer || 'not named') + ' | click id: ' + cid + '</p><p style="color:#555">' + (status === 'refund' ? 'It has been subtracted from revenue in your ledger.' : 'It has been added to your ledger.') + '</p><p style="margin-top:16px"><a href="https://voxahq.in/fabconvert/profit/">Open the ledger</a></p></div>';
      await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.RESEND_API_KEY }, body: JSON.stringify({ from: 'FabConvert <alerts@voxahq.in>',
      reply_to: 'voxa.hq1@gmail.com', to: [owner], subject, html: body }) });
    }
  } catch (e) {}
  return json({ ok: true, saved: rec, dedupe: txid ? 'by transaction id' : 'by click id and payout' });
}
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
}
