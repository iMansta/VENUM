@echo off
chcp 65001 >nul
title Celeste - Instalador VENUM
color 0A
cls

echo.
echo  ============================================
echo    CELESTE - Servico de Dados VENUM
echo    Guilda I V E N U M I
echo  ============================================
echo.
echo  A cobra vigia o castelo e alimenta o hub:
echo    - Precos do mercado / Black Market
echo    - Membros da guilda
echo    - Rankings de fama
echo    - Notificacoes de missoes
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  [ERRO] Node.js nao encontrado.
  echo  Instale Node.js 18+ em https://nodejs.org
  echo  Depois execute este instalador novamente.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODEVER=%%v
echo  Node.js detectado: %NODEVER%
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\VENUM-Celeste"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo  Copiando arquivos para:
echo  %INSTALL_DIR%
echo.

xcopy /E /Y /I /Q "%~dp0*" "%INSTALL_DIR%\" >nul 2>&1

cd /d "%INSTALL_DIR%"

if not exist ".env" (
  echo.
  echo  --- Configuracao Supabase ---
  echo  Pegue em: Supabase ^> Project Settings ^> API
  echo.
  set /p SUPABASE_URL=  URL do projeto: 
  set /p SUPABASE_KEY=  Chave service_role: 
  echo.
  echo SUPABASE_URL=%SUPABASE_URL%> .env
  echo SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_KEY%>> .env
  echo GUILD_NAME=I V E N U M I>> .env
  echo CELESTE_INTERVAL_MS=900000>> .env
  echo  Arquivo .env criado.
) else (
  echo  .env ja existe — mantendo configuracao atual.
)

echo.
echo  Instalando dependencias (pode demorar 1-2 min)...
call npm install --omit=dev --no-fund --no-audit
if errorlevel 1 (
  echo  [ERRO] Falha no npm install.
  pause
  exit /b 1
)

echo.
echo  Criando atalho Iniciar Celeste...
(
  echo @echo off
  echo title Celeste - I V E N U M I
  echo cd /d "%INSTALL_DIR%"
  echo :loop
  echo node celeste.mjs
  echo echo.
  echo echo Celeste aguardando 60s antes de reiniciar...
  echo timeout /t 60 /nobreak ^>nul
  echo goto loop
) > "%USERPROFILE%\Desktop\Iniciar Celeste.bat" 2>nul

echo.
echo  ============================================
echo    INSTALACAO CONCLUIDA!
echo  ============================================
echo.
echo  Para iniciar: clique duplo em "Iniciar Celeste"
echo  na area de trabalho (ou execute Iniciar-Celeste.bat).
echo.
echo  Deixe a janela aberta — ela coleta dados em loop.
echo.
pause
