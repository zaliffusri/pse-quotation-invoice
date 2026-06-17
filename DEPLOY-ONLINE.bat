@echo off
chcp 65001 >nul 2>&1
title PSE — Deploy Semula
cd /d "%~dp0"

if not exist .env.local (
  echo  .env.local tidak dijumpai. Jalankan SETUP-ONLINE.bat dahulu.
  pause
  exit /b 1
)

for /f "tokens=1,* delims==" %%A in ('type .env.local ^| findstr /v "^#"') do (
  if "%%A"=="SUPABASE_URL" set SUPABASE_URL=%%B
  if "%%A"=="SUPABASE_SERVICE_ROLE_KEY" set SUPABASE_KEY=%%B
  if "%%A"=="SESSION_SECRET" set SESSION_SECRET=%%B
)

echo Deploying...
call npx vercel --prod --yes
echo.
echo Selesai!
pause
