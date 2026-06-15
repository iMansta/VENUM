import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Trophy, 
  Target, 
  TrendingUp, 
  Settings, 
  LogOut,
  Menu,
  X,
  User,
  Shield
} from 'lucide-react';
import { signOut } from '@/lib/supabase/auth';

/**
 * DashboardLayout component - Main layout with sidebar for authenticated users
 */

const DashboardLayout = ({ userId, userRole }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navigation = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Ranking', path: '/ranking', icon: Trophy },
    { name: 'Missões', path: '/missions', icon: Target },
    { name: 'Mercado', path: '/market', icon: TrendingUp },
    { name: 'Configurações', path: '/settings', icon: Settings },
  ];

  const adminNavigation = [
    { name: 'Administração', path: '/settings', icon: Shield },
  ];

  const filteredNavigation = userRole === 'admin' 
    ? [...navigation, ...adminNavigation] 
    : navigation;

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:inset-0
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white">VENUM MARKET</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {filteredNavigation.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                ${isActive(item.path)
                  ? 'bg-red-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-800'
                }
              `}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 font-bold">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {userRole === 'admin' ? 'Administrador' : userRole === 'officer' ? 'Oficial' : 'Membro'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden bg-slate-900 border-b border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-white">VENUM MARKET</h1>
            <div className="w-6" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
