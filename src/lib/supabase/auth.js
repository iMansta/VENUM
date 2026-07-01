import { supabase } from './client';
import { verifyGuildMembership } from '@/lib/albion/gameinfo';

/** Converte nickname em e-mail interno (padrão VENUM). */
const toEmail = (nickname) =>
  `${String(nickname).trim().toLowerCase()}@venum.local`;

/**
 * Login com nickname do Albion + senha.
 * Só permite acesso se o perfil estiver ativo (validado na guilda).
 */
export const signIn = async (nickname, password) => {
  try {
    if (!nickname?.trim() || !password) {
      return { success: false, error: 'Nickname e senha são obrigatórios' };
    }

    const normalized = nickname.trim();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(normalized),
      password,
    });

    if (error) throw error;

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active, username')
        .eq('id', data.user.id)
        .single();

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        return {
          success: false,
          error:
            'Conta inativa. Você precisa estar na guilda I V E N U M I. Entre em contato com um oficial.',
        };
      }
    }

    return { success: true, data };
  } catch (error) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: error.message === 'Invalid login credentials'
        ? 'Nickname ou senha inválidos'
        : error.message || 'Erro ao fazer login',
    };
  }
};

/**
 * Cadastro: nickname = personagem Albion, validado na guilda I V E N U M I.
 */
export const signUp = async (nickname, password) => {
  try {
    if (!nickname?.trim() || !password) {
      return { success: false, error: 'Preencha nickname e senha' };
    }

    if (password.length < 6) {
      return { success: false, error: 'A senha deve ter pelo menos 6 caracteres' };
    }

    const normalizedNickname = nickname.trim();

    const guildCheck = await verifyGuildMembership(normalizedNickname);
    if (!guildCheck.valid) {
      return { success: false, error: guildCheck.error };
    }

    const { data, error } = await supabase.auth.signUp({
      email: toEmail(normalizedNickname),
      password,
      options: {
        data: {
          username: normalizedNickname,
          full_name: normalizedNickname,
          albion_player_id: guildCheck.playerId,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      await supabase
        .from('profiles')
        .update({
          username: normalizedNickname,
          full_name: normalizedNickname,
          albion_character_name: normalizedNickname,
          albion_player_id: guildCheck.playerId,
          guild_verified: true,
          last_guild_verified_at: new Date().toISOString(),
          is_active: true,
        })
        .eq('id', data.user.id);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: error.message || 'Erro ao criar conta' };
  }
};

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

export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};
