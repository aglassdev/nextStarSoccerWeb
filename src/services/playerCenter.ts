import { functions } from './appwrite';
import { ADMIN_USER_IDS } from './accountProfile';
import type { User } from '../types';

// The Player Center in the Account Center: the Training Program and the
// Journal. Each is locked until an admin unlocks it for an account, which
// puts the resource's label on the account (the account-resources function
// does that, and serves the Training Program only to unlocked accounts).
// Admins can open everything.

const FUNCTION_ID = 'account-resources';

export type ResourceId = 'training-program' | 'journal';

/** The Appwrite label that unlocks each (letters and digits only). */
const LABELS: Record<ResourceId, string> = {
  'training-program': 'trainingprogram',
  journal: 'journal',
};

export const RESOURCES: { id: ResourceId; title: string; blurb: string; to: string }[] = [
  {
    id: 'training-program',
    title: 'Training Program 2026',
    blurb: 'The week day by day, conditioning, wellness, goal setting, the mental game, injury prevention and tips for every position.',
    to: '/account/player-center/training-program',
  },
  {
    id: 'journal',
    title: 'The Next Star Soccer Journal',
    blurb: 'Your daily training, game day and weekly review pages, to measure your progress and improve on it.',
    to: '/account/player-center/journal',
  },
];

/** The `admin` / `superadmin` label, or one of the admin accounts. */
export const isAdminUser = (user: User | null | undefined) =>
  !!user && (ADMIN_USER_IDS.includes(user.$id) || !!user.labels?.some((l) => l === 'admin' || l === 'superadmin'));

export const canOpen = (user: User | null | undefined, id: ResourceId) =>
  isAdminUser(user) || !!user?.labels?.includes(LABELS[id]);

export const canOpenAny = (user: User | null | undefined) => RESOURCES.some((r) => canOpen(user, r.id));

async function call<T>(payload: object): Promise<T> {
  const res = await functions.createExecution(FUNCTION_ID, JSON.stringify(payload), false);
  let body: any = {};
  try {
    body = JSON.parse(res.responseBody || '{}');
  } catch {
    // fall through to the error below
  }
  if (res.status !== 'completed' || !body.success) {
    throw new Error(body.error || 'Something went wrong. Please try again.');
  }
  return body as T;
}

// ── The Training Program ─────────────────────────────────────────────────────

export interface ProgramQuote { text: string; by: string }
export interface ProgramBlock { title?: string; lines: string[] }
export interface ProgramDay { day: string; short: string; note?: string; blocks: ProgramBlock[] }
export interface ProgramGroup { title: string; subtitle?: string; before?: string; items: string[] }
export interface ProgramSection {
  id: string;
  title: string;
  intro?: string;
  quoteTop?: ProgramQuote;
  groups: ProgramGroup[];
  quote?: ProgramQuote;
}
export interface TrainingProgram {
  title: string;
  year: number;
  contact: { name: string; phone: string; email: string };
  disclaimer: string;
  philosophy: { quote: string; by: string };
  note: { title: string; text: string; signoff: string };
  week: ProgramDay[];
  sections: ProgramSection[];
  selfAssessment: { title: string; intro: string; categories: string[]; weeks: number; focusLabel: string };
  closing: ProgramQuote;
}

let programCache: Promise<TrainingProgram> | null = null;

/** The Training Program (unlocked accounts and admins only), fetched once per visit. */
export function loadTrainingProgram(): Promise<TrainingProgram> {
  if (!programCache) {
    programCache = call<{ content: TrainingProgram }>({ action: 'get', resource: 'training-program' })
      .then((r) => r.content)
      .catch((e) => {
        programCache = null;
        throw e;
      });
  }
  return programCache;
}

// ── Admins: lock and unlock for an account ───────────────────────────────────

export type Unlocks = Record<ResourceId, boolean>;

export const getUnlocks = (userId: string) =>
  call<{ unlocked: Unlocks }>({ action: 'access', userId }).then((r) => r.unlocked);

export const setUnlocked = (userId: string, resource: ResourceId, unlocked: boolean) =>
  call<{ unlocked: Unlocks }>({ action: 'set', userId, resource, unlocked }).then((r) => r.unlocked);
