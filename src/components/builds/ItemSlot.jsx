import { memo, useState } from 'react';
import { Package, X } from 'lucide-react';
import { getAlbionIconUrl } from '@/utils/albionIcon';
import { translateItem } from '@/utils/itemTranslator';

/**
 * ItemSlot - Renderiza um slot de equipamento com ícone do Albian Online.
 *
 * - Memoizado com React.memo para não rerenderizar quando outros
 *   slots do mesmo BuildBuilder mudam.
 * - Visual: caixa escura com borda hover brilhante (estilo do jogo).
 * - Fallback: se a imagem falhar ou o ID for inválido, mostra um
 *   placeholder cinza com o ícone genérico `Package`.
 * - Modo edição: recebe `onRemove` para permitir limpar o slot.
 *
 * Props:
 *   slotKey      chave do slot (ex: 'main_hand')
 *   slotLabel    rótulo legível (ex: 'Mão Principal')
 *   iconPrefix   prefixo do ícone do slot (ex: 'MAIN_')
 *   itemId       ID do item atual (ou null para slot vazio)
 *   size         tamanho em px (default 56)
 *   editable     se true, mostra botão X para remover
 *   onRemove     callback chamado quando o usuário clica no X
 *   onClick      callback ao clicar no slot
 */
const ItemSlot = ({
  slotKey,
  slotLabel,
  iconPrefix,
  itemId,
  size = 56,
  editable = false,
  onRemove,
  onClick,
  selected = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const iconUrl = itemId ? getAlbionIconUrl(itemId) : null;
  const showFallback = !iconUrl || imgError;
  const isEmpty = !itemId;

  const handleClick = (e) => {
    e?.stopPropagation?.();
    if (onClick) onClick({ slotKey, slotLabel, iconPrefix, currentItemId: itemId });
  };

  const handleRemove = (e) => {
    e?.stopPropagation?.();
    if (onRemove) onRemove(slotKey);
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        title={isEmpty ? `${slotLabel} (vazio)` : `${slotLabel}: ${itemId}`}
        className={[
          'group relative flex items-center justify-center',
          'rounded-md border-2 transition-all',
          'bg-zinc-900 hover:bg-zinc-800',
          isEmpty
            ? 'border-dashed border-zinc-700 hover:border-zinc-500'
            : 'border-zinc-700 hover:border-amber-400 hover:shadow-[0_0_12px_rgba(245,158,11,0.5)]',
          selected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-950' : '',
          editable ? 'cursor-pointer' : 'cursor-default',
        ].join(' ')}
        style={{ width: size + 8, height: size + 8 }}
      >
        {showFallback ? (
          <div className="flex flex-col items-center justify-center gap-1 text-zinc-600">
            <Package style={{ width: size * 0.5, height: size * 0.5 }} />
            {iconPrefix && !isEmpty && (
              <span className="text-[8px] font-mono opacity-60">{iconPrefix}</span>
            )}
          </div>
        ) : (
          <img
            src={iconUrl}
            alt={itemId}
            onError={() => setImgError(true)}
            className="rounded-sm"
            style={{ width: size, height: size }}
            draggable={false}
          />
        )}

        {editable && !isEmpty && onRemove && (
          <span
            role="button"
            tabIndex={-1}
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            title="Remover item"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
        {slotLabel}
      </span>

      {!isEmpty && (
        <span className="text-[10px] text-zinc-400 font-mono max-w-[90px] truncate text-center" title={itemId}>
          {translateItem(itemId, { includeTier: false })}
        </span>
      )}
    </div>
  );
};

// Compara só props que importam para renderização visual.
// onClick/onRemove são recriados a cada render do pai — usamos
// shallow compare via memo custom.
export default memo(ItemSlot, (prev, next) => {
  // Re-renderiza se: ID do item mudou, ou flags visuais mudaram,
  // ou size mudou. Callbacks onClick/onRemove são recriados a cada
  // render do pai, mas não devem causar re-render do slot se o
  // conteúdo dele não mudou.
  return (
    prev.itemId === next.itemId &&
    prev.size === next.size &&
    prev.editable === next.editable &&
    prev.selected === next.selected &&
    prev.slotKey === next.slotKey &&
    prev.slotLabel === next.slotLabel &&
    prev.iconPrefix === next.iconPrefix
  );
});