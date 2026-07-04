# Celeste D. — Bot Discord VENUM

## Canais configurados

| Uso | ID |
|-----|-----|
| Content / Raids | `870822542103949342` |
| Missões | `1521712367015301291` |
| Avisos | `891114152997830687` |

## Setup (uma vez)

1. Copie `.env.example` → `.env` e cole o **DISCORD_BOT_TOKEN**
2. Adicione `SUPABASE_SERVICE_ROLE_KEY` (poll de missões + raids persistentes)
3. Rode `supabase/UPDATE_CELESTE_D.sql` no SQL Editor
4. Instale e registre:

```bash
cd celeste-d
npm install
npm run register
npm start
```

## Comandos

- `/raid` → canal **Content** (botões estilo Raid-Helper)

Missões criadas no Admin do hub são anunciadas automaticamente (poll 60s) com botão **Participar**.
O bot tenta vincular o membro do Discord ao perfil do site por `discord_user_id` ou nickname.
Quando a missão encerra, o botão é removido da mensagem.

Killboard e Battleboard também são publicados automaticamente via API oficial do Albion.

## Hospedagem 24/7

O bot usa Gateway (WebSocket), então precisa de processo **sempre ativo**.

### Render (recomendado)

1. Suba a pasta `celeste-d` para um repositório.
2. Crie serviço no Render apontando para `render.yaml`.
3. Configure as env vars do `.env.example`.
4. Deploy automático: o Render manterá a aplicação online e fará restart em falhas.

### Railway

1. Importe o repositório no Railway.
2. Use o arquivo `railway.json` (Dockerfile).
3. Defina as mesmas env vars.
4. Faça deploy.

### VPS/PM2

```bash
cd celeste-d
npm install
npm run register
pm2 start src/index.js --name celeste-d
pm2 save
```

> Segurança: o token informado em conversa já ficou exposto. Gere um novo token no Discord Developer Portal e atualize a env `DISCORD_BOT_TOKEN`.

### Healthcheck

- Endpoint: `/healthz`
- Retorna `200` quando o bot está conectado ao Discord.
- Retorna `503` enquanto ainda está inicializando/reconectando.

## Variáveis

Ver `.env.example`.
