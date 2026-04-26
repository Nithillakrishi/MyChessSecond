@echo off
REM Quick start script for Chess Second (Windows)

echo 🏃 Chess Second - Quick Start
echo ===============================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

REM Check if Node is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js 14+
    pause
    exit /b 1
)

echo ✅ Python and Node.js found
echo.

REM Backend setup
echo 📦 Setting up backend...
cd backend

REM Create venv if it doesn't exist
if not exist "venv" (
    python -m venv venv
    echo ✅ Virtual environment created
)

REM Activate venv
call venv\Scripts\activate.bat

REM Install dependencies
python -m pip install -q -r requirements.txt
echo ✅ Backend dependencies installed

echo.
echo ✅ Backend setup complete!
echo    To start the backend, run: cd backend ^&^& venv\Scripts\activate ^&^& python run.py
echo.

REM Frontend setup
echo 📦 Setting up frontend...
cd ..\frontend

REM Install dependencies
if not exist "node_modules" (
    npm install --quiet
    echo ✅ Frontend dependencies installed
) else (
    echo ✅ Frontend dependencies already installed
)

echo.
echo ✅ Frontend setup complete!
echo    To start the frontend, run: cd frontend ^&^& npm start
echo.
echo 🎯 To run the full application:
echo    Terminal 1: cd backend ^&^& venv\Scripts\activate ^&^& python run.py
echo    Terminal 2: cd frontend ^&^& npm start
echo.
echo Then open http://localhost:3000 in your browser
echo.
pause
