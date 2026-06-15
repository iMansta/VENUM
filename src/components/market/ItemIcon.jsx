import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';

/**
 * ItemIcon component - Fetches and displays item icons from Albion Online Data Project API
 * @param {string} itemId - The item ID to fetch icon for
 * @param {number} size - Icon size in pixels (default: 32)
 * @param {string} className - Additional CSS classes
 */

const ItemIcon = ({ itemId, size = 32, className = '' }) => {
  const [iconUrl, setIconUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchIcon = async () => {
      setLoading(true);
      setError(false);

      try {
        // Albion Online Data Project API for item icons
        // Format: https://render.albiononline.com/v1/item/ITEM_ID
        const response = await fetch(`https://render.albiononline.com/v1/item/${itemId}`);
        
        if (response.ok) {
          // The API returns the image directly
          setIconUrl(`https://render.albiononline.com/v1/item/${itemId}`);
        } else {
          throw new Error('Failed to fetch icon');
        }
      } catch (err) {
        console.error(`Error fetching icon for ${itemId}:`, err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (itemId) {
      fetchIcon();
    }
  }, [itemId]);

  if (loading) {
    return (
      <div
        className={`bg-slate-800 rounded flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <Package className="text-gray-600" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }

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
