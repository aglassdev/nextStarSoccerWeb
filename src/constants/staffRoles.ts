/**
 * Staff roles across the Next Star ecosystem (app, website, backend).
 *
 *  - Super Administrator: every branch, everything (HQ / CTO-COO).
 *  - Administrator: only the branch(es) they're assigned to.
 *
 * Roles live on each account's Appwrite Auth labels, which only the server can
 * set (the staff-access function, from Development → Staff Access):
 *    superadmin              -> Super Administrator
 *    admin + admin<branch>   -> Administrator of that branch (e.g. "admindc")
 * Keep BRANCH_NAMES in step with the app's constants/adminConfig.ts and the
 * staff-access function.
 */

/** Branch IDs. Seattle and San Diego get added here when they launch. */
export type BranchId = 'dc';

export const BRANCH_NAMES: Record<BranchId, string> = {
  dc: 'DC',
};

const BRANCH_IDS = Object.keys(BRANCH_NAMES) as BranchId[];

export type StaffRole = 'superadmin' | 'admin' | 'none';

/** Anything with labels: the signed-in user from AuthContext, or an Appwrite user. */
type Labeled = { labels?: string[] | null } | null | undefined;

const labelsOf = (u: Labeled) => new Set(u?.labels || []);

/** Super Administrator: no branch limits. */
export const isSuperAdmin = (u: Labeled): boolean => labelsOf(u).has('superadmin');

/** Any admin, super or branch. */
export const isAdminUser = (u: Labeled): boolean => {
  const l = labelsOf(u);
  return l.has('superadmin') || l.has('admin');
};

export const staffRoleOf = (u: Labeled): StaffRole =>
  isSuperAdmin(u) ? 'superadmin' : isAdminUser(u) ? 'admin' : 'none';

/**
 * Which branches an admin's dashboards cover: "all" for a Super
 * Administrator, the assigned branches for an Administrator, none otherwise.
 */
export const getAdminBranches = (u: Labeled): 'all' | BranchId[] => {
  if (isSuperAdmin(u)) return 'all';
  if (!isAdminUser(u)) return [];
  const l = labelsOf(u);
  return BRANCH_IDS.filter((b) => l.has(`admin${b}`));
};

/** Whether this admin may see and manage a branch's people, events and money. */
export const canAdminBranch = (u: Labeled, branchId: BranchId): boolean => {
  const branches = getAdminBranches(u);
  return branches === 'all' || branches.includes(branchId);
};

/** "Super Administrator · All locations" / "Administrator · DC", or null. */
export const getAdminRoleLabel = (u: Labeled): string | null => {
  if (isSuperAdmin(u)) return 'Super Administrator · All locations';
  if (!isAdminUser(u)) return null;
  const branches = getAdminBranches(u);
  if (branches === 'all') return null;
  return branches.length
    ? `Administrator · ${branches.map((b) => BRANCH_NAMES[b]).join(', ')}`
    : 'Administrator · No location yet';
};
