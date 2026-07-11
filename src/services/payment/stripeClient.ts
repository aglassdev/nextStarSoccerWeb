import { loadStripe, Stripe } from '@stripe/stripe-js';
import { stripePublishableKey } from '../appwrite';

// Singleton Stripe.js instance. loadStripe returns a promise that resolves once
// the Stripe.js script has loaded. We create it once and reuse it everywhere.
let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    stripePromise = loadStripe(stripePublishableKey);
  }
  return stripePromise;
};
