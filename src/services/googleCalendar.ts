import { Query } from "appwrite";
import { functions, databases, collections } from "./appwrite";

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  dateOnly?: boolean;
}

// Words that indicate cancellation — used to exclude those lines from coach detection.
const CANCEL_WORDS = new Set([
  "cancel", "cancelled", "canceled", "cancellation",
  "event cancelled", "event canceled", "session cancelled", "session canceled",
]);

const isCancelLine = (line: string): boolean => {
  const lower = line.toLowerCase();
  if (CANCEL_WORDS.has(lower)) return true;
  if (lower.startsWith("cancel")) return true;
  return lower.split(/\s+/).some(w => w === "cancel" || w === "cancelled" || w === "canceled" || w === "cancellation");
};

// Operational notes that live in the description but are not coach names.
const NON_COACH_NOTES = new Set(["backfilled session", "backfilled"]);

const isNonCoachLine = (line: string): boolean => {
  const lower = line.toLowerCase();
  if (NON_COACH_NOTES.has(lower)) return true;
  // Stray punctuation-only entries (e.g. a lone backslash) are not names.
  return !/[a-z]/i.test(line);
};

// Splits a description into candidate entries on the delimiters actually used
// (commas and newlines), dropping cancellation markers and operational notes.
const descriptionChunks = (description?: string): string[] => {
  if (!description) return [];
  return description
    .split(/[\n,]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !isCancelLine(l) && !isNonCoachLine(l));
};

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Coaches are entered inconsistently: comma-separated, newline-separated, or
// several names run together with only spaces ("Phillip Gyau Paul Torres").
// Splitting the last form needs a vocabulary of real names, and the coach
// roster alone is not enough — some regulars have no coach account. So we also
// learn names from the entries that are unambiguous on their own.
export const buildCoachNameVocabulary = (
  events: CalendarEvent[],
  roster: string[] = []
): string[] => {
  const vocab = new Map<string, string>();
  const add = (name: string) => {
    const key = normalize(name);
    if (key && !vocab.has(key)) vocab.set(key, name.trim());
  };
  roster.forEach(add);
  for (const event of events) {
    for (const chunk of descriptionChunks(event.description)) {
      if (wordCount(chunk) === 2) add(chunk);
    }
  }
  return Array.from(vocab.values());
};

// Pulls the coach names out of one description. `vocab` should come from
// buildCoachNameVocabulary so run-together entries can be separated.
export const getEventCoachesFromDescription = (
  event: CalendarEvent,
  vocab: string[] = []
): string[] => {
  const byLength = [...vocab].sort((a, b) => b.length - a.length);
  const lastNames = new Map<string, string[]>();
  for (const name of vocab) {
    const parts = name.split(/\s+/);
    if (parts.length < 2) continue;
    const last = normalize(parts[parts.length - 1]);
    lastNames.set(last, [...(lastNames.get(last) ?? []), name]);
  }

  const out: string[] = [];
  const push = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !out.some(n => normalize(n) === normalize(trimmed))) out.push(trimmed);
  };

  for (const chunk of descriptionChunks(event.description)) {
    if (wordCount(chunk) <= 2) { push(chunk); continue; }

    let rest = chunk;
    let guard = 0;
    while (rest.length > 0 && guard++ < 12) {
      const match = byLength.find(name => normalize(rest).startsWith(normalize(name)));
      if (match) {
        push(rest.slice(0, match.length));
        rest = rest.slice(match.length).trim();
        continue;
      }
      // No known name here: peel one token off and try to resolve a bare
      // surname ("Gyau") back to the full name when it is unambiguous.
      const [token, ...remaining] = rest.split(/\s+/);
      const candidates = lastNames.get(normalize(token));
      push(candidates?.length === 1 ? candidates[0] : token);
      rest = remaining.join(" ");
    }
  }
  return out;
};

