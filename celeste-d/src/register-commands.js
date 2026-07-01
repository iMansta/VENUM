import { REST, Routes } from 'discord.js';
import { config, assertConfig, resolveGuildId } from './config.js';
import { commands } from './commands.js';

assertConfig();
await resolveGuildId();

const rest = new REST({ version: '10' }).setToken(config.token);

if (config.guildId) {
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands,
  });
  console.log(`[Celeste D.] ${commands.length} comandos na guilda ${config.guildId}`);
} else {
  await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
  console.log(`[Celeste D.] ${commands.length} comandos globais (guild id ausente)`);
}

console.log('[Celeste D.] Canais:');
console.log('  Missões:', config.missionsChannelId);
console.log('  Avisos:', config.announcementsChannelId);
console.log('  Raids/Content:', config.raidsChannelId);
