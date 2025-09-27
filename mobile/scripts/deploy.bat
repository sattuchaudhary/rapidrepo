@echo off
REM Rapid Repo Mobile App Deployment Script for Windows
REM This script handles building and deploying the mobile app

echo 🚀 Starting Rapid Repo Mobile App Deployment...

REM Check if EAS CLI is installed
where eas >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] EAS CLI is not installed. Please install it first:
    echo npm install -g @expo/eas-cli
    pause
    exit /b 1
)

REM Check if user is logged in to Expo
eas whoami >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] You are not logged in to Expo. Please login first:
    echo eas login
    pause
    exit /b 1
)

REM Get deployment type from user
echo Select deployment type:
echo 1) Development Build (APK for testing)
echo 2) Preview Build (APK for internal testing)
echo 3) Production Build (AAB for Play Store)
echo 4) iOS Build (for App Store)
echo 5) Publish OTA Update (for existing builds)

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo [INFO] Building development version...
    eas build --platform android --profile development
    set BUILD_TYPE=development
) else if "%choice%"=="2" (
    echo [INFO] Building preview version...
    eas build --platform android --profile preview
    set BUILD_TYPE=preview
) else if "%choice%"=="3" (
    echo [INFO] Building production version for Play Store...
    eas build --platform android --profile production
    set BUILD_TYPE=production
) else if "%choice%"=="4" (
    echo [INFO] Building iOS version for App Store...
    eas build --platform ios --profile production
    set BUILD_TYPE=ios
) else if "%choice%"=="5" (
    echo [INFO] Publishing OTA update...
    eas update --branch production --message "Bug fixes and improvements"
    echo [SUCCESS] OTA update published successfully!
    pause
    exit /b 0
) else (
    echo [ERROR] Invalid choice. Please run the script again.
    pause
    exit /b 1
)

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Build completed successfully!
    echo.
    if "%BUILD_TYPE%"=="production" (
        echo [INFO] Next steps:
        echo 1. Download the build from Expo dashboard
        echo 2. Upload to Play Store/App Store
        echo 3. Update version configuration in admin panel
        echo 4. Test the app thoroughly
    ) else if "%BUILD_TYPE%"=="ios" (
        echo [INFO] Next steps:
        echo 1. Download the build from Expo dashboard
        echo 2. Upload to App Store
        echo 3. Update version configuration in admin panel
        echo 4. Test the app thoroughly
    ) else (
        echo [INFO] Build is ready for testing!
        echo You can download the APK from the Expo dashboard or scan the QR code.
    )
) else (
    echo [ERROR] Build failed. Please check the logs and try again.
    pause
    exit /b 1
)

echo [SUCCESS] Deployment process completed!
pause
