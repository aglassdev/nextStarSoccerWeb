import { useAuth } from '../contexts/AuthContext';

const ProfilePage = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Profile</h1>
        <p className="text-gray-400 mt-1">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <div className="bg-gray-800 rounded-lg p-6 md:p-8 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-3xl font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-1">{user?.name}</h2>
            <p className="text-gray-400">{user?.email}</p>
            {user?.phone && <p className="text-gray-400 mt-1">{user.phone}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {user?.emailVerification && (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded-full">
                  ✓ Email Verified
                </span>
              )}
              {user?.status && (
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm font-medium rounded-full">
                  ✓ Active
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Settings */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 divide-y divide-gray-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Account Settings</h3>
          
          <div className="space-y-4">
            <button className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">👤</span>
                <div className="text-left">
                  <p className="text-white font-medium">Edit Profile</p>
                  <p className="text-sm text-gray-400">Update your personal information</p>
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔒</span>
                <div className="text-left">
                  <p className="text-white font-medium">Change Password</p>
                  <p className="text-sm text-gray-400">Update your account password</p>
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔔</span>
                <div className="text-left">
                  <p className="text-white font-medium">Notifications</p>
                  <p className="text-sm text-gray-400">Manage notification preferences</p>
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">💳</span>
                <div className="text-left">
                  <p className="text-white font-medium">Payment Methods</p>
                  <p className="text-sm text-gray-400">Manage your payment methods</p>
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500 rounded-lg transition-colors"
          >
            <span>🚪</span>
            <span className="text-red-400 font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">About</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Version</span>
            <span className="text-white">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Build</span>
            <span className="text-white">Web</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">User ID</span>
            <span className="text-white font-mono text-xs">{user?.$id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
