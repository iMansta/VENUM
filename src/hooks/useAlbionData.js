import { useState, useEffect, useCallback } from 'react';

const ITEMS_TO_MONITOR = [
  'T4_MAIN_SPEAR', 'T5_MAIN_SPEAR', 'T6_MAIN_SPEAR', 'T7_MAIN_SPEAR', 'T8_MAIN_SPEAR',
  'T4_BAG', 'T5_BAG', 'T6_BAG', 'T7_BAG', 'T8_BAG',
  'T4_CAPE', 'T5_CAPE', 'T6_CAPE'
];

const CITIES = ['Caerleon', 'Lymhurst', 'Martlock', 'FortSterling', 'Bridgewatch', 'Thetford'];

const MOCK_DATA = ITEMS_TO_MONITOR.map(item => ({
  item_id: item,
  data: CITIES.map(city => ({
    item_id: item,
    city: city,
    prices: {
      sell: city === 'Caerleon' ? Math.floor(Math.random() * 500000) + 100000 : Math.floor(Math.random() * 300000) + 50000
    }
  }))
}));

export const useAlbionData = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const formatSilver = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const itemsString = ITEMS_TO_MONITOR.join(',');
      const response = await fetch(
        `https://www.albion-online-data.com/api/v2/stats/prices/${itemsString}?locations=Caerleon,Lymhurst,Martlock,FortSterling,Bridgewatch,Thetford`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const apiData = await response.json();

      if (!Array.isArray(apiData) || apiData.length === 0) {
        throw new Error('Empty response from API');
      }

      // Group data by item_id
      const groupedData = {};
      apiData.forEach(item => {
        if (!groupedData[item.item_id]) {
          groupedData[item.item_id] = [];
        }
        groupedData[item.item_id].push(item);
      });

      // Transform to expected format
      const transformedData = Object.keys(groupedData).map(itemId => ({
        item_id: itemId,
        data: groupedData[itemId]
      }));

      setData(transformedData);
      setLastUpdate(new Date().toISOString());
      
      // Save to LocalStorage
      localStorage.setItem('albionData', JSON.stringify(transformedData));
      localStorage.setItem('albionLastUpdate', new Date().toISOString());

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);

      // Try to load from LocalStorage
      const savedData = localStorage.getItem('albionData');
      const savedLastUpdate = localStorage.getItem('albionLastUpdate');

      if (savedData) {
        setData(JSON.parse(savedData));
        setLastUpdate(savedLastUpdate);
      } else {
        // Use mock data as fallback
        setData(MOCK_DATA);
        setLastUpdate(new Date().toISOString());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load from LocalStorage on mount
    const savedData = localStorage.getItem('albionData');
    const savedLastUpdate = localStorage.getItem('albionLastUpdate');

    if (savedData) {
      setData(JSON.parse(savedData));
      setLastUpdate(savedLastUpdate);
    } else {
      // Use mock data initially
      setData(MOCK_DATA);
      setLastUpdate(new Date().toISOString());
    }
  }, []);

  const calculateArbitrage = useCallback((taxRate, transportCost) => {
    return data.map(item => {
      const caerleonData = item.data.find(d => d.city === 'Caerleon');
      const otherCities = item.data.filter(d => d.city !== 'Caerleon');

      if (!caerleonData || otherCities.length === 0) {
        return null;
      }

      const bmPrice = caerleonData.prices?.sell || 0;
      const lowestOtherCity = otherCities.reduce((min, current) => {
        const price = current.prices?.sell || 0;
        return price < min.price ? { price, city: current.city } : min;
      }, { price: Infinity, city: '' });

      if (lowestOtherCity.price === Infinity) {
        return null;
      }

      const tax = bmPrice * (taxRate / 100);
      const netProfit = bmPrice - lowestOtherCity.price - tax - transportCost;
      const margin = lowestOtherCity.price > 0 ? (netProfit / lowestOtherCity.price) * 100 : 0;

      return {
        itemId: item.item_id,
        bmPrice,
        lowestPrice: lowestOtherCity.price,
        lowestCity: lowestOtherCity.city,
        netProfit,
        margin
      };
    }).filter(item => item !== null);
  }, [data]);

  return {
    data,
    loading,
    error,
    lastUpdate,
    fetchData,
    calculateArbitrage,
    formatSilver
  };
};
