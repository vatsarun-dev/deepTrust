@echo off
REM Setup script for DeepTrust Enhanced AI Backend (Windows)

echo.
echo ========================================
echo  DeepTrust Enhanced AI Backend Setup
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo Creating .env file from .env.example...
    copy .env.example .env
    echo.
    echo [IMPORTANT] Edit .env and add your API keys:
    echo   - GNEWS_API_KEY (get from https://gnews.io/)
    echo   - PUTER_API_TOKEN (get from https://puter.com/)
    echo   - SIGHTENGINE credentials (optional)
    echo.
) else (
    echo .env file already exists
    echo.
)

echo Installing dependencies...
call npm install

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit backend\.env with your API keys
echo 2. Run: npm run dev (development) or npm start (production)
echo 3. Test at: http://localhost:5000/api/health
echo.
echo Read ENHANCED_AI_README.md for full documentation
echo.

pause