// Resolves the coaches for each event, keyed by event id.
// Coach signups are authoritative; the Google Calendar description is only a
// fallback for events nobody has signed up to coach yet.
export const resolveEventCoaches = async (
  events: CalendarEvent[]
): Promise<Record<string, string[]>> => {
  if (events.length === 0) return {};

  const nameByUserId = new Map<string, string>();
  try {
    const res = await databases.listDocuments(databaseId, collections.coaches, [
      Query.limit(500),
    ]);
    for (const doc of res.documents as any[]) {
      const name = `${doc.firstName ?? ""} ${doc.lastName ?? ""}`.trim();
      if (doc.userId && name) nameByUserId.set(doc.userId, name);
    }
  } catch (error) {
    console.error("Failed to load coaches:", error);
  }

  const signedUpByEvent = new Map<string, string[]>();
  const eventIds = events.map(e => e.id);
  for (let i = 0; i < eventIds.length; i += 25) {
    const batch = eventIds.slice(i, i + 25);
    try {
      const res = await databases.listDocuments(databaseId, collections.coachSignups, [
        Query.equal("eventID", batch),
        Query.limit(200),
      ]);
      for (const doc of res.documents as any[]) {
        const name = nameByUserId.get(doc.coachUserId);
        if (!name) continue;
        const existing = signedUpByEvent.get(doc.eventID) ?? [];
        if (!existing.includes(name)) existing.push(name);
        signedUpByEvent.set(doc.eventID, existing);
      }
    } catch (error) {
      console.error("Failed to load coach signups:", error);
    }
  }

  const vocab = buildCoachNameVocabulary(events, [...nameByUserId.values()]);
  const result: Record<string, string[]> = {};
  for (const event of events) {
    const signedUp = signedUpByEvent.get(event.id);
    result[event.id] = signedUp?.length
      ? signedUp
      : getEventCoachesFromDescription(event, vocab);
  }
  return result;
};

export const isEventCancelled = (event: CalendarEvent): boolean => {
  if (!event.description) return false;

  const desc = event.description.trim().toLowerCase();
  const cancelVariants = [
    "cancel",
    "cancelled",
    "canceled",
    "cancellation",
    "event cancelled",
    "event canceled",
    "session cancelled",
    "session canceled",
  ];

  if (cancelVariants.includes(desc)) {
    return true;
  }

  if (desc.startsWith("cancel")) {
    return true;
  }

  const words = desc.split(/\s+/);
  return words.some(
    (word) =>
      word === "cancel" ||
      word === "cancelled" ||
      word === "canceled" ||
      word === "cancellation"
  );
};

// EST-aware date range helpers (mirrors the Appwrite function logic)
function getESTOffset(date: Date): string {
  // America/New_York: EST = -05:00, EDT = -04:00
  // EDT is in effect from 2nd Sunday in March to 1st Sunday in November
  const year = date.getFullYear();
  const marchSecondSunday = getNthSundayOfMonth(year, 2, 2); // March (month 2), 2nd Sunday
  const novFirstSunday = getNthSundayOfMonth(year, 10, 1);   // November (month 10), 1st Sunday
  const isDST = date >= marchSecondSunday && date < novFirstSunday;
  return isDST ? "-04:00" : "-05:00";
}

function getNthSundayOfMonth(year: number, month: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstSunday = new Date(year, month, 1 + ((7 - firstDay.getDay()) % 7));
  return new Date(year, month, firstSunday.getDate() + (n - 1) * 7);
}

