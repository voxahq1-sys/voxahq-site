// FabConvert ledger API: read conversions, add spend, compute net profit.
function json(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } }); }
async function listAll(env, prefix) {
  let cursor;
  const out = [];
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
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage is not configured yet.' }, 500);
  const keys = await listAll(env, 'p:');
  const conv = [];
  for (const k of keys.slice(-400)) {
    const v = await env.PASSPORT.get(k);
    if (v) { try { conv.push(JSON.parse(v)); } catch (e) {} }
  }
  const spendKeys = await listAll(env, 's:');
  const spend = [];
  for (const k of spendKeys.slice(-200)) {
    const v = await env.PASSPORT.get(k);
    if (v) { try { spend.push(JSON.parse(v)); } catch (e) {} }
  }
  const revenue = conv.reduce((a, c) => a + (Number(c.payout) || 0), 0);
  const cost = spend.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  const clicks = conv.length;
  return json({
    ok: true,
    summary: {
      conversions: clicks,
      revenue: Math.round(revenue * 100) / 100,
      spend: Math.round(cost * 100) / 100,
      profit: Math.round((revenue - cost) * 100) / 100,
      roi: cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : null,
      epc: clicks > 0 ? Math.round((revenue / clicks) * 100) / 100 : 0
    },
    conversions: conv.sort((a, b) => b.ts - a.ts).slice(0, 100),
    spend: spend.sort((a, b) => b.ts - a.ts).slice(0, 50)
  });
}
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage is not configured yet.' }, 500);
  let b = {};
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'Send JSON.' }, 400); }
  const amount = Number(b.amount || 0);
  if (!isFinite(amount) || amount <= 0) return json({ ok: false, error: 'Enter a spend amount above zero.' }, 400);
  const ts = Date.now();
  const rec = { amount: Math.round(amount * 100) / 100, label: String(b.label || '').slice(0, 120), ts };
  await env.PASSPORT.put('s:' + ts, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 365 });
  return json({ ok: true, saved: rec });
}
