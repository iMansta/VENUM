/**
 * Albion Online Data API Service
 * Fetches market data from the official Albion Online Data Project
 */

const ALBION_API_BASE = 'https://www.albion-online-data.com/api/v2/stats/prices';

/**
 * Mock data for when API fails or is unavailable
 */
const MOCK_OPPORTUNITIES = [
  {
    itemId: 'T6_BAG',
    itemName: 'T6_BAG',
    lowestCity: 'Martlock',
    lowestPrice: 45000,
    bmPrice: 75000,
    netProfit: 30000,
    margin: 66.7,
  },
  {
    itemId: 'T6_PLANKS',
    itemName: 'T6_PLANKS',
    lowestCity: 'Thetford',
    lowestPrice: 12000,
    bmPrice: 28000,
    netProfit: 16000,
    margin: 133.3,
  },
  {
    itemId: 'T6_METALBAR',
    itemName: 'T6_METALBAR',
    lowestCity: 'Fort Sterling',
    lowestPrice: 8000,
    bmPrice: 22000,
    netProfit: 14000,
    margin: 175.0,
  },
  {
    itemId: 'T5_BAG',
    itemName: 'T5_BAG',
    lowestCity: 'Lymhurst',
    lowestPrice: 15000,
    bmPrice: 32000,
    netProfit: 17000,
    margin: 113.3,
  },
  {
    itemId: 'T5_PLANKS',
    itemName: 'T5_PLANKS',
    lowestCity: 'Martlock',
    lowestPrice: 4000,
    bmPrice: 12000,
    netProfit: 8000,
    margin: 200.0,
  },
];

/**
 * Fetch price data for a specific item
 * @param {string} itemName - The item name (e.g., 'T4_BAG', 'T5_PLANKS')
 * @param {number} locations - Number of locations to fetch (default: 1 for Caerleon)
 * @returns {Promise<Object>} Price data for the item
 */
