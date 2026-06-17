@echo off
chcp 65001 >nul 2>&1
title PSE — Setup Online (Vercel + Supabase)
color 0A
cd /d "%~dp0"

echo.
echo  ========================================================
echo   PSE SYSTEM — Setup Online (PERCUMA)
echo   Vercel + Supabase — RM 0/bulan
echo  ========================================================
echo.

:: ── Semak Node.js ──
where node >nul 2>&1
if errorlevel 1 (
  echo  [Ralat] Node.js tidak dijumpai. Install dari https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo  Installing dependencies...
  call npm install
  echo.
)

:: ── Langkah 1: Supabase ──
echo  LANGKAH 1/4 — Setup Supabase Database
echo  ----------------------------------------
echo.
echo  1. Buka Supabase dan buat project baru (region: Singapore)
echo  2. Pergi SQL Editor -^> New query
echo  3. Tekan Ctrl+V (schema dah dicopy ke clipboard)
echo  4. Klik RUN
echo  5. Pergi Settings -^> API, copy URL dan service_role key
echo.
powershell -NoProfile -Command "Get-Content '%~dp0supabase\schema-vercel.sql' -Raw | Set-Clipboard"
echo  [OK] Schema SQL dicopy ke clipboard!
echo.
start https://supabase.com/dashboard/projects
echo  Tekan ENTER selepas anda dah RUN SQL schema...
pause >nul
echo.

:: ── Input credentials ──
set /p SUPABASE_URL=Masukkan SUPABASE_URL: 
set /p SUPABASE_KEY=Masukkan SERVICE_ROLE KEY: 

if "%SUPABASE_URL%"=="" (
  echo  [Ralat] SUPABASE_URL kosong.
  pause
  exit /b 1
)
if "%SUPABASE_KEY%"=="" (
  echo  [Ralat] SERVICE_ROLE KEY kosong.
  pause
  exit /b 1
)

for /f "delims=" %%S in ('node scripts\generate-secret.js') do set SESSION_SECRET=%%S

(
  echo SUPABASE_URL=%SUPABASE_URL%
  echo SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_KEY%
  echo SESSION_SECRET=%SESSION_SECRET%
  echo NODE_ENV=production
) > .env.local

echo.
echo  [OK] .env.local dicipta
echo.

:: ── Langkah 2: Verify ──
echo  LANGKAH 2/4 — Uji sambungan Supabase
echo  ----------------------------------------
call node scripts\verify-supabase.js
if errorlevel 1 (
  echo.
  echo  Setup gagal. Semak SQL schema dah run dengan betul.
  pause
  exit /b 1
)

:: ── Langkah 3: Import data ──
echo  LANGKAH 3/4 — Import data tempatan (jika ada)
echo  ----------------------------------------
call node scripts\migrate-local.js
echo.

:: ── Langkah 4: Deploy Vercel ──
echo  LANGKAH 4/4 — Deploy ke Vercel
echo  ----------------------------------------
echo.
echo  Browser akan buka untuk login Vercel (daftar percuma jika belum ada).
echo  Selepas login, env variables akan diset automatik.
echo.
pause

call npx vercel login
if errorlevel 1 (
  echo  [Ralat] Login Vercel gagal.
  pause
  exit /b 1
)

echo.
echo  Linking project...
call npx vercel link --yes 2>nul

echo  Setting environment variables...
echo %SUPABASE_URL%| npx vercel env add SUPABASE_URL production --force 2>nul
echo %SUPABASE_KEY%| npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --force 2>nul
echo %SESSION_SECRET%| npx vercel env add SESSION_SECRET production --force 2>nul
echo production| npx vercel env add NODE_ENV production --force 2>nul

echo.
echo  Deploying to production...
call npx vercel --prod --yes

echo.
echo  ========================================================
echo   SETUP SELESAI!
echo  ========================================================
echo.
echo   Log masuk:
echo   Username: admin
echo   Password: pse2026  (TUKAR selepas login!)
echo.
echo   Panduan: DEPLOY-VERCEL.md
echo  ========================================================
echo.
pause
