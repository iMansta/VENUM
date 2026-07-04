@echo off
chcp 65001 >nul
title Anaconda — Instalador VENUM
color 0A
cls

echo.
echo  ============================================
echo    ANACONDA — I V E N U M I
echo    Instalador (sem Node, sem chaves)
echo  ============================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\VENUM-Anaconda"
set "EXE_NAME=anaconda.exe"

if not exist "%~dp0%EXE_NAME%" (
  echo  [ERRO] anaconda.exe nao encontrado nesta pasta.
  echo  Baixe novamente o pacote Anaconda no hub VENUM.
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
  echo title Anaconda — I V E N U M I
  echo cd /d "%INSTALL_DIR%"
  echo start "Anaconda" "%INSTALL_DIR%\%EXE_NAME%"
) > "%USERPROFILE%\Desktop\Iniciar Anaconda.bat"

(
  echo @echo off
  echo cd /d "%INSTALL_DIR%"
  echo start "" "%INSTALL_DIR%\%EXE_NAME%"
) > "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Anaconda-VENUM.bat" 2>nul

echo  Atalho criado na Area de Trabalho.
echo  Inicio automatico com Windows configurado.
echo.
echo  ============================================
echo    PRONTO! Clique em "Iniciar Anaconda"
echo  ============================================
echo.
echo  A cobra fica na bandeja ^(perto do relogio^).
echo  Deixe o console aberto — e normal.
echo.
pause
