// VOXA newsletter signup: add the subscriber to Kit and send the welcome email.
export async function onRequestPost(context) {
  const { request, env } = context;
  let email = '';
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      email = (await request.json()).email || '';
    } else {
      const form = await request.formData();
      email = form.get('email') || '';
    }
  } catch (e) { /* fall through */ }
  email = String(email).trim().toLowerCase();
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email);
  if (!valid) return json({ ok: false, error: 'Enter a valid email address.' }, 400);

  let addedToKit = false;
  try {
    if (env.KIT_API_KEY) {
      const r = await fetch('https://api.convertkit.com/v3/forms/10026465/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: env.KIT_API_KEY, email })
      });
      addedToKit = r.ok;
    }
  } catch (e) { /* keep going: the welcome email matters more */ }

  let sentWelcome = false;
  try {
    if (env.RESEND_API_KEY) {
      const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0b0c0e;color:#f4f4f1;padding:28px;border-radius:14px;max-width:620px">
<h2 style="margin:0 0 12px;font-size:22px">You are in. This is AI, Actually.</h2>
<p style="color:#c9cac6;line-height:1.6;margin:0 0 14px">Three times a week (Monday, Wednesday, Friday) I send one short brief: what actually changed in AI, what it costs a small business, and the catch. Five minutes, no hype.</p>
<p style="color:#c9cac6;line-height:1.6;margin:0 0 18px">Start with the two pieces people asked for most:</p>
<ul style="color:#c9cac6;line-height:1.7;padding-left:18px;margin:0 0 18px">
  <li><a href="https://voxahq.in/guides/ai-phone-answering-cost" style="color:#c8f751">AI phone answering: the real cost</a> - nine services priced by hand</li>
  <li><a href="https://voxahq.in/guides/ai-for-small-business-2027" style="color:#c8f751">What AI will actually do by 2027</a> - every claim labelled</li>
</ul>
<p style="color:#8d8f8c;font-size:13px;margin:0">Reply to this email any time. A person reads it.<br>VOXA - voxahq.in</p>
</div>`;
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.RESEND_API_KEY },
        body: JSON.stringify({
          from: env.MAIL_FROM || 'AI, Actually <onboarding@resend.dev>',
          to: [email],
          reply_to: 'voxa.hq1@gmail.com',
          subject: 'You are in. This is AI, Actually.',
          html
        })
      });
      sentWelcome = r.ok;
    }
  } catch (e) { /* report below */ }

  return json({ ok: true, kit: addedToKit, welcome: sentWelcome }, 200);
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
export async function onRequestGet() {
  return json({ ok: false, error: 'POST an email address.' }, 405);
}
