// Same-origin proxy for the public status page.
//
// The status page is served from status.nextstarsoccer.com, which is a
// different origin than the registered Appwrite web platform — so a browser
// read of the status document is CORS-blocked (403). Fetching it here,
// server-side, has no CORS restriction, so the status page can read its data
// on any domain by hitting this same-origin endpoint.

const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID || '68577380002195dec512';
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6842f11e0030e4b668a8';
const COLLECTION_ID = process.env.VITE_APPWRITE_SERVICE_STATUS_COLLECTION_ID || 'service_status';
const DOC_ID = 'current';

export default async function handler(_req, res) {
  try {
    const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${DOC_ID}`;
    const r = await fetch(url, { headers: { 'X-Appwrite-Project': PROJECT_ID } });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const doc = await r.json();
    const parsed = JSON.parse(doc.data || '{}');
    // Don't cache — the status must reflect admin edits immediately.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({ sections: Array.isArray(parsed.sections) ? parsed.sections : null });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({ sections: null, error: String((e && e.message) || e) });
  }
}
