import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { CalendarEvent } from '@/services/googleCalendar';
import { AttendanceManager } from '../admin/sections/AttendanceManagerSection';
import { AccountPageHeader, AccountSpinner } from '../account/AccountLayout';
import { useAccount } from '../account/AccountContext';
import { hasCoachPlus, isCoachPlusSession, loadCoachPlusScope, type CoachPlusScope } from './coachPlus';

// Coach+: the admin's Attendance Manager over the camps and group sessions
// Phillip takes a share of. Signups, check-ins, billing colours and session
// notes work as in the admin; editing a session's details stays with admins,
// since only they may change the calendar.

const CoachPlusPage = () => {
  const { user } = useAuth();
  const { coachName, isAdmin } = useAccount();
  const allowed = hasCoachPlus(user?.$id, [coachName, user?.name]);
  const [scope, setScope] = useState<CoachPlusScope | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    loadCoachPlusScope()
      .catch(() => ({ attended: new Set<string>(), excluded: new Set<string>() }))
      .then((s) => { if (!cancelled) setScope(s); });
    return () => { cancelled = true; };
  }, [allowed]);

  const include = useCallback(
    (ev: CalendarEvent, calType: 'public' | 'private') => !!scope && isCoachPlusSession(ev, calType, scope),
    [scope],
  );

  if (!allowed) return <Navigate to="/coach" replace />;

  const header = (right?: React.ReactNode) => (
    <>
      <AccountPageHeader title="Coach+" right={right} />
      <p className="-mt-5 mb-6 text-[#9ca3af] text-sm">
        Every camp and group session you take a share of. Check players in, manage signups and keep session notes.
      </p>
    </>
  );

  if (!scope) {
    return (
      <div>
        {header()}
        <AccountSpinner />
      </div>
    );
  }

  return (
    <AttendanceManager
      basePath="/coach/plus"
      include={include}
      canEditEvents={isAdmin}
      showCalFilter={false}
      scope="coachplus"
      className=""
      renderHeader={(controls) => header(controls || undefined)}
    />
  );
};

export default CoachPlusPage;
