@echo off
chcp 65001 >nul 2>&1
title PSE — Push ke GitHub
color 0B
cd /d "%~dp0"

echo.
echo  ============================================
echo   Push ke GitHub — zaliffusri
echo  ============================================
echo.
echo  Browser akan buka untuk login GitHub.
echo  Selepas login, push akan jalan automatik.
echo.
pause

where git >nul 2>&1
if errorlevel 1 (
  echo  [Ralat] Git tidak dijumpai. Install dari https://git-scm.com
  pause
  exit /b 1
)

set REPO=pse-quotation-invoice
set USER=zaliffusri

git remote remove origin 2>nul
git remote add origin https://github.com/%USER%/%REPO%.git

echo.
echo  Mencuba push...
echo  Jika repo belum wujud, buat dulu di:
echo  https://github.com/new
echo  Nama repo: %REPO%
echo  (JANGAN tick Add README)
echo.
pause

git push -u origin master
if errorlevel 1 (
  echo.
  echo  Cuba branch main...
  git branch -M main
  git push -u origin main
)

if errorlevel 1 (
  echo.
  echo  [Gagal] Kemungkinan:
  echo  1. Repo belum dibuat di GitHub
  echo  2. Login ditolak
  echo  3. Token/password salah
  echo.
  echo  Buat repo: https://github.com/new?name=%REPO%
  pause
  exit /b 1
)

echo.
echo  ============================================
echo   BERJAYA!
echo   https://github.com/%USER%/%REPO%
echo  ============================================
echo.
start https://github.com/%USER%/%REPO%
pause
