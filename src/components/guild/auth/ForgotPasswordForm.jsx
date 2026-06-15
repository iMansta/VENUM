import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { resetPassword } from '../../../lib/supabase/auth';

/**
 * ForgotPasswordForm component - Password reset via email
 * @param {Function} onSuccess - Callback when password reset email is sent
 * @param {Function} onBackToLogin - Callback to switch back to login
 */

const ForgotPasswordForm = ({ onSuccess, onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!email || !email.includes('@')) {
      setError('Por favor, insira um email válido');
      setLoading(false);
      return;
    }

    const result = await resetPassword(email);

    if (result.success) {
      setSuccess(true);
      setError('');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h2>
        <p className="text-gray-400 text-sm">Enviaremos um link de recuperação para seu email</p>
      </div>

      {success && (
        <div className="mb-4 bg-green-900/30 border border-green-500/50 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-green-300 font-medium">Email enviado com sucesso!</p>
            <p className="text-xs text-green-400 mt-1">Verifique sua caixa de entrada para o link de recuperação.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {!success ? (
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
          </button>
        </form>
      ) : (
        <button
          onClick={onBackToLogin}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Voltar para Login
        </button>
      )}

      <div className="mt-4 text-center">
        <button
          onClick={onBackToLogin}
          className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors flex items-center gap-2 justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Login
        </button>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
