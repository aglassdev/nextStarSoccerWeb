// For now every camp uses the higher-res photos from the old home page
// collage, three each; swap in the camp's own photos here.
const collage = (n: number) => `/assets/images/collage${n}.webp`;

export interface CampSession {
  label: string;
  time: string;
  /** For camps sold on the website: the group the player signs up to. */
  key?: 'youth' | 'college';
}

export interface CampWeek {
  label: string;
  dates: string;
}

export interface CampLocation {
  name: string;
  address: string;
  city: string;
}

/** One camp day: each group's time and where it trains that day. */
export interface CampDay {
  /** YYYY-MM-DD */
  date: string;
  groups: { label: string; time: string; place: string }[];
}

export interface Camp {
  id: string;
  slug: string;
  name: string;
  isNike: boolean;
  /** The card's photo (the first) and the three across the top of the camp's page. */
  photos: string[];
  heroDateRange: string;
  /** Where the camp is (the cards, the register card and checkout show this one). */
  location: CampLocation;
  /** Other places the camp uses on some days (the schedule says which). */
  moreLocations?: CampLocation[];
  weeks: CampWeek[];
  sessions: CampSession[];
  /** Day by day, when the times or places change from day to day. */
  schedule?: CampDay[];
  /** The short price shown on the card and in the camp's details. */
  priceSummary: string;
  pricing: string;
  pricingNote: string;
  description: string;
  itemsToBring: string;
  /** 'web': registered and paid for on the website (account required). */
  registerType: 'in-app' | 'nike' | 'web';
  nikeUrl?: string;
  /** registerType 'web': the camp id the checkout and register-clinic know it by. */
  checkoutId?: string;
  /** Last camp day (YYYY-MM-DD, Eastern); registration closes after it. */
  endDate?: string;
  /** Week shown in checkout, e.g. "November 23 – 27, 2026". */
  weekLabel?: string;
}

