import nodemailer from 'nodemailer';

// ── Appwrite Function entry point ────────────────────────────────────────────
export default async ({ req, res, log, error }) => {
  // ── Parse body ─────────────────────────────────────────────────────────────
  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const {
    toEmail,
    toName,
    subject,
    originalMessage,
    originalDate,
    replyMessage,
  } = payload;

  if (!toEmail || !replyMessage) {
    return res.json({ success: false, error: 'toEmail and replyMessage are required' }, 400);
  }

  // ── SMTP config from function env vars (accept common naming variants) ────
  const smtpHost = process.env.SMTP_HOST || process.env.SMTPHOST || process.env.smtp_host;
  const smtpPort = parseInt(process.env.SMTP_PORT || process.env.SMTPPORT || '587', 10);
  const smtpUser = process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.SMTPUSER || process.env.smtp_user;
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.SMTPPASS || process.env.smtp_pass;
  const fromEmail = process.env.FROM_EMAIL || smtpUser;
  const fromName  = process.env.FROM_NAME  || 'Next Star Soccer';

  // Debug: log which vars were found (values hidden)
  log(`SMTP config — host: ${smtpHost || 'MISSING'}, port: ${smtpPort}, user: ${smtpUser ? '✓' : 'MISSING'}, pass: ${smtpPass ? '✓' : 'MISSING'}`);
  log(`All env keys: ${Object.keys(process.env).filter(k => !k.startsWith('APPWRITE')).join(', ')}`);

  if (!smtpHost || !smtpUser || !smtpPass) {
    error('Missing SMTP environment variables');
    return res.json({ success: false, error: `Email service not configured — found keys: ${Object.keys(process.env).join(', ')}` }, 500);
  }

  // ── Build HTML email ──────────────────────────────────────────────────────
  const firstName = toName?.split(' ')[0] || toName || 'there';
  const emailSubject = subject ? `Re: ${subject}` : 'Response from Next Star Soccer';
  const formattedDate = originalDate
    ? new Date(originalDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${emailSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:580px;background-color:#111111;border-radius:16px;border:1px solid #222222;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color:#000000;padding:28px 32px;border-bottom:1px solid #1e1e1e;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ⚽ Next Star Soccer
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              <p style="margin:0 0 20px 0;color:#d1d5db;font-size:15px;line-height:1.5;">
                Hi ${firstName},
              </p>

              <!-- Reply message -->
              <div style="background-color:#0d0d0d;border:1px solid #222222;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
                <p style="margin:0;color:#e5e7eb;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(replyMessage)}</p>
              </div>

              <!-- Divider + original message -->
              ${originalMessage ? `
              <p style="margin:0 0 12px 0;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">
                Your original message
                ${formattedDate ? `<span style="font-weight:400;text-transform:none;letter-spacing:0;"> · ${formattedDate}</span>` : ''}
              </p>
              <div style="border-left:3px solid #2a2a2a;padding:12px 16px;margin-bottom:28px;">
                ${subject ? `<p style="margin:0 0 8px 0;color:#9ca3af;font-size:13px;font-weight:600;">${escapeHtml(subject)}</p>` : ''}
                <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(originalMessage)}</p>
              </div>
              ` : ''}

              <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.6;">
                If you have any further questions, feel free to reach out or
                <a href="https://nextstarsoccer.com/contact" style="color:#3b82f6;text-decoration:none;">visit our contact page</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0a0a0a;padding:20px 32px;border-top:1px solid #1e1e1e;text-align:center;">
              <p style="margin:0;color:#4b5563;font-size:12px;">
                © ${new Date().getFullYear()} Next Star Soccer · This is a reply to your website inquiry
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // ── Send ──────────────────────────────────────────────────────────────────
  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: `"${toName || ''}" <${toEmail}>`,
      subject: emailSubject,
      html,
      text: `Hi ${firstName},\n\n${replyMessage}${originalMessage ? `\n\n────────────────────\nYour original message:\n${originalMessage}` : ''}`,
    });

    log(`Reply sent to ${toEmail} re: "${subject}"`);
    return res.json({ success: true });
  } catch (err) {
    error('sendMail failed: ' + err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};

// ── Helper ────────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
