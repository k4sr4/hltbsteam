@echo off
REM Package HLTB Steam Extension for Chrome Web Store
REM This script creates a ZIP file from the dist/ folder

echo ========================================
echo HLTB Steam Extension Packager
echo ========================================
echo.

REM Check if dist folder exists
if not exist "dist\" (
    echo [ERROR] dist\ folder not found!
    echo Please run: npm run build
    echo.
    pause
    exit /b 1
)

REM Check if dist folder has files
dir dist\ /b | findstr "^" >nul
if errorlevel 1 (
    echo [ERROR] dist\ folder is empty!
    echo Please run: npm run build
    echo.
    pause
    exit /b 1
)

echo [1/5] Checking for required files...

REM Check for critical files
if not exist "dist\manifest.json" (
    echo [ERROR] manifest.json not found in dist\
    pause
    exit /b 1
)

if not exist "dist\background.js" (
    echo [ERROR] background.js not found in dist\
    pause
    exit /b 1
)

if not exist "dist\content.js" (
    echo [ERROR] content.js not found in dist\
    pause
    exit /b 1
)

if not exist "dist\popup.html" (
    echo [ERROR] popup.html not found in dist\
    pause
    exit /b 1
)

echo [OK] All required files found

echo.
echo [2/5] Checking for icons...

if not exist "dist\icons\icon16.png" (
    echo [WARNING] Icons not found! You need icons before publishing.
    echo Please create icons in dist\icons\ folder
    echo Sizes needed: 16x16, 32x32, 48x48, 128x128
    echo.
    echo Continue anyway? (Y/N)
    set /p continue=
    if /i not "%continue%"=="Y" (
        echo Cancelled.
        pause
        exit /b 1
    )
) else (
    echo [OK] Icons found
)

echo.
echo [3/5] Creating package directory...

REM Create release folder if it doesn't exist
if not exist "release\" mkdir release

echo [OK] Release folder ready

echo.
echo [4/5] Creating ZIP file...

REM Get current timestamp for filename
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "timestamp=%dt:~0,8%-%dt:~8,6%"

set "zipfile=release\hltb-steam-extension-v1.0.0.zip"

REM Check if PowerShell is available (Windows 8+)
where powershell >nul 2>nul
if %errorlevel% equ 0 (
    REM Use PowerShell to create ZIP
    powershell -command "Compress-Archive -Path 'dist\*' -DestinationPath '%zipfile%' -Force"
    if %errorlevel% equ 0 (
        echo [OK] ZIP file created: %zipfile%
    ) else (
        echo [ERROR] Failed to create ZIP file
        pause
        exit /b 1
    )
) else (
    echo [ERROR] PowerShell not found!
    echo Please create ZIP file manually:
    echo 1. Open dist\ folder
    echo 2. Select all files
    echo 3. Right-click ^> Send to ^> Compressed (zipped) folder
    echo 4. Name it: hltb-steam-extension-v1.0.0.zip
    pause
    exit /b 1
)

echo.
echo [5/5] Validating ZIP file...

if exist "%zipfile%" (
    for %%A in ("%zipfile%") do set size=%%~zA
    echo [OK] ZIP file size: %size% bytes

    REM Check if size is reasonable (should be 1-5 MB typically)
    if %size% LSS 100000 (
        echo [WARNING] ZIP file seems too small! May be incomplete.
    )
    if %size% GTR 104857600 (
        echo [ERROR] ZIP file is too large! ^(^>100 MB^)
        echo Chrome Web Store has a 100 MB limit.
        pause
        exit /b 1
    )
) else (
    echo [ERROR] ZIP file was not created
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS!
echo ========================================
echo.
echo Package created: %zipfile%
echo.
echo Next steps:
echo 1. Test the ZIP by extracting and loading in Chrome
echo 2. Go to: chrome://extensions/
echo 3. Enable Developer Mode
echo 4. Click "Load unpacked" and select extracted folder
echo 5. Test all features
echo 6. Upload to Chrome Web Store Developer Dashboard
echo.
echo Chrome Web Store: https://chrome.google.com/webstore/devconsole
echo.
pause
