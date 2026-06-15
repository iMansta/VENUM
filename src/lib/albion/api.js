/**
 * Albion Online Data API Service
 * Fetches market data from the official Albion Online Data Project
 */

const ALBION_API_BASE = 'https://www.albion-online-data.com/api/v2/stats/prices';

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
 * @param {Array<string>} itemNames - Array of item names
 * @param {number} locations - Number of locations to fetch
 * @returns {Promise<Array>} Array of price data for all items
 */
export const fetchMultipleItemPrices = async (itemNames, locations = 1) => {
  try {
    const promises = itemNames.map(itemName => fetchItemPrice(itemName, locations));
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
 * @param {Array<string>} itemNames - Array of item names to check
 * @param {number} limit - Number of top opportunities to return
 * @returns {Promise<Array>} Array of top arbitrage opportunities
 */
export const fetchTopOpportunities = async (itemNames, limit = 10) => {
  try {
    console.log(`Fetching top opportunities for ${itemNames.length} items`);
    const priceData = await fetchMultipleItemPrices(itemNames);
    console.log(`Received price data for ${priceData.length} items`);
    
    const opportunities = priceData
      .map(data => calculateArbitrage(data))
      .filter(opp => opp !== null && opp.netProfit > 0)
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, limit);

    console.log(`Calculated ${opportunities.length} profitable opportunities`);
    return opportunities;
  } catch (error) {
    console.error('Error fetching top opportunities:', error);
    return [];
  }
};

// Common items to check for arbitrage
export const COMMON_ITEMS = [
  'T4_BAG',
  'T5_BAG',
  'T6_BAG',
  'T4_PLANKS',
  'T5_PLANKS',
  'T6_PLANKS',
  'T4_METALBAR',
  'T5_METALBAR',
  'T6_METALBAR',
  'T4_LEATHER',
  'T5_LEATHER',
  'T6_LEATHER',
  'T4_CLOTH',
  'T5_CLOTH',
  'T6_CLOTH',
  'T4_ORE',
  'T5_ORE',
  'T6_ORE',
  'T4_LOG',
  'T5_LOG',
  'T6_LOG',
  'T4_HIDE',
  'T5_HIDE',
  'T6_HIDE',
  'T4_FIBER',
  'T5_FIBER',
  'T6_FIBER',
];
