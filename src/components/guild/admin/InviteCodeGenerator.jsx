import { useState, useEffect } from 'react';
import { Key, Plus, Copy, Check, X, RefreshCw, Trash2 } from 'lucide-react';
import { getGuildCodes, createGuildCode, deactivateGuildCode, deleteGuildCode, generateGuildCode } from '@/lib/supabase/guildCodes';

/**
 * InviteCodeGenerator component - Generate and manage guild invite codes
 */

const InviteCodeGenerator = ({ userId, userRole }) => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    setLoading(true);
    const { success, data } = await getGuildCodes();
    if (success) {
      setCodes(data);
    }
    setLoading(false);
  };

  const handleGenerateCode = () => {
    setNewCode(generateGuildCode());
  };

  const handleCreateCode = async () => {
    if (!newCode.trim()) return;

    console.log('Creating invite code with data:', { code: newCode, max_uses: maxUses, createdBy: userId });
    const result = await createGuildCode({
      code: newCode,
      max_uses,
      createdBy: userId,
    });
    console.log('Invite code creation result:', result);

    if (result.success) {
      setShowCreateForm(false);
      setNewCode('');
      setMaxUses(1);
      loadCodes();
    } else {
      console.error('Failed to create invite code:', result.error);
      alert(`Erro ao criar código: ${result.error}`);
    }
  };

  const handleDeactivateCode = async (codeId) => {
    const result = await deactivateGuildCode(codeId);
    if (result.success) {
      loadCodes();
    }
  };

  const handleDeleteCode = async (codeId) => {
    if (window.confirm('Tem certeza que deseja excluir este código?')) {
      const result = await deleteGuildCode(codeId);
      if (result.success) {
        loadCodes();
      }
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const activeCodes = codes.filter(c => c.is_active);
  const inactiveCodes = codes.filter(c => !c.is_active);

  return (
    <div className="space-y-6">
      {/* Create Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Códigos de Convite</h3>
        <button
          onClick={() => {
            setShowCreateForm(true);
            handleGenerateCode();
          }}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Código
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Código
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="VENUMXXXX"
                />
                <button
                  onClick={handleGenerateCode}
                  className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg transition-colors"
                  title="Gerar código aleatório"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Máximo de Usos
              </label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                min="1"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleCreateCode}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Criar
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Codes */}
      <div>
        <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
          <Key className="w-4 h-4 text-green-400" />
          Códigos Ativos ({activeCodes.length})
        </h4>
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-400">Carregando...</p>
          </div>
        ) : activeCodes.length === 0 ? (
          <div className="bg-slate-800/30 rounded-lg p-6 text-center">
            <Key className="w-12 h-12 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum código ativo</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeCodes.map((code) => (
              <div
                key={code.id}
                className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded font-mono font-bold">
                    {code.code}
                  </div>
                  <div className="text-sm text-gray-400">
                    <span>{code.used_count}/{code.max_uses} usos</span>
                    {code.expires_at && (
                      <span className="ml-2">
                        • Expira: {new Date(code.expires_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyCode(code.code)}
                    className="text-gray-400 hover:text-white p-2 rounded hover:bg-slate-700 transition-colors"
                    title="Copiar código"
                  >
                    {copiedCode === code.code ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeactivateCode(code.id)}
                    className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-500/10 transition-colors"
                    title="Desativar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Codes */}
      {inactiveCodes.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-gray-500" />
            Códigos Inativos ({inactiveCodes.length})
          </h4>
          <div className="space-y-2">
            {inactiveCodes.map((code) => (
              <div
                key={code.id}
                className="bg-slate-800/30 rounded-lg p-4 border border-slate-700 flex items-center justify-between opacity-60"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-gray-500/20 text-gray-400 px-3 py-1 rounded font-mono font-bold">
                    {code.code}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span>{code.used_count}/{code.max_uses} usos</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCode(code.id)}
                  className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-500/10 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteCodeGenerator;
