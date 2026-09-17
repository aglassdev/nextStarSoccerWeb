import { ExecutionMethod } from 'appwrite';
import { functions, databases, databaseId, collections, paymentFunctions } from '../appwrite';
import { Query } from 'appwrite';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CreatePaymentIntentResult {
  // The Stripe PaymentIntent client secret (used to confirm the payment client-side)
  clientSecret: string;
  customerId?: string;
  ephemeralKey?: string;
  /** Set only when the backend already confirmed against a saved method. */
  status?: string;
  confirmed?: boolean;
}

export interface SavedPaymentMethod {
  id: string;
  /** Cards carry a brand; bank accounts carry a bank name and no expiry. */
  kind: 'card' | 'bank';
  brand: string; // "visa", "mastercard", or the bank name
  bankName?: string;
  accountType?: string;
  last4: string;
  expMonth: number;
  expYear: number;
  stripePaymentMethodId: string;
}

export type UserType = 'parent' | 'youth' | 'collegiate' | 'professional' | 'coach';

export interface UserStripeContext {
  stripeId: string | null;
  userType: UserType | null;
  collectionId: string | null;
  profile: any | null;
}

// ── Helper: execute an Appwrite Function with a JSON body (POST) ────────────────
async function callFunction<T = any>(functionId: string, payload: Record<string, any>): Promise<T> {
  if (!functionId) {
    throw new Error('Payment function is not configured. Check environment variables.');
  }
  const execution = await functions.createExecution(
    functionId,
    JSON.stringify(payload),
    false,
    '/',
    ExecutionMethod.POST,
    { 'Content-Type': 'application/json' },
  );

  if (execution.responseStatusCode !== 200) {
    throw new Error(
      `Function ${functionId} returned status ${execution.responseStatusCode}: ${execution.responseBody}`,
    );
  }

  const response = JSON.parse(execution.responseBody);
  // These functions return errors as { error, details } with HTTP 200 and no
  // `success` field, so check for an `error` too (not just success === false).
  if (response.success === false || response.error) {
    throw new Error(response.error || 'Payment function reported failure');
  }
  return response as T;
}

// ── Create a PaymentIntent (server-side via Appwrite Function) ─────────────────
// amount MUST be in cents.
export async function createPaymentIntent(params: {
  amount: number;
  currency?: string;
  appliedCoupon?: string;
  metadata?: Record<string, string>;
  existingStripeCustomerId?: string;
  userInfo: { userId: string; email?: string; name?: string; userType?: string };
  /**
   * Pass a SAVED payment method id to have the backend create AND confirm the
   * intent. Required for saved bank accounts: stripe.js can only confirm a
   * us_bank_account it just collected, never a previously saved one.
   */
  paymentMethodId?: string;
}): Promise<CreatePaymentIntentResult> {
  const response = await callFunction(paymentFunctions.createPaymentIntent, {
    amount: params.amount,
    currency: params.currency || 'usd',
    appliedCoupon: params.appliedCoupon,
    metadata: params.metadata || {},
    existingStripeCustomerId: params.existingStripeCustomerId,
    userInfo: params.userInfo,
    ...(params.paymentMethodId ? { paymentMethodId: params.paymentMethodId } : {}),
  });

  // The Appwrite function returns the client secret as a STRING in
  // `paymentIntent`. Be defensive in case a future version returns an object.
  const pi = response.paymentIntent;
  const clientSecret = typeof pi === 'string' ? pi : pi?.client_secret;

  return {
    clientSecret,
    customerId: typeof response.customer === 'string' ? response.customer : response.customer?.id,
    ephemeralKey: response.ephemeralKey,
    status: response.status,
    confirmed: response.confirmed,
  };
}

// ── Create a Stripe customer for an NSS user ───────────────────────────────────
export async function createStripeCustomer(params: {
  email: string;
  name: string;
  userId: string;
  userType: string;
  phone?: string;
  address?: any;
}): Promise<{ stripeCustomerId: string; customer: any }> {
  const response = await callFunction(paymentFunctions.createCustomer, params);
  return { stripeCustomerId: response.stripeCustomerId, customer: response.customer };
}

