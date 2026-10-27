import { findClinicCode } from './discountCodes';

/**
 * Pro clinics sold through /checkout/:slug.
 *
 * Kept in step with the app's constants/clinics.ts and the register-clinic
 * Appwrite function (same id, price and calendar event ids) — the function
 * rejects a payment whose amount doesn't match its own quote.
 */

export interface ClinicDay {
  /** YYYY-MM-DD */
  date: string;
  label: string; // "Saturday, October 31"
  shortLabel: string; // "Sat, Oct 31"
  eventId: string;
  startDateTime: string;
}

export interface Clinic {
  id: string;
  slug: string;
  name: string;
  image: string;
  heroDateRange: string;
  timeText: string;
  pricePerPlayerPerDay: number; // dollars
  location: { name: string; address: string; city: string };
  days: ClinicDay[];
  description: string;
  itemsToBring: string;
}

export const clinics: Clinic[] = [
  {
    id: 'dc-power-clinic',
    slug: 'dc-power-clinic',
    name: 'Next Star x DC Power Clinic',
    image: '/assets/images/dcPowerClinic.jpg',
    heroDateRange: 'October 31 – November 1, 2026',
    timeText: '10:00 AM – 12:00 PM',
    pricePerPlayerPerDay: 55,
    location: {
      name: 'Sofive Rockville',
      address: '1008 Westmore Ave, Rockville, MD 20850',
      city: 'Rockville, MD',
    },
    days: [
      {
        date: '2026-10-31',
        label: 'Saturday, October 31',
        shortLabel: 'Sat, Oct 31',
        eventId: 'mh8jbnc8j7vrtopbmlc85ovclk',
        startDateTime: '2026-10-31T10:00:00-04:00',
      },
      {
        date: '2026-11-01',
        label: 'Sunday, November 1',
        shortLabel: 'Sun, Nov 1',
        eventId: 'rt1vbf58qvjb5vccasoqvqr400',
        startDateTime: '2026-11-01T10:00:00-05:00',
      },
    ],
    description:
      "Train with Next Star Soccer in collaboration with DC Power at Sofive Rockville. DC Power players will be in attendance to talk with players, coach, and take pictures, and U.S. Women's National Team legend Briana Scurry will be joining us as a special guest. Every registration includes a ticket to a DC Power match, and if you come both days you'll receive 2 tickets, so one can be used by family or friends.",
    itemsToBring: 'Cleats or indoor turf shoes, soccer ball, and a water bottle.',
  },
];

/** A clinic day can be bought until the session starts. */
export const isClinicDayOpen = (day: ClinicDay, now: Date = new Date()) =>
  now.getTime() < new Date(day.startDateTime).getTime();

export const isClinicOver = (clinic: Clinic, now: Date = new Date()) =>
  !clinic.days.some((d) => isClinicDayOpen(d, now));

const PROCESSING_FEE_RATE = 0.03; // same 3% fee as every other checkout

export interface ClinicQuote {
  /** All amounts in cents. */
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  couponCode: string; // '' when no valid code
}

/** Price in cents — identical to the app's quoteClinic and register-clinic's quote. */
export function quoteClinic(
  clinic: Clinic,
  dayCount: number,
  playerCount: number,
  couponCode?: string,
): ClinicQuote {
  const subtotal = dayCount * playerCount * clinic.pricePerPlayerPerDay * 100;
  const code = couponCode ? findClinicCode(couponCode, clinic.id) : null;
  const discount = code ? Math.round(subtotal * code.rate) : 0;
  const net = subtotal - discount;
  const fee = Math.round(net * PROCESSING_FEE_RATE);
  return { subtotal, discount, fee, total: net + fee, couponCode: code ? code.code : '' };
}

export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
