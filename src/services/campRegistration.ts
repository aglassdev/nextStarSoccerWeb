import { ExecutionMethod } from 'appwrite';
import { functions } from './appwrite';
import type { ClinicPlayerRef } from './clinicRegistration';

// Camps sold on the website go through the same function as clinics and video
// analysis (app repo: functions/register-clinic, product "camp"). It prices the
// order, checks nothing blocks it, and after payment verifies the charge with
// Stripe before writing the signups. Signed-in callers only.
const REGISTER_FUNCTION_ID = 'register-clinic';

export type CampGroup = 'youth' | 'college';

export interface CampQuotePlayer extends ClinicPlayerRef {
  name: string;
  priceCents: number;
  /** Why this player can't be registered (overdue balance, already registered), or ''. */
  blocked: string;
}

export interface CampQuote {
  players: CampQuotePlayer[];
  days: { date: string; label: string }[];
  /** False once camp has started: the days left are charged at the day rate. */
  fullWeek: boolean;
  session: { label: string; time: string };
  subtotal: number;
  discount: number;
  couponCode: string;
  fee: number;
  total: number;
}

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const execution = await functions.createExecution(
    REGISTER_FUNCTION_ID,
    JSON.stringify({ product: 'camp', ...payload }),
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
    throw new Error(body.error || `Request failed (${execution.responseStatusCode})`);
  }
  return body as T;
}

/** Price an order and find anything that would block it. Nothing is written. */
export const quoteCamp = (params: {
  campId: string;
  sessionType: CampGroup;
  players: ClinicPlayerRef[];
  couponCode?: string;
}) => call<CampQuote>({ action: 'quote', ...params });

/** Turn a paid PaymentIntent into camp signups. Safe to retry: a payment registers once. */
export const registerCamp = (params: {
  paymentIntentId: string;
  campId: string;
  sessionType: CampGroup;
  players: ClinicPlayerRef[];
  couponCode?: string;
}) => call<{ success: boolean; players?: string[]; emailed?: boolean }>({ action: 'register', ...params });
