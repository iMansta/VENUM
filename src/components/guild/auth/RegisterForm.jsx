import { useState } from 'react';
import { Lock, Mail, User, Key, AlertCircle, Check } from 'lucide-react';
import { signUp } from '../../../lib/supabase/auth';
import { supabase } from '../../../lib/supabase/client';

/**
 * RegisterForm component - User registration with guild code validation
 * @param {Function} onSuccess - Callback when registration succeeds
 * @param {Function} onSwitchToLogin - Callback to switch to login
 */

const RegisterForm = ({ onSuccess, onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [guildCode, setGuildCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeValidated, setCodeValidated] = useState(false);

  const validateGuildCode = async () => {
    if (!guildCode) {
      setError('Por favor, insira o código de guilda');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.rpc('validate_guild_code', {
        p_code: guildCode.toUpperCase(),
      });

      if (error) throw error;

      const result = JSON.parse(data);
      
      if (result.success) {
        setCodeValidated(true);
        setLoading(false);
        return true;
      } else {
        setError(result.message || 'Código de guilda inválido');
        setLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Error validating guild code:', error);
      setError('Erro ao validar código. Tente novamente.');
      setLoading(false);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (!codeValidated) {
      setError('Por favor, valide o código de guilda primeiro');
      setLoading(false);
      return;
    }

    const result = await signUp(username, password, guildCode);

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
        <h2 className="text-2xl font-bold text-white mb-2">Juntar-se à Guilda</h2>
        <p className="text-gray-400 text-sm">Cadastre-se no VENUM MARKET Guild Hub</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Guild Code Validation */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Código de Guilda *
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={guildCode}
                onChange={(e) => setGuildCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="VENUM2024"
                disabled={codeValidated}
              />
            </div>
            {!codeValidated && (
              <button
                type="button"
                onClick={validateGuildCode}
                disabled={loading || !guildCode}
                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Validar
              </button>
            )}
            {codeValidated && (
              <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-lg flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">Válido</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Solicite o código aos oficiais da guilda I V E N U M I
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nome de Usuário *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Seu nome no jogo"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email *
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
            Senha *
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Confirmar Senha *
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Confirme sua senha"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !codeValidated}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={onSwitchToLogin}
          className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
        >
          Já tem conta? Entrar
        </button>
      </div>
    </div>
  );
};

export default RegisterForm;
