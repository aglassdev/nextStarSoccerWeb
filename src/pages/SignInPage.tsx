import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { account } from '../services/appwrite';
import { homePathFor, resolveAccount } from '../services/accountProfile';
import CreateAccountModal from '../components/common/CreateAccountModal';

// One sign-in for everyone with an app account. Parents and players land in
// the Account Center, coaches on the coach dashboard, unless they were sent
// here from a page they're going back to.
const SignInPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const { login, user, initialized } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;

  const goHome = async (userId: string) => {
    if (from) return navigate(from, { replace: true });
    navigate(homePathFor(await resolveAccount(userId)), { replace: true });
  };

  // Already signed in: straight through.
  useEffect(() => {
    if (initialized && user && !busy) goHome(user.$id);
  }, [user, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Please enter your email and password.');
    setBusy(true);
    try {
      await login(email.trim(), password);
      await goHome((await account.get()).$id);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/fetch|network/i.test(msg)) setError('Cannot reach the server. Please try again in a moment.');
      else if (/invalid credentials|password/i.test(msg)) setError('That email and password don’t match an account.');
      else setError(msg || 'Could not sign in.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/">
            <img
              src="/assets/images/NextStarBall.png"
              alt="Next Star"
              className="w-12 h-12 mx-auto mb-4 opacity-90"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </Link>
          <h1 className="text-2xl font-bold text-white">Sign in</h1>
          <p className="text-gray-400 mt-2 text-sm">Manage your Next Star account, bills, players and video analysis</p>
        </div>

        <div className="bg-[#111] rounded-lg shadow-xl p-6 md:p-8 border border-white/10">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="your@email.com"
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="••••••••"
                disabled={busy}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 px-4 bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="text-center text-xs mt-6 space-y-2">
          <p className="text-gray-600">Use the same email and password as the Next Star Soccer app. Coaches too.</p>
          <p className="text-gray-500">
            No account yet?{' '}
            <button onClick={() => setShowCreate(true)} className="text-white underline underline-offset-2">Create one</button>
            {' · '}Forgot your password? Reset it in the app.
          </p>
        </div>
      </div>
      {showCreate && <CreateAccountModal onClose={() => setShowCreate(false)} />}
    </div>
  );
};

export default SignInPage;
