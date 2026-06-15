import { supabase } from './client';

/**
 * Authentication utilities for VENUM MARKET
 */

// Helper function to generate email from username for Supabase Auth
const generateEmailFromUsername = (username) => {
  return `${username.toLowerCase()}@venum.local`;
};

// Sign up with username and password
export const signUp = async (username, password, guildCode = null) => {
  try {
    // First, validate guild code if provided
    if (guildCode) {
      const { data: codeData, error: codeError } = await supabase
        .rpc('validate_guild_code', { p_code: guildCode });

      if (codeError || !codeData?.success) {
        throw new Error(codeData?.message || 'Código de guilda inválido');
      }
    }

    // Generate email from username for Supabase Auth
    const email = generateEmailFromUsername(username);

    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name: username,
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
    // Generate email from username for Supabase Auth
    const email = generateEmailFromUsername(username);

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
