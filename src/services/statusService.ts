import { databases, databaseId, collections } from './appwrite';

// ── Model ────────────────────────────────────────────────────────────────────
export type StatusKey = 'operational' | 'partial' | 'major' | 'maintenance';

export interface Service { name: string; status: StatusKey; }
export interface StatusSection { title: string; items: Service[]; }

export const STATUS_ORDER: StatusKey[] = ['operational', 'partial', 'major', 'maintenance'];

export const STATUS_META: Record<StatusKey, { label: string; dot: string; text: string; glow: string }> = {
  operational: { label: 'Operational', dot: 'bg-green-500', text: 'text-green-400', glow: 'shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]' },
  partial: { label: 'Partial Outage', dot: 'bg-orange-500', text: 'text-orange-400', glow: 'shadow-[0_0_8px_2px_rgba(249,115,22,0.6)]' },
  major: { label: 'Major Outage', dot: 'bg-red-500', text: 'text-red-400', glow: 'shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]' },
  maintenance: { label: 'Under Maintenance', dot: 'bg-blue-500', text: 'text-blue-400', glow: 'shadow-[0_0_8px_2px_rgba(59,130,246,0.6)]' },
};

// Fallback shown if the stored config can't be loaded.
export const DEFAULT_SECTIONS: StatusSection[] = [
  {
    title: 'General',
    items: [
      { name: 'Database', status: 'operational' },
      { name: 'Auth', status: 'operational' },
      { name: 'SMTP', status: 'operational' },
      { name: 'Functions', status: 'operational' },
      { name: 'APIs', status: 'operational' },
      { name: 'Storage', status: 'operational' },
    ],
  },
  {
    title: 'App',
    items: [
      { name: 'Main', status: 'operational' },
      { name: 'Requests', status: 'operational' },
      { name: 'Messaging', status: 'operational' },
      { name: 'Account', status: 'operational' },
      { name: 'Calendar', status: 'operational' },
      { name: 'Contact', status: 'operational' },
      { name: 'Account Linking', status: 'major' },
    ],
  },
  {
    title: 'Payments',
    items: [
      { name: 'Billing', status: 'operational' },
      { name: 'Checkout', status: 'operational' },
      { name: 'Credit Cards', status: 'operational' },
      { name: 'Bank Transfer', status: 'operational' },
      { name: 'GPay', status: 'partial' },
      { name: 'Apple Pay', status: 'major' },
    ],
  },
  {
    title: 'Website',
    items: [
      { name: 'Main', status: 'operational' },
      { name: 'Contact', status: 'operational' },
      { name: 'Calendar', status: 'operational' },
      { name: 'Payment Portal', status: 'operational' },
      { name: 'Scholarship Applications', status: 'operational' },
      { name: 'Documentation', status: 'operational' },
    ],
  },
];

// Singleton document that holds the whole status config as a JSON string.
const STATUS_DOC_ID = 'current';

const isValidStatus = (s: any): s is StatusKey => STATUS_ORDER.includes(s);

// Coerce arbitrary parsed JSON into a clean StatusSection[] (defensive).
function normalize(raw: any): StatusSection[] | null {
  const sections = Array.isArray(raw) ? raw : raw?.sections;
  if (!Array.isArray(sections)) return null;
  const out: StatusSection[] = [];
  for (const sec of sections) {
    if (!sec || typeof sec.title !== 'string' || !Array.isArray(sec.items)) continue;
    const items: Service[] = [];
    for (const it of sec.items) {
      if (!it || typeof it.name !== 'string') continue;
      items.push({ name: it.name, status: isValidStatus(it.status) ? it.status : 'operational' });
    }
    out.push({ title: sec.title, items });
  }
  return out;
}

// Public loader for the status page. Reads via the same-origin /api/status
// proxy first — this works on any domain (e.g. the status.* subdomain, which
// isn't a registered Appwrite web platform and would be CORS-blocked by a
// direct browser read). Falls back to a direct SDK read, then to defaults.
export async function loadStatusSectionsPublic(): Promise<StatusSection[]> {
  try {
    const r = await fetch('/api/status', { cache: 'no-store' });
    if (r.ok) {
      const json = await r.json();
      const parsed = normalize(json);
      if (parsed && parsed.length) return parsed;
    }
  } catch { /* fall through to SDK */ }
  return loadStatusSections();
}

// Load the current status config. Falls back to DEFAULT_SECTIONS on any error.
export async function loadStatusSections(): Promise<StatusSection[]> {
  try {
    if (!collections.serviceStatus) return DEFAULT_SECTIONS;
    const doc: any = await databases.getDocument(databaseId, collections.serviceStatus, STATUS_DOC_ID);
    const parsed = normalize(JSON.parse(doc.data || '{}'));
    return parsed && parsed.length ? parsed : DEFAULT_SECTIONS;
  } catch {
    return DEFAULT_SECTIONS;
  }
}

// Persist the status config (admin only — writes require an authenticated session).
export async function saveStatusSections(sections: StatusSection[]): Promise<void> {
  const payload = { data: JSON.stringify({ sections }) };
  try {
    await databases.updateDocument(databaseId, collections.serviceStatus, STATUS_DOC_ID, payload);
  } catch {
    // Document may not exist yet — create it.
    await databases.createDocument(databaseId, collections.serviceStatus, STATUS_DOC_ID, payload);
  }
}

// Overall banner status (worst status wins).
export function overallStatus(sections: StatusSection[]): { key: StatusKey; headline: string } {
  const all = sections.flatMap((s) => s.items.map((i) => i.status));
  if (all.includes('major')) return { key: 'major', headline: 'Some systems are experiencing a major outage' };
  if (all.includes('partial')) return { key: 'partial', headline: 'Some systems are experiencing a partial outage' };
  if (all.includes('maintenance')) return { key: 'maintenance', headline: 'Some systems are under maintenance' };
  return { key: 'operational', headline: 'All systems operational' };
}
