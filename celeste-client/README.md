# Celeste Client (Windows)

Executável estilo Albion Data Client — console + bandeja do sistema.

## Build (admin, uma vez)

Requisito: [Go 1.22+](https://go.dev/dl/)

```powershell
cd celeste-client
.\build.ps1
```

Gera `celeste.exe`. Depois, na raiz do projeto:

```bash
npm run celeste:pack
```

Isso cria `public/downloads/celeste.zip` (exe + Instalar-Celeste.bat).

## O que o .exe contém (embutido)

- URL do hub: `https://venum-eight.vercel.app`
- Token de agente Celeste (não é service_role)

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

## Instalação (membro da guilda)

1. Baixar ZIP no hub → Admin → Celeste  
2. Extrair → `Instalar-Celeste.bat`  
3. Desktop → **Iniciar Celeste**

Sem Node, sem chaves, sem configuração.
