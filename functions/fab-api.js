// FabConvert ledger API, scoped by workspace key: /fab-api?w=KEY
function json(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } }); }
function keyOf(raw) { return String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40); }
async function listAll(env, prefix) {
  let cursor; const out = [];
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
  const w = keyOf(new URL(request.url).searchParams.get('w'));
  if (!w) return json({ ok: false, error: 'Missing workspace key.' }, 400);
  const conv = [];
  for (const k of (await listAll(env, 'w:' + w + ':p:')).slice(-400)) {
    const v = await env.PASSPORT.get(k);
    if (v) { try { conv.push(JSON.parse(v)); } catch (e) {} }
  }
  const spend = [];
  for (const k of (await listAll(env, 'w:' + w + ':s:')).slice(-200)) {
    const v = await env.PASSPORT.get(k);
    if (v) { try { spend.push(JSON.parse(v)); } catch (e) {} }
  }
  const revenue = conv.reduce((a, c) => a + (Number(c.payout) || 0), 0);
  const cost = spend.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  return json({
    ok: true,
    summary: {
      conversions: conv.length,
      revenue: Math.round(revenue * 100) / 100,
      spend: Math.round(cost * 100) / 100,
      profit: Math.round((revenue - cost) * 100) / 100,
      roi: cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : null,
      epc: conv.length > 0 ? Math.round((revenue / conv.length) * 100) / 100 : 0
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
  const w = keyOf(b.w);
  if (!w) return json({ ok: false, error: 'Missing workspace key.' }, 400);
  if (b.action === 'clear') {
    const keys = [...(await listAll(env, 'w:' + w + ':p:')), ...(await listAll(env, 'w:' + w + ':s:'))];
    for (const k of keys) await env.PASSPORT.delete(k);
    return json({ ok: true, removed: keys.length });
  }
  const amount = Number(b.amount || 0);
  if (!isFinite(amount) || amount <= 0) return json({ ok: false, error: 'Enter a spend amount above zero.' }, 400);
  const ts = Date.now();
  const rec = { amount: Math.round(amount * 100) / 100, label: String(b.label || '').slice(0, 120), ts };
  await env.PASSPORT.put('w:' + w + ':s:' + ts, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 365 });
  return json({ ok: true, saved: rec });
}
