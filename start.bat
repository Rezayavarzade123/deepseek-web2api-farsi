@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title DeepSeek Chat API Proxy Server

:: ============================================================
::  0. Defaults (override with the PORT / HOST environment variables)
:: ============================================================
if "%PORT%"=="" set "PORT=8080"
if "%HOST%"=="" set "HOST=127.0.0.1"
set "REQ=requirements.txt"

echo ==================================================
echo    DeepSeek Chat API Proxy Launcher
echo    HOST=%HOST%    PORT=%PORT%
echo ==================================================
echo.

if not exist ".env" (
    if not exist ".env.example" (
        echo [ERROR] Neither .env nor .env.example was found. Cannot create configuration.
        pause
        exit /b 1
    )
    copy /Y ".env.example" ".env" >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Could not copy .env.example to .env. Check directory write permissions.
        pause
        exit /b 1
    )
    echo [CONFIG] .env was not found; created it from .env.example.
) else (
    echo [CONFIG] Existing .env detected; keeping the current configuration.
)
echo.

:: ============================================================
::  1. Locate system Python (requires 3.10 or later)
:: ============================================================
set "PYTHON="
where python >nul 2>&1 && set "PYTHON=python"
if not defined PYTHON where py >nul 2>&1 && set "PYTHON=py"
if not defined PYTHON goto :no_python
"%PYTHON%" --version >nul 2>&1 || goto :no_python
"%PYTHON%" -c "import sys;sys.exit(0 if sys.version_info>=(3,10) else 1)" >nul 2>&1 || goto :old_python
for /f "tokens=*" %%v in ('"%PYTHON%" --version 2^>^&1') do set "PYVER=%%v"
echo [1/6] System Python: !PYVER!
echo.

:: ============================================================
::  2. Find or create a virtual environment (.venv, then venv / env)
:: ============================================================
set "VENV="
if exist ".venv\Scripts\python.exe" set "VENV=.venv"
if not defined VENV if exist "venv\Scripts\python.exe" set "VENV=venv"
if not defined VENV if exist "env\Scripts\python.exe" set "VENV=env"
if defined VENV (
    echo [2/6] Found virtual environment: %VENV%
) else (
    echo [2/6] No virtual environment found; creating .venv ...
    "%PYTHON%" -m venv .venv
    if errorlevel 1 (
        echo        Could not create .venv; trying venv ...
        "%PYTHON%" -m venv venv
        if errorlevel 1 goto :venv_failed
        set "VENV=venv"
    ) else (
        set "VENV=.venv"
    )
    echo        Virtual environment created: !VENV!
)
set "PY=%VENV%\Scripts\python.exe"
if not exist "%PY%" goto :venv_failed
echo.

:: ============================================================
::  3. Check dependencies (install missing or unavailable packages)
:: ============================================================
set "CHK=%TEMP%\ds2api_pipchk_%RANDOM%.txt"
echo [3/6] Checking dependencies in %VENV% ...
"%PY%" -m pip install --dry-run -r "%REQ%" > "%CHK%" 2>&1
set "DRY_RC=!errorlevel!"
findstr /i "would install" "%CHK%" >nul 2>&1
set "NEED=!errorlevel!"
del "%CHK%" >nul 2>&1
if !DRY_RC! equ 0 if !NEED! equ 1 (
    echo        Dependencies are already installed; skipping installation.
) else (
    echo        Dependencies are missing or the check failed; installing ...
    if !DRY_RC! neq 0 echo        [INFO] The pip check failed; pip may be offline or outdated. Trying installation anyway.
    "%PY%" -m pip install --upgrade pip >nul 2>&1
    "%PY%" -m pip install -r "%REQ%"
    if errorlevel 1 goto :deps_failed
    echo        Dependencies installed.
)
echo.

