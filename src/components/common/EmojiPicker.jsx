import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

// Emojis frequentes para avisos/títulos/descrições da guild.
const EMOJI_GROUPS = {
  Destaque: ['📢', '🚨', '⚠️', '🔴', '🟢', '🟡', '⭐', '✨', '🔥', '❗', '‼️', '📣'],
  Guild: ['🛡️', '⚔️', '🏰', '👑', '🤝', '🐍', '💰', '🪙', '🏆', '🎯', '📅', '⏰'],
  Combate: ['⚔️', '🗡️', '🏹', '💥', '💀', '🩸', '🛡️', '🐴', '🧙', '🧝', '🔮', '💚'],
  Reações: ['✅', '❌', '👍', '👎', '🎉', '😎', '🙏', '👀', '💯', '🚀', '📌', '🔔'],
};

/**
 * Botão de emoji para inserir em campos de título/descrição.
 * onSelect recebe o emoji escolhido; o componente pai decide como inserir.
 */
const EmojiPicker = ({ onSelect, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={`relative inline-block ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-gray-400 hover:text-amber-400 transition-colors p-1 rounded"
        title="Inserir emoji"
      >
        <Smile className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute z-50 right-0 mt-1 w-64 max-h-72 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 space-y-3">
          {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
            <div key={group}>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{group}</p>
              <div className="grid grid-cols-6 gap-1">
                {emojis.map((emoji, i) => (
                  <button
                    key={`${group}-${i}`}
                    type="button"
                    onClick={() => {
                      onSelect?.(emoji);
                      setOpen(false);
                    }}
                    className="text-lg hover:bg-slate-800 rounded p-1 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;
