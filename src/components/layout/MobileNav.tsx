import { NavLink } from 'react-router-dom';

const navigation = [
  { name: 'Dashboard', to: '/dashboard', icon: '📊' },
  { name: 'Events', to: '/events', icon: '📅' },
  { name: 'Billing', to: '/billing', icon: '💳' },
  { name: 'Profile', to: '/profile', icon: '👤' },
];

const MobileNav = () => {
  return (
    <div className="bg-gray-800 border-t border-gray-700">
      <nav className="flex justify-around items-center h-16">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`
            }
          >
            <span className="text-2xl mb-1">{item.icon}</span>
            <span className="text-xs font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default MobileNav;
