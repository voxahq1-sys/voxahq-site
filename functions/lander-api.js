// FabConvert lander API: create, read, update, delete, and compliance precheck.
function json(o, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
function secret(env) { return env.FABCONVERT_SECRET || env.RESEND_API_KEY || ''; }
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
async function wsFor(env, email) { return (await hmac(secret(env), 'ws:' + email)).slice(0, 18); }
async function session(request, env) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(/(?:^|; )fc_session=([^;]+)/);
  if (!m) return null;
  const raw = m[1];
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const email = decodeURIComponent(raw.slice(0, i)), sig = raw.slice(i + 1);
  const want = await hmac(secret(env), 's:' + email);
  return sig === want ? email : null;
}
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage not configured.' }, 500);
  const email = await session(request, env);
  if (!email) return json({ ok: false, signedIn: false }, 401);
  const ws = await wsFor(env, email);
  const list = [];
  let cursor;
  for (let i = 0; i < 5; i++) {
    const res = await env.PASSPORT.list({ prefix: 'lander:' + ws + ':', cursor, limit: 200 });
    for (const k of res.keys) {
      const v = await env.PASSPORT.get(k.name);
      if (v) { try {
        const d = JSON.parse(v);
        const pub = d.pub || (ws + '-' + d.slug);
        let clicks = 0, convs = 0;
        for (let vi2 = 0; vi2 < d.variants.length; vi2++) { convs += Number((await env.PASSPORT.get('lconv:' + pub + ':' + vi2)) || 0); }
        for (let vi = 0; vi < d.variants.length; vi++) {
          clicks += Number((await env.PASSPORT.get('clicks:' + pub + ':' + vi)) || 0);
        }
        list.push({ slug: d.slug, pubSlug: pub, name: d.name, template: d.template, variants: d.variants.length, clicks, convs, updated: d.updated });
      } catch (e) {} }
    }
    if (res.list_complete) break;
    cursor = res.cursor;
  }
  return json({ ok: true, landers: list.sort((a, b) => (b.updated || 0) - (a.updated || 0)) });
}
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.PASSPORT) return json({ ok: false, error: 'Storage not configured.' }, 500);
  const email = await session(request, env);
  if (!email) return json({ ok: false, signedIn: false }, 401);
  const ws = await wsFor(env, email);
  let b = {};
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'Send JSON.' }, 400); }
  if (b.action === 'upload') {
    const data = String(b.data || '');
    const m = data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return json({ ok: false, error: 'Send a jpeg, png or webp image.' }, 400);
    const bytes = Math.floor(m[2].length * 0.75);
    if (bytes > 900000) return json({ ok: false, error: 'Image is too large after resizing. Try a smaller one.' }, 400);
    const key = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
    await env.PASSPORT.put('img:' + key, bin.buffer, { expirationTtl: 60 * 60 * 24 * 365 });
    return json({ ok: true, url: '/i/' + key });
  }
  if (b.action === 'delete') {
    const slug = slugify(b.slug);
    const rawDoc = await env.PASSPORT.get('lander:' + ws + ':' + slug);
    if (rawDoc) { try { const dd = JSON.parse(rawDoc); if (dd.pub) await env.PASSPORT.delete('pub:' + dd.pub); } catch (e) {} }
    await env.PASSPORT.delete('lander:' + ws + ':' + slug);
    await env.PASSPORT.delete('pub:' + ws + '-' + slug);
    return json({ ok: true, deleted: slug });
  }
  // save
  const name = String(b.name || '').slice(0, 80) || 'Untitled lander';
  let slug = slugify(b.slug || name) || ('lander-' + Date.now().toString(36));
  const variants = (Array.isArray(b.variants) ? b.variants : []).slice(0, 3).map(function (v, i) {
    return {
      headline: String(v.headline || '').slice(0, 160),
      sub: String(v.sub || '').slice(0, 400),
      bullets: (Array.isArray(v.bullets) ? v.bullets : []).slice(0, 6).map(function (x) { return String(x).slice(0, 200); }),
      cta: String(v.cta || 'See the offer').slice(0, 40),
      weight: Math.max(1, Math.min(100, Number(v.weight) || 50))
    };
  });
  if (!variants.length) return json({ ok: false, error: 'Add at least one variant.' }, 400);
  const existing = await env.PASSPORT.get('lander:' + ws + ':' + slug).catch(() => null);
  let prevPub = null;
  try { if (existing) prevPub = JSON.parse(existing).pub || null; } catch (e) {}
  const pub = prevPub || (Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8));
  const doc = {
    owner: email,
    pub,
    ws,
    slug,
    name,
    template: String(b.template || 'advertorial').slice(0, 20),
    brand: String(b.brand || '').slice(0, 60),
    accent: /^#[0-9a-fA-F]{6}$/.test(b.accent || '') ? b.accent : '#0E7C66',
    offer: String(b.offer || '').slice(0, 600),
    hero: String(b.hero || '').slice(0, 400),
    pixel: String(b.pixel || '').slice(0, 4000),
    cidParam: String(b.cidParam || 'sub1').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24),
    variants,
    updated: Date.now(),
    created: Date.now()
  };
  await env.PASSPORT.put('lander:' + ws + ':' + slug, JSON.stringify(doc));
  await env.PASSPORT.put('pub:' + pub, JSON.stringify(doc));
  if (prevPub && prevPub !== pub) await env.PASSPORT.delete('pub:' + prevPub);
  return json({ ok: true, slug, pub, url: 'https://l.voxahq.in/l/' + pub });
}
