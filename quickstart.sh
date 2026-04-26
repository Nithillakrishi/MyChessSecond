#!/bin/bash
# Quick start script for Chess Second

echo "🏃 Chess Second - Quick Start"
echo "==============================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Check if Node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 14+"
    exit 1
fi

echo "✅ Python and Node.js found"
echo ""

# Backend setup
echo "📦 Setting up backend..."
cd backend

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# Activate venv
source venv/bin/activate || . venv/Scripts/activate

# Install dependencies
pip install -r requirements.txt -q
echo "✅ Backend dependencies installed"

echo ""
echo "✅ Backend setup complete!"
echo "   To start the backend, run: cd backend && source venv/bin/activate && python run.py"
echo ""

# Frontend setup
echo "📦 Setting up frontend..."
cd ../frontend

# Install dependencies
if [ ! -d "node_modules" ]; then
    npm install --quiet
    echo "✅ Frontend dependencies installed"
else
    echo "✅ Frontend dependencies already installed"
fi

echo ""
echo "✅ Frontend setup complete!"
echo "   To start the frontend, run: cd frontend && npm start"
echo ""
echo "🎯 To run the full application:"
echo "   Terminal 1: cd backend && source venv/bin/activate && python run.py"
echo "   Terminal 2: cd frontend && npm start"
echo ""
echo "Then open http://localhost:3000 in your browser"
