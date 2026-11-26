@echo off
setlocal
title Bracket Engine
cd /d "%~dp0"
if not exist "data" mkdir "data"
rem One shared database for every way of running the app.
set "DB_FILE=%~dp0data\bracket.sqlite"

if exist "app\BracketEngine-windows-x64.exe" goto run_app
where node >nul 2>nul
if %errorlevel%==0 goto run_node
goto no_runtime

:run_app
echo Starting Bracket Engine... your browser will open in a moment.
echo Keep this window open while you use the app. Close it to stop.
echo.
"app\BracketEngine-windows-x64.exe"
if errorlevel 1 pause
goto :eof

:run_node
echo Windows app not found - starting the Node.js version instead.
cd /d "%~dp0node"
if exist "node_modules" goto node_ready
echo Installing - first run only, needs internet...
call npm install --omit=dev
:node_ready
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"
echo Keep this window open while you use the app. Close it to stop.
node server.js
if errorlevel 1 pause
goto :eof

:no_runtime
echo Could not find the Windows app or Node.js.
echo Install Node.js from https://nodejs.org and double-click this file again.
pause
