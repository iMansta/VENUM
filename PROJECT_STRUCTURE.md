# VENUM MARKET - Project Structure

## Overview
Scalable folder structure for the expanded VENUM MARKET application with modular architecture.

## Directory Structure

```
albion-arbitrage-dashboard/
├── public/
│   └── assets/
│       └── images/
├── src/
│   ├── app/                          # Next.js App Router (if migrating to Next.js)
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── market/
│   │   │   │   ├── arbitrage/
│   │   │   │   └── transport/
│   │   │   ├── production/
│   │   │   │   ├── refining/
│   │   │   │   ├── crafting/
│   │   │   │   └── resources/
│   │   │   └── guild/
│   │   │       ├── missions/
│   │   │       ├── shop/
│   │   │       └── members/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/                   # React Components
│   │   ├── common/                   # Shared components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── SearchBar.tsx
│   │   ├── layout/                   # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Navigation.tsx
│   │   ├── market/                   # Market/Arbitrage components
│   │   │   ├── ArbitrageTable.tsx
│   │   │   ├── TopOpportunities.tsx
│   │   │   ├── TransportList.tsx
│   │   │   ├── TransportRow.tsx
│   │   │   ├── ItemIcon.tsx
│   │   │   ├── PriceDisplay.tsx
│   │   │   └── filters/
│   │   │       ├── CityFilter.tsx
│   │   │       ├── TierFilter.tsx
│   │   │       ├── EnchantmentFilter.tsx
│   │   │       ├── QualityFilter.tsx
│   │   │       └── ProfitFilter.tsx
│   │   ├── production/               # Production modules
│   │   │   ├── refining/
│   │   │   │   ├── RefiningCalculator.tsx
│   │   │   │   ├── RefiningResult.tsx
│   │   │   │   └── ResourceInput.tsx
│   │   │   ├── crafting/
│   │   │   │   ├── CraftingCalculator.tsx
│   │   │   │   ├── MaterialList.tsx
│   │   │   │   ├── CostBreakdown.tsx
│   │   │   │   └── CraftRecommendation.tsx
│   │   │   └── resources/
│   │   │       ├── ResourceMap.tsx
│   │   │       ├── RouteOptimizer.tsx
│   │   │       └── ResourceFilter.tsx
│   │   └── guild/                    # Guild Hub components
│   │       ├── auth/
│   │       │   ├── LoginForm.tsx
│   │       │   ├── RegisterForm.tsx
│   │       │   ├── GuildCodeInput.tsx
│   │       │   └── ProtectedRoute.tsx
│   │       ├── missions/
│   │       │   ├── MissionList.tsx
│   │       │   ├── MissionCard.tsx
│   │       │   ├── MissionForm.tsx
│   │       │   ├── MissionProgress.tsx
│   │       │   └── ParticipantList.tsx
│   │       ├── shop/
│   │       │   ├── ShopGrid.tsx
│   │       │   ├── ShopItem.tsx
│   │       │   ├── PurchaseModal.tsx
│   │       │   └── PointsDisplay.tsx
│   │       └── members/
│   │           ├── MemberList.tsx
│   │           ├── MemberCard.tsx
│   │           ├── PointsLeaderboard.tsx
│   │           └── RoleBadge.tsx
│   ├── hooks/                       # Custom React Hooks
│   │   ├── useAlbionData.ts         # Market data fetching
│   │   ├── useAuth.ts               # Authentication
│   │   ├── useMissions.ts           # Mission management
│   │   ├── useShop.ts               # Shop operations
│   │   ├── usePoints.ts             # Points calculation
│   │   ├── useLocalStorage.ts       # LocalStorage utilities
│   │   └── useDebounce.ts           # Debounce utilities
│   ├── lib/                         # Utility libraries
│   │   ├── supabase/                # Supabase configuration
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── profiles.ts
│   │   │   ├── missions.ts
│   │   │   ├── points.ts
│   │   │   └── shop.ts
│   │   ├── api/                     # API service layer
│   │   │   ├── albionApi.ts         # Albion Data Project API
│   │   │   ├── proxyHandler.ts      # Proxy/Bad IP handling
│   │   │   └── errorHandler.ts      # Error handling utilities
│   │   ├── i18n/                    # Internationalization
│   │   │   ├── translations.ts
│   │   │   ├── itemNames.ts         # Item ID translations
│   │   │   └── formatters.ts        # Number/currency formatters
│   │   ├── utils/                   # General utilities
│   │   │   ├── calculations.ts      # Profit calculations
│   │   │   ├── formatters.ts        # Data formatting
│   │   │   ├── validators.ts        # Input validation
│   │   │   └── constants.ts         # App constants
│   │   └── types/                   # TypeScript types
│   │       ├── market.ts
│   │       ├── guild.ts
│   │       ├── production.ts
│   │       └── api.ts
│   ├── store/                       # State Management (Zustand)
│   │   ├── transportStore.ts        # Transport routes state
│   │   ├── filterStore.ts           # Global filter state
│   │   ├── uiStore.ts               # UI state (modals, etc.)
│   │   └── authStore.ts             # Auth state (if not using Supabase auth)
│   ├── styles/                      # Global styles
│   │   ├── globals.css
│   │   └── themes/
│   │       ├── dark.css
│   │       └── venum.css            # VENUM brand colors
│   ├── config/                      # Configuration files
│   │   ├── constants.ts             # App constants
│   │   ├── endpoints.ts             # API endpoints
│   │   └── features.ts              # Feature flags
│   └── App.jsx                      # Main app component (current Vite setup)
├── public/
│   └── favicon.ico
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json                    # If migrating to TypeScript
├── vite.config.js
├── postcss.config.js
├── DATABASE_SCHEMA.md               # Database documentation
├── PROJECT_STRUCTURE.md             # This file
└── README.md
```

