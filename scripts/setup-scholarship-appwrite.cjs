/**
 * One-time Appwrite setup: creates the scholarship_applications collection
 * and the scholarship_documents storage bucket.
 *
 * Usage:
 *   APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1 \
 *   APPWRITE_PROJECT_ID=xxx \
 *   APPWRITE_API_KEY=xxx \
 *   APPWRITE_DATABASE_ID=xxx \
 *   node scripts/setup-scholarship-appwrite.cjs
 *
 * The API key needs: databases.write, collections.write, attributes.write,
 *                    indexes.write, buckets.write
 */

const { Client, Databases, Storage, Permission, Role, IndexType } = require('node-appwrite');

const ENDPOINT    = process.env.APPWRITE_ENDPOINT    || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID  || '';
const API_KEY     = process.env.APPWRITE_API_KEY      || '';
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID  || '';

const COLLECTION_ID = 'scholarship_applications';
const BUCKET_ID     = 'scholarship_documents';

if (!PROJECT_ID || !API_KEY || !DATABASE_ID) {
  console.error('Missing APPWRITE_PROJECT_ID, APPWRITE_API_KEY, or APPWRITE_DATABASE_ID');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const db      = new Databases(client);
const storage = new Storage(client);

async function run() {
  // ── 1. Create collection ──────────────────────────────────────────────────
  console.log('Creating scholarship_applications collection...');
  try {
    await db.createCollection(
      DATABASE_ID,
      COLLECTION_ID,
      'Scholarship Applications',
      [
        Permission.read(Role.team('admin')),
        Permission.create(Role.any()),       // public can submit
        Permission.update(Role.team('admin')),
        Permission.delete(Role.team('admin')),
      ],
      false // documentSecurity off — collection-level permissions handle it
    );
    console.log('  ✓ Collection created');
  } catch (e) {
    if (e.code === 409) console.log('  ℹ Collection already exists, continuing...');
    else throw e;
  }

  // ── 2. Attributes ─────────────────────────────────────────────────────────
  const strings = [
    // Personal
    ['applicantFirstName',   255, true ],
    ['applicantLastName',    255, true ],
    ['applicantDOB',          32, true ],   // ISO date string
    ['applicantEmail',       255, true ],
    ['applicantPhone',        32, false],
    ['applicantAddress',     512, false],
    ['applicantCity',        128, false],
    ['applicantState',        64, false],
    ['applicantZip',          16, false],
    // Player info
    ['playerFirstName',      255, true ],
    ['playerLastName',       255, true ],
    ['playerDOB',             32, true ],
    ['playerAge',             16, false],
    ['playerGrade',           32, false],
    ['playerSchool',         255, false],
    ['playerPosition',        64, false],
    ['trainingHistory',     2000, false],
    // Household
    ['householdSize',         16, true ],
    ['annualHouseholdIncome', 32, true ],
    ['employmentStatus',      64, false],
    ['receivesAssistance',    32, false],  // 'yes'|'no'|'prefer-not'
    ['assistanceDetails',    512, false],
    // Application
    ['requestedAid',          32, true ],  // 'full'|'partial'
    ['personalStatement',    4000, true ],
    ['referralSource',       255, false],
    ['coachReference',       255, false],
    // Status
    ['status',                32, true ],  // 'pending'|'reviewing'|'approved'|'denied'
    ['adminNotes',           2000, false],
    // Document file IDs (comma-separated list of storage file IDs)
    ['documentFileIds',      4000, false],
    ['submittedAt',           64, true ],
  ];

  console.log('Creating string attributes...');
  for (const [key, size, required] of strings) {
    try {
      await db.createStringAttribute(DATABASE_ID, COLLECTION_ID, key, size, required, undefined, false);
      process.stdout.write(`  ✓ ${key}\n`);
    } catch (e) {
      if (e.code === 409) process.stdout.write(`  ℹ ${key} (exists)\n`);
      else console.warn(`  ✗ ${key}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 200)); // Appwrite needs a moment between attrs
  }

  // ── 3. Index on status for admin queries ──────────────────────────────────
  console.log('\nCreating index on status...');
  try {
    await db.createIndex(DATABASE_ID, COLLECTION_ID, 'idx_status', IndexType.Key, ['status'], ['ASC']);
    console.log('  ✓ Index created');
  } catch (e) {
    if (e.code === 409) console.log('  ℹ Index already exists');
    else console.warn('  ✗ Index:', e.message);
  }

  // ── 4. Storage bucket ─────────────────────────────────────────────────────
  console.log('\nCreating scholarship_documents bucket...');
  try {
    await storage.createBucket(
      BUCKET_ID,
      'Scholarship Documents',
      [
        Permission.read(Role.team('admin')),
        Permission.create(Role.any()),
        Permission.delete(Role.team('admin')),
      ],
      false,   // fileSecurity
      true,    // enabled
      25 * 1024 * 1024, // 25 MB max file size
      ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      false,   // compression
      false,   // encryption
      false    // antivirus
    );
    console.log('  ✓ Bucket created');
  } catch (e) {
    if (e.code === 409) console.log('  ℹ Bucket already exists');
    else throw e;
  }

  console.log('\n✅ Scholarship Appwrite resources ready.');
  console.log(`   Collection ID: ${COLLECTION_ID}`);
  console.log(`   Bucket ID:     ${BUCKET_ID}`);
  console.log('\nAdd to your .env:');
  console.log(`   VITE_APPWRITE_SCHOLARSHIP_COLLECTION_ID=${COLLECTION_ID}`);
  console.log(`   VITE_APPWRITE_SCHOLARSHIP_BUCKET_ID=${BUCKET_ID}`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
