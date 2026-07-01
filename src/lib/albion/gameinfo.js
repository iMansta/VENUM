import { GAMEINFO_BASE, GUILD_NAME } from '@/config/guild';

const normalizeGuildName = (name) =>
  String(name || '').replace(/\s+/g, '').toUpperCase();

/**
 * Busca jogador pelo nickname exato no GameInfo API.
 */
export const searchPlayer = async (nickname) => {
  const q = encodeURIComponent(String(nickname).trim());
  const res = await fetch(`${GAMEINFO_BASE}/search?q=${q}`);
  if (!res.ok) throw new Error(`GameInfo search falhou (${res.status})`);
  const data = await res.json();
  const exact = (data.players || []).find(
    (p) => p.Name?.toLowerCase() === String(nickname).trim().toLowerCase()
  );
  return exact || null;
};

/**
 * Verifica se o jogador pertence à guilda I V E N U M I.
 */
export const verifyGuildMembership = async (nickname) => {
  const player = await searchPlayer(nickname);
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
      player,
    };
  }

  return {
    valid: true,
    player,
    playerId: player.Id,
    guildName: player.GuildName,
    guildId: player.GuildId,
  };
};

/**
 * Busca guilda pelo nome.
 */
export const searchGuild = async (guildName = GUILD_NAME) => {
  const q = encodeURIComponent(guildName);
  const res = await fetch(`${GAMEINFO_BASE}/search?q=${q}`);
  if (!res.ok) throw new Error(`GameInfo guild search falhou (${res.status})`);
  const data = await res.json();
  return (data.guilds || []).find(
    (g) => normalizeGuildName(g.Name) === normalizeGuildName(guildName)
  );
};

/**
 * Lista membros da guilda (para sync diário no coletor).
 */
export const getGuildMembers = async (guildId) => {
  const res = await fetch(`${GAMEINFO_BASE}/guilds/${guildId}/members`);
  if (!res.ok) throw new Error(`GameInfo members falhou (${res.status})`);
  return res.json();
};

/**
 * Eventos recentes do killboard (PvP/PvE inferido).
 */
export const getRecentEvents = async (limit = 51, offset = 0) => {
  const res = await fetch(
    `${GAMEINFO_BASE}/events?limit=${limit}&offset=${offset}`
  );
  if (!res.ok) throw new Error(`GameInfo events falhou (${res.status})`);
  return res.json();
};

export default {
  searchPlayer,
  verifyGuildMembership,
  searchGuild,
  getGuildMembers,
  getRecentEvents,
};
