# Celeste D. — Bot Discord VENUM

Bot para **missões**, **avisos da guilda** e **eventos AVA/CTG** estilo [Raid-Helper](https://raid-helper.dev/).

## Comandos

| Comando | Descrição |
|---------|-----------|
| `/aviso` | Aviso oficial no canal de anúncios |
| `/missao` | Anuncia missão manualmente |
| `/raid` | Cria embed + botões de inscrição por função (Main-tank, Cobra, Healer…) |

Poll automático: missões `active` com `discord_notified = false` no Supabase.

## Setup

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application → **Celeste D.**
2. Bot → Reset Token → copie `DISCORD_BOT_TOKEN`
3. OAuth2 → URL Generator → scopes: `bot`, `applications.commands`
4. Permissões: Send Messages, Embed Links, Manage Messages
5. Convide o bot ao servidor da guilda

### Variáveis (.env na pasta `celeste-d/`)

```env
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=          # ID do servidor Discord
DISCORD_MISSIONS_CHANNEL_ID=
DISCORD_ANNOUNCEMENTS_CHANNEL_ID=
DISCORD_RAIDS_CHANNEL_ID=   # opcional

SUPABASE_URL=https://bmdvkgmlslyihposxffc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=  # só no servidor do bot (Railway/VPS)

GUILD_NAME=I V E N U M I
MISSION_POLL_MS=60000
```

### Registrar comandos

```bash
cd celeste-d
npm install
npm run register
npm start
```

## Hospedagem

O bot precisa rodar **24/7** (Railway, Render, VPS ou PC da staff). A Vercel **não** suporta bots persistentes.

## Próximos passos

- Persistir raids no Supabase (sobrevive restart)
- Limite de vagas por função
- Sincronizar missões criadas no Admin automaticamente (já via poll)
