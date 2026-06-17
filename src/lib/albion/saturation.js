/**
 * Market saturation system for Black Market
 * Simulates price drop based on volume transported
 */

// Saturation thresholds (percentage of max volume)
export const SATURATION_LEVELS = {
  LOW: { max: 30, color: 'green', label: 'Baixa Saturação', multiplier: 1.0 },
  MEDIUM: { max: 60, color: 'yellow', label: 'Saturação Média', multiplier: 0.85 },
  HIGH: { max: 85, color: 'orange', label: 'Alta Saturação', multiplier: 0.7 },
  CRITICAL: { max: 100, color: 'red', label: 'Saturação Crítica', multiplier: 0.5 },
};

// Simulated current saturation for each item (in production, this would come from database)
export const itemSaturation = new Map();

/**
 * Get saturation level for an item
 * @param {string} itemId - Item ID
 * @returns {Object} Saturation level object
 */
export const getSaturationLevel = (itemId) => {
  const saturation = itemSaturation.get(itemId) || 0;
  
  if (saturation <= SATURATION_LEVELS.LOW.max) return SATURATION_LEVELS.LOW;
  if (saturation <= SATURATION_LEVELS.MEDIUM.max) return SATURATION_LEVELS.MEDIUM;
  if (saturation <= SATURATION_LEVELS.HIGH.max) return SATURATION_LEVELS.HIGH;
  return SATURATION_LEVELS.CRITICAL;
};

/**
 * Update saturation for an item
 * @param {string} itemId - Item ID
 * @param {number} volume - Volume to add
 */
export const updateSaturation = (itemId, volume) => {
  const currentSaturation = itemSaturation.get(itemId) || 0;
  const newSaturation = Math.min(100, currentSaturation + volume);
  itemSaturation.set(itemId, newSaturation);
};

/**
 * Calculate price drop due to saturation
 * @param {string} itemId - Item ID
 * @param {number} basePrice - Base price
 * @returns {number} Adjusted price
 */
export const calculateSaturationAdjustedPrice = (itemId, basePrice) => {
  const saturationLevel = getSaturationLevel(itemId);
  return basePrice * saturationLevel.multiplier;
};

/**
 * Get saturation warning message
 * @param {string} itemId - Item ID
 * @returns {string} Warning message
 */
export const getSaturationWarning = (itemId) => {
  const saturationLevel = getSaturationLevel(itemId);
  const saturation = itemSaturation.get(itemId) || 0;
  
  if (saturationLevel === SATURATION_LEVELS.CRITICAL) {
    return `⚠️ Aviso: Saturação crítica (${saturation}%) - Preço reduzido em 50%`;
  }
  if (saturationLevel === SATURATION_LEVELS.HIGH) {
    return `⚠️ Aviso: Alta saturação (${saturation}%) - Preço reduzido em 30%`;
  }
  if (saturationLevel === SATURATION_LEVELS.MEDIUM) {
    return `ℹ️ Saturação média (${saturation}%) - Preço reduzido em 15%`;
  }
  return null;
};
