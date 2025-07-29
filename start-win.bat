@echo off
chcp 65001 > nul
echo ===================================
echo Quoridor Chess Online Startup Script
echo ===================================

if "%1"=="--help" goto help
if "%1"=="-h" goto help
if "%1"=="" goto all
if "%1"=="all" goto all
if "%1"=="backend" goto backend
if "%1"=="frontend" goto frontend
if "%1"=="stop" goto stop
if "%1"=="logs" goto logs
goto invalid

:help
echo Usage: start-win.bat [option]
echo.
echo Options:
echo   all       - Start both backend and frontend (default)
echo   backend   - Start Nakama backend only
echo   frontend  - Start frontend only
echo   stop      - Stop all services
echo   logs      - Show Nakama logs
echo   --help    - Show this help
goto end

:all
call :start_backend
echo.
call :start_frontend
goto end

:backend
call :start_backend
goto end

:frontend
call :start_frontend
goto end

:stop
echo Stopping services...
docker-compose down
echo All services stopped
goto end

:logs
echo Showing Nakama logs (Ctrl+C to exit)
docker-compose logs -f nakama
goto end

:start_backend
echo Starting Nakama backend...

REM Check Docker
docker info > nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running.
    echo Please start Docker Desktop.
    exit /b 1
)

REM Download Go dependencies
echo Downloading Go dependencies...
cd backend\modules
go mod download 2>nul || echo WARNING: Skipping Go dependencies (Go may not be installed)
cd ..\..

REM Start with Docker Compose
docker-compose up -d

echo Waiting for Nakama server to start...
timeout /t 5 /nobreak > nul

REM Health check
set count=0
:healthcheck
set /a count+=1
curl -f http://localhost:7350/ > nul 2>&1
if %errorlevel% equ 0 (
    echo Nakama backend started successfully!
    echo    - Game Server: http://localhost:7350
    echo    - Admin Console: http://localhost:7351 (admin/password)
    exit /b 0
)
if %count% lss 10 (
    echo Checking startup... (%count%/10)
    timeout /t 2 /nobreak > nul
    goto healthcheck
)
echo ERROR: Failed to start Nakama
exit /b 1

:start_frontend
echo Starting frontend...

REM Check Node.js
node -v > nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Please install Node.js: https://nodejs.org/
    exit /b 1
)

cd frontend

REM Install dependencies
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

echo Frontend started successfully!
echo    - Application: http://localhost:3000
echo.
echo How to play:
echo    1. Open 2 browser tabs
echo    2. Login with different usernames
echo    3. Start random match
echo    4. Enjoy chatting!
echo.
echo Press Ctrl+C to stop

REM Start frontend server
npm run dev
exit /b 0

:invalid
echo ERROR: Unknown option: %1
echo Usage: start-win.bat [all^|backend^|frontend^|stop^|logs^|--help]

:end