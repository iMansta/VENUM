import { supabase } from './client';

/**
 * Build operations for VENUM MARKET
 * - Read-side helpers (used by /builds page) call the safe public RPCs.
 * - Admin write-side helpers call the admin-only RPCs (gated by RLS).
 */

const safe = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error('[builds]', error);
    return { success: false, error: error.message || String(error) };
  }
};

// ---------- Read (public) ----------

/**
 * List build categories with build count.
 * Calls public RPC `get_build_categories_with_count()`.
 */
export const fetchBuildCategories = async () => {
  const { data, error } = await supabase.rpc('get_build_categories_with_count');
  if (error) throw error;
  return data || [];
};

/**
 * List builds inside a single category.
 * Calls public RPC `get_builds_by_category(p_category_id)`.
 */
export const fetchBuildsByCategory = async (categoryId) => {
  const { data, error } = await supabase.rpc('get_builds_by_category', {
    p_category_id: categoryId,
  });
  if (error) throw error;
  return data || [];
};

// ---------- Admin: categories ----------

export const fetchAllCategoriesAdmin = safe(async () => {
  const { data, error } = await supabase
    .from('build_categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
});

export const createCategory = safe(async (payload) => {
  const { data, error } = await supabase.rpc('admin_create_build_category', {
    p_name: payload.name,
    p_description: payload.description ?? null,
  });
  if (error) throw error;
  return { success: true, data };
});

export const updateCategory = safe(async (id, payload) => {
  const { data, error } = await supabase.rpc('admin_update_build_category', {
    p_category_id: id,
    p_name: payload.name,
    p_description: payload.description ?? null,
  });
  if (error) throw error;
  return { success: true, data };
});

export const deleteCategory = safe(async (id) => {
  const { error } = await supabase.rpc('admin_delete_build_category', {
    p_category_id: id,
  });
  if (error) throw error;
  return { success: true };
});

// ---------- Admin: builds ----------

export const fetchBuildsAdmin = safe(async () => {
  const { data, error } = await supabase
    .from('builds')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
});

export const createBuild = safe(async (payload) => {
  const { data, error } = await supabase.rpc('admin_create_build', {
    p_category_id: payload.category_id,
    p_title: payload.title,
    p_author: payload.author ?? null,
    p_items_json: payload.items_json ?? [],
    p_tactics: payload.tactics ?? null,
  });
  if (error) throw error;
  return { success: true, data };
});

export const updateBuild = safe(async (id, payload) => {
  const { data, error } = await supabase.rpc('admin_update_build', {
    p_build_id: id,
    p_category_id: payload.category_id,
    p_title: payload.title,
    p_author: payload.author ?? null,
    p_items_json: payload.items_json ?? [],
    p_tactics: payload.tactics ?? null,
  });
  if (error) throw error;
  return { success: true, data };
});

export const deleteBuild = safe(async (id) => {
  const { error } = await supabase.rpc('admin_delete_build', {
    p_build_id: id,
  });
  if (error) throw error;
  return { success: true };
});