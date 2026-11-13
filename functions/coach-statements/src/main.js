import nodemailer from "nodemailer";
import { hourlyStatement, shareReport, hourlyTotals, shareTotals, monthLabel, money } from "./pdf.js";

/**
 * coach-statements: each coach's statement for a month, as a PDF, emailed to
 * them. Phillip Gyau's is his session share report; everyone else's lists
 * their sessions, pay for each, any deductions (late, no-show) and the total.
 *
 * Admins only (called from Coach Payments → Payouts with their session). The
 * page sends the figures it already shows; this builds the PDFs and emails them.
 *
 * body.route:
 *   "preview" { statement }            → { pdf: base64 } to look at, nothing sent
 *   "send"    { statements: [...] }    → emails each coach (address from the
 *                                        coach roster, by name) and logs it
 *   "test"    { statement }            → emails it to the admin sending it instead
 *
 * A statement: { coach, kind: "hourly" | "share", month: "YYYY-MM", sessions, deductions }
 * Email goes out through the same SES account as the other emails (SMTP_* settings).
 */

const ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const PROJECT = process.env.APPWRITE_FUNCTION_PROJECT_ID || "68577380002195dec512";
const DB = "6842f11e0030e4b668a8";
const COACHES = "6896c95e0004dce4140c";
const LOG = "coach_statements";
const LOGO_URL = process.env.EMAIL_LOGO_URL || "https://www.nextstarsoccer.com/assets/images/NextStarLogo.png";

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

let KEY = "";
const aw = async (method, path, body) => {
  const r = await fetch(`${ENDPOINT}${path}`, {
    method, headers: { "X-Appwrite-Project": PROJECT, "X-Appwrite-Key": KEY, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(json.message || `Appwrite ${r.status}`); e.code = r.status; throw e; }
  return json;
};
const listAll = async (col) => {
  const out = []; let cursor = null;
  for (;;) {
    const qs = [JSON.stringify({ method: "limit", values: [100] }), ...(cursor ? [JSON.stringify({ method: "cursorAfter", values: [cursor] })] : [])]
      .map(x => "queries[]=" + encodeURIComponent(x)).join("&");
    const r = await aw("GET", `/databases/${DB}/collections/${col}/documents?${qs}`);
    out.push(...r.documents);
    if (r.documents.length < 100) return out;
    cursor = r.documents[r.documents.length - 1].$id;
  }
};

const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
const ALIASES = { "karim metwalli": ["coach kareem", "kareem metwalli"] };
const prepared = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const isMonth = (m) => /^\d{4}-\d{2}$/.test(m || "");

const clean = (s) => {
  if (!s || typeof s.coach !== "string" || !isMonth(s.month) || !Array.isArray(s.sessions)) throw new HttpError(400, "Bad statement");
  return { ...s, coach: s.coach.slice(0, 120), deductions: Array.isArray(s.deductions) ? s.deductions : [] };
};
const isShare = (s) => s.kind === "share";
const pdfFor = (s) => (isShare(s) ? shareReport(s, prepared()) : hourlyStatement(s, prepared()));
const totalOf = (s) => (isShare(s) ? shareTotals(s).total : hourlyTotals(s).total);
const fileName = (s) => `${s.coach.replace(/[^A-Za-z0-9]+/g, " ").trim()} - ${monthLabel(s.month)} ${isShare(s) ? "Session Share Report" : "Statement"}.pdf`;

const mailer = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST || "email-smtp.us-east-1.amazonaws.com",
  port: parseInt(process.env.SMTP_PORT || "587"), secure: false,
  auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD },
});

