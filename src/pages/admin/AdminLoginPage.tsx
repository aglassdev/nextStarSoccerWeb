import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ALLOWED_EMAILS = [
  'amartyaglasses@gmail.com',
  'seba@taso-group.com',
  'info@nextstarsoccer.com',
];

const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, logout, loading, user, initialized } = useAuth();
  const navigate = useNavigate();

  // Auto-redirect if already logged in as an admin
  useEffect(() => {
    if (!initialized) return;
    if (user && ALLOWED_EMAILS.includes(user.email.toLowerCase().trim())) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [user, initialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields'); return; }
    try {
      await login(email, password);
      if (!ALLOWED_EMAILS.includes(email.toLowerCase().trim())) {
        await logout();
        setError('Access denied. This account is not authorized for admin access.');
        return;
      }
      navigate('/admin/dashboard');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
        setError('Cannot reach the server. Make sure this site is added as a Web Platform in the Appwrite Console.');
      } else {
        setError(msg || 'Failed to login');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#111] rounded-lg shadow-xl p-6 md:p-8 border border-white/10 relative">
          {/* Logo — top right */}
          <img
            src="/assets/images/NextStarBall.png"
            alt="Next Star"
            className="absolute top-5 right-5 w-8 h-8 opacity-70"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">Email</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="" disabled={loading} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="" disabled={loading} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 px-4 bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
