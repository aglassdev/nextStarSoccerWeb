import { CoachAttendanceData, normalizeName } from "./coachAttendance";
import { CalendarEvent } from "./googleCalendar";

// Payouts only cover sessions from this date onward; anything earlier is
// already settled. Anchored to Eastern time, where the season is scheduled.
export const PAYOUT_START = "2026-05-01T00:00:00-04:00";
const PAYOUT_START_MS = Date.parse(PAYOUT_START);

export const isWithinPayoutWindow = (event: CalendarEvent): boolean =>
  Date.parse(event.startDateTime) >= PAYOUT_START_MS;

// ── Rates ─────────────────────────────────────────────────────────────────────

// Everyone is hourly and paid on exact elapsed time, so 3h pays 3 × the rate.
export const DEFAULT_HOURLY = 25;
export const SENIOR_HOURLY = 50;

// Paid at the higher rate, with one exception: at a camp run by a head coach
// they drop to the default rate like everyone else. Spelling variants are
// listed because names also arrive from free-text calendar descriptions.
const SENIOR_COACHES = new Set([
  "ryan machado",
  "jake steinman",
  "noah satriano",
  "michael elfman",
  "michael anthony elfman",
  "patrick mullins",
]);

// Session leads. Neither draws an hourly rate: Gyau takes a share of the
// profit of each eligible session, and Torres keeps whatever is left after
// him, so Torres is left off this page entirely. He still counts as a head
// coach being present, which is what sets the camp rate.
const GYAU = "phillip gyau";
const PAUL_TORRES = "paul torres";
const HEAD_COACHES = new Set([GYAU, PAUL_TORRES]);

// Booked as a session cost rather than a coach — a photographer, not staff.
// The figure comes out of session profit but earns no payout row of its own.
export const SESSION_EXPENSES: Record<string, { label: string; amount: number }> = {
  peabo: { label: "Peabo · photographer", amount: 250 },
};

// Phillip Gyau takes a share of what the session nets after facility hire and
// every other cost on it.
export const GYAU_ATTENDED_SHARE = 0.5;
export const GYAU_ABSENT_SHARE = 0.3;

// Facilities we pay to hire. Matched anywhere in the calendar location, so the
// full postal address still resolves. Everything not listed is free.
export const FACILITY_COSTS: { match: string; label: string; flat: number }[] = [
  { match: "sofive", label: "Sofive Rockville", flat: 150 },
  { match: "bethesda soccer club", label: "Bethesda Soccer Club", flat: 110 },
];

// ── Session classification ────────────────────────────────────────────────────

const lower = (s: string) => (s || "").toLowerCase();

export const isCamp = (title: string) => lower(title).includes("camp");
export const isNikeCamp = (title: string) =>
  lower(title).includes("nike") && isCamp(title);

// Privates, semi-privates and analysis work never feed Gyau's share.
export const isPrivateOrAnalysis = (title: string) => {
  const t = lower(title);
  return [
    "private session",
    "individual session",
    "two-person",
    "two person",
    "small group",
    "game analysis",
    "player report",
    "parent consultation",
  ].some(p => t.includes(p));
};

// Based on when the session actually starts rather than its name: several
// Sunday 3pm sessions are titled "Evening Group Training".
export const isWeekendAfternoon = (event: CalendarEvent): boolean => {
  if (event.dateOnly) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(event.startDateTime));
  const weekday = parts.find(p => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find(p => p.type === "hour")?.value ?? "0");
  return (weekday === "Sat" || weekday === "Sun") && hour >= 12;
};

// Patrick Mullins runs sessions in Alexandria under his own name. Those are
// his business rather than ours, so they are left out of this page entirely.
// He is still paid as a support coach when he works one of our sessions.
export const isMullinsOwnSession = (event: CalendarEvent): boolean =>
  lower(event.title).includes("mullins");

// Camps and group sessions are the only revenue Gyau shares in. Weekend
// afternoons and privates are excluded whether or not he was there.
export const gyauEligible = (event: CalendarEvent): boolean => {
  if (isPrivateOrAnalysis(event.title)) return false;
  if (isWeekendAfternoon(event)) return false;
  return isCamp(event.title) || lower(event.title).includes("group");
};

const easternDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso));

// A Nike camp day is sold as an overlapping half day and full day at the same
// start time. They are one session on the ground, so they are combined: the
// revenue adds up, but the facility hire and each coach's pay are only counted
// once, and Gyau takes his share of the day as a whole.
const nikeCampDayKey = (event: CalendarEvent): string | null => {
  if (!isNikeCamp(event.title)) return null;
  const t = lower(event.title);
  if (!t.includes("half day") && !t.includes("full day")) return null;
  return `nike-camp::${easternDay(event.startDateTime)}`;
};

// Collapses the grouped events into one synthetic session spanning the longest
// of them, so hourly pay reflects the real length of the day.
const mergeSessionEvents = (group: CalendarEvent[]): CalendarEvent => {
  const byStart = [...group].sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime));
  const first = byStart[0];
  const latestEnd = group.reduce(
    (max, e) => (Date.parse(e.endDateTime) > Date.parse(max) ? e.endDateTime : max),
    first.endDateTime
  );
  const hasHalf = group.some(e => lower(e.title).includes("half day"));
  const hasFull = group.some(e => lower(e.title).includes("full day"));
  const title =
    hasHalf && hasFull
      ? "Next Star x Nike Summer Camp (Half + Full Day)"
      : first.title;
  return { ...first, title, endDateTime: latestEnd };
};

export const facilityLabel = (location?: string): string => {
  if (!location) return "—";
  return location.split(",")[0].trim();
};

// Nike camps are excluded from facility hire; Nike evening groups are not.
export const facilityCostFor = (event: CalendarEvent): number => {
  if (isNikeCamp(event.title)) return 0;
  const loc = lower(event.location || "");
  const hit = FACILITY_COSTS.find(f => loc.includes(f.match));
  return hit ? hit.flat : 0;
};

const durationHours = (event: CalendarEvent): number => {
  const h = (Date.parse(event.endDateTime) - Date.parse(event.startDateTime)) / 3_600_000;
  return Number.isFinite(h) && h > 0 ? h : 0;
};

// ── Per-coach pay for one session ─────────────────────────────────────────────

export interface CoachRate {
  amount: number | null; // null when pay is settled outside this calculation
  basis: string;
}

export const rateForCoach = (
  coachName: string,
  event: CalendarEvent,
  headCoachPresent: boolean
): CoachRate => {
  const key = normalizeName(coachName);

  if (HEAD_COACHES.has(key)) return { amount: null, basis: "Head coach" };

  const expense = SESSION_EXPENSES[key];
  if (expense) return { amount: expense.amount, basis: "Session expense" };

  const hours = durationHours(event);
  const hoursLabel = hours ? `${hours % 1 ? hours.toFixed(1) : hours}h` : "duration unknown";

  // The higher rate does not apply at a camp a head coach is running.
  const campWithHead = isCamp(event.title) && headCoachPresent;
  const rate = SENIOR_COACHES.has(key) && !campWithHead ? SENIOR_HOURLY : DEFAULT_HOURLY;
  const note = SENIOR_COACHES.has(key) && campWithHead ? " (camp rate)" : "";

  return {
    amount: hours ? hours * rate : rate,
    basis: `${hoursLabel} × $${rate}${note}`,
  };
};

// ── Rows ──────────────────────────────────────────────────────────────────────

export interface SupportPay {
  name: string;
  amount: number;
  basis: string;
}

export interface SessionCost {
  label: string;
  amount: number;
}

// One row of the Session view: what the session took in, what it cost to run,
// and what was left over.
export interface SessionRow {
  id: string;
  title: string;
  startDateTime: string;
  dateOnly?: boolean;
  headCoaches: string[];
  supportCoaches: SupportPay[];
  supportCost: number;
  facility: string;
  facilityCost: number;
  otherCosts: SessionCost[];
  otherCost: number;
  revenue: number;
  profit: number;
  gyauShare: number;
  gyauAttended: boolean;
  gyauEligible: boolean;
}

