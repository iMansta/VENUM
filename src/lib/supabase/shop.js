import { supabase } from './client';

/**
 * Shop operations for VENUM MARKET
 */

// Get all active shop items
export const getShopItems = async (category = null) => {
  try {
    let query = supabase
      .from('shop_items')
      .select('*')
      .eq('is_active', true)
      .order('cost_points', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get shop items error:', error);
    return { success: false, error: error.message };
  }
};

// Get shop item by ID
export const getShopItemById = async (itemId) => {
  try {
    const { data, error } = await supabase
      .from('shop_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get shop item by ID error:', error);
    return { success: false, error: error.message };
  }
};

// Create shop item (officers/admins only)
export const createShopItem = async (itemData) => {
  try {
    const { data, error } = await supabase
      .from('shop_items')
      .insert(itemData)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Create shop item error:', error);
    return { success: false, error: error.message };
  }
};

// Update shop item (officers/admins only)
export const updateShopItem = async (itemId, updates) => {
  try {
    const { data, error } = await supabase
      .from('shop_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Update shop item error:', error);
    return { success: false, error: error.message };
  }
};

// Delete shop item (officers/admins only)
export const deleteShopItem = async (itemId) => {
  try {
    const { error } = await supabase
      .from('shop_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete shop item error:', error);
    return { success: false, error: error.message };
  }
};

// Purchase shop item
export const purchaseShopItem = async (profileId, shopItemId, notes = null) => {
  try {
    // Get shop item details
    const { data: shopItem, error: itemError } = await supabase
      .from('shop_items')
      .select('*')
      .eq('id', shopItemId)
      .single();

    if (itemError) throw itemError;

    // Check if item is in stock
    if (shopItem.stock !== -1 && shopItem.stock <= 0) {
      throw new Error('Item fora de estoque');
    }

    // Check if user has enough points
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('total_points')
      .eq('id', profileId)
      .single();

    if (profileError) throw profileError;

    if (profile.total_points < shopItem.cost_points) {
      throw new Error('Pontos insuficientes');
    }

    // Deduct points
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_points', {
      p_profile_id: profileId,
      p_amount: shopItem.cost_points,
      p_reason: `Shop purchase: ${shopItem.name}`,
      p_reference_id: shopItemId,
      p_reference_type: 'shop_item',
    });

    if (deductError || !deductResult) {
      throw new Error('Falha ao deduzir pontos');
    }

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('shop_purchases')
      .insert({
        profile_id: profileId,
        shop_item_id: shopItemId,
        points_spent: shopItem.cost_points,
        status: 'pending',
        notes,
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // Update stock if not unlimited
    if (shopItem.stock !== -1) {
      await supabase
        .from('shop_items')
        .update({ stock: shopItem.stock - 1 })
        .eq('id', shopItemId);
    }

    return { success: true, data: purchase };
  } catch (error) {
    console.error('Purchase shop item error:', error);
    return { success: false, error: error.message };
  }
};

// Get user's purchases
export const getUserPurchases = async (profileId, limit = 20) => {
  try {
    const { data, error } = await supabase
      .from('shop_purchases')
      .select(`
        *,
        shop_items(name, image_url, category)
      `)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get user purchases error:', error);
    return { success: false, error: error.message };
  }
};

// Get all purchases (officers/admins only)
export const getAllPurchases = async (status = null, limit = 50) => {
  try {
    let query = supabase
      .from('shop_purchases')
      .select(`
        *,
        profiles(username, full_name),
        shop_items(name, category)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get all purchases error:', error);
    return { success: false, error: error.message };
  }
};

// Update purchase status (officers/admins only)
export const updatePurchaseStatus = async (purchaseId, newStatus) => {
  try {
    const { data, error } = await supabase
      .from('shop_purchases')
      .update({ status: newStatus })
      .eq('id', purchaseId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Update purchase status error:', error);
    return { success: false, error: error.message };
  }
};

// Get shop categories
export const getShopCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('shop_items')
      .select('category')
      .eq('is_active', true);

    if (error) throw error;

    const categories = [...new Set(data.map((item) => item.category))];
    return { success: true, data: categories };
  } catch (error) {
    console.error('Get shop categories error:', error);
    return { success: false, error: error.message };
  }
};
