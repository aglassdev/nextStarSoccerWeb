import { ExecutionMethod, Query } from 'appwrite';
import { functions, databases, databaseId, collections } from './appwrite';

// Function id is literally "register-clinic" (app repo: functions/register-clinic).
const REGISTER_CLINIC_FUNCTION_ID = 'register-clinic';

export interface ClinicPlayerRef {
  kind: 'self' | 'proxy' | 'real';
  id: string;
}

export interface GuestRegistration {
  role: 'parent' | 'player';
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  playerFirstName: string;
  playerLastName: string;
  /** YYYY-MM-DD from a date input */
  playerBirthDate: string;
  playerEmail?: string;
}

/**
 * Turn a paid PaymentIntent into clinic signups. Runs server-side: the payment
 * is verified with Stripe before anything is written, and calling it again for
 * the same payment never registers twice. Signed-in visitors pass `players`;
 * guests pass `guest` (the function sees no session and creates a guest player).
 */
export async function registerClinic(payload: {
  paymentIntentId: string;
  clinicId: string;
  days: string[];
  couponCode?: string;
  players?: ClinicPlayerRef[];
  guest?: GuestRegistration;
}): Promise<{ success: boolean; players?: string[]; emailed?: boolean }> {
  const execution = await functions.createExecution(
    REGISTER_CLINIC_FUNCTION_ID,
    JSON.stringify(payload),
    false,
    '/',
    ExecutionMethod.POST,
    { 'Content-Type': 'application/json' },
  );
  let body: any = {};
  try {
    body = JSON.parse(execution.responseBody || '{}');
  } catch {
    // fall through to the status check
  }
  if (execution.responseStatusCode !== 200 || !body.success) {
    throw new Error(body.error || `Registration failed (${execution.responseStatusCode})`);
  }
  return body;
}

/** "pi_123_secret_abc" → "pi_123" */
export const paymentIntentIdFromSecret = (clientSecret: string) =>
  String(clientSecret || '').split('_secret_')[0];

export interface ParentChild {
  kind: 'proxy' | 'real';
  id: string; // proxyId or the child's userId
  firstName: string;
  lastName: string;
}

/**
 * A parent's players, the same set the app offers: proxies they own, plus
 * proxies and real accounts linked through an active family relationship.
 */
export async function getParentChildren(parentUserId: string): Promise<ParentChild[]> {
  const out: ParentChild[] = [];
  const seen = new Set<string>();

  const owned = await databases.listDocuments(databaseId, collections.proxyChildren, [
    Query.equal('parentUserId', parentUserId),
    Query.limit(100),
  ]);
  for (const p of owned.documents as any[]) {
    const id = p.proxyId || p.$id;
    if (seen.has(id) || p.accountStatus === 'migrated') continue;
    seen.add(id);
    out.push({ kind: 'proxy', id, firstName: p.firstName, lastName: p.lastName });
  }

  try {
    const rels = await databases.listDocuments(databaseId, collections.familyRelationships001, [
      Query.equal('parentUserId', parentUserId),
      Query.equal('status', 'active'),
      Query.limit(100),
    ]);
    const playerCollections = [
      collections.youthPlayers,
      collections.collegiatePlayers,
      collections.professionalPlayers,
    ].filter(Boolean) as string[];

    for (const rel of rels.documents as any[]) {
      if (rel.childProxyId && !seen.has(rel.childProxyId)) {
        const r = await databases.listDocuments(databaseId, collections.proxyChildren, [
          Query.equal('proxyId', rel.childProxyId),
          Query.limit(1),
        ]);
        const p: any = r.documents[0];
        if (p && p.accountStatus !== 'migrated') {
          seen.add(rel.childProxyId);
          out.push({ kind: 'proxy', id: rel.childProxyId, firstName: p.firstName, lastName: p.lastName });
        }
      } else if (rel.childUserId && !seen.has(rel.childUserId)) {
        for (const collectionId of playerCollections) {
          const r = await databases.listDocuments(databaseId, collectionId, [
            Query.equal('userId', rel.childUserId),
            Query.limit(1),
          ]);
          const c: any = r.documents[0];
          if (c) {
            seen.add(rel.childUserId);
            out.push({ kind: 'real', id: rel.childUserId, firstName: c.firstName, lastName: c.lastName });
            break;
          }
        }
      }
    }
  } catch (e) {
    console.error('Could not load linked children:', e);
  }

  return out;
}
