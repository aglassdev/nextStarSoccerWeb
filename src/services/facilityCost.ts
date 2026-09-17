import { Query, ID } from 'appwrite';
import { databases, databaseId, collections } from './appwrite';

// Facilities we pay to hire. Sofive bills by the hour; Bethesda is one flat
// charge however long we are there. Everything we use for free — Whitman,
// Howard, Lewinsville, Murch, Somerset, Wootton, Palisades — is simply absent
// from this list and costs nothing.
export interface FacilityRate {
  match: string;
  label: string;
  hourly?: number;
  flat?: number;
}

export const FACILITY_RATES: FacilityRate[] = [
  { match: 'sofive', label: 'Sofive', hourly: 100 },
  { match: 'bethesda soccer club', label: 'Bethesda Soccer Club', flat: 110 },
];

const lower = (s?: string) => (s || '').toLowerCase();

export const facilityRateFor = (location?: string): FacilityRate | null =>
  FACILITY_RATES.find(f => lower(location).includes(f.match)) ?? null;

// How a rate reads in the UI, e.g. "$100/hr" or "$110 flat".
export const rateLabel = (r: FacilityRate) =>
  r.flat !== undefined ? `$${r.flat} flat` : `$${r.hourly}/hr`;

// Nike camps are hosted on Nike's dime, so we are never billed for the pitch.
export const isNikeCamp = (title?: string) => {
  const t = lower(title);
  return t.includes('nike') && t.includes('camp');
};

// Youth and Pro/College run side by side on a camp day. It is one booking, so
// the hire is charged once — to the youth group, which is always the one that
// runs — and the pro/college twin carries nothing.
export const isPairedCampSecondary = (title?: string) =>
  lower(title).includes('camp') && lower(title).includes('pro/college');

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

// What a session at this venue costs to host. Sofive is $100/hr, so a 1.5-hour
// evening is $150 and two hours is $200; Bethesda is $110 whatever the length.
// Nike camps and the pro/college half of a camp day are free to us.
export const computeFacilityCost = (
  location?: string,
  start?: string,
  end?: string,
  title?: string,
): number => {
  if (isNikeCamp(title) || isPairedCampSecondary(title)) return 0;
  const rate = facilityRateFor(location);
  if (!rate) return 0;
  if (rate.flat !== undefined) return rate.flat;
  const hours = hoursBetween(start, end);
  if (!hours) return 0;
  return Math.round((rate.hourly ?? 0) * hours);
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
