/**
 * Risk mapping for Albion Online routes
 * Based on zone colors and PvP activity
 * Green: Low risk (safe zones, blue zones)
 * Yellow: Medium risk (yellow zones, occasional PvP)
 * Red: High risk (red zones, black zones, frequent ganks)
 */

export const RISK_LEVELS = {
  LOW: { value: 0.05, color: 'green', label: 'Baixo Risco' },
  MEDIUM: { value: 0.15, color: 'yellow', label: 'Risco Médio' },
  HIGH: { value: 0.30, color: 'red', label: 'Alto Risco' },
};

export const ROUTE_RISK_MAP = {
  // From Martlock (Blue Zone)
  'Martlock-Caerleon': RISK_LEVELS.LOW,
  'Martlock-Lymhurst': RISK_LEVELS.LOW,
  'Martlock-Thetford': RISK_LEVELS.LOW,
  'Martlock-Fort Sterling': RISK_LEVELS.LOW,
  
  // From Lymhurst (Blue Zone)
  'Lymhurst-Caerleon': RISK_LEVELS.LOW,
  'Lymhurst-Martlock': RISK_LEVELS.LOW,
  'Lymhurst-Thetford': RISK_LEVELS.LOW,
  'Lymhurst-Fort Sterling': RISK_LEVELS.LOW,
  
  // From Thetford (Blue Zone)
  'Thetford-Caerleon': RISK_LEVELS.LOW,
  'Thetford-Martlock': RISK_LEVELS.LOW,
  'Thetford-Lymhurst': RISK_LEVELS.LOW,
  'Thetford-Fort Sterling': RISK_LEVELS.LOW,
  
  // From Fort Sterling (Blue Zone)
  'Fort Sterling-Caerleon': RISK_LEVELS.LOW,
  'Fort Sterling-Martlock': RISK_LEVELS.LOW,
  'Fort Sterling-Lymhurst': RISK_LEVELS.LOW,
  'Fort Sterling-Thetford': RISK_LEVELS.LOW,
  
  // From Caerleon (Red Zone - Black Market)
  'Caerleon-Martlock': RISK_LEVELS.MEDIUM,
  'Caerleon-Lymhurst': RISK_LEVELS.MEDIUM,
  'Caerleon-Thetford': RISK_LEVELS.MEDIUM,
  'Caerleon-Fort Sterling': RISK_LEVELS.MEDIUM,
  
  // From Yellow Zones (Medium Risk)
  'Bridgewatch-Caerleon': RISK_LEVELS.MEDIUM,
  'Caerleon-Bridgewatch': RISK_LEVELS.MEDIUM,
  'Lymhurst-Bridgewatch': RISK_LEVELS.MEDIUM,
  'Bridgewatch-Lymhurst': RISK_LEVELS.MEDIUM,
  
  // From Red Zones (High Risk)
  'Fort Sterling-Caerleon': RISK_LEVELS.HIGH, // Through red zones
  'Caerleon-Fort Sterling': RISK_LEVELS.HIGH,
  'Thetford-Caerleon': RISK_LEVELS.HIGH, // Through red zones
  'Caerleon-Thetford': RISK_LEVELS.HIGH,
};

/**
 * Get risk level for a route
 * @param {string} fromCity - Origin city
 * @param {string} toCity - Destination city
 * @returns {Object} Risk level object
 */
export const getRouteRisk = (fromCity, toCity) => {
  const routeKey = `${fromCity}-${toCity}`;
  return ROUTE_RISK_MAP[routeKey] || RISK_LEVELS.MEDIUM;
};

/**
 * Calculate expected profit considering risk
 * @param {number} profit - Gross profit
 * @param {number} riskValue - Risk value (0-1)
 * @returns {number} Expected profit
 */
export const calculateExpectedProfit = (profit, riskValue) => {
  return profit * (1 - riskValue);
};

/**
 * Get travel time between cities (in minutes)
 * Based on Albion Online travel times
 */
export const TRAVEL_TIMES = {
  'Martlock-Caerleon': 8,
  'Martlock-Lymhurst': 6,
  'Martlock-Thetford': 7,
  'Martlock-Fort Sterling': 5,
  'Lymhurst-Caerleon': 7,
  'Lymhurst-Martlock': 6,
  'Lymhurst-Thetford': 5,
  'Lymhurst-Fort Sterling': 8,
  'Thetford-Caerleon': 6,
  'Thetford-Martlock': 7,
  'Thetford-Lymhurst': 5,
  'Thetford-Fort Sterling': 6,
  'Fort Sterling-Caerleon': 5,
  'Fort Sterling-Martlock': 5,
  'Fort Sterling-Lymhurst': 8,
  'Fort Sterling-Thetford': 6,
  'Bridgewatch-Caerleon': 10,
  'Caerleon-Bridgewatch': 10,
  'Lymhurst-Bridgewatch': 12,
  'Bridgewatch-Lymhurst': 12,
};

/**
 * Get travel time between cities
 * @param {string} fromCity - Origin city
 * @param {string} toCity - Destination city
 * @returns {number} Travel time in minutes
 */
export const getTravelTime = (fromCity, toCity) => {
  const routeKey = `${fromCity}-${toCity}`;
  return TRAVEL_TIMES[routeKey] || 10; // Default 10 minutes
};

/**
 * Calculate efficiency (profit per minute)
 * @param {number} profit - Gross profit
 * @param {number} travelTime - Travel time in minutes
 * @returns {number} Profit per minute
 */
export const calculateEfficiency = (profit, travelTime) => {
  if (travelTime <= 0) return 0;
  return profit / travelTime;
};

/**
 * Calculate efficiency considering risk
 * @param {number} profit - Gross profit
 * @param {number} travelTime - Travel time in minutes
 * @param {number} riskValue - Risk value (0-1)
 * @returns {number} Risk-adjusted efficiency
 */
export const calculateRiskAdjustedEfficiency = (profit, travelTime, riskValue) => {
  const expectedProfit = calculateExpectedProfit(profit, riskValue);
  return calculateEfficiency(expectedProfit, travelTime);
};