export const camps: Camp[] = [
  {
    // Same camp as the app's FallCampScreen. Prices, days and the calendar
    // events it signs players up to live in the register-clinic function
    // (which has this schedule too, for the confirmation email).
    id: 'fall',
    slug: 'fall',
    name: 'Next Star Fall Camp',
    isNike: false,
    photos: [collage(10), collage(2), collage(8)],
    heroDateRange: 'November 23 – 27, 2026',
    location: {
      name: 'Lewinsville Park',
      address: '1659 Chain Bridge Rd, McLean, VA 22101',
      city: 'McLean, VA',
    },
    moreLocations: [
      {
        name: 'Somerset Elementary School',
        address: '5811 Warwick Pl, Chevy Chase, MD 20815',
        city: 'Chevy Chase, MD',
      },
    ],
    weeks: [{ label: 'Week', dates: 'November 23 – November 27' }],
    // Shown under each group in checkout. The day-by-day schedule is below.
    sessions: [
      {
        label: 'Youth Group',
        time: 'Mon–Wed: 12:00 – 2:00 PM, Somerset ES\nThu–Fri: 10:00 AM – 12:00 PM, Lewinsville Park',
        key: 'youth',
      },
      { label: 'Pro/College Group', time: '10:00 AM – 12:00 PM, Lewinsville Park', key: 'college' },
    ],
    schedule: [
      ...['2026-11-23', '2026-11-24', '2026-11-25'].map((date) => ({
        date,
        groups: [
          { label: 'Pro/College Group', time: '10:00 AM – 12:00 PM', place: 'Lewinsville Park' },
          { label: 'Youth Group', time: '12:00 PM – 2:00 PM', place: 'Somerset Elementary School' },
        ],
      })),
      ...['2026-11-26', '2026-11-27'].map((date) => ({
        date,
        groups: [
          { label: 'Pro/College Group', time: '10:00 AM – 12:00 PM', place: 'Lewinsville Park' },
          { label: 'Youth Group', time: '10:00 AM – 12:00 PM', place: 'Lewinsville Park' },
        ],
      })),
    ],
    priceSummary: '$250 / week · $60 / day',
    pricing: 'Full Week: $250\nIndividual Day: $60 / day (drop-in)\nCancellation and rebooking available',
    pricingNote: 'Ages 6-21 · Coed · All skill levels',
    description:
      "Join us for our Fall Camp at Lewinsville Park in McLean, VA. Under Howard Men's Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress. We look forward to seeing you!",
    itemsToBring:
      'Soccer ball, soccer cleats, water bottle.',
    registerType: 'web',
    checkoutId: 'fall-camp-2026',
    endDate: '2026-11-27',
    weekLabel: 'November 23 – 27, 2026',
  },
  {
    id: 'lewinsville',
    slug: 'lewinsville',
    name: 'Next Star Summer Camp Session 1',
    isNike: false,
    photos: [collage(6), collage(3), collage(7)],
    heroDateRange: 'June 1 – June 19, 2026',
    location: {
      name: 'Lewinsville Park',
      address: '1659 Chain Bridge Rd, McLean, VA 22101',
      city: 'McLean, VA',
    },
    weeks: [
      { label: 'Week 1', dates: 'June 1 – June 5' },
      { label: 'Week 2', dates: 'June 8 – June 12' },
      { label: 'Week 3', dates: 'June 15 – June 19' },
    ],
    sessions: [
      { label: 'Youth Group', time: '10:00 AM – 12:00 PM' },
      { label: 'Pro/College Group', time: '10:00 AM – 12:00 PM' },
    ],
    priceSummary: '$250 / week · $60 / day',
    pricing: 'Individual Day: $60 / day\nFull Week: $50 / day ($250)',
    pricingNote: 'All ages · Coed · All skill levels',
    description:
      'Start the summer off right at our Summer Camp at Lewinsville Park in McLean, VA. Under Howard Men\'s Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress. We look forward to seeing you!',
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack.',
    registerType: 'in-app',
    endDate: '2026-06-19',
  },
  {
    id: 'howard',
    slug: 'howard',
    name: 'Next Star × Nike Summer Camp',
    isNike: true,
    photos: [collage(1), collage(9), collage(4)],
    heroDateRange: 'June 22 – July 10, 2026',
    location: {
      name: 'Howard University – Greene Stadium',
      address: '6th and Girard St NW, Washington, DC 20059',
      city: 'Washington, DC',
    },
    weeks: [
      { label: 'Week 1', dates: 'June 22 – June 26' },
      { label: 'Week 2', dates: 'June 29 – July 3' },
      { label: 'Week 3', dates: 'July 6 – July 10' },
    ],
    sessions: [
      { label: 'Half-Day', time: '9:00 AM – 12:00 PM' },
      { label: 'Full-Day', time: '9:00 AM – 3:00 PM' },
    ],
    priceSummary: 'From $299 / week',
    pricing: 'Half-Day: $299 / week | $80 / day\nFull-Day: $429 / week | $115 / day',
    pricingNote: 'Ages 6-18 · Coed · All skill levels',
    description:
      'Join us for our Next Star Soccer Camp in partnership with Nike at Howard University in Washington, D.C. Under Howard Men\'s Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress.',
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack. All campers receive a Nike Soccer Camps t-shirt! Nike Soccer Camp Balls can be purchased during registration.',
    registerType: 'nike',
    endDate: '2026-07-10',
    nikeUrl:
      'https://www.ussportscamps.com/soccer/nike/nike-soccer-camp-next-star-howard-university-washington-dc',
  },
  {
    id: 'whitman',
    slug: 'whitman',
    name: 'Next Star Summer Camp Session 2',
    isNike: false,
    photos: [collage(5), collage(7), collage(2)],
    heroDateRange: 'July 13 – August 14, 2026',
    location: {
      name: 'Walt Whitman High School',
      address: '7100 Whittier Blvd, Bethesda, MD 20817',
      city: 'Bethesda, MD',
    },
    weeks: [
      { label: 'Week 1', dates: 'July 13 – July 17' },
      { label: 'Week 2', dates: 'August 3 – August 7' },
      { label: 'Week 3', dates: 'August 10 – August 14' },
    ],
    sessions: [
      { label: 'Youth Group', time: '8:00 AM – 11:00 AM' },
      { label: 'Pro/College Group', time: '8:00 AM – 11:00 AM' },
    ],
    priceSummary: '$250 / week · $60 / day',
    pricing: 'Individual Day: $60 / day\nFull Week: $50 / day ($250)',
    pricingNote: 'Ages 6-21 · Coed · All skill levels',
    description:
      'Join us for our summer Soccer Camp at Walt Whitman HS in Bethesda, MD. Under Howard Men\'s Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress. We look forward to seeing you!',
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack.',
    registerType: 'in-app',
    endDate: '2026-08-14',
  },
  {
    id: 'sofive',
    slug: 'sofive',
    name: 'Next Star × Nike Summer Camp',
    isNike: true,
    photos: [collage(4), collage(6), collage(9)],
    heroDateRange: 'July 20 – July 31, 2026',
    location: {
      name: 'Sofive Rockville',
      address: '1008 Westmore Ave, Rockville, MD 20850',
      city: 'Rockville, MD',
    },
    weeks: [
      { label: 'Week 1', dates: 'July 20 – July 24' },
      { label: 'Week 2', dates: 'July 27 – July 31' },
    ],
    sessions: [
      { label: 'Half-Day', time: '9:00 AM – 12:00 PM' },
      { label: 'Full-Day', time: '9:00 AM – 3:00 PM' },
    ],
    priceSummary: 'From $309 / week',
    pricing: 'Half-Day: $309 / week\nFull-Day: $439 / week',
    pricingNote: 'Ages 6-18 · Coed · All skill levels',
    description:
      'Join us for our Next Star Soccer Camp in partnership with Nike at Sofive Rockville, an indoor air-conditioned facility. Under Howard Men\'s Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress.',
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack. All campers receive a Nike Soccer Camps t-shirt! Nike Soccer Camp Balls can be purchased during registration.',
    registerType: 'nike',
    endDate: '2026-07-31',
    nikeUrl: 'https://www.ussportscamps.com/soccer/nike/nike-soccer-camp-sofive-rockville',
  },
  {
    id: 'somerset',
    slug: 'somerset',
    name: 'Next Star Summer Camp Session 3',
    isNike: false,
    photos: [collage(3), collage(5), collage(1)],
    heroDateRange: 'August 17 – September 4, 2026',
    location: {
      name: 'Somerset Elementary School',
      address: '5811 Warwick Pl, Chevy Chase, MD 20815',
      city: 'Chevy Chase, MD',
    },
    weeks: [
      { label: 'Week 1', dates: 'August 17 – August 21' },
      { label: 'Week 2', dates: 'August 24 – August 28' },
      { label: 'Week 3', dates: 'August 31 – September 4' },
    ],
    sessions: [
      { label: 'Youth Group', time: '8:00 AM – 11:00 AM' },
      { label: 'Pro/College Group', time: '8:00 AM – 11:00 AM' },
    ],
    priceSummary: '$250 / week · $60 / day',
    pricing: 'Individual Day: $60 / day\nFull Week: $50 / day ($250)',
    pricingNote: 'Ages 6-21 · Coed · All skill levels',
    description:
      'Join us for our summer Soccer Camp at Somerset Elementary School in Chevy Chase, MD. Under Howard Men\'s Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress. We look forward to seeing you!',
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack.',
    registerType: 'in-app',
    endDate: '2026-09-04',
  },
  {
    // The app's SpringCampScreen (dates as its checkout and camps list have them).
    id: 'spring',
    slug: 'spring',
    name: 'Next Star Spring Camp',
    isNike: false,
    photos: [collage(9), collage(7), collage(3)],
    heroDateRange: 'March 30 – April 3, 2026',
    location: {
      name: 'Walt Whitman High School',
      address: '7100 Whittier Blvd, Bethesda, MD 20817',
      city: 'Bethesda, MD',
    },
    weeks: [{ label: 'Week', dates: 'March 30 – April 3' }],
    sessions: [{ label: 'All levels', time: '8:00 AM – 11:00 AM' }],
    priceSummary: '$50 / day',
    pricing: 'Individual Day: $50 / day\nCancellation and rebooking available',
    pricingNote: 'All ages · Coed · All skill levels',
    description:
      "Join us over spring break for Soccer Camp at Walt Whitman HS in Bethesda, MD. Under Howard Men's Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress. We look forward to seeing you!",
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack.',
    registerType: 'in-app',
    endDate: '2026-04-03',
  },
  {
    // The app's WinterCampScreen.
    id: 'winter',
    slug: 'winter',
    name: 'Next Star Winter Camp',
    isNike: false,
    photos: [collage(8), collage(2), collage(10)],
    heroDateRange: 'December 22, 2025 – January 2, 2026',
    location: {
      name: 'Lewinsville Park',
      address: '1659 Chain Bridge Rd, McLean, VA 22101',
      city: 'McLean, VA',
    },
    weeks: [
      { label: 'Week 1', dates: 'December 22 – December 26' },
      { label: 'Week 2', dates: 'December 29 – January 2' },
    ],
    sessions: [{ label: 'All levels', time: '10:00 AM – 12:00 PM' }],
    priceSummary: '$50 / day',
    pricing: 'Individual Day: $50 / day\nCancellation and rebooking available',
    pricingNote: 'Ages 6-21 · Coed · All skill levels',
    description:
      "Brave the cold and join us at our Winter Camp at Lewinsville Park in McLean, VA. Under Howard Men's Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress. We look forward to seeing you!",
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack.',
    registerType: 'in-app',
    endDate: '2026-01-02',
  },
];

/** True once a camp's last day has passed (Eastern time). */
export const campHasEnded = (camp: Camp) =>
  !!camp.endDate && new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) > camp.endDate;
