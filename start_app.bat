@echo off
title AI Labor Market Analytics - Launcher
color 0A

echo ============================================
echo   AI Labor Market Analytics - Starting...
echo ============================================
echo.

:: Navigate to project root
cd /d "%~dp0"

:: ── Install Python dependencies if needed ──
echo [1/4] Checking Python dependencies...
python -c "import fastapi, uvicorn, pandas, numpy, sklearn, joblib, pydantic" 2>nul
if errorlevel 1 (
    echo       Installing Python packages...
    pip install fastapi uvicorn pandas numpy scikit-learn joblib pydantic >nul 2>&1
    echo       Done.
) else (
    echo       All packages found, skipping.
)
echo.

:: ── Install frontend dependencies if needed ──
echo [2/4] Checking frontend dependencies...
cd frontend
if not exist "node_modules" (
    echo       Installing npm packages ...
    npm install
) else (
    echo       node_modules found, skipping.
)
cd ..
echo.

:: ── Start Backend ──
echo [3/4] Starting Backend (FastAPI) on port 8000...
start "Backend - FastAPI" cmd /k "cd /d %~dp0 && uvicorn backend.main:app --reload --port 8000"

:: Wait for backend to be ready (health check)
echo       Waiting for backend to be ready...
set RETRIES=0
:wait_backend
set /a RETRIES+=1
if %RETRIES% gtr 30 (
    echo       WARNING: Backend did not respond after 30s. Continuing anyway...
    goto start_frontend
)
ping 127.0.0.1 -n 2 >nul
curl -s http://localhost:8000/ >nul 2>&1
if errorlevel 1 goto wait_backend
echo       Backend is ready!
echo.

:start_frontend
:: ── Start Frontend ──
echo [4/4] Starting Frontend (Next.js) on port 3000...
start "Frontend - Next.js" cmd /k "cd /d %~dp0frontend && npm run dev"
ping 127.0.0.1 -n 6 >nul
echo       Frontend started.
echo.

echo ============================================
echo   Everything is running!
echo.
echo   Backend  : http://localhost:8000
echo   Frontend : http://localhost:3000
echo.
echo   Opening browser...
echo ============================================

:: Open the app in default browser
ping 127.0.0.1 -n 3 >nul
start http://localhost:3000

echo.
echo Press any key to STOP all servers...
pause >nul

:: Kill the servers
taskkill /FI "WINDOWTITLE eq Backend - FastAPI*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend - Next.js*" /F >nul 2>&1
echo Servers stopped. Goodbye!
ping 127.0.0.1 -n 3 >nul
