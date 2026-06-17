@echo off
title PSE Online Tunnel
cd /d "%~dp0"
echo.
echo  PSE System - Akses Online (Sementara)
echo  =====================================
echo.
echo  Pastikan server dah jalan (start.bat) dalam window lain!
echo.
echo  Tunnel URL akan muncul di bawah...
echo  Kongsi URL tu untuk akses dari telefon/laptop lain.
echo  (URL berubah setiap kali - untuk production guna Render.com)
echo.
npx --yes cloudflared tunnel --url http://localhost:3000
pause
