import nodemailer from "nodemailer";
import { Client, Databases, Users } from "node-appwrite";

/**
 * Emails a reply to a website inquiry (or, from a server script, an outbound
 * notice). Signed-in callers must be admins. With `inquiryId`, the reply is
 * also saved on the inquiry (replies: JSON list of { id, message, sentAt,
 * byUserId, byName }) and the inquiry is marked read and resolved, so the
 * website and app dashboards show what was sent.
 */

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "6842f11e0030e4b668a8";
const INQUIRIES = process.env.APPWRITE_WEBSITE_INQUIRIES_COLLECTION_ID || "website_inquiries";
const COACHES = "6896c95e0004dce4140c";

export default async ({ req, res, log, error }) => {
  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const { toEmail, toName, subject, subjectOverride, greetingSuffix, originalMessage, originalDate, replyMessage, inquiryId } = body;

    if (!toEmail || !replyMessage) {
      return res.json({ success: false, error: "toEmail and replyMessage are required" }, 400);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || "68577380002195dec512")
      .setKey(req.headers["x-appwrite-key"] || "");
    const db = new Databases(client);

    // Signed in: admins only (this sends email as support@). No user: a
    // server-side call made with an API key.
    const callerId = req.headers["x-appwrite-user-id"] || "";
    let senderName = "Next Star Soccer";
    if (callerId) {
      const caller = await new Users(client).get(callerId);
      if (!(caller.labels || []).includes("admin")) {
        return res.json({ success: false, error: "Only admins can send replies" }, 403);
      }
      const coach = await db.getDocument(DATABASE_ID, COACHES, callerId).catch(() => null);
      senderName = (coach ? `${coach.firstName || ""} ${coach.lastName || ""}`.trim() : "") || caller.name || caller.email || senderName;
    }

    log(`Sending reply to: ${toEmail} re: "${subject}"`);

    const firstName = toName?.split(" ")[0] || toName || "there";
    // Punctuation after the greeting. Defaults to "," so inquiry replies are
    // unchanged; campaigns can pass "!" for a warmer tone.
    const greeting = greetingSuffix || ",";
    // subjectOverride sets the subject verbatim (no "Re:" prefix) for outbound
    // notices that are not replies to an inquiry.
    const emailSubject = subjectOverride
      ? subjectOverride
      : subject
        ? `Re: ${subject}`
        : "Response from Next Star Soccer";
    const formattedDate = originalDate
      ? new Date(originalDate).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit", hour12: true,
          timeZone: "America/New_York",
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
            <td style="background-color:#000000;padding:32px 30px;text-align:center;">
              ${process.env.EMAIL_LOGO_URL ? `<img src="${process.env.EMAIL_LOGO_URL}" alt="Next Star Soccer" style="width:250px;display:block;margin:0 auto;" />` : ""}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;">
              <p style="color:#333333;font-size:16px;line-height:1.7;margin:0 0 8px 0;">Hi <strong>${firstName}</strong>${greeting}</p>
              <p style="color:#333333;font-size:16px;line-height:1.7;margin:0 0 24px 0;white-space:pre-wrap;">${escapeHtml(replyMessage)}</p>

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
                Want to continue the conversation? Download the <strong>Next Star Soccer</strong> app to message us directly and get faster responses.
              </p>
              <div style="margin-top:20px;text-align:center;">
                <a href="https://apps.apple.com/us/app/next-star-soccer/id6754170423" style="display:inline-block;margin-right:10px;">
                  <img src="${process.env.APPLE_STORE_LOGO_URL || 'https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg'}" alt="Download on the App Store" style="height:36px;width:auto;" />
                </a>
                <a href="https://play.google.com/store/apps/details?id=com.nextstarsoccer.nextstar" style="display:inline-block;">
                  <img src="${process.env.GOOGLE_STORE_LOGO_URL || 'https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg'}" alt="Get it on Google Play" style="height:36px;width:auto;" />
                </a>
              </div>
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

    // Keep a copy on the inquiry. The email has gone either way.
    let reply = null;
    if (inquiryId) {
      try {
        const doc = await db.getDocument(DATABASE_ID, INQUIRIES, String(inquiryId));
        let replies = [];
        try {
          replies = JSON.parse(doc.replies || "[]");
          if (!Array.isArray(replies)) replies = [];
        } catch {
          replies = [];
        }
        const now = new Date().toISOString();
        reply = {
          id: Math.random().toString(36).slice(2, 10),
          message: String(replyMessage),
          sentAt: now,
          byUserId: callerId || null,
          byName: senderName,
        };
        replies.push(reply);
        await db.updateDocument(DATABASE_ID, INQUIRIES, doc.$id, {
          replies: JSON.stringify(replies),
          read: true,
          resolved: true,
          resolvedAt: now,
        });
      } catch (e) {
        error(`Reply sent but not saved on inquiry ${inquiryId}: ${e.message}`);
      }
    }

    return res.json({ success: true, reply });

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
