import { ExecutionMethod } from 'appwrite';
import { functions } from './appwrite';

// Same Appwrite function the mobile app uses (services/secureApiKeyService.ts).
// Routes service='google-places' to the Google Places REST API server-side.
const APPWRITE_FUNCTION_ID = '68c373b50026f961bdc4';

export interface GooglePlacesPrediction {
  description: string;
  place_id: string;
  reference?: string;
  matched_substrings?: { length: number; offset: number }[];
  terms?: { offset: number; value: string }[];
  types?: string[];
}

export interface GooglePlaceDetails {
  formatted_address?: string;
  name?: string;
  place_id?: string;
  geometry?: { location: { lat: number; lng: number } };
  address_components?: { long_name: string; short_name: string; types: string[] }[];
  types?: string[];
}

async function callPlacesFunction(payload: object): Promise<any> {
  const res = await functions.createExecution(
    APPWRITE_FUNCTION_ID,
    JSON.stringify(payload),
    false,
    '/',
    ExecutionMethod.POST,
  );
  if (res.status !== 'completed' || res.responseStatusCode !== 200) {
    throw new Error(`Places function failed (status ${res.responseStatusCode})`);
  }
  return JSON.parse(res.responseBody);
}

const cache = new Map<string, { data: GooglePlacesPrediction[]; ts: number }>();
const CACHE_MS = 5 * 60 * 1000;

export const GooglePlacesService = {
  async getAutocompleteSuggestions(
    input: string,
    types: string = 'establishment',
    options: { componentRestrictions?: { country: string }; language?: string } = {},
  ): Promise<GooglePlacesPrediction[]> {
    if (!input || input.trim().length < 2) return [];

    const key = `${input}-${types}-${JSON.stringify(options)}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_MS) return cached.data;

    try {
      const body = await callPlacesFunction({
        service: 'google-places',
        action: 'autocomplete',
        input,
        types,
        componentRestrictions: options.componentRestrictions,
        language: options.language || 'en',
      });

      const data = body.data || body;
      if (data?.status === 'OK' && Array.isArray(data.predictions)) {
        cache.set(key, { data: data.predictions, ts: Date.now() });
        return data.predictions;
      }
      return [];
    } catch (e) {
      console.error('Places autocomplete error:', e);
      return [];
    }
  },

  async getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
    try {
      const body = await callPlacesFunction({
        service: 'google-places',
        action: 'placeDetails',
        placeId,
        fields: ['formatted_address', 'geometry', 'name', 'address_components'],
      });
      const data = body.data || body;
      return data?.result || data || null;
    } catch (e) {
      console.error('Place details error:', e);
      return null;
    }
  },
};