// One row of the Coach view: what a single coach earned on a single session.
export interface PayoutRow {
  id: string;
  coach: string;
  sessionTitle: string;
  startDateTime: string;
  dateOnly?: boolean;
  facility: string;
  facilityCost: number;
  // Only populated on Gyau's rows, where the support cost is what his share is
  // calculated after. Assistant coaches carry no support cost of their own.
  supportCoaches: string[] | null;
  supportCost: number | null;
  revenue: number;
  payment: number | null;
  basis: string;
  attended: boolean;
}

export interface PayoutTable {
  rows: PayoutRow[];
  sessions: SessionRow[];
  builtAt: string;
  totalsByCoach: { coach: string; total: number | null; sessions: number }[];
  grandTotal: number;
}

export function computePayoutTable(data: CoachAttendanceData): PayoutTable {
  const inWindow = data.events.filter(
    e => isWithinPayoutWindow(e) && !isMullinsOwnSession(e)
  );

  // Everyone credited to a calendar event, from tracked attendance or the
  // calendar description.
  const attendeesByEvent = new Map<string, string[]>();
  for (const [eventId, slot] of Object.entries(data.coachesByEvent)) {
    const names: string[] = [];
    for (const t of slot.tracked) if (!names.some(n => normalizeName(n) === normalizeName(t.name))) names.push(t.name);
    for (const c of slot.calendar) if (!names.some(n => normalizeName(n) === normalizeName(c))) names.push(c);
    attendeesByEvent.set(eventId, names);
  }

  // Group the overlapping halves of a camp day together; everything else is a
  // session on its own.
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of inWindow) {
    const key = nikeCampDayKey(event) ?? event.id;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  const events: CalendarEvent[] = [];
  const memberIds = new Map<string, string[]>();
  const memberEvents = new Map<string, CalendarEvent[]>();
  for (const [key, group] of groups) {
    const merged = group.length === 1 ? group[0] : mergeSessionEvents(group);
    events.push({ ...merged, id: key });
    memberIds.set(key, group.map(e => e.id));
    memberEvents.set(key, group);
  }
  events.sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime));

  const revenueFor = (key: string) =>
    (memberIds.get(key) ?? [key]).reduce((sum, id) => sum + (data.revenueByEvent[id] || 0), 0);

  // Within a combined camp day a coach may only have worked the half day, so
  // pay them for the longest event they are actually credited on rather than
  // the full span of the day.
  const payableEventFor = (key: string, coach: string, merged: CalendarEvent): CalendarEvent => {
    const credited = (memberEvents.get(key) ?? []).filter(e =>
      (attendeesByEvent.get(e.id) ?? []).some(n => normalizeName(n) === normalizeName(coach))
    );
    if (credited.length === 0) return merged;
    return credited.reduce((longest, e) =>
      Date.parse(e.endDateTime) - Date.parse(e.startDateTime) >
      Date.parse(longest.endDateTime) - Date.parse(longest.startDateTime)
        ? e
        : longest
    );
  };

  const attendeesFor = (key: string) => {
    const names: string[] = [];
    for (const id of memberIds.get(key) ?? [key]) {
      for (const n of attendeesByEvent.get(id) ?? []) {
        if (!names.some(x => normalizeName(x) === normalizeName(n))) names.push(n);
      }
    }
    return names;
  };

  const gyauDisplayName = data.coaches.find(c => c.key === GYAU)?.name ?? "Phillip Gyau";

  // ── Session view ──
  const sessions: SessionRow[] = [];

  for (const event of events) {
    const attendees = attendeesFor(event.id);
    const revenue = revenueFor(event.id);
    // A session nobody is credited on and that took nothing in has nothing to
    // report either way.
    if (attendees.length === 0 && revenue <= 0) continue;

    const headCoaches = attendees.filter(n => HEAD_COACHES.has(normalizeName(n)));
    const headCoachPresent = headCoaches.length > 0;

    const otherCosts: SessionCost[] = [];
    const supportCoaches: SupportPay[] = [];
    for (const name of attendees) {
      const key = normalizeName(name);
      if (HEAD_COACHES.has(key)) continue;
      const expense = SESSION_EXPENSES[key];
      if (expense) { otherCosts.push({ label: expense.label, amount: expense.amount }); continue; }
      const rate = rateForCoach(name, payableEventFor(event.id, name, event), headCoachPresent);
      supportCoaches.push({ name, amount: rate.amount ?? 0, basis: rate.basis });
    }

    const supportCost = supportCoaches.reduce((s, c) => s + c.amount, 0);
    const otherCost = otherCosts.reduce((s, c) => s + c.amount, 0);
    const facilityCost = facilityCostFor(event);
    const profit = revenue - facilityCost - supportCost - otherCost;

    const eligible = gyauEligible(event);
    const attended = attendees.some(n => normalizeName(n) === GYAU);
    // His share never goes negative on a session that lost money.
    const shareRate = attended ? GYAU_ATTENDED_SHARE : GYAU_ABSENT_SHARE;
    const gyauShare = eligible ? Math.max(0, profit) * shareRate : 0;

    sessions.push({
      id: event.id,
      title: event.title,
      startDateTime: event.startDateTime,
      dateOnly: event.dateOnly,
      headCoaches,
      supportCoaches,
      supportCost,
      facility: facilityLabel(event.location),
      facilityCost,
      otherCosts,
      otherCost,
      revenue,
      profit,
      gyauShare,
      gyauAttended: attended,
      gyauEligible: eligible,
    });
  }

  // ── Coach view ──
  const rows: PayoutRow[] = [];

  for (const session of sessions) {
    const supportNames = session.supportCoaches.map(c => c.name);

    for (const support of session.supportCoaches) {
      rows.push({
        id: `${session.id}::${normalizeName(support.name)}`,
        coach: support.name,
        sessionTitle: session.title,
        startDateTime: session.startDateTime,
        dateOnly: session.dateOnly,
        facility: session.facility,
        facilityCost: session.facilityCost,
        supportCoaches: null,
        supportCost: null,
        revenue: session.revenue,
        payment: support.amount,
        basis: support.basis,
        attended: true,
      });
    }

    // Gyau earns from every eligible session, whether or not he was there.
    if (!session.gyauEligible) continue;
    if (!session.gyauAttended && session.revenue <= 0) continue;
    const net = Math.max(0, session.profit);
    rows.push({
      id: `${session.id}::${GYAU}`,
      coach: gyauDisplayName,
      sessionTitle: session.title,
      startDateTime: session.startDateTime,
      dateOnly: session.dateOnly,
      facility: session.facility,
      facilityCost: session.facilityCost,
      supportCoaches: supportNames,
      supportCost: session.supportCost,
      revenue: session.revenue,
      payment: session.gyauShare,
      basis: session.gyauAttended
        ? `50% of $${net.toFixed(2)} net (attended)`
        : `30% of $${net.toFixed(2)} net (did not attend)`,
      attended: session.gyauAttended,
    });
  }

  rows.sort((a, b) => Date.parse(b.startDateTime) - Date.parse(a.startDateTime));
  sessions.sort((a, b) => Date.parse(b.startDateTime) - Date.parse(a.startDateTime));

  const byCoach = new Map<string, { coach: string; total: number | null; sessions: number }>();
  for (const row of rows) {
    const key = normalizeName(row.coach);
    const entry = byCoach.get(key) ?? { coach: row.coach, total: 0 as number | null, sessions: 0 };
    entry.sessions += 1;
    if (row.payment === null) entry.total = null;
    else if (entry.total !== null) entry.total += row.payment;
    byCoach.set(key, entry);
  }
  const totalsByCoach = Array.from(byCoach.values()).sort(
    (a, b) => (b.total ?? -1) - (a.total ?? -1) || a.coach.localeCompare(b.coach)
  );

  return {
    rows,
    sessions,
    builtAt: data.builtAt,
    totalsByCoach,
    grandTotal: rows.reduce((s, r) => s + (r.payment ?? 0), 0),
  };
}
