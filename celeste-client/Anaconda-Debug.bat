@echo off
chcp 65001 >nul
title Anaconda Debug — mapeamento banco guilda
cd /d "%~dp0"
set ANACONDA_GUILD_BANK_DEBUG=1
start "" "%~dp0anaconda.exe"
