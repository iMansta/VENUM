@echo off
chcp 65001 >nul
title Celeste — Instalador VENUM
color 0A
cls

echo.
echo  ============================================
echo    CELESTE — I V E N U M I
echo    Instalador (sem Node, sem chaves)
echo  ============================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\VENUM-Celeste"
set "EXE_NAME=celeste.exe"

if not exist "%~dp0%EXE_NAME%" (
  echo  [ERRO] celeste.exe nao encontrado nesta pasta.
  echo  Baixe novamente o pacote Celeste no hub VENUM.
  pause
  exit /b 1
)

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo  Instalando em:
echo  %INSTALL_DIR%
echo.

copy /Y "%~dp0%EXE_NAME%" "%INSTALL_DIR%\%EXE_NAME%" >nul

(
  echo @echo off
  echo title Celeste — I V E N U M I
  echo cd /d "%INSTALL_DIR%"
  echo start "Celeste" "%INSTALL_DIR%\%EXE_NAME%"
) > "%USERPROFILE%\Desktop\Iniciar Celeste.bat"

(
  echo @echo off
  echo cd /d "%INSTALL_DIR%"
  echo start "" "%INSTALL_DIR%\%EXE_NAME%"
) > "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Celeste-VENUM.bat" 2>nul

echo  Atalho criado na Area de Trabalho.
echo  Inicio automatico com Windows configurado.
echo.
echo  ============================================
echo    PRONTO! Clique em "Iniciar Celeste"
echo  ============================================
echo.
echo  A cobra fica na bandeja ^(perto do relogio^).
echo  Deixe o console aberto — e normal.
echo.
pause
