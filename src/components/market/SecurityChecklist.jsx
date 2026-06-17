import { useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, X } from 'lucide-react';

/**
 * Security Checklist Modal for Transport Reservations
 * Ensures transporters are prepared before confirming reservation
 */

const SecurityChecklist = ({ opportunity, onConfirm, onCancel }) => {
  const [checkedItems, setCheckedItems] = useState({
    invisibility: false,
    escapeSetup: false,
    inventorySpace: false,
    mountReady: false,
    routeKnowledge: false,
  });

  const allChecked = Object.values(checkedItems).every(Boolean);

  const handleToggle = (key) => {
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg border border-slate-700 max-w-md w-full">
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-amber-500" />
              <h2 className="text-xl font-bold text-white">Checklist de Segurança</h2>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Confirme que você está preparado para o transporte de {opportunity?.itemName}
          </p>
        </div>

        {/* Checklist Items */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-amber-400 font-semibold text-sm mb-1">Rota: {opportunity?.lowestCity} → Caerleon</h3>
                <p className="text-gray-400 text-xs">
                  Investimento: {new Intl.NumberFormat('pt-BR').format(opportunity?.lowestPrice || 0)} prata
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={checkedItems.invisibility}
                onChange={() => handleToggle('invisibility')}
                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">Invisibilidade Ativa</span>
                  {checkedItems.invisibility && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <p className="text-gray-500 text-xs mt-1">Verifique se sua poção de invisibilidade está ativa</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={checkedItems.escapeSetup}
                onChange={() => handleToggle('escapeSetup')}
                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">Setup de Fuga</span>
                  {checkedItems.escapeSetup && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <p className="text-gray-500 text-xs mt-1">Prepare sua rota de fuga alternativa</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={checkedItems.inventorySpace}
                onChange={() => handleToggle('inventorySpace')}
                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">Espaço no Inventário</span>
                  {checkedItems.inventorySpace && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <p className="text-gray-500 text-xs mt-1">Verifique se tem espaço suficiente para o item</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={checkedItems.mountReady}
                onChange={() => handleToggle('mountReady')}
                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">Montaria Pronta</span>
                  {checkedItems.mountReady && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <p className="text-gray-500 text-xs mt-1">Sua montaria está equipada e pronta</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={checkedItems.routeKnowledge}
                onChange={() => handleToggle('routeKnowledge')}
                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">Conhecimento da Rota</span>
                  {checkedItems.routeKnowledge && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <p className="text-gray-500 text-xs mt-1">Você conhece a rota e os pontos perigosos</p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800 px-6 py-4 border-t border-slate-700">
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(checkedItems)}
              disabled={!allChecked}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              Confirmar Reserva
            </button>
          </div>
          {!allChecked && (
            <p className="text-gray-500 text-xs text-center mt-2">
              Marque todos os itens para confirmar a reserva
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityChecklist;
