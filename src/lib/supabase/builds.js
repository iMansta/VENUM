import { supabase } from './client';

/**
 * Build operations for VENUM MARKET (Albion Online)
 *
 * Toda função aqui é defensiva: se a RPC não existir (PGRST202/404) ou
 * se a resposta vier vazia, retornamos um valor seguro (array vazio /
 * objeto vazio) ao invés de quebrar a UI.
 */

const BUILD_CATEGORIES_RPC = 'get_build_categories_with_count';
const BUILDS_BY_CATEGORY_RPC = 'get_builds_by_category';

const isMissingRpcError = (error) => {
  if (!error) return false;
  const code = error.code;
  const status = error.status;
  const msg = String(error.message || '');
  return (
    code === 'PGRST202' ||
    status === 404 ||
    /Could not find the function public\./i.test(msg)
  );
};

const safe = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error('[builds]', error);
    return { success: false, error: error.message || String(error) };
  }
};

// ---------- Read (público) ----------

/**
 * Lista categorias com contagem de builds.
 * Retorna SEMPRE um array (vazio se der erro).
 */
export const fetchBuildCategories = async () => {
  try {
    const { data, error } = await supabase.rpc(BUILD_CATEGORIES_RPC);
    if (error) {
      if (isMissingRpcError(error)) {
        console.warn(
          '[builds] RPC get_build_categories_with_count missing. ' +
            'Apply supabase/schema_builds_and_reservations.sql.'
        );
        return [];
      }
      console.error('[builds] fetchBuildCategories error:', error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[builds] fetchBuildCategories exception:', error);
    return [];
  }
};

/**
 * Lista builds dentro de uma categoria.
 * Retorna SEMPRE um array.
 */
export const fetchBuildsByCategory = async (categoryId) => {
  if (!categoryId) return [];
  try {
    const { data, error } = await supabase.rpc(BUILDS_BY_CATEGORY_RPC, {
      p_category_id: categoryId,
    });
    if (error) {
      if (isMissingRpcError(error)) {
        console.warn('[builds] RPC get_builds_by_category missing.');
        return [];
      }
      console.error('[builds] fetchBuildsByCategory error:', error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[builds] fetchBuildsByCategory exception:', error);
    return [];
  }
};

// ---------- Admin: categorias ----------

export const fetchAllCategoriesAdmin = safe(async () => {
  const { data, error } = await supabase
    .from('build_categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
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
  return Array.isArray(data) ? data : [];
});

export const createBuild = safe(async (payload) => {
  const { data, error } = await supabase.rpc('admin_create_build', {
    p_category_id: payload.category_id,
    p_title: payload.title,
    p_items: payload.items_json ?? payload.items ?? [],
    p_description: payload.description ?? null,
    p_author: payload.author ?? null,
  });
  if (error) throw error;
  return { success: true, data };
});

export const updateBuild = safe(async (id, payload) => {
  const { data, error } = await supabase.rpc('admin_update_build', {
    p_build_id: id,
    p_category_id: payload.category_id,
    p_title: payload.title,
    p_items: payload.items_json ?? payload.items ?? [],
    p_description: payload.description ?? null,
    p_author: payload.author ?? null,
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