import { useState } from 'react';
import { Shield, Users } from 'lucide-react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';

/**
 * GuildAuth component - Main authentication container for Guild Hub
 * Handles switching between login, registration, and password reset
 */

const GuildAuth = ({ onAuthSuccess }) => {
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'forgot-password'

  const handleLoginSuccess = (data) => {
    onAuthSuccess(data);
  };

  const handleRegisterSuccess = (data) => {
    onAuthSuccess(data);
  };

  const handleForgotPasswordSuccess = () => {
    // Stay on forgot password form to show success message
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-12 h-12 text-amber-500" />
            <h1 className="text-4xl font-bold text-white">I V E N U M I</h1>
          </div>
          <p className="text-gray-400 text-lg">Guild Hub - VENUM MARKET</p>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-500">
            <Users className="w-4 h-4" />
            <span>Área Exclusiva para Membros</span>
          </div>
        </div>

        {/* Auth Form */}
        {authMode === 'login' && (
          <LoginForm
            onSuccess={handleLoginSuccess}
            onSwitchToRegister={() => setAuthMode('register')}
            onForgotPassword={() => setAuthMode('forgot-password')}
          />
        )}

        {authMode === 'register' && (
          <RegisterForm
            onSuccess={handleRegisterSuccess}
            onSwitchToLogin={() => setAuthMode('login')}
          />
        )}

        {authMode === 'forgot-password' && (
          <ForgotPasswordForm
            onSuccess={handleForgotPasswordSuccess}
            onBackToLogin={() => setAuthMode('login')}
          />
        )}

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Área restrita. Acesso mediante código de recrutamento válido.</p>
          <p className="mt-1">Entre em contato com os oficiais da guilda para obter seu código.</p>
        </div>
      </div>
    </div>
  );
};

export default GuildAuth;
