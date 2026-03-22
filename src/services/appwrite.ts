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
  throw error;
}

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

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
  websiteInquiries: 'website_inquiries',
};

// Database ID
export const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;

console.log('✅ Appwrite initialized successfully');
console.log('🔗 Endpoint:', import.meta.env.VITE_APPWRITE_ENDPOINT);
console.log('🎯 Project ID:', import.meta.env.VITE_APPWRITE_PROJECT_ID?.substring(0, 8) + '...');
