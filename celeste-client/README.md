# Anaconda Client (Windows)

Executável estilo Albion Data Client — console + bandeja do sistema.
Foco: rodar em massa nos desktops da guilda e alimentar o hub com dados locais + mercado.

## Build (admin, uma vez)

Requisito: [Go 1.22+](https://go.dev/dl/) (somente para quem compila)

```powershell
cd celeste-client
.\build.ps1
```

Gera `celeste.exe` (base interna), e o empacotamento publica como `anaconda.exe`. Depois, na raiz do projeto:

```bash
npm run celeste:pack
```

Isso cria `public/downloads/anaconda.zip` (fallback com exe + instalador BAT).

## Setup .exe (instalador amigável)

Requisito: [Inno Setup 6](https://jrsoftware.org/isinfo.php)

```powershell
cd celeste-client
.\build-installer.ps1
```

Gera `public/downloads/Anaconda-Setup.exe`.
Para MSI, recomendo etapa futura com WiX Toolset; o `.exe` já cobre 100% da instalação para jogador leigo.

## O que o .exe contém (embutido)

- URL do hub: `https://venum-eight.vercel.app`
- Token de agente Anaconda (não é service_role)

## Variáveis na Vercel (obrigatório)

| Variável | Valor |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://bmdvkgmlslyihposxffc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_URL` | mesmo URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (só servidor) |
| `CELESTE_AGENT_TOKEN` | `venum_celeste_bmdvk_7Xk9mP2wQ5nR8tY4vL6jH1sF3dA0cE` |
| `GUILD_NAME` | `I V E N U M I` |

Depois de alterar env vars na Vercel, faça **Redeploy**.
Se o frontend continuar chamando `moglqrrmqokhuzjoigbr`, a Vercel ainda está com URL antiga.

## Instalação (membro da guilda)

1. Baixar `Anaconda-Setup.exe` no hub → Admin → Anaconda  
2. Seguir o assistente de instalação  
3. Concluir (o app já pode iniciar automaticamente)

Sem Node, sem chaves, sem configuração.
Se o `.exe` não estiver disponível no momento do deploy, usar fallback em ZIP.

## Como alimenta o sistema (modelo fan-in)

Mesmo conceito do Albion Data Client:

1. **Muitos clientes desktop** (cada player) coletam dados locais.
2. **Envio assíncrono para API central** (`/api/celeste?action=telemetry`).
3. **Servidor normaliza e grava no Supabase**:
   - `celeste_clients` (heartbeat por máquina)
   - `celeste_observations` (fama, gathering, mob_kill, mission)
4. Hub usa isso para evoluir ranking, missões dinâmicas e economia.

Arquivos principais:
- watcher local: `celeste-client/collector/logs.go`
- loop de envio: `celeste-client/syncer/run.go`
- endpoint server: `api/celeste.js`
- persistência server: `server/celesteService.mjs`
- schema: `supabase/UPDATE_CELESTE_INGESTION.sql`
- agregação: `supabase/UPDATE_CELESTE_AGGREGATION.sql`

## Endpoint de status operacional

Com token da Anaconda:

```bash
curl -X POST "https://venum-eight.vercel.app/api/celeste?action=status" \
  -H "Authorization: Bearer <CELESTE_AGENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{}"
```

Retorna:
- `supabaseHost` (para confirmar se está no projeto correto)
- `onlineClients15m`
- `observationsLast1h`
- `pendingObservations`
- último cliente visto

## SQL obrigatório para pipeline completo

1. `supabase/QUICK_FIX_SCHEMA.sql`
2. `supabase/UPDATE_CELESTE_INGESTION.sql`
3. `supabase/UPDATE_CELESTE_AGGREGATION.sql`

Com isso, cada observação da Anaconda vira:
- progresso de missão (`missions.current_quantity`)
- participação automática (`mission_participants`)
- fama por categoria (`profiles.albion_*_fame`)
- conclusão automática + pontos para participantes
