import { useEffect, useState } from 'react';
import { functions } from '../../../services/appwrite';
import { BRANCH_IDS, BRANCH_NAMES, BranchId, StaffRole } from '../../../constants/staffRoles';

// ── Staff Access (Super Administrators only) ───────────────────────────────────
// Who can open the admin dashboards, and for which locations. Roles live on
// each account's Appwrite labels; the staff-access function changes them.

const FUNCTION_ID = 'staff-access';

interface StaffAccount {
  userId: string;
  email: string;
  name: string;
  lastActive: string | null;
  role: StaffRole;
  branches: BranchId[];
  /** Has the coach label (coach tools; sees only their own chats and analyses). */
  coach: boolean;
}

async function call<T>(payload: object): Promise<T> {
  const res = await functions.createExecution(FUNCTION_ID, JSON.stringify(payload), false);
  let body: any = {};
  try {
    body = JSON.parse(res.responseBody || '{}');
  } catch {
    // fall through to the error below
  }
  if (res.status !== 'completed' || !body.success) {
    throw new Error(body.error || 'Something went wrong. Please try again.');
  }
  return body as T;
}

const ROLE_OPTIONS: { value: StaffRole; label: string; hint: string }[] = [
  { value: 'superadmin', label: 'Super Administrator', hint: 'Every location, plus Development' },
  { value: 'admin', label: 'Administrator', hint: 'Only the locations ticked' },
  { value: 'none', label: 'No admin access', hint: 'A regular account' },
];

const roleTitle = (a: Pick<StaffAccount, 'role' | 'branches'>) => {
  if (a.role === 'superadmin') return 'Super Administrator · All locations';
  if (a.role === 'admin') {
    return a.branches.length
      ? `Administrator · ${a.branches.map((b) => BRANCH_NAMES[b]).join(', ')}`
      : 'Administrator · No location yet';
  }
  return 'No admin access';
};

