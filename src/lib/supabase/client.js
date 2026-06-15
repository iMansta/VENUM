import { createClient } from '@supabase/supabase-js';

// Environment variables - these should be set in .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

console.log('Supabase URL:', supabaseUrl ? 'Loaded' : 'NOT LOADED');
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Loaded' : 'NOT LOADED');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Some features will be limited.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types for TypeScript (if using TS)
/*
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          role: 'admin' | 'officer' | 'member';
          joined_at: string;
          total_points: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'admin' | 'officer' | 'member';
          joined_at?: string;
          total_points?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'admin' | 'officer' | 'member';
          joined_at?: string;
          total_points?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      guild_codes: {
        Row: {
          id: string;
          code: string;
          created_by: string | null;
          max_uses: number;
          used_count: number;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        // ... similar for Insert and Update
      };
      missions: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          mission_type: 'gathering' | 'crafting' | 'pvp' | 'trading' | 'other';
          target_item: string | null;
          target_quantity: number;
          current_quantity: number;
          points_reward: number;
          start_date: string;
          end_date: string | null;
          status: 'draft' | 'active' | 'completed' | 'cancelled';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        // ... similar for Insert and Update
      };
      mission_participants: {
        Row: {
          id: string;
          mission_id: string;
          profile_id: string;
          contribution_quantity: number;
          joined_at: string;
        };
        // ... similar for Insert and Update
      };
      points_ledger: {
        Row: {
          id: string;
          profile_id: string;
          amount: number;
          transaction_type: 'earned' | 'spent' | 'adjusted';
          reason: string;
          reference_id: string | null;
          reference_type: string | null;
          created_by: string | null;
          created_at: string;
        };
        // ... similar for Insert and Update
      };
      shop_items: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          cost_points: number;
          stock: number;
          category: string;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        // ... similar for Insert and Update
      };
      shop_purchases: {
        Row: {
          id: string;
          profile_id: string;
          shop_item_id: string | null;
          points_spent: number;
          status: 'pending' | 'approved' | 'delivered' | 'cancelled';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        // ... similar for Insert and Update
      };
    };
  };
};
*/
