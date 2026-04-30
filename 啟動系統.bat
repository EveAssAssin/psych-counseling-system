@echo off
chcp 65001 >nul 2>nul
title Psych System Launcher

cd /d "%~dp0"

:MENU
cls
echo.
echo  =============================================
echo   Psych Counseling System - Launcher
echo  =============================================
echo.
echo   [1] Start All (Backend + Frontend)
echo   [2] Start Backend Only
echo   [3] Start Frontend Only
echo   [4] Stop All Services
echo   [5] Build Frontend
echo   [6] Open Browser
echo   [0] Exit
echo.
echo  ---------------------------------------------
echo   Backend : http://localhost:3001
echo   Frontend: http://localhost:5174
echo   API Docs: http://localhost:3001/api/docs
echo  ---------------------------------------------
echo.
set /p choice=  Select [0-6]:

if "%choice%"=="1" goto START_ALL
if "%choice%"=="2" goto START_BACKEND
if "%choice%"=="3" goto START_FRONTEND
if "%choice%"=="4" goto STOP_ALL
if "%choice%"=="5" goto BUILD_FRONTEND
if "%choice%"=="6" goto OPEN_BROWSER
if "%choice%"=="0" goto EXIT
echo  Invalid choice
timeout /t 2 /nobreak >nul
goto MENU

:START_ALL
echo.
echo  Checking environment...

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  Node.js not found. Please install Node.js first.
    pause
    goto MENU
)

if not exist "backend\.env" (
    echo  backend\.env not found!
    pause
    goto MENU
)

echo  Stopping old processes...
call :KILL_PORTS

if not exist "backend\node_modules" (
    echo  Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)
if not exist "frontend\node_modules" (
    echo  Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo.
echo  Starting backend...
start "psych-backend" cmd /c "cd /d "%~dp0backend" && npm run start:dev"

echo  Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo  Starting frontend...
start "psych-frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"

timeout /t 5 /nobreak >nul

echo  Opening browser...
start http://localhost:5174

echo.
echo  All services started!
echo.
pause
goto MENU

:START_BACKEND
echo.
call :KILL_PORT 3001
echo  Starting backend...
start "psych-backend" cmd /c "cd /d "%~dp0backend" && npm run start:dev"
echo  Backend started: http://localhost:3001
echo.
pause
goto MENU

:START_FRONTEND
echo.
call :KILL_PORT 5174
echo  Starting frontend...
start "psych-frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"
echo  Frontend started: http://localhost:5174
echo.
pause
goto MENU

:STOP_ALL
echo.
echo  Stopping all services...
call :KILL_PORTS
echo  All services stopped.
echo.
pause
goto MENU

:BUILD_FRONTEND
echo.
echo  Building frontend...
cd frontend
call npm run build
cd ..
echo.
echo  Build complete! Output in frontend\dist
echo.
pause
goto MENU

:OPEN_BROWSER
start http://localhost:5174
goto MENU

:KILL_PORTS
call :KILL_PORT 3001
call :KILL_PORT 5174
goto :eof

:KILL_PORT
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%~1 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)
goto :eof

:EXIT
exit /b 0
