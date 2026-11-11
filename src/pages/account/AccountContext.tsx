import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AccountInfo, resolveAccount } from '../../services/accountProfile';
import { clearUserStripeContextCache } from '../../services/payment/paymentApi';
import { getParentChildren, ParentChild } from '../../services/clinicRegistration';
import { isAdminUser } from '../../services/playerCenter';

interface AccountState extends AccountInfo {
  loading: boolean;
  /** Parents only: proxy and linked children. */
  children: ParentChild[];
  /** Re-read the profile and children (after an edit). */
  refresh: () => Promise<void>;
}

const empty: AccountInfo = { userType: null, profile: null, collectionId: null, isCoach: false, isAdmin: false };

export const AccountCtx = createContext<AccountState>({ ...empty, loading: true, children: [], refresh: async () => {} });

export const AccountProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [info, setInfo] = useState<AccountInfo>(empty);
  const [kids, setKids] = useState<ParentChild[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const a = await resolveAccount(user.$id, user.labels);
    // The `admin` label counts as admin too (At-Home Training, the Player Center).
    setInfo({ ...a, isAdmin: a.isAdmin || isAdminUser(user) });
    setKids(a.userType === 'parent' ? await getParentChildren(user.$id).catch(() => []) : []);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    if (user) clearUserStripeContextCache(user.$id);
    await load();
  }, [user, load]);

  return (
    <AccountCtx.Provider value={{ ...info, loading, children: kids, refresh }}>
      {children}
    </AccountCtx.Provider>
  );
};

export const useAccount = () => useContext(AccountCtx);
