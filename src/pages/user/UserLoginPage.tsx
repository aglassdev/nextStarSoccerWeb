import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Login page for the user Payment Portal. Styled after the admin login, but
// open to ALL authenticated users (no email allow-list). On success the user
// lands on /user/payments.
const UserLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading, user, initialized } = useAuth();
  const navigate = useNavigate();

  // Auto-redirect if already signed in
  useEffect(() => {
    if (!initialized) return;
    if (user) navigate('/user/payments', { replace: true });
  }, [user, initialized, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    try {
      await login(email, password);
      navigate('/user/payments');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
        setError('Cannot reach the server. Please try again in a moment.');
      } else {
        setError(msg || 'Failed to login');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Heading */}
        <div className="text-center mb-8">
          <img
            src="/assets/images/NextStarBall.png"
            alt="Next Star"
            className="w-12 h-12 mx-auto mb-4 opacity-90"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h1 className="text-2xl font-bold text-white">Payment Portal</h1>
          <p className="text-gray-400 mt-2 text-sm">Sign in to view and pay your bills</p>
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Use the same email and password as the Next Star Soccer app.
        </p>
      </div>
    </div>
  );
};

export default UserLoginPage;
