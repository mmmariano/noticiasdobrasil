@echo off
title Atualizar Noticias do Brasil - GitHub
cd /d "C:\Users\mtema\OneDrive\Desktop\noticiasdobrasil"

echo ========================================
echo   ATUALIZANDO PROJETO NO GITHUB
echo ========================================
echo.

git add .

git diff --cached --quiet
if %errorlevel%==0 (
    echo Nenhuma alteracao nova para enviar.
    pause
    exit /b
)

git commit -m "Atualizacao do site"

if errorlevel 1 (
    echo.
    echo ERRO ao criar o commit.
    pause
    exit /b 1
)

git push origin main

if errorlevel 1 (
    echo.
    echo ERRO ao enviar para o GitHub.
    echo Verifique sua conexao e possiveis conflitos.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   PUSH REALIZADO COM SUCESSO!
echo ========================================
echo.
pause
