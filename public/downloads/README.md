# Downloads Anaconda

O ZIP é gerado localmente:

```powershell
cd celeste-client
.\build.ps1
cd ..
npm run celeste:pack
```

Artefatos principais:
- `Anaconda-Setup.exe` (instalador assistido para usuário final)
- `anaconda.zip` (fallback técnico)
- `anaconda.exe` (binário standalone)

Aliases legados `celeste.zip` e `celeste.exe` continuam sendo gerados para compatibilidade.

Na Vercel o build do app **não falha** se o exe não existir — só avisa no log.
