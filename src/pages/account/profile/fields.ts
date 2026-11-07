import type { EditorType } from './EditFieldModal';

// What the app's Profile screen shows for each account type
// (screens/main/account/settings/ProfileScreen.tsx): its sections, labels,
// order and pickers. Each field points at the attribute that actually exists
// in that Appwrite collection — where the app's screen names an attribute the
// collection doesn't have, the real one is used instead:
//   collegiate "College"           → currentCollege (app: college)
//   collegiate "Professional Club" → club           (app: professionalClub)
//   professional "Graduation Year" → gradYear       (app: graduationYear)
//   coach "Coaching Experience"    → coachingPositions (app: coachingExperience)
// Positions are a string array in every player collection, so they're saved
// as an array (the app's modal joins them into one string).

export const POSITION_OPTIONS = [
  { label: 'Goalkeeper (GK)', value: 'GK' },
  { label: 'Centre Back (CB)', value: 'CB' },
  { label: 'Full Back (RB/LB)', value: 'RB/LB' },
  { label: 'Wing Back (RWB/LWB)', value: 'RWB/LWB' },
  { label: 'Defensive Midfielder (DM)', value: 'DM' },
  { label: 'Centre Midfielder (CM)', value: 'CM' },
  { label: 'Attacking Midfielder (AM)', value: 'AM' },
  { label: 'Wide Midfielder (RM/LM)', value: 'RM/LM' },
  { label: 'Winger (RW/LW)', value: 'RW/LW' },
  { label: 'Striker (ST)', value: 'ST' },
];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

export const AGE_GROUP_OPTIONS = range(2005, 2022);
export const LEAGUE_OPTIONS = ['MLS Next PRO', 'MLS Next', 'MLS Next II', 'ECNL', 'NAL', 'USYS NL', 'ECNL RL', 'NAL RL', 'EDP', 'GA', 'CCL', 'REC'];
export const GRAD_YEAR_OPTIONS = range(2010, 2040);
export const LEVEL_OPTIONS = ['Senior Team', 'U-23', 'U-22', 'U-21', 'U-20', 'U-19', 'U-18', 'U-17', 'U-16', 'U-15', 'U-14', 'U-13'];
export const COLLEGE_YEAR_OPTIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior', '5th Year'];
export const LICENSE_OPTIONS = ['UEFA Pro', 'UEFA A', 'UEFA B', 'USSF A', 'USSF B', 'USSF C', 'Grassroots', 'None'];
export const EXPERIENCE_YEARS_OPTIONS = ['0-1', '1-3', '3-5', '5-10', '10-15', '15-20', '20+'];

export interface FieldSpec {
  field: string;
  label: string;
  type: EditorType;
  title: string;
  options?: string[];
}

export interface SectionSpec {
  title?: string;
  /** Rows of fields; a row with two fields sits side by side. */
  rows: FieldSpec[][];
}

const positions: FieldSpec = { field: 'positions', label: 'Position(s)', type: 'position', title: 'Edit Position(s)' };
const nationalTeam: SectionSpec = {
  title: 'National Team',
  rows: [[
    { field: 'nation', label: 'Nation', type: 'nation', title: 'Edit Nation' },
    { field: 'level', label: 'Level', type: 'dropdown', title: 'Edit Level', options: LEVEL_OPTIONS },
  ]],
};

export const YOUTH_SECTIONS: SectionSpec[] = [
  { rows: [[positions]] },
  {
    title: 'Club',
    rows: [
      [{ field: 'currentClub', label: 'Current Club', type: 'youthClub', title: 'Edit Current Club' }],
      [
        { field: 'ageGroup', label: 'Age Group', type: 'dropdown', title: 'Edit Age Group', options: AGE_GROUP_OPTIONS },
        { field: 'league', label: 'League', type: 'dropdown', title: 'Edit League', options: LEAGUE_OPTIONS },
      ],
    ],
  },
  {
    title: 'School',
    rows: [[
      { field: 'school', label: 'School', type: 'school', title: 'Edit School' },
      { field: 'gradYear', label: 'Graduation Year', type: 'dropdown', title: 'Edit Graduation Year', options: GRAD_YEAR_OPTIONS },
    ]],
  },
  {
    title: 'Professional Club',
    rows: [[{ field: 'club', label: 'Professional Club', type: 'club', title: 'Edit Professional Club' }]],
  },
  nationalTeam,
];

