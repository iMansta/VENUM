import { useState } from 'react';
import { Package } from 'lucide-react';
import { getAlbionIconUrl, normalizeAlbionAssetUrl } from '@/utils/albionIcon';

/**
 * Exibe ícone oficial do Albion via cache interno /api/albion-render.
 * O endpoint do hub evita consultas diretas do navegador ao Render Service.
 */
const ItemIcon = ({ itemId, imageUrl = null, size = 32, className = '' }) => {
  const fallbackIconUrl = itemId ? getAlbionIconUrl(itemId) : null;
  const [source, setSource] = useState(
    normalizeAlbionAssetUrl(imageUrl, fallbackIconUrl) || fallbackIconUrl || null
  );

  const boxStyle = { width: size, height: size };
  const iconSize = size * 0.5;

  if (!source) {
    return (
      <div
        className={`bg-slate-800 rounded flex items-center justify-center shrink-0 ${className}`}
        style={boxStyle}
        title={itemId}
      >
        <Package className="text-gray-600" style={{ width: iconSize, height: iconSize }} />
      </div>
    );
  }

  return (
    <img
      src={source}
      alt={itemId}
      className={`rounded shrink-0 object-contain bg-slate-900/50 ${className}`}
      style={boxStyle}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (source !== fallbackIconUrl && fallbackIconUrl) {
          setSource(fallbackIconUrl);
          return;
        }
        setSource(null);
      }}
      title={itemId}
    />
  );
};

export default ItemIcon;
