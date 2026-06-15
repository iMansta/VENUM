import { useState } from 'react';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { signIn } from '../../../lib/supabase/auth';

/**
 * LoginForm component - User login with email and password
 * @param {Function} onSuccess - Callback when login succeeds
 * @param {Function} onSwitchToRegister - Callback to switch to registration
 * @param {Function} onForgotPassword - Callback to switch to password reset
 */

const LoginForm = ({ onSuccess, onSwitchToRegister, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn(email, password);

    if (result.success) {
      onSuccess(result.data);
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Entrar na Guilda</h2>
        <p className="text-gray-400 text-sm">Acesse o VENUM MARKET Guild Hub</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="seu@email.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Senha
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <div className="text-right">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
          >
            Esqueci minha senha
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="mt-4 text-center space-y-2">
        <button
          onClick={onSwitchToRegister}
          className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
        >
          Não tem conta? Cadastre-se com código de guilda
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