const lastActiveText = (iso: string | null) => {
  if (!iso) return 'Never signed in';
  const d = new Date(iso);
  return `Last active ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

// ── One account's role editor ──────────────────────────────────────────────────
const AccessRow = ({ account, isYou, onSaved }: {
  account: StaffAccount;
  isYou: boolean;
  onSaved: (a: StaffAccount) => void;
}) => {
  const [role, setRole] = useState<StaffRole>(account.role);
  const [branches, setBranches] = useState<BranchId[]>(account.branches.length ? account.branches : ['dc']);
  const [coach, setCoach] = useState<boolean>(account.coach);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');

  useEffect(() => {
    setRole(account.role);
    setBranches(account.role === 'admin' && account.branches.length ? account.branches : ['dc']);
    setCoach(account.coach);
  }, [account]);

  const effectiveBranches = role === 'admin' ? branches : [];
  const changed =
    coach !== account.coach ||
    role !== account.role ||
    (role === 'admin' && [...effectiveBranches].sort().join() !== [...account.branches].sort().join());

  const toggleBranch = (b: BranchId) => {
    setSavedNote('');
    setBranches((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  };

  const save = async () => {
    setError('');
    setSavedNote('');
    if (role === 'admin' && !branches.length) { setError('Tick at least one location.'); return; }
    const who = account.name || account.email;
    if (role === 'none' && account.role !== 'none' && !window.confirm(`Remove all admin access for ${who}?`)) return;
    if (role === 'superadmin' && account.role !== 'superadmin'
      && !window.confirm(`Make ${who} a Super Administrator? They'll see every location and can change anyone's access.`)) return;
    setSaving(true);
    try {
      const res = await call<{ account: StaffAccount }>({ action: 'set', userId: account.userId, role, branches: effectiveBranches, coach });
      onSaved(res.account);
      setSavedNote('Saved. It applies the next time they open the app or reload the site.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-4 border-b border-white/[0.06] last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white text-[13px] font-medium truncate">
            {account.name || account.email}
            {isYou && <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-white/35">You</span>}
          </p>
          <p className="text-white/40 text-[12px] truncate">{account.email}</p>
          <p className="text-white/25 text-[11px] font-mono mt-0.5">{lastActiveText(account.lastActive)}</p>
        </div>
        <span className={`text-[11px] font-mono px-2 py-1 rounded-md border ${
          account.role === 'superadmin'
            ? 'border-amber-400/30 text-amber-300 bg-amber-400/10'
            : account.role === 'admin'
              ? 'border-white/15 text-white/70 bg-white/[0.04]'
              : 'border-white/10 text-white/35'
        }`}>
          {roleTitle(account)}{account.coach ? ' · Coach' : ''}
        </span>
      </div>

      {isYou ? (
        <p className="text-white/30 text-[11px] font-mono mt-3">
          You can't change your own access. Another Super Administrator has to.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value as StaffRole); setSavedNote(''); setError(''); }}
            className="bg-[#0d0b09] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-white/30"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {role === 'admin' && (
            <div className="flex items-center gap-3">
              <span className="text-white/35 text-[11px] font-mono">Locations</span>
              {BRANCH_IDS.map((b) => (
                <label key={b} className="flex items-center gap-1.5 text-[12px] text-white/80 cursor-pointer">
                  <input type="checkbox" checked={branches.includes(b)} onChange={() => toggleBranch(b)} className="accent-white" />
                  {BRANCH_NAMES[b]}
                </label>
              ))}
            </div>
          )}

          <label className="flex items-center gap-1.5 text-[12px] text-white/80 cursor-pointer">
            <input type="checkbox" checked={coach} onChange={() => { setCoach((c) => !c); setSavedNote(''); }} className="accent-white" />
            Coach
          </label>

          <span className="text-white/25 text-[11px]">{ROLE_OPTIONS.find((o) => o.value === role)?.hint}</span>

          <button
            onClick={save}
            disabled={!changed || saving}
            className="ml-auto px-4 py-2 text-[12px] font-mono bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-red-400 text-[12px] font-mono">{error}</p>}
      {savedNote && <p className="mt-2 text-green-400/80 text-[12px] font-mono">{savedNote}</p>}
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────────
const StaffAccessSection = () => {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [you, setYou] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState('');
  const [found, setFound] = useState<StaffAccount | null>(null);

  const load = async () => {
    setError('');
    try {
      const res = await call<{ staff: StaffAccount[]; you: string }>({ action: 'list' });
      setStaff(res.staff);
      setYou(res.you);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSaved = (a: StaffAccount) => {
    setStaff((prev) => {
      const rest = prev.filter((s) => s.userId !== a.userId);
      return a.role === 'none' && !a.coach ? rest : [...rest, a].sort((x, y) =>
        (x.role === 'superadmin' ? 0 : 1) - (y.role === 'superadmin' ? 0 : 1)
        || (x.name || x.email).localeCompare(y.name || y.email));
    });
    if (found?.userId === a.userId) setFound(a);
  };

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setFindError('');
    setFound(null);
    if (!email.trim()) return;
    setFinding(true);
    try {
      const res = await call<{ account: StaffAccount }>({ action: 'find', email: email.trim() });
      setFound(res.account);
    } catch (err: any) {
      setFindError(err.message);
    } finally {
      setFinding(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-white text-[15px] font-medium font-mono">
          <span className="text-white/25">{'// '}</span>staff access
        </h2>
        <p className="text-white/25 text-[11px] font-mono mt-0.5">
          Who can open the admin dashboards, and for which locations. Administrators only see their own locations. Coaches only see their own chats and video analyses.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-[12px] font-mono">{error}</div>
      )}

      {/* Current staff */}
      <div className="bg-[#131211] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <p className="text-[10px] font-mono tracking-widest text-white/35 uppercase">Admins and coaches</p>
          {!loading && <p className="text-[11px] font-mono text-white/30">{staff.length}</p>}
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : staff.length === 0 && !error ? (
          <p className="px-4 py-6 text-white/30 text-[12px] font-mono">No admin accounts.</p>
        ) : (
          staff.map((a) => <AccessRow key={a.userId} account={a} isYou={a.userId === you} onSaved={onSaved} />)
        )}
      </div>

      {/* Give someone access */}
      <div className="bg-[#131211] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-[10px] font-mono tracking-widest text-white/35 uppercase">Give someone access</p>
          <p className="text-white/25 text-[11px] mt-1">They need a Next Star account first. Look them up by the email they sign in with.</p>
        </div>
        <form onSubmit={find} className="px-4 py-4 flex flex-wrap items-center gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="flex-1 min-w-[220px] bg-[#0d0b09] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-white/30"
          />
          <button
            type="submit"
            disabled={finding || !email.trim()}
            className="px-4 py-2 text-[12px] font-mono text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-lg transition-colors disabled:opacity-30"
          >
            {finding ? 'Looking…' : 'Find account'}
          </button>
        </form>
        {findError && <p className="px-4 pb-4 -mt-1 text-red-400 text-[12px] font-mono">{findError}</p>}
        {found && (
          <div className="border-t border-white/[0.06]">
            <AccessRow account={found} isYou={found.userId === you} onSaved={onSaved} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffAccessSection;
