import crypto from "node:crypto";

/**
 * quickbooks-sync: records coach payments made in QuickBooks (Contractor
 * Payments, bill payments, checks) on Coach Payments → Payouts.
 *
 * Routes (body.route):
 *  Admins, called from the website with their session:
 *   - "status"      → whether it's set up and connected, last sync
 *   - "authUrl"     → the Intuit sign-in address to connect QuickBooks
 *   - "sync"        { full? } → read payments now
 *   - "disconnect"  → revoke the connection
 *  Intuit, through the website's /api/quickbooks/* proxy (no session):
 *   - "callback"    { query } → finish connecting (checked by a signed state)
 *   - "webhook"     { rawBody, signature } → a payment changed (checked by
 *                   Intuit's signature), so sync
 *  The daily schedule runs a sync too.
 *
 * Settings (function environment variables, set in the Appwrite console):
 *   QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET   the Intuit app's production keys
 *   QUICKBOOKS_WEBHOOK_VERIFIER                      the app's webhook verifier token
 *   QUICKBOOKS_SYNC_FROM (optional, YYYY-MM-DD)      payments on or after this date
 *                                                    count; default 2026-11-13, the day
 *                                                    after the starting balances
 *
 * A payment is recorded when its payee matches a coach on the roster; anything
 * else (facilities, equipment) is left alone and listed as unmatched.
 */

const ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const PROJECT = process.env.APPWRITE_FUNCTION_PROJECT_ID || "68577380002195dec512";
const DB = "6842f11e0030e4b668a8";
const COACHES = process.env.COACHES_COLLECTION_ID || "6896c95e0004dce4140c";
const PAYOUTS = "coach_payouts";
const CONNECTION = "quickbooks_connection";
const CONNECTION_DOC = "main";

const SITE = "https://www.nextstarsoccer.com";
const REDIRECT_URI = `${SITE}/api/quickbooks/callback`;
const RETURN_TO = `${SITE}/admin/coach-payments?view=payouts`;
const INTUIT_AUTH = "https://appcenter.intuit.com/connect/oauth2";
const INTUIT_TOKEN = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const INTUIT_REVOKE = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const QBO = "https://quickbooks.api.intuit.com/v3/company";
const MINOR = "minorversion=75";

const CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET || "";
const VERIFIER = process.env.QUICKBOOKS_WEBHOOK_VERIFIER || "";
const SYNC_FROM = /^\d{4}-\d{2}-\d{2}$/.test(process.env.QUICKBOOKS_SYNC_FROM || "") ? process.env.QUICKBOOKS_SYNC_FROM : "2026-11-13";

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ── Appwrite (REST, with the function's own key) ─────────────────────────────

let KEY = "";
const aw = async (method, path, body) => {
  const r = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: { "X-Appwrite-Project": PROJECT, "X-Appwrite-Key": KEY, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : {};
  if (!r.ok) { const e = new Error(json.message || `Appwrite ${r.status}`); e.code = r.status; throw e; }
  return json;
};
const q = (method, values, attribute) => JSON.stringify(attribute ? { method, attribute, values } : { method, values });
const listDocs = async (col, queries = []) => {
  const out = []; let cursor = null;
  for (;;) {
    const qs = [...queries, q("limit", [100]), ...(cursor ? [q("cursorAfter", [cursor])] : [])]
      .map(x => "queries[]=" + encodeURIComponent(x)).join("&");
    const r = await aw("GET", `/databases/${DB}/collections/${col}/documents?${qs}`);
    out.push(...r.documents);
    if (r.documents.length < 100) return out;
    cursor = r.documents[r.documents.length - 1].$id;
  }
};
const docPath = (col, id) => `/databases/${DB}/collections/${col}/documents/${id}`;
const getDoc = (col, id) => aw("GET", docPath(col, id)).catch(e => { if (e.code === 404) return null; throw e; });
const putDoc = async (col, id, data) => {
  try { return await aw("PATCH", docPath(col, id), { data }); }
  catch (e) {
    if (e.code !== 404) throw e;
    return aw("POST", `/databases/${DB}/collections/${col}/documents`, { documentId: id, data });
  }
};
const deleteDoc = (col, id) => aw("DELETE", docPath(col, id)).catch(e => { if (e.code !== 404) throw e; });

// ── The connection (tokens live only in the server-only collection) ──────────

const readConnection = async () => {
  const doc = await getDoc(CONNECTION, CONNECTION_DOC);
  if (!doc || !doc.refreshToken) return null;
  let meta = {};
  try { meta = JSON.parse(doc.meta || "{}"); } catch { /* keep empty */ }
  return { ...doc, meta };
};
const saveConnection = (fields, meta) =>
  putDoc(CONNECTION, CONNECTION_DOC, { ...fields, ...(meta ? { meta: JSON.stringify(meta).slice(0, 7900) } : {}) });

const basicAuth = () => "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
const tokenRequest = async (params) => {
  const r = await fetch(INTUIT_TOKEN, {
    method: "POST",
    headers: { Authorization: basicAuth(), Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, `QuickBooks sign-in failed: ${json.error_description || json.error || r.status}`);
  return json;
};
const tokenFields = (t, now = Date.now()) => ({
  accessToken: t.access_token,
  refreshToken: t.refresh_token,
  expires: { access: new Date(now + (t.expires_in - 60) * 1000).toISOString(), refresh: new Date(now + t.x_refresh_token_expires_in * 1000).toISOString() },
});

// A valid access token, refreshed (and the rotated refresh token saved) when due.
const accessTokenFor = async (conn) => {
  if (conn.accessToken && conn.meta.accessExpires && Date.parse(conn.meta.accessExpires) > Date.now()) return conn.accessToken;
  const t = tokenFields(await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refreshToken }));
  conn.accessToken = t.accessToken; conn.refreshToken = t.refreshToken;
  conn.meta = { ...conn.meta, accessExpires: t.expires.access, refreshExpires: t.expires.refresh };
  await saveConnection({ accessToken: t.accessToken, refreshToken: t.refreshToken }, conn.meta);
  return t.accessToken;
};

const qbo = async (conn, path) => {
  const token = await accessTokenFor(conn);
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${QBO}/${conn.realmId}/${path}${sep}${MINOR}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, `QuickBooks: ${json?.Fault?.Error?.[0]?.Detail || json?.Fault?.Error?.[0]?.Message || r.status}`);
  return json;
};

// ── Matching payees to coaches ───────────────────────────────────────────────

const ALIASES = { "coach kareem": "Karim Metwalli", "kareem metwalli": "Karim Metwalli" };
const norm = (s) => (s || "").toLowerCase()
  .replace(/\b(llc|inc|co|corp|ltd)\b\.?/g, " ")
  .replace(/[^a-z\s,]/g, " ").replace(/\s+/g, " ").trim();
// "Machado, Ryan" → "ryan machado"
const flip = (s) => (s.includes(",") ? s.split(",").map(x => x.trim()).reverse().join(" ") : s).replace(/,/g, " ").replace(/\s+/g, " ").trim();

const loadRoster = async () => {
  const coaches = await listDocs(COACHES);
  const byName = new Map();
  for (const c of coaches) {
    const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
    if (!name || norm(name) === "coach testing") continue;
    byName.set(flip(norm(name)), ALIASES[norm(name)] || name);
  }
  for (const [alias, name] of Object.entries(ALIASES)) byName.set(alias, name);
  return byName;
};
const matchCoach = (roster, payee) => {
  const n = flip(norm(payee));
  if (!n) return null;
  if (roster.has(n)) return roster.get(n);
  // "Ryan A Machado" or "Ryan Machado Soccer": the coach's first and last name both present
  for (const [key, name] of roster) {
    const parts = key.split(" ");
    if (parts.length >= 2 && n.split(" ").includes(parts[0]) && n.split(" ").includes(parts[parts.length - 1])) return name;
  }
  return null;
};

// ── Sync ─────────────────────────────────────────────────────────────────────

const payeeOf = (type, t) => (type === "BillPayment" ? t.VendorRef : t.EntityRef)?.name || "";
const recordId = (type, id) => `qbo-${type === "BillPayment" ? "bp" : "pu"}-${id}`.slice(0, 36);

async function sync(conn, { full = false } = {}, log = () => {}) {
  const started = new Date().toISOString();
  const roster = await loadRoster();
  const changes = []; // { type, id, deleted, txn }

  const since = conn.meta.lastSyncAt;
  const recent = since && Date.now() - Date.parse(since) < 25 * 86400e3;
  if (!full && recent) {
    // Everything changed since the last sync, deletions included (5 minutes' overlap)
    const changedSince = new Date(Date.parse(since) - 5 * 60e3).toISOString();
    const r = await qbo(conn, `cdc?entities=Purchase,BillPayment&changedSince=${encodeURIComponent(changedSince)}`);
    for (const resp of r?.CDCResponse?.[0]?.QueryResponse ?? []) {
      for (const type of ["Purchase", "BillPayment"]) {
        for (const t of resp[type] ?? []) changes.push({ type, id: t.Id, deleted: t.status === "Deleted", txn: t });
      }
    }
  } else {
    for (const type of ["Purchase", "BillPayment"]) {
      for (let start = 1; ; start += 1000) {
        const r = await qbo(conn, `query?query=${encodeURIComponent(`select * from ${type} where TxnDate >= '${SYNC_FROM}' startposition ${start} maxresults 1000`)}`);
        const items = r?.QueryResponse?.[type] ?? [];
        for (const t of items) changes.push({ type, id: t.Id, deleted: false, txn: t });
        if (items.length < 1000) break;
      }
    }
  }

  const result = { at: started, recorded: 0, removed: 0, unmatched: {}, full: !recent || full };
  for (const c of changes) {
    const id = recordId(c.type, c.id);
    const amount = Number(c.txn.TotalAmt || 0);
    const date = c.txn.TxnDate || "";
    const coach = c.deleted ? null : matchCoach(roster, payeeOf(c.type, c.txn));
    if (c.deleted || amount <= 0 || date < SYNC_FROM || !coach) {
      // Deleted, voided, before the start date, or no longer a coach: not a payout
      const existing = await getDoc(PAYOUTS, id);
      if (existing) { await deleteDoc(PAYOUTS, id); result.removed++; }
      if (!c.deleted && amount > 0 && date >= SYNC_FROM && !coach) {
        const payee = payeeOf(c.type, c.txn) || "(no payee)";
        result.unmatched[payee] = (result.unmatched[payee] || 0) + 1;
      }
      continue;
    }
    const how = c.type === "BillPayment" ? "Bill payment" : (c.txn.PaymentType === "Check" ? "Check / direct deposit" : c.txn.PaymentType || "Payment");
    await putDoc(PAYOUTS, id, {
      coach, kind: "amount", amount: Math.round(amount * 100) / 100,
      paidOn: date, source: "quickbooks", externalId: `${c.type}:${c.id}`,
      note: `QuickBooks · ${how}${c.txn.DocNumber ? ` #${c.txn.DocNumber}` : ""}`.slice(0, 500),
      recordedBy: "QuickBooks",
    });
    result.recorded++;
  }

  conn.meta = { ...conn.meta, lastSyncAt: started, lastResult: result };
  await saveConnection({}, conn.meta);
  log(`quickbooks-sync: ${result.recorded} recorded, ${result.removed} removed, ${Object.keys(result.unmatched).length} unmatched payees`);
  return result;
}

// ── Signed state for the sign-in round trip ──────────────────────────────────

const sign = (s) => crypto.createHmac("sha256", CLIENT_SECRET).update(s).digest("base64url");
const makeState = (userId) => {
  const payload = Buffer.from(JSON.stringify({ u: userId, t: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
};
const readState = (state) => {
  const [payload, sig] = String(state || "").split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  return Date.now() - data.t < 15 * 60e3 ? data : null;
};

// ── Handler ──────────────────────────────────────────────────────────────────

const configured = () => !!(CLIENT_ID && CLIENT_SECRET);
const isAdmin = (user) => (user.labels || []).some(l => l === "admin" || l === "superadmin");

export default async (context) => {
  const { req, res, log, error } = context;
  KEY = process.env.APPWRITE_API_KEY || req.headers["x-appwrite-key"] || "";
  const scheduled = req.headers["x-appwrite-trigger"] === "schedule";
  let body = {};
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}; } catch { body = {}; }
  // Only Appwrite's own schedule runs the daily sync
  const route = scheduled ? "(schedule)" : String(body.route || "").replace("(schedule)", "");

  try {
    // Intuit's side: verified by signature or signed state, not by a session
    if (route === "webhook") {
      if (!VERIFIER) throw new HttpError(503, "Webhook verifier not set");
      const expected = crypto.createHmac("sha256", VERIFIER).update(String(body.rawBody || "")).digest("base64");
      const got = Buffer.from(String(body.signature || ""));
      if (got.length !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(got, Buffer.from(expected))) {
        throw new HttpError(401, "Bad signature");
      }
      const conn = await readConnection();
      if (conn) await sync(conn, {}, log);
      return res.json({ ok: true });
    }
    if (route === "callback") {
      const qy = body.query || {};
      if (qy.error) return res.json({ redirect: `${RETURN_TO}&quickbooks=${encodeURIComponent(qy.error)}` });
      if (!configured()) throw new HttpError(503, "QuickBooks keys not set");
      const st = readState(qy.state);
      if (!st || !qy.code || !qy.realmId) return res.json({ redirect: `${RETURN_TO}&quickbooks=expired` });
      const t = tokenFields(await tokenRequest({ grant_type: "authorization_code", code: qy.code, redirect_uri: REDIRECT_URI }));
      const conn = {
        realmId: String(qy.realmId), accessToken: t.accessToken, refreshToken: t.refreshToken,
        meta: { accessExpires: t.expires.access, refreshExpires: t.expires.refresh, connectedBy: st.u, connectedAt: new Date().toISOString() },
      };
      await saveConnection({ realmId: conn.realmId, accessToken: conn.accessToken, refreshToken: conn.refreshToken }, conn.meta);
      let companyName = "";
      try { companyName = (await qbo(conn, `companyinfo/${conn.realmId}`))?.CompanyInfo?.CompanyName || ""; } catch { /* optional */ }
      await saveConnection({ companyName });
      try { await sync(conn, { full: true }, log); } catch (e) { error(`first sync: ${e.message}`); }
      return res.json({ redirect: `${RETURN_TO}&quickbooks=connected` });
    }
    if (route === "(schedule)" && scheduled) {
      const conn = await readConnection();
      if (conn && configured()) await sync(conn, {}, log);
      return res.json({ ok: true });
    }

    // Admins only from here
    const callerId = req.headers["x-appwrite-user-id"];
    if (!callerId) throw new HttpError(401, "Sign in first");
    const caller = await aw("GET", `/users/${callerId}`);
    if (!isAdmin(caller)) throw new HttpError(403, "Admins only");

    switch (route) {
      case "status": {
        const doc = await getDoc(CONNECTION, CONNECTION_DOC);
        let meta = {};
        try { meta = JSON.parse(doc?.meta || "{}"); } catch { /* empty */ }
        return res.json({
          success: true, configured: configured(), webhookReady: !!VERIFIER,
          connected: !!doc?.refreshToken, companyName: doc?.companyName || "",
          lastSyncAt: meta.lastSyncAt || null, lastResult: meta.lastResult || null, syncFrom: SYNC_FROM,
        });
      }
      case "authUrl": {
        if (!configured()) throw new HttpError(503, "QuickBooks isn't set up yet: add the Intuit app's keys to this function's settings.");
        const params = new URLSearchParams({
          client_id: CLIENT_ID, response_type: "code", scope: "com.intuit.quickbooks.accounting",
          redirect_uri: REDIRECT_URI, state: makeState(callerId),
        });
        return res.json({ success: true, url: `${INTUIT_AUTH}?${params}` });
      }
      case "sync": {
        const conn = await readConnection();
        if (!conn) throw new HttpError(400, "QuickBooks isn't connected");
        return res.json({ success: true, result: await sync(conn, { full: !!body.full }, log) });
      }
      case "disconnect": {
        const conn = await readConnection();
        if (conn && configured()) {
          await fetch(INTUIT_REVOKE, {
            method: "POST",
            headers: { Authorization: basicAuth(), Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ token: conn.refreshToken }),
          }).catch(() => {});
        }
        await deleteDoc(CONNECTION, CONNECTION_DOC);
        return res.json({ success: true });
      }
      default:
        throw new HttpError(400, "Unknown route");
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) error(`quickbooks-sync ${route}: ${e.message}`);
    if (route === "callback") return res.json({ redirect: `${RETURN_TO}&quickbooks=error` });
    return res.json({ success: false, error: e instanceof HttpError ? e.message : "Something went wrong" }, status);
  }
};
