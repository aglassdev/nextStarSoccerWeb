import { Query, ID } from 'appwrite';
import { databases, databaseId, collections } from './appwrite';

// Facilities we pay to hire, charged by the hour. Everything we use for free —
// Whitman, Howard, Lewinsville, Murch, Somerset, Wootton, Palisades — is simply
// absent from this list and costs nothing.
export const FACILITY_HOURLY: { match: string; label: string; hourly: number }[] = [
  { match: 'sofive', label: 'Sofive', hourly: 75 },
  { match: 'bethesda soccer club', label: 'Bethesda Soccer Club', hourly: 55 },
];

const lower = (s?: string) => (s || '').toLowerCase();

export const facilityRateFor = (location?: string) =>
  FACILITY_HOURLY.find(f => lower(location).includes(f.match)) ?? null;

// Hours between two ISO datetimes, or between "HH:MM" clock strings.
export const hoursBetween = (start?: string, end?: string): number => {
  if (!start || !end) return 0;
  const a = Date.parse(start), b = Date.parse(end);
  if (Number.isFinite(a) && Number.isFinite(b) && b > a) return (b - a) / 3_600_000;
  const m = (t: string) => {
    const [h, min] = t.split(':').map(Number);
    return Number.isFinite(h) ? h * 60 + (min || 0) : NaN;
  };
  const am = m(start), bm = m(end);
  return Number.isFinite(am) && Number.isFinite(bm) && bm > am ? (bm - am) / 60 : 0;
};

// What a session at this location for this long costs to host. A two-hour group
// at Sofive comes to $150, at Bethesda $110.
export const computeFacilityCost = (location?: string, start?: string, end?: string): number => {
  const rate = facilityRateFor(location);
  if (!rate) return 0;
  const hours = hoursBetween(start, end);
  if (!hours) return 0;
  return Math.round(rate.hourly * hours);
};

// ── Stored overrides ─────────────────────────────────────────────────────────
// The computed figure is only a default: once a cost is saved against an event
// it wins, so a hand-typed correction survives.

// Sessions marked as not worth reporting — cancelled, or nobody turned up.
export async function getExcludedEventIds(): Promise<Set<string>> {
  if (!collections.eventMeta) return new Set();
  try {
    const res = await databases.listDocuments(databaseId, collections.eventMeta, [
      Query.equal('excludedFromPayouts', true), Query.limit(1000),
    ]);
    return new Set((res.documents as any[]).map(d => d.eventId).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function getFacilityCosts(eventIds: string[]): Promise<Record<string, number>> {
  if (!collections.eventMeta || eventIds.length === 0) return {};
  const out: Record<string, number> = {};
  // Appwrite caps how many values one `equal` accepts, so ask in batches.
  for (let i = 0; i < eventIds.length; i += 90) {
    const batch = eventIds.slice(i, i + 90);
    try {
      const res = await databases.listDocuments(databaseId, collections.eventMeta, [
        Query.equal('eventId', batch), Query.limit(100),
      ]);
      for (const d of res.documents as any[]) {
        if (typeof d.facilityCost === 'number') out[d.eventId] = d.facilityCost;
      }
    } catch { /* metadata is optional — fall back to the computed cost */ }
  }
  return out;
}

export async function getFacilityCost(eventId: string): Promise<number | null> {
  const m = await getFacilityCosts([eventId]);
  return eventId in m ? m[eventId] : null;
}

export async function setFacilityCost(eventId: string, facilityCost: number): Promise<void> {
  if (!collections.eventMeta || !eventId) return;
  const existing = await databases.listDocuments(databaseId, collections.eventMeta, [
    Query.equal('eventId', eventId), Query.limit(1),
  ]);
  const doc = (existing.documents as any[])[0];
  if (doc) {
    await databases.updateDocument(databaseId, collections.eventMeta, doc.$id, { facilityCost });
  } else {
    await databases.createDocument(databaseId, collections.eventMeta, ID.unique(), { eventId, facilityCost });
  }
}
