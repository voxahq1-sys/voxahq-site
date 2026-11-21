// VOXA newsletter signup: MailerLite (primary), Kit fallback, welcome email via Resend.
export async function onRequestPost(context) {
  const { request, env } = context;
  let email = '';
  let src = '';
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await request.json();
      email = body.email || '';
      src = body.src || '';
    } else {
      const form = await request.formData();
      email = form.get('email') || '';
      src = form.get('src') || '';
    }
  } catch (e) { /* fall through */ }
  email = String(email).trim().toLowerCase();
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email);
  if (!valid) return json({ ok: false, error: 'Enter a valid email address.' }, 400);

  let addedToMailerLite = false;
  try {
    if (env.MAILERLITE_TOKEN) {
      const group = env.MAILERLITE_GROUP || '204730746890356247';
      const r = await fetch('https://connect.mailerlite.com/api/subscribers', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.MAILERLITE_TOKEN },
        body: JSON.stringify({ email, groups: [group], status: 'active' })
      });
      addedToMailerLite = r.ok || r.status === 409;
    }
  } catch (e) { /* keep going */ }

  let addedToKit = false;
  try {
    if (!addedToMailerLite && env.KIT_API_KEY) {
      const r = await fetch('https://api.convertkit.com/v3/forms/10026465/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: env.KIT_API_KEY, email })
      });
      addedToKit = r.ok;
    }
  } catch (e) { /* keep going */ }

  let sentWelcome = false;
  try {
    if (env.RESEND_API_KEY) {
      const html = '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0b0c0e;color:#f4f4f1;padding:28px;border-radius:14px;max-width:620px">'
        + '<h2 style="margin:0 0 12px;font-size:22px">You are in. This is AI, Actually.</h2>'
        + '<p style="color:#c9cac6;line-height:1.6;margin:0 0 14px">One quick brief: what actually changed in AI, what it costs a small business, and the catch.</p>'
        + '<p style="color:#c9cac6;line-height:1.6;margin:0 0 14px">Because you subscribed, here is your one-time code for <strong>12% off any VOXA service</strong>: <strong>NEWS12</strong>. Mention it when you reply.</p>'
        + '<p style="color:#c9cac6;line-height:1.6;margin:0 0 18px">Start with the newest pieces:</p>'
        + '<ul style="color:#c9cac6;line-height:1.7;padding-left:18px;margin:0 0 18px">'
        + '<li><a href="https://voxahq.in/blog/ai-voice-agent-cost-per-call/" style="color:#c8f751">What an AI phone agent costs per call</a></li>'
        + '<li><a href="https://voxahq.in/blog/small-business-cash-reserve/" style="color:#c8f751">How much cash a small business should keep</a></li>'
        + '</ul>'
        + '<p style="color:#8d8f8c;font-size:13px;margin:0">Reply to this email any time. A person reads it.<br>VOXA - voxahq.in</p></div>';
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.RESEND_API_KEY },
        body: JSON.stringify({
          from: env.MAIL_FROM || 'AI Actually <hello@voxahq.in>',
          to: [email],
          reply_to: 'voxa.hq1@gmail.com',
          subject: 'You are in. This is AI, Actually.',
          html
        })
      });
      sentWelcome = r.ok;
    }
  } catch (e) { /* report below */ }

  return json({ ok: true, mailerlite: addedToMailerLite, kit: addedToKit, welcome: sentWelcome, src }, 200);
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
export async function onRequestGet() {
  return json({ ok: false, error: 'POST an email address.' }, 405);
}
