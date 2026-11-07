import { ExecutionMethod } from 'appwrite';
import { functions } from '@/services/appwrite';
import { GooglePlacesService, GooglePlacesPrediction } from '@/services/googlePlaces';

// The suggestion sources behind the app's profile pickers
// (components/profile/modals): clubs from the Football API, schools from
// Google Places, colleges from the NCAA list. Club and school searches run
// through the same Appwrite function the app uses (secureApiKeyService.ts), so
// no API key is in the browser.

const SECURE_API_FUNCTION_ID = '68c373b50026f961bdc4';

export interface ClubSuggestion {
  id: string;
  name: string;
  displayName: string;
}

const clubCache = new Map<string, ClubSuggestion[]>();

/** Football API team search (needs 3+ characters, as in the app). */
export async function searchClubs(term: string, limit = 20): Promise<ClubSuggestion[]> {
  const q = term.trim();
  if (q.length < 3) return [];
  const key = q.toLowerCase();
  if (clubCache.has(key)) return clubCache.get(key)!;

  const res = await functions.createExecution(
    SECURE_API_FUNCTION_ID,
    JSON.stringify({ service: 'football-api', action: 'searchTeams', searchTerm: q }),
    false,
    '/',
    ExecutionMethod.POST,
  );
  if (res.status !== 'completed' || res.responseStatusCode !== 200) throw new Error('Club search failed');
  const body = JSON.parse(res.responseBody || '{}');
  if (!body.success) throw new Error(body.error || 'Club search failed');

  const teams: any[] = body.data?.response || [];
  const out = teams.slice(0, limit).map((t, i) => {
    const name = t.name || t.team?.name || 'Unknown Team';
    const country = t.country || t.team?.country || '';
    return {
      id: String(t.id ?? t.team?.id ?? `t-${i}`),
      name,
      displayName: country ? `${name} (${country})` : name,
    };
  });
  if (out.length) clubCache.set(key, out);
  return out;
}

// Same filter as the app's SchoolModal: a school keyword plus a school-like
// place type or a US address.
const isSchoolSuggestion = (s: GooglePlacesPrediction) => {
  const d = s.description.toLowerCase();
  const types = s.types || [];
  const keywords = ['school', 'college', 'university', 'academy', 'institute', 'education', 'elementary',
    'middle', 'high school', 'prep', 'preparatory', 'campus'];
  const schoolTypes = ['school', 'university', 'secondary_school', 'primary_school', 'establishment', 'point_of_interest'];
  const inUS = d.includes('usa') || d.includes('united states') || d.includes(', us') || d.includes('america')
    || /,\s[A-Z]{2}\s\d{5}/.test(s.description) || /,\s[A-Z]{2},\sUSA/.test(s.description);
  return keywords.some((k) => d.includes(k)) && (types.some((t) => schoolTypes.includes(t)) || inUS);
};

/** US schools via Google Places (needs 3+ characters). Returns school names. */
export async function searchSchools(term: string): Promise<{ id: string; name: string; description: string }[]> {
  if (term.trim().length <= 2) return [];
  const preds = await GooglePlacesService.getAutocompleteSuggestions(`${term} school`, 'establishment', {
    componentRestrictions: { country: 'us' },
  });
  return preds.filter(isSchoolSuggestion).map((p) => ({
    id: p.place_id,
    name: p.description.split(',')[0],
    description: p.description,
  }));
}

/** Street addresses via Google Places, for Account Details → Address. */
export const searchAddresses = (term: string) => GooglePlacesService.getAutocompleteSuggestions(term);
export const addressDetails = (placeId: string) => GooglePlacesService.getPlaceDetails(placeId);

let collegeList: string[] | null = null;

/** NCAA colleges (2+ characters), ranked like the app: prefix matches, then shorter names. */
export async function searchColleges(term: string): Promise<string[]> {
  const q = term.trim().toLowerCase();
  if (q.length < 2) return [];
  if (!collegeList) collegeList = (await import('./colleges')).default;
  return collegeList
    .filter((n) => n.toLowerCase().includes(q))
    .slice(0, 10)
    .sort((a, b) => {
      const as = a.toLowerCase().startsWith(q);
      const bs = b.toLowerCase().startsWith(q);
      if (as !== bs) return as ? -1 : 1;
      return a.length - b.length;
    });
}
