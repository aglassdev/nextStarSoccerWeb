import { CoachAttendanceData, normalizeName } from "./coachAttendance";
import { CalendarEvent } from "./googleCalendar";

// Payouts only cover sessions from this date onward; anything earlier is
// already settled. Anchored to Eastern time, where the season is scheduled.
export const PAYOUT_START = "2026-05-01T00:00:00-04:00";
const PAYOUT_START_MS = Date.parse(PAYOUT_START);

export const isWithinPayoutWindow = (event: CalendarEvent): boolean =>
  Date.parse(event.startDateTime) >= PAYOUT_START_MS;

// ── Rates ─────────────────────────────────────────────────────────────────────

// Hourly rate for the assistant coaches, i.e. anyone without a specific
// arrangement below. Paid on exact elapsed time, so 3h pays 3 × the rate.
export const DEFAULT_HOURLY = 25;

// Ryan Machado is hourly but at his own rates, higher for group sessions than
// for camps.
export const MACHADO_GROUP_HOURLY = 50;
export const MACHADO_CAMP_HOURLY = 25;

// Patrick Mullins is a flat rate per session.
export const MULLINS_PER_SESSION = 75;

// Guests booked as a session expense rather than on an hourly rate. They are
// recorded as attendance like any other coach, so the figure flows into the
// session's support cost and comes out of Gyau's net.
export const SESSION_EXPENSE_PER_SESSION: Record<string, number> = {
  peabo: 250,
};

// Phillip Gyau takes a share of what the session nets after facility hire and
// the other coaches on the session have been paid.
export const GYAU_ATTENDED_SHARE = 0.5;
export const GYAU_ABSENT_SHARE = 0.3;

// Facilities we pay to hire. Matched on the start of the calendar location, so
// the full postal address still resolves. Everything not listed is free.
export const FACILITY_COSTS: { match: string; label: string; flat: number }[] = [
  { match: "sofive", label: "Sofive Rockville", flat: 150 },
  { match: "bethesda soccer club", label: "Bethesda Soccer Club", flat: 150 },
];

const PAUL_TORRES = "paul torres";
const MACHADO = "ryan machado";
const MULLINS = "patrick mullins";
const GYAU = "phillip gyau";

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

export const isMullinsInAlexandria = (event: CalendarEvent): boolean =>
  lower(event.title).includes("mullins") && lower(event.location || "").includes("alexandria");