const emailHtml = (first, s, total) => {
  const what = isShare(s) ? "session share report" : "statement";
  const n = s.sessions.length;
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#000;padding:22px 28px"><img src="${LOGO_URL}" alt="Next Star Soccer" height="26" style="display:block;height:26px"></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 14px;font-size:16px">Hi ${first},</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5">Your ${what} for <b>${monthLabel(s.month)}</b> is attached.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5;margin:0 0 18px">
<tr><td style="padding:12px 0;font-size:14px;color:#555">Sessions</td><td align="right" style="padding:12px 0;font-size:14px">${n}</td></tr>
<tr><td style="padding:0 0 12px;font-size:14px;color:#555">${isShare(s) ? "Your share (collected so far)" : "Total earned"}</td><td align="right" style="padding:0 0 12px;font-size:16px;font-weight:700">${money(total)}</td></tr>
</table>
<p style="margin:0;font-size:13px;color:#777;line-height:1.5">Questions about it? Just reply to this email.</p>
<p style="margin:18px 0 0;font-size:14px">Next Star Soccer</p>
</td></tr></table></td></tr></table></body></html>`;
};

async function send(transport, s, to, toName) {
  const pdf = await pdfFor(s);
  const total = totalOf(s);
  const first = (toName || s.coach).split(" ")[0];
  await transport.sendMail({
    from: { name: process.env.FROM_NAME || "Next Star Soccer", address: process.env.SMTP_FROM_EMAIL || "support@nextstarsoccer.com" },
    to: toName ? `"${toName}" <${to}>` : to,
    subject: `Your ${isShare(s) ? "session share report" : "Next Star Soccer statement"} · ${monthLabel(s.month)}`,
    html: emailHtml(first, s, total),
    text: `Hi ${first},\n\nYour ${isShare(s) ? "session share report" : "statement"} for ${monthLabel(s.month)} is attached: ${s.sessions.length} sessions, ${money(total)}.\n\nQuestions? Just reply to this email.\n\nNext Star Soccer`,
    attachments: [{ filename: fileName(s), content: pdf, contentType: "application/pdf" }],
  });
  return total;
}

export default async ({ req, res, log, error }) => {
  KEY = req.headers["x-appwrite-key"] || "";
  try {
    const callerId = req.headers["x-appwrite-user-id"];
    if (!callerId) throw new HttpError(401, "Sign in first");
    const caller = await aw("GET", `/users/${callerId}`);
    if (!(caller.labels || []).some(l => l === "admin" || l === "superadmin")) throw new HttpError(403, "Admins only");
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    switch (body.route) {
      case "preview": {
        const s = clean(body.statement);
        return res.json({ success: true, pdf: (await pdfFor(s)).toString("base64"), fileName: fileName(s) });
      }
      case "test": {
        const s = clean(body.statement);
        if (!caller.email) throw new HttpError(400, "Your account has no email address");
        await send(mailer(), s, caller.email, caller.name || "");
        return res.json({ success: true, sentTo: caller.email });
      }
      case "send": {
        const list = (Array.isArray(body.statements) ? body.statements : []).map(clean);
        if (!list.length) throw new HttpError(400, "Nothing to send");
        // Addresses come from the coach roster, not the page
        const byName = new Map();
        for (const c of await listAll(COACHES)) {
          const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
          if (!name || !c.email) continue;
          byName.set(norm(name), { email: c.email, name });
          for (const a of ALIASES[norm(name)] || []) byName.set(a, { email: c.email, name });
        }
        const transport = mailer();
        const results = [];
        for (const s of list) {
          const to = byName.get(norm(s.coach));
          if (!to) { results.push({ coach: s.coach, ok: false, error: "No email on the coach roster" }); continue; }
          try {
            const total = await send(transport, s, to.email, to.name);
            await aw("POST", `/databases/${DB}/collections/${LOG}/documents`, {
              documentId: "unique()",
              data: { coach: s.coach, month: s.month, total, email: to.email, sentBy: caller.name || caller.email || callerId },
            }).catch(e => error(`sent but not logged for ${s.coach}: ${e.message}`));
            results.push({ coach: s.coach, ok: true, email: to.email });
          } catch (e) {
            error(`statement for ${s.coach}: ${e.message}`);
            results.push({ coach: s.coach, ok: false, error: "Couldn't send" });
          }
        }
        log(`coach-statements: sent ${results.filter(r => r.ok).length} of ${results.length}`);
        return res.json({ success: true, results });
      }
      default:
        throw new HttpError(400, "Unknown route");
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) error(`coach-statements: ${e.message}`);
    return res.json({ success: false, error: e instanceof HttpError ? e.message : "Something went wrong" }, status);
  }
};
