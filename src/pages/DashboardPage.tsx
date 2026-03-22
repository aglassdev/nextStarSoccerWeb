import { useAuth } from '../contexts/AuthContext';

const DashboardPage = () => {
  const { user } = useAuth();

  // Stats data (this would come from Appwrite in real implementation)
  const stats = [
    { label: 'Upcoming Events', value: '3', icon: '📅', color: 'bg-blue-500' },
    { label: 'Pending Bills', value: '$250', icon: '💳', color: 'bg-yellow-500' },
    { label: 'Active Players', value: '2', icon: '⚽', color: 'bg-green-500' },
    { label: 'Messages', value: '5', icon: '✉️', color: 'bg-purple-500' },
  ];

  const recentActivity = [
    { type: 'event', message: 'Signed up for Team Training', time: '2 hours ago' },
    { type: 'billing', message: 'Payment received for January', time: '1 day ago' },
    { type: 'message', message: 'New message from Coach Sarah', time: '2 days ago' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 md:p-8 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Welcome back, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-blue-100">Here's what's happening with your account today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`${stat.color} w-10 h-10 rounded-lg flex items-center justify-center text-xl`}>
                {stat.icon}
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</p>
            <p className="text-sm text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Two Column Layout for Desktop */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Upcoming Events</h2>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-start space-x-4 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white font-bold">
                  {15 + i}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">Team Training Session</p>
                  <p className="text-sm text-gray-400">Saturday, 3:00 PM - 5:00 PM</p>
                  <p className="text-xs text-gray-500 mt-1">Main Field, Soccer Complex</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start space-x-4 p-4 bg-gray-700 rounded-lg">
                <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{activity.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'New Event', icon: '➕', color: 'bg-green-500' },
            { label: 'Pay Bill', icon: '💰', color: 'bg-yellow-500' },
            { label: 'Send Message', icon: '✉️', color: 'bg-purple-500' },
            { label: 'View Reports', icon: '📊', color: 'bg-blue-500' },
          ].map((action) => (
            <button
              key={action.label}
              className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <div className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-2`}>
                {action.icon}
              </div>
              <span className="text-sm text-white font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