export const fetchItemPrice = async (itemName, locations = 1) => {
  try {
    console.log(`Fetching price for ${itemName} from Albion API`);
    const response = await fetch(`${ALBION_API_BASE}/${itemName}?locations=${locations}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch price for ${itemName}: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`Price data for ${itemName}:`, data);
    return data[0] || null;
  } catch (error) {
    console.error(`Error fetching price for ${itemName}:`, error);
    return null;
  }
};

/**
 * Fetch price data for multiple items
 * @param {Array<Object>} items - Array of item objects with itemId, enchantment, quantity
 * @param {number} locations - Number of locations to fetch
 * @returns {Promise<Array>} Array of price data for all items
 */
export const fetchMultipleItemPrices = async (items, locations = 1) => {
  try {
    const promises = items.map(item => fetchItemPrice(item.itemId, locations));
    const results = await Promise.all(promises);
    return results.filter(result => result !== null);
  } catch (error) {
    console.error('Error fetching multiple item prices:', error);
    return [];
  }
};

/**
 * Calculate arbitrage opportunity for an item
 * @param {Object} priceData - Price data from Albion API
 * @param {string} targetCity - Target city (default: 'Caerleon')
 * @returns {Object|null} Arbitrage opportunity data
 */
export const calculateArbitrage = (priceData, targetCity = 'Caerleon') => {
  if (!priceData) return null;

  const bmPrice = priceData.data?.['Caerleon']?.sell_price_min || 0;
  const lowestCity = Object.entries(priceData.data || {})
    .filter(([city]) => city !== 'Caerleon')
    .reduce((lowest, [city, data]) => {
      const buyPrice = data.buy_price_min || Infinity;
      return buyPrice < lowest.price ? { city, price: buyPrice } : lowest;
    }, { city: 'Unknown', price: Infinity });

  if (lowestCity.price === Infinity) return null;

  const netProfit = bmPrice - lowestCity.price;
  const margin = lowestCity.price > 0 ? ((netProfit / lowestCity.price) * 100) : 0;

  return {
    itemId: priceData.item_id,
    itemName: priceData.item_id,
    lowestCity: lowestCity.city,
    lowestPrice: lowestCity.price,
    bmPrice: bmPrice,
    netProfit: netProfit,
    margin: margin,
  };
};

/**
 * Fetch top arbitrage opportunities for a list of items
 * @param {Array<Object>} items - Array of item objects with itemId, enchantment, quantity
 * @param {number} limit - Number of top opportunities to return
 * @returns {Promise<Array>} Array of top arbitrage opportunities
 */
export const fetchTopOpportunities = async (items, limit = 10) => {
  try {
    console.log(`Fetching top opportunities for ${items.length} items`);
    const priceData = await fetchMultipleItemPrices(items);
    console.log(`Received price data for ${priceData.length} items`);
    
    if (priceData.length === 0) {
      console.warn('No price data received from API, using mock data');
      return MOCK_OPPORTUNITIES.slice(0, limit);
    }
    
    // Map price data with item metadata
    const opportunities = priceData
      .map((data, index) => {
        const itemMetadata = items[index] || { enchantment: 0, quantity: 1 };
        const arbitrage = calculateArbitrage(data);
        if (arbitrage) {
          return {
            ...arbitrage,
            enchantment: itemMetadata.enchantment,
            quantity: itemMetadata.quantity,
          };
        }
        return null;
      })
      .filter(opp => opp !== null && opp.netProfit > 0)
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, limit);

    console.log(`Calculated ${opportunities.length} profitable opportunities`);
    
    if (opportunities.length === 0) {
      console.warn('No profitable opportunities found, using mock data');
      return MOCK_OPPORTUNITIES.slice(0, limit);
    }
    
    return opportunities;
  } catch (error) {
    console.error('Error fetching top opportunities:', error);
    console.warn('API failed, using mock data');
    return MOCK_OPPORTUNITIES.slice(0, limit);
  }
};

// Common items to check for arbitrage with enchantment and quantity
export const COMMON_ITEMS = [
  { itemId: 'T4_BAG', enchantment: 0, quantity: 1 },
  { itemId: 'T5_BAG', enchantment: 0, quantity: 1 },
  { itemId: 'T6_BAG', enchantment: 0, quantity: 1 },
  { itemId: 'T4_PLANKS', enchantment: 0, quantity: 100 },
  { itemId: 'T5_PLANKS', enchantment: 0, quantity: 100 },
  { itemId: 'T6_PLANKS', enchantment: 0, quantity: 100 },
  { itemId: 'T4_METALBAR', enchantment: 0, quantity: 100 },
  { itemId: 'T5_METALBAR', enchantment: 0, quantity: 100 },
  { itemId: 'T6_METALBAR', enchantment: 0, quantity: 100 },
  { itemId: 'T4_LEATHER', enchantment: 0, quantity: 100 },
  { itemId: 'T5_LEATHER', enchantment: 0, quantity: 100 },
  { itemId: 'T6_LEATHER', enchantment: 0, quantity: 100 },
  { itemId: 'T4_CLOTH', enchantment: 0, quantity: 100 },
  { itemId: 'T5_CLOTH', enchantment: 0, quantity: 100 },
  { itemId: 'T6_CLOTH', enchantment: 0, quantity: 100 },
  { itemId: 'T4_ORE', enchantment: 0, quantity: 100 },
  { itemId: 'T5_ORE', enchantment: 0, quantity: 100 },
  { itemId: 'T6_ORE', enchantment: 0, quantity: 100 },
  { itemId: 'T4_LOG', enchantment: 0, quantity: 100 },
  { itemId: 'T5_LOG', enchantment: 0, quantity: 100 },
  { itemId: 'T6_LOG', enchantment: 0, quantity: 100 },
  { itemId: 'T4_HIDE', enchantment: 0, quantity: 100 },
  { itemId: 'T5_HIDE', enchantment: 0, quantity: 100 },
  { itemId: 'T6_HIDE', enchantment: 0, quantity: 100 },
  { itemId: 'T4_FIBER', enchantment: 0, quantity: 100 },
  { itemId: 'T5_FIBER', enchantment: 0, quantity: 100 },
  { itemId: 'T6_FIBER', enchantment: 0, quantity: 100 },
];