// ── List saved payment methods for a Stripe customer ───────────────────────────
export async function listPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]> {
  if (!customerId) return [];
  try {
    const response = await callFunction(paymentFunctions.listPaymentMethods, { customerId });
    const methods = (response.paymentMethods || []) as any[];
    return methods.map((pm) => {
      const bank = pm.us_bank_account;
      if (pm.type === 'us_bank_account' && bank) {
        return {
          id: pm.id,
          kind: 'bank' as const,
          brand: bank.bank_name || 'Bank account',
          bankName: bank.bank_name || 'Bank account',
          accountType: bank.account_type || 'checking',
          last4: bank.last4 || '••••',
          expMonth: 0,
          expYear: 0,
          stripePaymentMethodId: pm.id,
        };
      }
      return {
        id: pm.id,
        kind: 'card' as const,
        brand: pm.card?.brand || 'card',
        last4: pm.card?.last4 || '••••',
        expMonth: pm.card?.exp_month || 0,
        expYear: pm.card?.exp_year || 0,
        stripePaymentMethodId: pm.id,
      };
    });
  } catch (e) {
    console.error('Error listing payment methods:', e);
    return [];
  }
}

// ── Saved payment methods: add / remove ───────────────────────────────────────

/**
 * Create a SetupIntent so a card or bank account can be SAVED for reuse.
 * Pass ['us_bank_account'] for the "add bank account" (ACH Direct Debit) flow.
 */
export async function createSetupIntent(
  customerId: string,
  methodTypes?: ('card' | 'us_bank_account')[],
): Promise<{ clientSecret: string; setupIntentId: string }> {
  const response = await callFunction(paymentFunctions.createSetupIntent, {
    customerId,
    ...(methodTypes ? { methodTypes } : {}),
  });
  if (!response.clientSecret) throw new Error('No client secret returned');
  return { clientSecret: response.clientSecret, setupIntentId: response.setupIntentId };
}

/** Attach an already-created payment method to the customer (card flow). */
export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string,
): Promise<void> {
  await callFunction(paymentFunctions.attachPaymentMethod, { paymentMethodId, customerId });
}

/** Remove a saved payment method from the customer. */
export async function detachPaymentMethod(paymentMethodId: string): Promise<void> {
  await callFunction(paymentFunctions.detachPaymentMethod, { paymentMethodId });
}

// ── Send a receipt email for a paid bill ───────────────────────────────────────
export async function sendPaymentReceipt(billId: string, userId: string): Promise<void> {
  try {
    await callFunction(paymentFunctions.sendReceipt, { billId, userId });
  } catch (e) {
    // Receipt failure is non-critical — never block the payment success flow.
    console.error('Error sending payment receipt:', e);
  }
}

// ── Resolve the logged-in user's Stripe customer id + profile/type ─────────────
// Searches the player/parent/coach collections for a profile doc owned by this
// Appwrite account (matches userId first, then falls back to $id).
export async function resolveUserStripeContext(accountId: string): Promise<UserStripeContext> {
  const lookups: { collectionId: string | undefined; userType: UserType }[] = [
    { collectionId: collections.parentUsers, userType: 'parent' },
    { collectionId: collections.youthPlayers, userType: 'youth' },
    { collectionId: collections.collegiatePlayers, userType: 'collegiate' },
    { collectionId: collections.professionalPlayers, userType: 'professional' },
    { collectionId: collections.coaches, userType: 'coach' },
  ];

  for (const { collectionId, userType } of lookups) {
    if (!collectionId) continue;
    // Match by userId field
    try {
      const res = await databases.listDocuments(databaseId, collectionId, [
        Query.equal('userId', accountId),
        Query.limit(1),
      ]);
      if (res.documents.length > 0) {
        const doc = res.documents[0] as any;
        return { stripeId: doc.stripeId || null, userType, collectionId, profile: doc };
      }
    } catch { /* keep searching */ }

    // Match by document $id (older accounts where $id === account id)
    try {
      const doc = (await databases.getDocument(databaseId, collectionId, accountId)) as any;
      if (doc) {
        return { stripeId: doc.stripeId || null, userType, collectionId, profile: doc };
      }
    } catch { /* keep searching */ }
  }

  return { stripeId: null, userType: null, collectionId: null, profile: null };
}

// ── Persist a newly-created Stripe customer id onto the user's profile doc ──────
export async function saveUserStripeId(
  collectionId: string,
  documentId: string,
  stripeCustomerId: string,
): Promise<void> {
  try {
    await databases.updateDocument(databaseId, collectionId, documentId, { stripeId: stripeCustomerId });
  } catch (e) {
    console.error('Error saving Stripe customer id to profile:', e);
  }
}
