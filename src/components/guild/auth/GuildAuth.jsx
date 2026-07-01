import { useState } from 'react';
import { Users } from 'lucide-react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import VenumLogo from '@/components/common/VenumLogo';
import { GUILD_NAME } from '@/config/guild';

/**
 * GuildAuth component - Main authentication container for Guild Hub
 * Handles switching between login and registration
 */

const GuildAuth = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);

  const handleLoginSuccess = (data) => {
    onAuthSuccess(data);
  };

  const handleRegisterSuccess = (data) => {
    onAuthSuccess(data);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <VenumLogo className="h-16 w-auto" />
          </div>
          <p className="text-gray-400 text-lg">Hub da Guilda {GUILD_NAME}</p>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-500">
            <Users className="w-4 h-4" />
            <span>Área Exclusiva para Membros</span>
          </div>
        </div>

        {/* Auth Form */}
        {isLogin ? (
          <LoginForm
            onSuccess={handleLoginSuccess}
            onSwitchToRegister={() => setIsLogin(false)}
          />
        ) : (
          <RegisterForm
            onSuccess={handleRegisterSuccess}
            onSwitchToLogin={() => setIsLogin(true)}
          />
        )}

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Área restrita a membros da guilda {GUILD_NAME}.</p>
        </div>
      </div>
    </div>
  );
};

export default GuildAuth;
