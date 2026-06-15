import { useState } from 'react';
import { Package } from 'lucide-react';

/**
 * ItemIcon component - Displays item icons from Albion Online Data Project API
 * @param {string} itemId - The item ID to fetch icon for
 * @param {number} size - Icon size in pixels (default: 32)
 * @param {string} className - Additional CSS classes
 */

const ItemIcon = ({ itemId, size = 32, className = '' }) => {
  const [error, setError] = useState(false);

  const iconUrl = itemId ? `https://render.albiononline.com/v1/item/${itemId}` : null;

  if (error || !iconUrl) {
    return (
      <div
        className={`bg-slate-800 rounded flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        title={itemId}
      >
        <Package className="text-gray-600" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={itemId}
      className={`rounded ${className}`}
      style={{ width: size, height: size }}
      onError={() => setError(true)}
      title={itemId}
    />
  );
};

export default ItemIcon;
