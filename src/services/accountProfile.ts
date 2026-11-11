import { databases, databaseId, collections } from './appwrite';
import { resolveUserStripeContext, UserType } from './payment/paymentApi';
import { ACCOUNTS_LIVE } from '../constants/features';
import { isAdminUser } from '../constants/staffRoles';

export interface AccountInfo {
  /** The profile that pays and owns bills: parent first, then player, then coach. */
  userType: UserType | null;
  profile: any | null;
  collectionId: string | null;
  /** Has a Coaches doc (player+coach hybrids included), keyed by userId as in the app. */
  isCoach: boolean;
  isAdmin: boolean;
}

async function coachDoc(userId: string): Promise<any | null> {
  try {
    return await databases.getDocument(databaseId, collections.coaches, userId);
  } catch {
    return null;
  }
}

/**
 * Who a signed-in account is, the same way the app works it out: the first
 * profile collection with a doc for them, plus whether they also coach.
 */
export async function resolveAccount(userId: string, labels?: string[]): Promise<AccountInfo> {
  const [ctx, coach] = await Promise.all([resolveUserStripeContext(userId), coachDoc(userId)]);
  return {
    userType: ctx.userType,
    profile: ctx.profile,
    collectionId: ctx.collectionId,
    isCoach: !!coach,
    // Admin access comes from the account's labels (Development → Staff Access).
    isAdmin: isAdminUser({ labels }),
  };
}

/** The web coach dashboard (/coach) is part of website accounts. */
export const COACH_DASHBOARD_LIVE = ACCOUNTS_LIVE;

/** A coach with no parent or player profile goes to the coach dashboard. */
export const isPureCoach = (a: AccountInfo) => a.isCoach && (a.userType === 'coach' || a.userType === null);

/** Where someone lands after signing in. */
export const homePathFor = (a: AccountInfo) => (COACH_DASHBOARD_LIVE && isPureCoach(a) ? '/coach' : '/account');
