@echo off
title PSE System
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  npm install
)
echo.
echo Starting PSE System...
echo Open http://localhost:3000 in your browser
echo Login: admin / pse2026
echo.
npm start