export const COLLEGIATE_SECTIONS: SectionSpec[] = [
  { rows: [[positions]] },
  {
    title: 'School',
    rows: [[
      { field: 'currentCollege', label: 'College', type: 'college', title: 'Edit College' },
      { field: 'year', label: 'Year', type: 'dropdown', title: 'Edit Year', options: COLLEGE_YEAR_OPTIONS },
    ]],
  },
  {
    title: 'Clubs',
    rows: [[
      { field: 'youthClub', label: 'Youth Club', type: 'youthClub', title: 'Edit Youth Club' },
      { field: 'club', label: 'Professional Club', type: 'club', title: 'Edit Professional Club' },
    ]],
  },
  nationalTeam,
];

export const PROFESSIONAL_SECTIONS: SectionSpec[] = [
  { rows: [[{ field: 'currentClub', label: 'Current Club', type: 'club', title: 'Edit Current Club' }]] },
  {
    title: 'Player Info',
    rows: [[
      positions,
      { field: 'youthClub', label: 'Youth Club', type: 'youthClub', title: 'Edit Youth Club' },
    ]],
  },
  nationalTeam,
  {
    title: 'College',
    rows: [[
      { field: 'college', label: 'College', type: 'college', title: 'Edit College' },
      { field: 'gradYear', label: 'Graduation Year', type: 'dropdown', title: 'Edit Graduation Year', options: GRAD_YEAR_OPTIONS },
    ]],
  },
];

export const COACH_EXPERIENCE: { field: string; title: string }[] = [
  { field: 'playingExperience', title: 'Playing Experience' },
  { field: 'coachingPositions', title: 'Coaching Experience' },
];

export const COACH_CREDENTIALS: FieldSpec[] = [
  { field: 'experience', label: 'Years', type: 'dropdown', title: 'Edit Years of Experience', options: EXPERIENCE_YEARS_OPTIONS },
  { field: 'license', label: 'License Type', type: 'dropdown', title: 'Edit License Type', options: LICENSE_OPTIONS },
];

export const sectionsFor = (type: string | null | undefined): SectionSpec[] =>
  type === 'collegiate' ? COLLEGIATE_SECTIONS : type === 'professional' ? PROFESSIONAL_SECTIONS : YOUTH_SECTIONS;

/** The app's displayValue: empty → "None"; lists are comma separated. */
export const displayValue = (v: any): string => {
  if (Array.isArray(v)) return v.filter(Boolean).join(', ') || 'None';
  if (v === null || v === undefined) return 'None';
  const s = String(v).trim();
  return s === '' || s === 'undefined' || s === 'null' ? 'None' : s;
};

/** The club line under the name in the profile header. */
export const headerClub = (type: string | null | undefined, doc: any): string =>
  (type === 'collegiate' ? doc?.currentCollege || doc?.college : doc?.currentClub) || '';

export const TYPE_LABELS: Record<string, string> = {
  youth: 'Youth Player',
  collegiate: 'Collegiate Player',
  professional: 'Professional Player',
  coach: 'Coach',
  parent: 'Parent',
};

/** The account types the app's Switch Account Type modal offers from each type. */
export const SWITCH_TARGETS: Record<string, string[]> = {
  youth: ['collegiate', 'professional', 'coach', 'parent'],
  collegiate: ['professional', 'coach', 'parent'],
  professional: ['collegiate', 'coach', 'parent'],
  coach: ['collegiate', 'professional', 'parent'],
  parent: ['coach'],
};
