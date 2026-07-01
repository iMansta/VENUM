import { supabase } from './client';

/** Converte username em e-mail interno (padrão VENUM). */
const toEmail = (username) => `${String(username).trim().toLowerCase()}@venum.local`;

/**
 * Login com username + senha.
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export const signIn = async (username, password) => {
  try {
    if (!username?.trim() || !password) {
      return { success: false, error: 'Usuário e senha são obrigatórios' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: error.message === 'Invalid login credentials'
        ? 'Usuário ou senha inválidos'
        : error.message || 'Erro ao fazer login',
    };
  }
};

/**
 * Cadastro com validação de código de guilda.
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export const signUp = async (username, password, guildCode) => {
  try {
    if (!username?.trim() || !password || !guildCode?.trim()) {
      return { success: false, error: 'Preencha todos os campos' };
    }

    if (password.length < 6) {
      return { success: false, error: 'A senha deve ter pelo menos 6 caracteres' };
    }

    const { data: validation, error: codeError } = await supabase.rpc('validate_guild_code', {
      p_code: guildCode.trim().toUpperCase(),
    });

    if (codeError) {
      console.error('Guild code validation error:', codeError);
      return { success: false, error: 'Erro ao validar código da guilda' };
    }

    const result = typeof validation === 'string' ? JSON.parse(validation) : validation;
    if (!result?.success) {
      return { success: false, error: result?.message || 'Código de guilda inválido' };
    }

    const normalizedUsername = username.trim();
    const { data, error } = await supabase.auth.signUp({
      email: toEmail(normalizedUsername),
      password,
      options: {
        data: {
          username: normalizedUsername,
          full_name: normalizedUsername,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      await supabase
        .from('profiles')
        .update({ username: normalizedUsername })
        .eq('id', data.user.id);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: error.message || 'Erro ao criar conta' };
  }
};

/** Retorna sessão atual. */
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { success: true, session: data.session };
  } catch (error) {
    console.error('Get session error:', error);
    return { success: false, error: error.message };
  }
};

/** Listener de mudanças de auth (retorna objeto compatível com ProtectedRoute). */
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};
