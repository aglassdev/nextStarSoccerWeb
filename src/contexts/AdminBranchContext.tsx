import { createContext, useContext } from 'react';
import { BranchId } from '../constants/staffRoles';

/**
 * The location the admin dashboard is showing. Super Administrators switch it
 * from the sidebar; an Administrator is pinned to their own location(s).
 * Sections read it with useAdminBranch() to scope what they load.
 */
export interface AdminBranchState {
  branch: BranchId;
  /** Locations this admin may switch between. */
  branches: BranchId[];
  setBranch: (b: BranchId) => void;
}

export const AdminBranchContext = createContext<AdminBranchState>({
  branch: 'dc',
  branches: ['dc'],
  setBranch: () => {},
});

export const useAdminBranch = () => useContext(AdminBranchContext);

/**
 * Locations whose records the dashboards can show today. Nothing in the
 * database carries a location tag yet, so every existing record is DC's; a
 * location joins this list once its records are tagged and the sections
 * filter by it.
 */
export const BRANCHES_WITH_DATA: ReadonlySet<BranchId> = new Set<BranchId>(['dc']);