:: ============================================================
::  4. Build the WebUI (v3 React account-pool management interface)
:: ============================================================
set "WEBUI_DIR=webui-new"
set "WEBUI_DIST=%WEBUI_DIR%\dist"
set "NEED_BUILD=1"
if exist "%WEBUI_DIST%\index.html" if not defined WEBUI_REBUILD set "NEED_BUILD=0"
echo [4/6] Checking WebUI build output ...
if "!NEED_BUILD!"=="0" (
    echo        WebUI is already built; skipping. To force a rebuild, set WEBUI_REBUILD=1.
) else (
    if defined WEBUI_REBUILD (
        echo        WEBUI_REBUILD is set; forcing a rebuild ...
    ) else (
        echo        Build output not found; starting build ...
    )
    where node >nul 2>&1
    if errorlevel 1 (
        echo        [WARNING] Node.js/npm was not found; cannot build the WebUI.
        echo        Starting the API only. You can build it later with %WEBUI_DIR%\scripts\build.bat.
    ) else (
        pushd "%WEBUI_DIR%"
        call scripts\build.bat
        set "BUILD_RC=!errorlevel!"
        popd
        if !BUILD_RC! neq 0 (
            echo        [WARNING] WebUI build failed; starting the API only.
            echo        You can retry later with %WEBUI_DIR%\scripts\build.bat.
        ) else (
            echo        WebUI build complete: %WEBUI_DIST%
        )
    )
)
echo.

:: ============================================================
::  5. Free the port (stop only recognized API server command lines)
:: ============================================================
echo [5/6] Checking port %PORT% ...
set "BLOCKED="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
    set "PID=%%a"
    set "CMDLINE="
    for /f "usebackq tokens=*" %%c in (`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=%%a').CommandLine" 2^>nul`) do set "CMDLINE=%%c"
    if defined CMDLINE (
        echo        Port %PORT% is used by PID !PID!; command line: !CMDLINE!
        echo !CMDLINE! | findstr /i "uvicorn server:app server.py ds2api" >nul
        if !errorlevel! equ 0 (
            echo        The command line matches a known API server pattern; stopping it ...
            taskkill /F /PID !PID! >nul 2>&1
            if !errorlevel! neq 0 taskkill /F /T /PID !PID! >nul 2>&1
            ping -n 2 127.0.0.1 >nul
        ) else (
            echo        This process does not appear to belong to this project; refusing to stop it.
            set "BLOCKED=1"
        )
    ) else (
        echo        Port %PORT% is used by PID !PID!, but its command line could not be read; refusing to stop it.
        set "BLOCKED=1"
    )
)
if defined BLOCKED (
    echo.
    echo   ============================================================
    echo   Port %PORT% is in use by another process, not this service.
    echo   Free the port yourself or choose a different one:
    echo       set PORT=9090 ^&^& start.bat
    echo   ============================================================
    echo.
    pause
    exit /b 1
)
echo.

:: ============================================================
::  6. Start the service
:: ============================================================
echo [6/6] Starting service on %HOST%:%PORT% ...
echo.
:: 0.0.0.0 / :: are bind addresses; use 127.0.0.1 in a local browser.
set "ACCESS_HOST=%HOST%"
if "%ACCESS_HOST%"=="0.0.0.0" set "ACCESS_HOST=127.0.0.1"
echo.
echo   ============================================================
echo   After startup, open one of these URLs:
echo      WebUI admin panel: http://%ACCESS_HOST%:%PORT%/webui/
echo      OpenAI API:        http://%ACCESS_HOST%:%PORT%/v1/chat/completions
echo      Health check:      http://%ACCESS_HOST%:%PORT%/health
"%PY%" -c "import os; from dotenv import load_dotenv; load_dotenv('.env'); print('  Admin password: ' + os.environ.get('DEEPSEEK_ADMIN_PASSWORD', 'admin'))"
echo   ============================================================
echo.
if not "%WEBUI_OPEN%"=="0" (
    echo   Opening the browser in 3 seconds. Set WEBUI_OPEN=0 to skip.
    start "" powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://%ACCESS_HOST%:%PORT%/webui/'"
) else (
    echo   Skipping automatic browser launch (WEBUI_OPEN=0).
)
echo.
"%PY%" -m uvicorn server:app --host %HOST% --port %PORT%
if errorlevel 1 (
    echo.
    echo   Service exited unexpectedly. Review the logs above.
    pause
)
exit /b %errorlevel%

:: ---------- Error handling ----------
:no_python
echo.
echo [ERROR] Python 3.10+ was not found (tried "python" and "py").
echo        Install it from https://www.python.org/downloads/ and add it to PATH.
pause
exit /b 1

:old_python
echo.
echo [ERROR] Python 3.10+ is required. Detected version:
"%PYTHON%" --version
pause
exit /b 1

:venv_failed
echo.
echo [ERROR] Could not create or use a virtual environment.
echo        Try manually: "%PYTHON%" -m venv .venv
pause
exit /b 1

:deps_failed
echo.
echo [ERROR] Dependency installation failed. Review the logs above.
echo        Try manually: "%PY%" -m pip install -r "%REQ%"
pause
exit /b 1
