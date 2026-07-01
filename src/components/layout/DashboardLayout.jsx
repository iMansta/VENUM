import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, TrendingUp, Target, Hammer, Wrench, Shield, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import VenumLogo from '@/components/common/VenumLogo';

const DashboardLayout = ({ userId, userRole, profile }) => {
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Ranking', href: '/ranking', icon: TrendingUp },
    { name: 'Missões', href: '/missions', icon: Target },
    { name: 'Mercado', href: '/market', icon: Wrench },
    { name: 'Produção', href: '/production', icon: Hammer },
    { name: 'Builds', href: '/builds', icon: Shield },
  ];

  if (userRole === 'admin') {
    navigation.push({ name: 'Admin', href: '/admin', icon: Shield });
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed left-0 top-0 h-full w-64 bg-black border-r border-slate-800">
        <div className="p-6">
          <VenumLogo className="h-12 w-auto" showCredit />
        </div>

        <nav className="mt-6">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={[
                  'flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-800 text-red-500 border-r-2 border-red-500'
                    : 'text-gray-400 hover:text-white hover:bg-slate-800/50',
                ].join(' ')}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {profile?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {profile?.username || 'User'}
              </p>
              <p className="text-xs text-gray-400 truncate capitalize">
                {userRole || 'member'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>

      <div className="ml-64 min-h-screen bg-black">
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;
