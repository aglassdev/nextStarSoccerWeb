import nodemailer from "nodemailer";

export default async ({ req, res, log, error }) => {
  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const { toEmail, toName, subject, originalMessage, originalDate, replyMessage } = body;

    if (!toEmail || !replyMessage) {
      return res.json({ success: false, error: "toEmail and replyMessage are required" }, 400);
    }

    log(`Sending reply to: ${toEmail} re: "${subject}"`);

    const firstName = toName?.split(" ")[0] || toName || "there";
    const emailSubject = subject ? `Re: ${subject}` : "Response from Next Star Soccer";
    const formattedDate = originalDate
      ? new Date(originalDate).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit", hour12: true,
        })
      : null;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${emailSubject}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background-color:#f4f4f4;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#000000 0%,#1a1a1a 100%);padding:40px 30px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:bold;">⚽ Next Star Soccer</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;">
              <p style="color:#333333;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
                Hi <strong>${firstName}</strong>,
              </p>

              <!-- Reply message -->
              <div style="background-color:#f8f9fa;border-left:4px solid #000000;padding:20px 24px;margin-bottom:28px;border-radius:0 8px 8px 0;">
                <p style="margin:0;color:#222222;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(replyMessage)}</p>
              </div>

              ${originalMessage ? `
              <!-- Original message -->
              <p style="color:#999999;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px 0;">
                Your original message${formattedDate ? ` &middot; ${formattedDate}` : ""}
              </p>
              <div style="border-left:3px solid #e0e0e0;padding:12px 16px;margin-bottom:28px;">
                ${subject ? `<p style="margin:0 0 8px 0;color:#999999;font-size:13px;font-weight:600;">${escapeHtml(subject)}</p>` : ""}
                <p style="margin:0;color:#aaaaaa;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(originalMessage)}</p>
              </div>
              ` : ""}

              <p style="color:#666666;font-size:14px;line-height:1.6;margin:0;">
                If you have any further questions, feel free to
                <a href="https://nextstarsoccer.com/contact" style="color:#000000;text-decoration:underline;">contact us</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fa;padding:30px;text-align:center;border-top:1px solid #e0e0e0;">
              <p style="color:#333333;font-size:15px;margin:0 0 16px 0;">
                Best regards,<br/><strong>Next Star Soccer Support Team</strong>
              </p>
              <p style="color:#999999;font-size:12px;margin:0;">
                This is a reply to your website inquiry. Please do not reply to this email directly.
              </p>
              <p style="color:#999999;font-size:12px;margin:8px 0 0 0;">
                &copy; ${new Date().getFullYear()} Next Star Soccer. All rights reserved.
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

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "email-smtp.us-east-1.amazonaws.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: {
        name: process.env.FROM_NAME || "Next Star Support",
        address: process.env.SMTP_FROM_EMAIL || "support@nextstarsoccer.com",
      },
      to: toName ? `"${toName}" <${toEmail}>` : toEmail,
      subject: emailSubject,
      html,
      text: `Hi ${firstName},\n\n${replyMessage}${originalMessage ? `\n\n────────────────────\nYour original message:\n${originalMessage}` : ""}`,
    });

    log(`Reply sent successfully to ${toEmail}`);
    return res.json({ success: true });

  } catch (err) {
    error(`sendMail failed: ${err.message}`);
    return res.json({ success: false, error: err.message || "Failed to send reply" }, 500);
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
