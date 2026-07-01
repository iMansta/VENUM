import { GUILD_NAME } from '@/config/guild';

/**
 * Valida membership na guilda via API server-side (evita CORS no browser).
 */
export const verifyGuildMembership = async (nickname) => {
  const trimmed = String(nickname || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Nickname é obrigatório' };
  }

  try {
    const url = `/api/verify-guild?nickname=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      return {
        valid: false,
        error: `Validação indisponível (${res.status}). Tente novamente.`,
      };
    }

    return await res.json();
  } catch (err) {
    console.error('[verifyGuildMembership]', err);
    return {
      valid: false,
      error:
        'Não foi possível validar seu personagem. Verifique sua conexão ou tente mais tarde.',
    };
  }
};

export default { verifyGuildMembership, GUILD_NAME };
