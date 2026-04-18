import { images } from './images';

export interface CampSession {
  label: string;
  time: string;
}

export interface CampWeek {
  label: string;
  dates: string;
}

export interface Camp {
  id: string;
  slug: string;
  name: string;
  isNike: boolean;
  image: string;
  heroDateRange: string;
  location: {
    name: string;
    address: string;
    city: string;
  };
  weeks: CampWeek[];
  sessions: CampSession[];
  pricing: string;
  pricingNote: string;
  description: string;
  itemsToBring: string;
  registerType: 'in-app' | 'nike';
  nikeUrl?: string;
}

export const camps: Camp[] = [
  {
    id: 'lewinsville',
    slug: 'lewinsville',
    name: 'Next Star Summer Camp Session 1',
    isNike: false,
    image: images.summerCampLewinsville,
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
    pricing: 'Individual Day: $60 / day\nFull Week: $50 / day ($250)',
    pricingNote: 'All ages · Coed · All skill levels',
    description:
      'Start the summer off right at our Summer Camp at Lewinsville Park in McLean, VA. Under Howard Men\'s Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress. We look forward to seeing you!',
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack.',
    registerType: 'in-app',
  },
  {
    id: 'howard',
    slug: 'howard',
    name: 'Next Star × Nike Summer Camp',
    isNike: true,
    image: images.summerCampHoward,
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
    pricing: 'Half-Day: $299 / week\nFull-Day: $429 / week',
    pricingNote: 'Ages 6-18 · Coed · All skill levels',
    description:
      'Join us for our Next Star Soccer Camp in partnership with Nike at Howard University in Washington, D.C. Under Howard Men\'s Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress.',
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack. All campers receive a Nike Soccer Camps t-shirt! Nike Soccer Camp Balls can be purchased during registration.',
    registerType: 'nike',
    nikeUrl:
      'https://www.ussportscamps.com/soccer/nike/nike-soccer-camp-next-star-howard-university-washington-dc',
  },
  {
    id: 'whitman',
    slug: 'whitman',
    name: 'Next Star Summer Camp Session 2',
    isNike: false,
    image: images.summerCampWhitman,
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
    pricing: 'Individual Day: $60 / day\nFull Week: $50 / day ($250)',
    pricingNote: 'Ages 6-21 · Coed · All skill levels',
    description:
      'Join us for our summer Soccer Camp at Walt Whitman HS in Bethesda, MD. Under Howard Men\'s Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress. We look forward to seeing you!',
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack.',
    registerType: 'in-app',
  },
  {
    id: 'sofive',
    slug: 'sofive',
    name: 'Next Star × Nike Summer Camp',
    isNike: true,
    image: images.summerCampSofive,
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
    pricing: 'Half-Day: $309 / week\nFull-Day: $439 / week',
    pricingNote: 'Ages 6-18 · Coed · All skill levels',
    description:
      'Join us for our Next Star Soccer Camp in partnership with Nike at Sofive Rockville, an indoor air-conditioned facility. Under Howard Men\'s Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress.',
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack. All campers receive a Nike Soccer Camps t-shirt! Nike Soccer Camp Balls can be purchased during registration.',
    registerType: 'nike',
    nikeUrl: 'https://www.ussportscamps.com/soccer/nike/nike-soccer-camp-sofive-rockville',
  },
  {
    id: 'somerset',
    slug: 'somerset',
    name: 'Next Star Summer Camp Session 3',
    isNike: false,
    image: images.summerCampSomerset,
    heroDateRange: 'August 17 – September 4, 2026',
    location: {
      name: 'Somerset Elementary School',
      address: '5710 Warwick Place, Chevy Chase, MD 20815',
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
    pricing: 'Individual Day: $60 / day\nFull Week: $50 / day ($250)',
    pricingNote: 'Ages 6-21 · Coed · All skill levels',
    description:
      'Join us for our summer Soccer Camp at Somerset Elementary School in Chevy Chase, MD. Under Howard Men\'s Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres, campers will get to learn, practice, improve, and have fun. Our curriculum is simple but proven, allowing every camper, no matter their age or skill level, to learn and continue to progress. We look forward to seeing you!',
    itemsToBring:
      'Athletic clothing, soccer cleats (no metal studs), soccer ball, shin guards (optional), water bottle, sunblock, gym bag or backpack.',
    registerType: 'in-app',
  },
];
