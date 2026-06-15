import { useState } from 'react';
import { Settings, User, Shield, Key, Users as UsersIcon } from 'lucide-react';
import UserProfile from '../components/guild/members/UserProfile';
import AdminPanel from '../components/guild/admin/AdminPanel';

/**
 * Settings page - User settings and admin panel
 */

const Settings = ({ userId, userRole }) => {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'admin', label: 'Administração', icon: Shield, adminOnly: true },
  ];

  const availableTabs = tabs.filter(tab => !tab.adminOnly || userRole === 'admin');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-red-500" />
          Configurações
        </h1>
        <p className="text-gray-400 text-sm mt-1">Gerencie sua conta e configurações da guilda</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-red-500 text-slate-950'
                  : 'text-gray-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'profile' && <UserProfile userId={userId} currentUserId={userId} />}
        {activeTab === 'admin' && userRole === 'admin' && <AdminPanel userId={userId} userRole={userRole} />}
      </div>
    </div>
  );
};

export default Settings;
