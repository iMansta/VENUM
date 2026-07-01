const GUILD_NAME = 'I V E N U M I';
const GAMEINFO_BASE = 'https://gameinfo.albiononline.com/api/gameinfo';

const normalizeGuildName = (name) =>
  String(name || '').replace(/\s+/g, '').toUpperCase();

/**
 * Valida membership na guilda via GameInfo (server-side — sem CORS).
 */
export async function verifyGuildMembershipServer(nickname) {
  const trimmed = String(nickname || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Nickname é obrigatório' };
  }

  try {
    const searchRes = await fetch(
      `${GAMEINFO_BASE}/search?q=${encodeURIComponent(trimmed)}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!searchRes.ok) {
      return {
        valid: false,
        error: `Não foi possível consultar o Albion (${searchRes.status}). Tente novamente.`,
      };
    }

    const data = await searchRes.json();
    const player = (data.players || []).find(
      (p) => p.Name?.toLowerCase() === trimmed.toLowerCase()
    );

    if (!player) {
      return {
        valid: false,
        error: 'Personagem não encontrado. Use o nickname exato do jogo.',
      };
    }

    const playerGuild = normalizeGuildName(player.GuildName);
    const targetGuild = normalizeGuildName(GUILD_NAME);

    if (playerGuild !== targetGuild) {
      return {
        valid: false,
        error: `Você precisa estar na guilda ${GUILD_NAME} para acessar o sistema.`,
        playerName: player.Name,
        guildName: player.GuildName,
      };
    }

    return {
      valid: true,
      playerId: player.Id,
      playerName: player.Name,
      guildName: player.GuildName,
      guildId: player.GuildId,
    };
  } catch (err) {
    console.error('[verifyGuild]', err);
    return {
      valid: false,
      error: 'Erro ao validar personagem. Tente novamente em instantes.',
    };
  }
}
