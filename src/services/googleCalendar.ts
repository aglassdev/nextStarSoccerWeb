import { functions } from "./appwrite";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  dateOnly?: boolean;
}

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

  // Appwrite function call — only for the PRIVATE calendar
  private async fetchPrivateCalendarEvents(year: number, month: number): Promise<CalendarEvent[]> {
    console.log(`🔒 Fetching private calendar via Appwrite: ${year}-${month + 1}`);

    const payload = {
      service: "google-calendar",
      action: "getEventsForMonth",
      year,
      month,
      calendarType: "private",
    };

    const response = await functions.createExecution(
      this.FUNCTION_ID,
      JSON.stringify(payload),
      false
    );

    if (response.status !== "completed" || response.responseStatusCode !== 200) {
      console.error("❌ Appwrite function failed for private calendar");
      return [];
    }

    const result = JSON.parse(response.responseBody);
    if (!result.success) {
      console.error("❌ Private calendar API error:", result.error);
      return [];
    }

    const rawEvents = result.data || [];
    console.log(`✅ Got ${rawEvents.length} private events`);
    return rawEvents.map((e: any) => this.transformCalendarEvent(e));
  }

  async getEventsForMonth(
    year: number,
    month: number,
    calendarType: "public" | "private" = "public"
  ): Promise<CalendarEvent[]> {
    try {
      if (calendarType === "private") {
        return await this.fetchPrivateCalendarEvents(year, month);
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
    const today = now.toISOString().split("T")[0];
    return events.filter((event) => event.startDateTime.split("T")[0] === today);
  }

  async getCurrentMonthEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    return await this.getEventsForMonth(now.getFullYear(), now.getMonth());
  }
}

export const googleCalendarService = new GoogleCalendarService();
export default googleCalendarService;
