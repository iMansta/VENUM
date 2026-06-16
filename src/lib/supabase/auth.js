import { supabase } from './client';

/**
 * Authentication utilities for VENUM MARKET
 */

// Helper function to generate email from username for Supabase Auth (Login - legacy)
const generateEmailFromUsernameForLogin = (username) => {
  const u = String(username ?? '').trim().toLowerCase();
  return `${u}@venum.local`; // legado (compatível com usuários existentes)
};

// Helper function to generate email from username for Supabase Auth (Signup - new users)
const generateEmailFromUsernameForSignup = (username) => {
  const u = String(username ?? '').trim().toLowerCase();
  return `${u}@example.com`; // domínio válido para criar novos usuários
};

// Sign up with username and password
export const signUp = async (username, password, guildCode = null) => {
  try {
    // Sanitize username (remove invisible Unicode chars)
    const normalizeUsername = (value) => {
      return String(value ?? '')
        .normalize('NFKC') // normaliza unicode
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width chars
        .replace(/\u00A0/g, ' ') // NBSP -> espaço
        .trim()
        .toLowerCase();
    };

    const u = normalizeUsername(username);

    // Debug logs for character codes
    console.log('u =', JSON.stringify(u));
    console.log('u length =', u.length);
    console.log('u codepoints =', [...u].map(ch => ch.charCodeAt(0)));

    if (!u) throw new Error('Username inválido.');
    if (u.length < 3) throw new Error('Username deve ter pelo menos 3 caracteres.');
    if (!/^[a-z0-9_]+$/.test(u)) {
      throw new Error('Username deve conter apenas letras, números e underscore (_).');
    }

    // First, validate guild code if provided
    if (guildCode) {
      const { data: codeData, error: codeError } = await supabase
        .rpc('validate_guild_code', { p_code: guildCode });

      if (codeError || !codeData?.success) {
        throw new Error(codeData?.message || 'Código de guilda inválido');
      }
    }

    // Generate email from username for Supabase Auth (NEW users)
    const email = `${u}@example.com`;

    // Debug logs for email
    console.log('email =', JSON.stringify(email));
    console.log('email length =', email.length);
    console.log('email codepoints =', [...email].map(ch => ch.charCodeAt(0)));

    // Basic email validation BEFORE calling supabase.auth.signUp
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Email gerado inválido.');
    }

    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: u,
          full_name: u,
          guild_code: guildCode,
        },
      },
    });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: error.message };
  }
};

// Sign in with username and password
export const signIn = async (username, password) => {
  try {
    const u = String(username ?? '').trim();
    if (!u) throw new Error('Username inválido.');

    const email = generateEmailFromUsernameForLogin(u);

    // Basic (opcional) validação pra não enviar lixo pro Supabase
    if (!/@.+\..+/.test(email)) {
      throw new Error('Email gerado inválido para login.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: error.message };
  }
};

// Sign out
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
};

// Get current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return { success: true, user };
  } catch (error) {
    console.error('Get current user error:', error);
    return { success: false, error: error.message };
  }
};

// Get current session
export const getSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { success: true, session };
  } catch (error) {
    console.error('Get session error:', error);
    return { success: false, error: error.message };
  }
};

// Reset password
export const resetPassword = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, error: error.message };
  }
};

// Update password
export const updatePassword = async (newPassword) => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Update password error:', error);
    return { success: false, error: error.message };
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
};
