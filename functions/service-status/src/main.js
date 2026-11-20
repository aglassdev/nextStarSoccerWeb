// service-status: the status page's data, readable from any site.
//
// status.nextstarsoccer.com isn't one of the project's web platforms, so a
// browser there can't read Appwrite directly. This function reads the status
// document server-side and returns it with an open CORS header, at its own
// address (https://nss-status.nyc.appwrite.run), so the status page works
// wherever the website is hosted. Read-only and public: the document is too.

const ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const PROJECT = process.env.APPWRITE_FUNCTION_PROJECT_ID || "68577380002195dec512";
const DB = "6842f11e0030e4b668a8";
const COLLECTION = "service_status";
const DOC = "current";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store, max-age=0", // admin edits show straight away
};

export default async ({ req, res, error }) => {
  if (req.method === "OPTIONS") return res.text("", 204, HEADERS);
  try {
    const r = await fetch(`${ENDPOINT}/databases/${DB}/collections/${COLLECTION}/documents/${DOC}`, {
      headers: { "X-Appwrite-Project": PROJECT },
    });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const doc = await r.json();
    const parsed = JSON.parse(doc.data || "{}");
    return res.json({ sections: Array.isArray(parsed.sections) ? parsed.sections : null }, 200, HEADERS);
  } catch (e) {
    error(`service-status: ${e.message}`);
    return res.json({ sections: null }, 502, HEADERS);
  }
};
