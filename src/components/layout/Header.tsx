import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

const Header = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Get page title from current route
  const getPageTitle = () => {
    const path = location.pathname.split('/')[1];
    return path.charAt(0).toUpperCase() + path.slice(1) || 'Dashboard';
  };

  return (
    <header className="sticky top-0 z-40 bg-gray-800 border-b border-gray-700">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">⚽</span>
          <div>
            <h1 className="text-lg font-semibold text-white">{getPageTitle()}</h1>
            <p className="text-xs text-gray-400">{user?.name}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
