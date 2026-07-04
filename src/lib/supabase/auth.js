import { supabase } from './client';
import { verifyGuildMembership } from '@/lib/albion/gameinfo';

const PRIMARY_AUTH_DOMAIN =
  String(import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'venum.gg')
    .trim()
    .toLowerCase();

const LEGACY_AUTH_DOMAINS = String(
  import.meta.env.VITE_AUTH_EMAIL_LEGACY_DOMAINS || 'venum.local'
)
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const AUTH_DOMAINS = Array.from(new Set([PRIMARY_AUTH_DOMAIN, ...LEGACY_AUTH_DOMAINS]));

const MIGRATION_AUTH_DOMAIN = String(
  import.meta.env.VITE_AUTH_MIGRATION_EMAIL_DOMAIN || 'example.com'
)
  .trim()
  .toLowerCase();

const LAST_DOMAIN_KEY = 'venum:last_auth_domain';
const SIGNIN_DOMAINS = Array.from(
  new Set([MIGRATION_AUTH_DOMAIN, PRIMARY_AUTH_DOMAIN, ...LEGACY_AUTH_DOMAINS])
);

/** Converte nickname em e-mail interno (padrão VENUM). */
const toEmail = (nickname, domain = PRIMARY_AUTH_DOMAIN) =>
  `${String(nickname).trim().toLowerCase()}@${domain}`;

const isInvalidCredentials = (error) =>
  error?.message === 'Invalid login credentials';

const signInByEmailVariants = async (nickname, password) => {
  let lastError = null;
  const remembered =
    typeof window !== 'undefined' ? window.localStorage.getItem(LAST_DOMAIN_KEY) : null;
  const orderedDomains = Array.from(
    new Set([remembered, ...SIGNIN_DOMAINS].filter(Boolean))
  );

  for (const domain of orderedDomains) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(nickname, domain),
      password,
    });

    if (!error) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_DOMAIN_KEY, domain);
      }
      return { success: true, data, email: toEmail(nickname, domain), domain };
    }

    lastError = error;
    if (!isInvalidCredentials(error)) {
      return { success: false, error, domain };
    }
  }

  return { success: false, error: lastError };
};

const provisionAccountOnServer = async (nickname, password) => {
  const response = await fetch('/api/auth-provision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, password }),
  });

  let json = {};
  try {
    json = await response.json();
  } catch {
    json = {};
  }

  if (!response.ok || json.success === false) {
    return {
      success: false,
      error: json.error || 'Não foi possível provisionar conta no servidor',
    };
  }

  return { success: true, data: json };
};

const nicknameExists = async (nickname) => {
  const normalized = String(nickname).trim();
  const lower = normalized.toLowerCase();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, albion_character_name')
    .or(`username.ilike.${normalized},username.ilike.${lower},albion_character_name.ilike.${normalized},albion_character_name.ilike.${lower}`)
    .limit(1);

  if (error) return false;
  return Boolean(data?.length);
};

/**
 * Fallback de migração:
 * se o projeto Supabase foi trocado e o usuário ainda não existe,
 * cria conta automaticamente usando nickname+senha.
 */
const autoProvisionFromNickname = async (nickname, password) => {
  const exists = await nicknameExists(nickname);
  if (exists) {
    return { success: false, error: 'Nickname ou senha inválidos' };
  }

  const provisionResult = await provisionAccountOnServer(nickname, password);
  if (!provisionResult.success) {
    return provisionResult;
  }

  const loginAfterCreate = await signInByEmailVariants(nickname, password);
  if (!loginAfterCreate.success) {
    return {
      success: false,
      error:
        loginAfterCreate.error?.message || 'Erro ao entrar após criar conta',
    };
  }

  return { success: true, data: loginAfterCreate.data, autoProvisioned: true };
};

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

    const loginResult = await signInByEmailVariants(normalized, password);
    if (!loginResult.success) {
      if (isInvalidCredentials(loginResult.error)) {
        const fallback = await autoProvisionFromNickname(normalized, password);
        if (fallback.success) return fallback;
        return fallback;
      }
      throw loginResult.error;
    }
    const data = loginResult.data;

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

    const provisioned = await provisionAccountOnServer(normalizedNickname, password);
    if (!provisioned.success) {
      return provisioned;
    }

    const loginResult = await signInByEmailVariants(normalizedNickname, password);
    if (!loginResult.success) {
      throw loginResult.error || new Error('Conta criada, mas falhou login');
    }

    return {
      success: true,
      data: loginResult.data,
      email: provisioned.data?.email || toEmail(normalizedNickname, MIGRATION_AUTH_DOMAIN),
    };
  } catch (error) {
    console.error('Sign up error:', error);
    return {
      success: false,
      error: error.message || 'Erro ao criar conta',
    };
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
