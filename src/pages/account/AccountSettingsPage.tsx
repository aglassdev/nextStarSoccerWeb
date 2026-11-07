import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { SIGN_IN_PATH } from '../../constants/features';
import PaymentMethodsSection from '../user/PaymentMethodsSection';
import { useAccount } from './AccountContext';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';
import AccountDetails from './profile/AccountDetails';
import { BackArrowIcon, Overlay, SectionCard } from './profile/ui';

// The app's Settings screen (screens/main/account/settings/SettingsScreen.tsx):
// Account Information, Payment Methods, Notifications and Sign Out. On a wide
// screen the menu stays on the left and the chosen screen opens beside it; on
// a phone the menu opens each screen in its place, as in the app.

type Section = 'account' | 'payments' | 'notifications';
const SECTIONS: { id: Section; title: string; heading: string }[] = [
  { id: 'account', title: 'Account Information', heading: 'Account Details' },
  { id: 'payments', title: 'Payment Methods', heading: 'Payment Methods' },
  { id: 'notifications', title: 'Notifications', heading: 'Notifications' },
];

const MenuItem = ({ title, onClick, active = false, activeWide = false, signOut = false }: {
  title: string;
  onClick: () => void;
  active?: boolean;
  /** Highlighted only on wide screens (the default screen shown beside the menu). */
  activeWide?: boolean;
  signOut?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`w-full text-left rounded-[14px] border px-5 py-5 md:px-6 md:py-6 text-lg font-medium transition-colors ${
      active ? 'bg-[#1a1a1a] border-white/50'
        : activeWide ? 'bg-[#111] border-[#222] lg:bg-[#1a1a1a] lg:border-white/50'
          : 'bg-[#111] border-[#222] hover:border-[#3a3a3a]'
    } ${signOut ? 'text-[#ff0000]' : 'text-white'}`}
  >
    {title}
  </button>
);

const Notifications = () => (
  <SectionCard title="Notification Preferences">
    <p className="text-[#666] text-base italic text-center py-6">Notification settings will be available soon.</p>
  </SectionCard>
);

const PaymentMethods = () => {
  const { user } = useAuth();
  const { profile } = useAccount();
  if (!user) return null;
  const name = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || user.name || '';
  // The shared payment-methods panel (also on the Payment Center) brings its
  // own "Payment Methods" title; the pane heading already says it.
  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-5 md:p-7 [&>div>h3:first-child]:hidden">
      <PaymentMethodsSection userId={user.$id} userName={name} userEmail={user.email || ''} />
    </div>
  );
};

const AccountSettingsPage = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { loading } = useAccount();
  const [params, setParams] = useSearchParams();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const requested = params.get('section') as Section | null;
  const chosen = SECTIONS.find((s) => s.id === requested) || null;
  // Wide screens always show a screen beside the menu (Account Information first).
  const shown = chosen || SECTIONS[0];

  const open = (id: Section) => setParams({ section: id });
  const close = () => setParams({});

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate(SIGN_IN_PATH);
    } catch {
      setSigningOut(false);
      setConfirmSignOut(false);
    }
  };

  const body = (id: Section) =>
    id === 'account' ? <AccountDetails /> : id === 'payments' ? <PaymentMethods /> : <Notifications />;

  return (
    <div>
      <AccountPageHeader title="Settings" />

      {loading ? (
        <AccountSpinner />
      ) : (
        <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* Menu — on phones it's hidden while a screen is open */}
          <nav className={`space-y-2.5 lg:sticky lg:top-24 lg:self-start ${chosen ? 'hidden lg:block' : ''}`} aria-label="Settings">
            {SECTIONS.map((s) => (
              <MenuItem
                key={s.id}
                title={s.title}
                active={chosen?.id === s.id}
                activeWide={!chosen && shown.id === s.id}
                onClick={() => open(s.id)}
              />
            ))}
            <MenuItem title="Sign Out" signOut onClick={() => setConfirmSignOut(true)} />
          </nav>

          {/* The chosen screen */}
          <div className={`min-w-0 ${chosen ? '' : 'hidden lg:block'}`}>
            <div className="flex items-center gap-3 mb-5 md:mb-6">
              <button type="button" onClick={close} aria-label="Back to Settings" className="lg:hidden text-white hover:text-gray-300 -ml-1 p-1">
                <BackArrowIcon className="w-6 h-6" />
              </button>
              <h3 className="text-white text-[22px] md:text-2xl font-bold">{shown.heading}</h3>
            </div>
            {body(shown.id)}
          </div>
        </div>
      )}

      {confirmSignOut && (
        <Overlay onClose={() => !signingOut && setConfirmSignOut(false)} dim="bg-black/50">
          <div role="alertdialog" aria-modal="true" className="mx-6 rounded-xl border-2 border-white bg-black p-6 text-center">
            <p className="text-white text-lg font-medium mb-6">Are you sure you want to sign out?</p>
            <div className="flex justify-center gap-5">
              <button type="button" onClick={() => setConfirmSignOut(false)} disabled={signingOut}
                className="px-6 py-3 rounded-lg text-white font-medium hover:bg-white/10 disabled:opacity-40">No</button>
              <button type="button" onClick={signOut} disabled={signingOut}
                className="px-6 py-3 rounded-lg text-white font-medium hover:bg-white/10 disabled:opacity-40">
                {signingOut ? 'Signing out…' : 'Yes'}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
};

export default AccountSettingsPage;
