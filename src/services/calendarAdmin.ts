import { functions } from './appwrite';

// The same Appwrite function the mobile app uses; it holds the Google service
// account and is the only thing allowed to write to the calendars.
const APPWRITE_FUNCTION_ID = '68c373b50026f961bdc4';

export type CalendarType = 'public' | 'private' | 'analysis';

export interface CalendarEventData {
  title: string;
  location: string;
  description: string;
  startDateTime: string;  // "YYYY-MM-DDTHH:MM:SS", read as Eastern
  endDateTime: string;
}

export async function callCalendarFunction(action: string, payload: object): Promise<any> {
  let res: Awaited<ReturnType<typeof functions.createExecution>>;
  try {
    res = await functions.createExecution(
      APPWRITE_FUNCTION_ID,
      JSON.stringify({ service: 'google-calendar', action, ...payload }),
      false,
    );
  } catch (sdkErr: any) {
    throw new Error(`SDK error calling calendar function: ${sdkErr?.message || String(sdkErr)}`);
  }

  if (res.status !== 'completed' || res.responseStatusCode !== 200) {
    // A readable detail string so a failure can be diagnosed from the toast.
    const errText = (res.errors || '').trim();
    const bodyText = (res.responseBody || '').trim();
    const detail = errText || bodyText.slice(0, 400) || `status="${res.status}" code=${res.responseStatusCode}`;
    throw new Error(`Calendar function failed (${action}): ${detail}`);
  }
  if (!res.responseBody) throw new Error(`Calendar function returned empty body for action "${action}"`);

  let body: any;
  try {
    body = JSON.parse(res.responseBody);
  } catch {
    throw new Error(`Calendar function returned invalid JSON: ${res.responseBody.slice(0, 200)}`);
  }
  if (!body.success) throw new Error(body.error || 'Function returned success=false');
  return body;
}

export const updateCalendarEvent = (calendarType: CalendarType, eventId: string, eventData: CalendarEventData) =>
  callCalendarFunction('updateEvent', { calendarType, eventId, eventData });

export const createCalendarEvent = (calendarType: CalendarType, eventData: CalendarEventData) =>
  callCalendarFunction('createEvent', { calendarType, eventData });

export const deleteCalendarEvent = (calendarType: CalendarType, eventId: string) =>
  callCalendarFunction('deleteEvent', { calendarType, eventId });
