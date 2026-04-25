@echo off
echo Starting Rice Models Stack...

:: Flask ML Service (port 5000)
start "Flask ML Service" cmd /k "cd /d %~dp0ai_models && python ml_service.py"

:: Node Backend (port 6532)
start "Node Backend" cmd /k "cd /d %~dp0stack\backend && node server.js"

:: Vite Frontend (port 5173)
start "Vite Frontend" cmd /k "cd /d %~dp0stack\frontend2 && npm run dev"

echo All services started.
