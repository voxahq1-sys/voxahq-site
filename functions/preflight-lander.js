// Preflight landing page check: fetch a page and report status, tracking and risky claims.
const BAD = [/\bcures?\b/i, /\btreats?\b/i, /\bguarantee[ds]?\b/i, /\bfda approved\b/i, /\bclinically proven\b/i, /\blose \d+ (lbs?|pounds?|kg)\b/i, /\bno side effects\b/i];
function json(b, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }); }
function privateHost(h) {
  return /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]|::1)/i.test(h);
}
export async function onRequestGet(context) {
  const { request, env } = context;
  const u = new URL(request.url);
  const target = u.searchParams.get('url') || '';
  const adCopy = u.searchParams.get('q') || '';
  let parsed;
  try { parsed = new URL(target); } catch (e) { return json({ ok: false, error: 'That is not a valid URL.' }); }
  if (!/^https?:$/.test(parsed.protocol)) return json({ ok: false, error: 'Only http and https are allowed.' });
  if (privateHost(parsed.hostname)) return json({ ok: false, error: 'That host is not allowed.' });

  const trackingKeys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','ttclid','msclkid','clickid','click_id','sub1','sub2','sub_id','aff_id','affid'];
  const params = Array.from(parsed.searchParams.keys());
  const found = params.filter(k => trackingKeys.some(t => k.toLowerCase().indexOf(t) === 0));

  let res, html = '';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    res = await fetch(parsed.toString(), { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; PreflightCheck/1.0)', accept: 'text/html' } });
    clearTimeout(timer);
    const buf = await res.arrayBuffer();
    html = new TextDecoder().decode(buf.slice(0, 400000));
  } catch (e) {
    return json({ ok: false, error: 'The page did not load in time.' });
  }

  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').length : 0;
  const flags = [];
  BAD.forEach(function (re) { if (re.test(text)) { const m = text.match(re); if (m && flags.indexOf(m[0].toLowerCase()) === -1) flags.push(m[0].toLowerCase()); } });

  let overlapping = 0, adWords = 0, mismatch = false;
  if (adCopy) {
    const stop = /^(this|that|with|your|from|they|have|will|what|when|more|than|into|just|only|over|after|before|about|there|their|them)$/;
    const seen = {};
    const aw = adCopy.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function (w) { return w.length > 4 && !stop.test(w) && !seen[w] && (seen[w] = 1); });
    adWords = aw.length;
    const pageLower = text.toLowerCase();
    aw.forEach(function (w) { if (pageLower.indexOf(w) > -1) overlapping++; });
    mismatch = adWords >= 5 && overlapping / adWords < 0.25;
  }

  return json({ ok: true, status: res.status, host: parsed.hostname, words: words, tracking: found.join(', '), flags: flags, overlap: adWords ? Math.round((overlapping / adWords) * 100) : null, mismatch: mismatch });
}