function getMonthRangeEST(year: number, month: number): { timeMin: string; timeMax: string } {
  const lastDay = new Date(year, month + 1, 0).getDate();

  const startStr = `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00`;
  const endStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59`;

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  const startOffset = getESTOffset(startDate);
  const endOffset = getESTOffset(endDate);

  return {
    timeMin: `${startStr}${startOffset}`,
    timeMax: `${endStr}${endOffset}`,
  };
}

class GoogleCalendarService {
  private readonly FUNCTION_ID = "68c373b50026f961bdc4";
  private readonly PUBLIC_API_KEY = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
  private readonly PUBLIC_CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;

  private transformCalendarEvent(rawEvent: any): CalendarEvent {
    const title = rawEvent.summary || rawEvent.title || "Untitled Event";

    let startDateTime: string;
    let endDateTime: string;
    let dateOnly = false;

    if (rawEvent.start) {
      if (rawEvent.start.dateTime) {
        startDateTime = rawEvent.start.dateTime;
      } else if (rawEvent.start.date) {
        startDateTime = rawEvent.start.date + "T00:00:00";
        dateOnly = true;
      } else {
        startDateTime = new Date().toISOString();
      }
    } else {
      startDateTime = new Date().toISOString();
    }

    if (rawEvent.end) {
      if (rawEvent.end.dateTime) {
        endDateTime = rawEvent.end.dateTime;
      } else if (rawEvent.end.date) {
        endDateTime = rawEvent.end.date + "T23:59:59";
        dateOnly = true;
      } else {
        endDateTime = new Date().toISOString();
      }
    } else {
      endDateTime = new Date().toISOString();
    }

    return {
      id: rawEvent.id || `event-${Date.now()}`,
      title,
      description: rawEvent.description || undefined,
      location: rawEvent.location || undefined,
      startDateTime,
      endDateTime,
      dateOnly,
    };
  }

  // Direct Google Calendar API call — only for the PUBLIC calendar
  private async fetchPublicCalendarEvents(year: number, month: number): Promise<CalendarEvent[]> {
    const { timeMin, timeMax } = getMonthRangeEST(year, month);
    const calendarId = encodeURIComponent(this.PUBLIC_CALENDAR_ID);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${this.PUBLIC_API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

    console.log(`📅 Fetching public calendar directly: ${year}-${month + 1}`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Google Calendar API error: ${data.error.message}`);
    }

    const rawEvents = data.items || [];
    console.log(`✅ Got ${rawEvents.length} public events`);
    return rawEvents.map((e: any) => this.transformCalendarEvent(e));
  }

  // Appwrite function call — for PRIVATE or ANALYSIS calendars
  private async fetchPrivateOrAnalysisCalendarEvents(year: number, month: number, calendarType: "private" | "analysis"): Promise<CalendarEvent[]> {
    console.log(`🔒 Fetching ${calendarType} calendar via Appwrite: ${year}-${month + 1}`);

    const payload = {
      service: "google-calendar",
      action: "getEventsForMonth",
      year,
      month,
      calendarType,
    };

    const response = await functions.createExecution(
      this.FUNCTION_ID,
      JSON.stringify(payload),
      false
    );

    if (response.status !== "completed" || response.responseStatusCode !== 200) {
      console.error(`❌ Appwrite function failed for ${calendarType} calendar`);
      return [];
    }

    const result = JSON.parse(response.responseBody);
    if (!result.success) {
      console.error(`❌ ${calendarType} calendar API error:`, result.error);
      return [];
    }

    const rawEvents = result.data || [];
    console.log(`✅ Got ${rawEvents.length} ${calendarType} events`);
    return rawEvents.map((e: any) => this.transformCalendarEvent(e));
  }

  async getEventsForMonth(
    year: number,
    month: number,
    calendarType: "public" | "private" | "analysis" = "public"
  ): Promise<CalendarEvent[]> {
    try {
      if (calendarType === "private" || calendarType === "analysis") {
        return await this.fetchPrivateOrAnalysisCalendarEvents(year, month, calendarType);
      } else {
        return await this.fetchPublicCalendarEvents(year, month);
      }
    } catch (error) {
      console.error("❌ Error fetching calendar events:", error);
      return [];
    }
  }

  formatEventDateTime(startDateTime: string, endDateTime: string, dateOnly: boolean) {
    const startDate = new Date(startDateTime);
    const endDate = new Date(endDateTime);

    if (dateOnly) {
      return {
        date: startDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        time: "All Day",
        shortDate: startDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      };
    }

    const date = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const time = `${startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })} - ${endDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;

    const shortDate = startDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    return { date, time, shortDate };
  }

  async getTodaysEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const events = await this.getEventsForMonth(now.getFullYear(), now.getMonth());
    // Use local date components to avoid UTC day-flip issues in EDT/EST
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return events.filter((event) => event.startDateTime.split("T")[0] === today);
  }

  async getCurrentMonthEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    return await this.getEventsForMonth(now.getFullYear(), now.getMonth());
  }
}

export const googleCalendarService = new GoogleCalendarService();
export default googleCalendarService;
