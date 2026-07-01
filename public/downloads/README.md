# Downloads Celeste

O ZIP é gerado localmente:

```powershell
cd celeste-client
.\build.ps1
cd ..
npm run celeste:pack
```

Commit `celeste.zip` e `celeste.exe` aqui para o hub servir o instalador.

Na Vercel o build do app **não falha** se o exe não existir — só avisa no log.
