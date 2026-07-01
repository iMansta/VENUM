@echo off
chcp 65001 >nul
title Celeste - I V E N U M I
color 0A

set "DIR=%LOCALAPPDATA%\VENUM-Celeste"
if exist "%DIR%\celeste.mjs" (
  cd /d "%DIR%"
) else (
  cd /d "%~dp0"
)

if not exist ".env" (
  echo Execute primeiro: Instalar-Celeste.bat
  pause
  exit /b 1
)

echo.
echo  Celeste ativo — nao feche esta janela.
echo  Pressione Ctrl+C para parar.
echo.

:loop
node celeste.mjs
echo.
echo  Reiniciando em 60 segundos...
timeout /t 60 /nobreak >nul
goto loop
