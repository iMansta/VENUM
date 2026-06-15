import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useTransportStore = create(
  persist(
    (set, get) => ({
      routes: [],

      addRoute: (routeData) => {
        const newRoute = {
          ...routeData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          routes: [...state.routes, newRoute],
        }));
      },

      removeRoute: (id) => {
        set((state) => ({
          routes: state.routes.filter((route) => route.id !== id),
        }));
      },

      updateRouteQuantity: (id, quantity) => {
        set((state) => ({
          routes: state.routes.map((route) =>
            route.id === id
              ? { ...route, quantity, updatedAt: new Date().toISOString() }
              : route
          ),
        }));
      },

      updateRoute: (id, updates) => {
        set((state) => ({
          routes: state.routes.map((route) =>
            route.id === id
              ? { ...route, ...updates, updatedAt: new Date().toISOString() }
              : route
          ),
        }));
      },

      clearAllRoutes: () => {
        set({ routes: [] });
      },

      getRouteById: (id) => {
        return get().routes.find((route) => route.id === id);
      },

      getTotalProfit: () => {
        return get().routes.reduce(
          (total, route) => total + route.netProfit * route.quantity,
          0
        );
      },

      getTotalQuantity: () => {
        return get().routes.reduce((total, route) => total + route.quantity, 0);
      },
    }),
    {
      name: 'venum-transport-storage',
      partialize: (state) => ({ routes: state.routes }),
    }
  )
);