## Module Breakdown

### Market Module (`src/components/market/`)
Handles arbitrage, flipping, and transport management.
- **ArbitrageTable**: Main table for market opportunities
- **TopOpportunities**: Cards showing best profit opportunities
- **TransportList**: User's selected transport routes
- **filters/**: Advanced filtering components

### Production Module (`src/components/production/`)
Calculators for refining, crafting, and resource optimization.
- **refining/**: Refining profit calculator with return rates
- **crafting/**: Crafting cost vs. buy analysis
- **resources/**: Resource route optimization

### Guild Module (`src/components/guild/`)
Restricted area for guild management and gamification.
- **auth/**: Authentication with recruitment codes
- **missions/**: Mission CRUD and participation
- **shop/**: Points-based reward system
- **members/**: Member management and leaderboard

### Service Layer (`src/lib/`)
Abstraction layers for API calls and business logic.
- **supabase/**: Database operations
- **api/**: External API integration with error handling
- **i18n/**: Translation and formatting

### State Management (`src/store/`)
Zustand stores for global state without Redux overhead.
- **transportStore**: Transport routes (localStorage persisted)
- **filterStore**: Global filter preferences
- **uiStore**: UI state (modals, sidebars)

## Migration Path (Vite → Next.js)

When migrating from Vite to Next.js App Router:

1. Move `src/App.jsx` → `src/app/page.tsx`
2. Create `src/app/layout.tsx` for root layout
3. Convert components to TypeScript (optional but recommended)
4. Implement API routes in `src/app/api/` if needed
5. Use Next.js Image component for optimized images
6. Implement Server Components for data fetching where beneficial

## Key Design Decisions

1. **Modular Architecture**: Each module (market, production, guild) is self-contained
2. **Service Layer**: API calls abstracted for easy testing and mocking
3. **Type Safety**: TypeScript types in `src/lib/types/` for better DX
4. **State Management**: Zustand for lightweight global state
5. **Error Handling**: Centralized error handling in service layer
6. **i18n Ready**: Translation system for multi-language support
7. **Performance**: Memoization in filters and list components
8. **Security**: RLS policies in Supabase for data protection
