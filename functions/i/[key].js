// Serve an uploaded lander image: /i/<key>
export async function onRequestGet(context) {
  const { env, params } = context;
  if (!env.PASSPORT) return new Response('Not configured', { status: 500 });
  const raw = await env.PASSPORT.get('img:' + params.key, { type: 'arrayBuffer' });
  if (!raw) return new Response('Not found', { status: 404 });
  return new Response(raw, { status: 200, headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
}
