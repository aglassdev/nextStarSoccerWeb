import { Client, Account, Databases, Storage, Functions } from 'appwrite';

// Validate environment variables
const validateEnv = () => {
  const required = [
    'VITE_APPWRITE_ENDPOINT',
    'VITE_APPWRITE_PROJECT_ID',
    'VITE_APPWRITE_DATABASE_ID',
  ];

  const missing = required.filter(key => !import.meta.env[key]);
  
  if (missing.length > 0) {
    const errorMsg = `❌ Missing required environment variables: ${missing.join(', ')}`;
    console.error(errorMsg);
    console.error('📝 Please add these variables to your Vercel project settings.');
    console.error('🔗 Guide: https://vercel.com/docs/projects/environment-variables');
    throw new Error(`Configuration Error: ${errorMsg}\n\nPlease configure environment variables in Vercel dashboard.`);
  }
};

// Validate before initializing
try {
  validateEnv();
  console.log('✅ Environment variables validated');
} catch (error) {
  console.error('🚨 Environment validation failed:', error);
  console.error('⚠️ App will continue loading — public pages will work, auth/dashboard features require these env vars.');
}

// Initialize Appwrite client (use empty strings as fallback to prevent
// module-level crash when env vars are not set; API calls will fail gracefully)
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || '';
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || '';

const client = new Client();
if (endpoint && projectId) {
  client.setEndpoint(endpoint).setProject(projectId);
}

// Initialize services
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

// Export client for direct access if needed
export { client };

// Collection IDs
export const collections = {
  parentUsers: import.meta.env.VITE_APPWRITE_PARENT_USERS_COLLECTION_ID,
  youthPlayers: import.meta.env.VITE_APPWRITE_YOUTH_PLAYERS_COLLECTION_ID,
  collegiatePlayers: import.meta.env.VITE_APPWRITE_COLLEGIATE_PLAYERS_COLLECTION_ID,
  professionalPlayers: import.meta.env.VITE_APPWRITE_PROFESSIONAL_PLAYERS_COLLECTION_ID,
  coaches: import.meta.env.VITE_APPWRITE_COACHES_COLLECTION_ID,
  teamTraining: import.meta.env.VITE_APPWRITE_TEAM_TRAINING_COLLECTION_ID,
  signups: import.meta.env.VITE_APPWRITE_SIGNUPS_COLLECTION_ID,
  checkins: import.meta.env.VITE_APPWRITE_CHECKINS_COLLECTION_ID,
  coachSignups: import.meta.env.VITE_APPWRITE_COACH_SIGNUPS_COLLECTION_ID,
  coachCheckins: import.meta.env.VITE_APPWRITE_COACH_CHECKINS_COLLECTION_ID,
  messages: import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID,
  bills: import.meta.env.VITE_APPWRITE_BILLS_COLLECTION_ID,
  billItems: import.meta.env.VITE_APPWRITE_BILL_ITEMS_COLLECTION_ID,
  payments: import.meta.env.VITE_APPWRITE_PAYMENTS_COLLECTION_ID,
  familyRelationships: import.meta.env.VITE_APPWRITE_FAMILY_RELATIONSHIPS_COLLECTION_ID,
  familyInvitations: import.meta.env.VITE_APPWRITE_FAMILY_INVITATIONS_COLLECTION_ID,
  proxyChildren: import.meta.env.VITE_APPWRITE_PROXY_CHILDREN_COLLECTION_ID || 'proxy_children_001',
  websiteInquiries: 'website_inquiries',
  scholarshipApplications: import.meta.env.VITE_APPWRITE_SCHOLARSHIP_COLLECTION_ID || 'scholarship_applications',
  devSupport: 'dev-support',
  coachApplications: 'coach_applications',
  sessionReviews: import.meta.env.VITE_APPWRITE_SESSION_REVIEWS_COLLECTION_ID || 'session_reviews',
  sessionNotes: 'session_notes',
  billAccess: import.meta.env.VITE_APPWRITE_BILL_ACCESS_COLLECTION_ID || 'billAccess',
  couponUsage: import.meta.env.VITE_APPWRITE_COUPON_USAGE_COLLECTION_ID || 'coupon_usage',
  familyRelationships001: import.meta.env.VITE_APPWRITE_FAMILY_RELATIONSHIPS_COLLECTION_ID || 'family_relationships_001',
  serviceStatus: import.meta.env.VITE_APPWRITE_SERVICE_STATUS_COLLECTION_ID || 'service_status',
};

// Appwrite Function IDs for Stripe/payment processing (shared with the mobile app).
// These IDs are not secrets (they ship in the client bundle), so we hardcode the
// known production values as fallbacks — this keeps the payment portal working
// even if the VITE_* build-time env vars aren't configured in the host (Vercel).
export const paymentFunctions = {
  createPaymentIntent: import.meta.env.VITE_APPWRITE_PAYMENT_FUNCTION_ID || '68c651320015320a1fa2',
  createCustomer: import.meta.env.VITE_APPWRITE_CUSTOMER_FUNCTION_ID || '68c6510d000bc8250993',
  attachPaymentMethod: import.meta.env.VITE_APPWRITE_ATTACH_PAYMENT_FUNCTION_ID || '68c7a57500119903dd04',
  detachPaymentMethod: import.meta.env.VITE_APPWRITE_DETACH_PAYMENT_METHOD_FUNCTION_ID || '68d30b2100170817c278',
  listPaymentMethods: import.meta.env.VITE_APPWRITE_LIST_PAYMENT_METHODS_FUNCTION_ID || '68c8f0c800245401ab25',
  getStripePrice: import.meta.env.VITE_APPWRITE_GET_STRIPE_PRICE_FUNCTION_ID || '68d311f00003367d3a0e',
  sendReceipt: import.meta.env.VITE_APPWRITE_SEND_RECEIPT_FUNCTION_ID || '68f325ea00311c5f5d4d',
};

// Stripe publishable key (publishable keys are designed to be public / embedded
// in client code, so a hardcoded fallback is safe and matches the mobile app).
export const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  'pk_live_51RZE2hIDlPhwXhklH4gZlNICFCjOZAgfNqsJ0VuBXoNSUNJgWLLsMEj6VOtc8DSg9zTMPcyllrge0SDqU3lOktKF00w4nkvNYf';

// Storage bucket IDs
export const buckets = {
  scholarshipDocuments: import.meta.env.VITE_APPWRITE_SCHOLARSHIP_BUCKET_ID || 'scholarship_documents',
};

// Database ID
export const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;

console.log('✅ Appwrite initialized successfully');
console.log('🔗 Endpoint:', import.meta.env.VITE_APPWRITE_ENDPOINT);
console.log('🎯 Project ID:', import.meta.env.VITE_APPWRITE_PROJECT_ID?.substring(0, 8) + '...');
