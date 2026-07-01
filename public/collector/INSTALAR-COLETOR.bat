@echo off
title VENUM - Instalador do Coletor
echo ========================================
echo   VENUM - Coletor de Dados Albion
echo   Guilda I V E N U M I
echo ========================================
echo.
echo Este script prepara o coletor que alimenta:
echo   - Precos do mercado / Black Market
echo   - Ranking de fama (PvP, PvE, Coleta)
echo   - Sincronizacao de membros da guilda
echo.
echo REQUISITOS: Node.js 18+ instalado
echo.
pause
echo.
echo 1) Clone o repositorio (se ainda nao tiver):
echo    git clone https://github.com/iMansta/VENUM.git
echo.
echo 2) Entre na pasta e execute:
echo    cd VENUM
echo    copy .env.example .env
echo    npm install
echo    npm run setup
echo    npm run collector
echo.
echo Edite o arquivo .env com suas chaves Supabase antes de rodar.
echo.
pause