// Camps and group sessions are the only revenue Gyau shares in.
export const gyauEligible = (event: CalendarEvent): boolean => {
  if (isPrivateOrAnalysis(event.title)) return false;
  if (isWeekendAfternoon(event)) return false;
  if (isMullinsInAlexandria(event)) return false;
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

export const rateForCoach = (coachName: string, event: CalendarEvent): CoachRate => {
  const key = normalizeName(coachName);
  const hours = durationHours(event);
  const hoursLabel = hours ? `${hours % 1 ? hours.toFixed(1) : hours}h` : "duration unknown";

  if (key === PAUL_TORRES) return { amount: null, basis: "Not calculated" };
  if (key === MULLINS) return { amount: MULLINS_PER_SESSION, basis: "Flat per session" };

  const expense = SESSION_EXPENSE_PER_SESSION[key];
  if (expense !== undefined) return { amount: expense, basis: "Session expense" };

  if (key === MACHADO) {
    const rate = isCamp(event.title) ? MACHADO_CAMP_HOURLY : MACHADO_GROUP_HOURLY;
    return {
      amount: hours ? hours * rate : rate,
      basis: `${hoursLabel} × $${rate}${isCamp(event.title) ? " (camp)" : ""}`,
    };
  }

  return {
    amount: hours ? hours * DEFAULT_HOURLY : DEFAULT_HOURLY,
    basis: `${hoursLabel} × $${DEFAULT_HOURLY}`,
  };
};

// ── Rows ──────────────────────────────────────────────────────────────────────

export interface PayoutRow {
  id: string;
  coach: string;
  sessionTitle: string;
  startDateTime: string;
  dateOnly?: boolean;
  facility: string;
  facilityCost: number;
  // Only populated for Gyau and Paul Torres. Assistant coaches carry no
  // support cost of their own, so these stay null on their rows.
  supportCoaches: string[] | null;
  supportCost: number | null;
  revenue: number;
  payment: number | null;
  basis: string;
  attended: boolean;
}

export interface PayoutTable {
  rows: PayoutRow[];
  builtAt: string;
  totalsByCoach: { coach: string; total: number | null; sessions: number }[];
  grandTotal: number;
}

export function computePayoutTable(data: CoachAttendanceData): PayoutTable {
  const inWindow = data.events.filter(isWithinPayoutWindow);

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

  const rows: PayoutRow[] = [];
  const gyauAttended = new Set<string>();

  for (const event of events) {
    const attendees = attendeesFor(event.id);
    if (attendees.length === 0) continue;

    const facility = facilityLabel(event.location);
    const facilityCost = facilityCostFor(event);
    const revenue = revenueFor(event.id);

    // Support coaching cost is what the session pays out to coaches other than
    // Paul Torres, and other than Gyau whose share is derived from it.
    const supportCoaches = attendees.filter(n => {
      const k = normalizeName(n);
      return k !== PAUL_TORRES && k !== GYAU;
    });
    const supportCost = supportCoaches.reduce(
      (sum, n) => sum + (rateForCoach(n, payableEventFor(event.id, n, event)).amount ?? 0),
      0
    );

    for (const coach of attendees) {
      const key = normalizeName(coach);

      if (key === GYAU) {
        if (!gyauEligible(event)) continue;
        gyauAttended.add(event.id);
        const net = Math.max(0, revenue - facilityCost - supportCost);
        rows.push({
          id: `${event.id}::${key}`,
          coach,
          sessionTitle: event.title,
          startDateTime: event.startDateTime,
          dateOnly: event.dateOnly,
          facility,
          facilityCost,
          supportCoaches,
          supportCost,
          revenue,
          payment: net * GYAU_ATTENDED_SHARE,
          basis: `50% of $${net.toFixed(2)} net (attended)`,
          attended: true,
        });
        continue;
      }

      const rate = rateForCoach(coach, payableEventFor(event.id, coach, event));
      const showsSupport = key === PAUL_TORRES;
      rows.push({
        id: `${event.id}::${key}`,
        coach,
        sessionTitle: event.title,
        startDateTime: event.startDateTime,
        dateOnly: event.dateOnly,
        facility,
        facilityCost,
        supportCoaches: showsSupport ? supportCoaches : null,
        supportCost: showsSupport ? supportCost : null,
        revenue,
        payment: rate.amount,
        basis: rate.basis,
        attended: true,
      });
    }
  }

  // Gyau also shares in eligible sessions he did not coach.
  const gyauDisplayName =
    data.coaches.find(c => c.key === GYAU)?.name ?? "Phillip Gyau";

  for (const event of events) {
    if (gyauAttended.has(event.id)) continue;
    if (!gyauEligible(event)) continue;
    const revenue = revenueFor(event.id);
    if (revenue <= 0) continue;

    const attendees = attendeesFor(event.id);
    const supportCoaches = attendees.filter(n => {
      const k = normalizeName(n);
      return k !== PAUL_TORRES && k !== GYAU;
    });
    const supportCost = supportCoaches.reduce(
      (sum, n) => sum + (rateForCoach(n, payableEventFor(event.id, n, event)).amount ?? 0),
      0
    );
    const facilityCost = facilityCostFor(event);
    const net = Math.max(0, revenue - facilityCost - supportCost);

    rows.push({
      id: `${event.id}::${GYAU}`,
      coach: gyauDisplayName,
      sessionTitle: event.title,
      startDateTime: event.startDateTime,
      dateOnly: event.dateOnly,
      facility: facilityLabel(event.location),
      facilityCost,
      supportCoaches,
      supportCost,
      revenue,
      payment: net * GYAU_ABSENT_SHARE,
      basis: `30% of $${net.toFixed(2)} net (did not attend)`,
      attended: false,
    });
  }

  rows.sort((a, b) => Date.parse(b.startDateTime) - Date.parse(a.startDateTime));

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
    builtAt: data.builtAt,
    totalsByCoach,
    grandTotal: rows.reduce((s, r) => s + (r.payment ?? 0), 0),
  };
}
