@echo off
echo ============================================
echo DeepTrust Enhanced System - Installation
echo ============================================
echo.

cd backend

echo [1/3] Installing required dependencies...
echo.
call npm install cheerio
echo.

echo [2/3] Checking configuration...
echo.
if not exist .env (
    echo WARNING: .env file not found!
    echo Creating from .env.example...
    copy .env.example .env
    echo.
    echo IMPORTANT: Please edit backend\.env and add your API keys!
    echo.
) else (
    echo ✓ .env file exists
    echo.
)

echo [3/3] Running system test...
echo.
node test-enhanced-system.js

echo.
echo ============================================
echo Installation Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Make sure all API keys are in backend\.env
echo 2. Run: npm run dev
echo 3. Test with your frontend!
echo.
echo For detailed docs, see:
echo - ENHANCED_FEATURES.md (user guide)
echo - FIXES_SUMMARY.md (technical details)
echo.
pause
