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

- `/aviso` → canal **Avisos**
- `/missao` → canal **Missões**
- `/raid` → canal **Content** (botões estilo Raid-Helper)

Missões criadas no Admin do hub são anunciadas automaticamente (poll 60s).

## Hospedagem 24/7

Railway, Render ou VPS. **Regenerar o token** se ele vazar (Discord Developer Portal → Bot → Reset Token).

## Variáveis

Ver `.env.example`.
