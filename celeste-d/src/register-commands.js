import { REST, Routes } from 'discord.js';
import { config, assertConfig } from './config.js';
import { commands } from './commands.js';

assertConfig();

const rest = new REST({ version: '10' }).setToken(config.token);

const body = commands;

if (config.guildId) {
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
  console.log(`[Celeste D.] ${body.length} comandos registrados na guilda ${config.guildId}`);
} else {
  await rest.put(Routes.applicationCommands(config.clientId), { body });
  console.log(`[Celeste D.] ${body.length} comandos globais registrados`);
}
