@echo off
REM Rapid Repo Server Deployment Script for Windows
REM This script provides deployment instructions for the server

echo 🚀 Starting Rapid Repo Server Deployment...

echo.
echo The CORS issue has been fixed in server/index.js
echo You need to deploy this updated file to your VPS
echo.

echo Select deployment method:
echo 1) Manual deployment instructions
echo 2) Show the key changes made
echo 3) Exit

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo [MANUAL DEPLOYMENT INSTRUCTIONS]
    echo.
    echo 1. Copy the updated server/index.js file to your VPS
    echo 2. SSH into your VPS: ssh user@your-vps-ip
    echo 3. Navigate to your app directory: cd /path/to/your/app
    echo 4. Replace server/index.js with the updated version
    echo 5. Restart the application:
    echo    - If using PM2: pm2 restart all
    echo    - If using systemd: sudo systemctl restart your-app-name
    echo 6. Check logs: pm2 logs (or journalctl -u your-app-name)
    echo.
    echo After deployment, test the login functionality to verify CORS is working.
) else if "%choice%"=="2" (
    echo.
    echo [KEY CHANGES MADE TO FIX CORS]
    echo.
    echo 1. Enhanced CORS configuration with explicit methods and headers
    echo 2. Added explicit OPTIONS request handling for preflight requests
    echo 3. Disabled problematic Helmet policies that interfere with CORS
    echo 4. Added proper headers for cross-origin requests
    echo.
    echo The main changes are in server/index.js around lines 25-64
) else if "%choice%"=="3" (
    echo Exiting...
    exit /b 0
) else (
    echo [ERROR] Invalid choice. Please run the script again.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Deployment instructions provided!
pause
