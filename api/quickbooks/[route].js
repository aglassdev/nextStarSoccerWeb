// QuickBooks's addresses on our own domain, for the Intuit app's settings:
//   /api/quickbooks/callback  where Intuit returns after an admin connects QuickBooks
//   /api/quickbooks/webhook   where Intuit sends payment change notifications
// Both are passed straight to the quickbooks-sync Appwrite function, which
// checks them (a signed state, Intuit's signature) and holds the secrets.
// Nothing secret lives here.

const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID || '68577380002195dec512';
const FUNCTION_ID = 'quickbooks-sync';
const BACK = 'https://www.nextstarsoccer.com/admin/coach-payments?view=payouts&quickbooks=error';

// The exact bytes Intuit signed, so the signature can be checked
const rawBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString('utf8');
};

export default async function handler(req, res) {
  const route = String(req.query.route || '');
  res.setHeader('Cache-Control', 'no-store');
  if (route !== 'callback' && route !== 'webhook') return res.status(404).json({ error: 'Not found' });

  const payload = route === 'callback'
    ? { route, query: { code: req.query.code, state: req.query.state, realmId: req.query.realmId, error: req.query.error } }
    : { route, rawBody: await rawBody(req), signature: req.headers['intuit-signature'] || '' };

  try {
    const r = await fetch(`${ENDPOINT}/functions/${FUNCTION_ID}/executions`, {
      method: 'POST',
      headers: { 'X-Appwrite-Project': PROJECT_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: JSON.stringify(payload), async: false }),
    });
    const exec = await r.json();
    let out = {};
    try { out = JSON.parse(exec.responseBody || '{}'); } catch { /* not JSON */ }
    if (route === 'callback') return res.redirect(302, out.redirect || BACK);
    return res.status(exec.responseStatusCode || (r.ok ? 200 : 502)).json(out);
  } catch {
    if (route === 'callback') return res.redirect(302, BACK);
    return res.status(502).json({ error: 'Upstream failed' });
  }
}
