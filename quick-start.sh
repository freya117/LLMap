#!/bin/bash

echo "🚀 LLMap Quick Start (Basic OCR)"
echo "================================"

# Check if we're in the right directory
if [ ! -f "backend/main_simple.py" ] || [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the LLMap project root directory"
    exit 1
fi

echo "📦 Setting up backend (basic OCR only)..."

# Backend setup
cd backend

# Install minimal dependencies
echo "Installing basic dependencies..."
pip install fastapi uvicorn python-multipart python-dotenv pillow pytesseract requests opencv-python numpy

# Create simple .env file
if [ ! -f ".env" ]; then
    echo "Creating basic .env file..."
    echo "# Basic configuration" > .env
    echo "# Add OPENAI_API_KEY=your_key_here when ready for AI features" >> .env
fi

cd ..

echo "📦 Setting up frontend..."

# Frontend setup
cd frontend
npm install
cd ..

echo ""
echo "✅ Quick setup complete!"
echo ""
echo "🚀 To start the application:"
echo "1. Backend:  cd backend && python main_simple.py"
echo "2. Frontend: cd frontend && npm run dev"
echo ""
echo "📊 Backend will be available at: http://localhost:8000"
echo "🌐 Frontend will be available at: http://localhost:3000"
echo ""
echo "💡 This uses basic OCR only. For AI features, your team member can:"
echo "   - Install: pip install openai paddleocr"
echo "   - Add OPENAI_API_KEY to backend/.env"
echo "   - Use backend/main.py instead of main_simple.py"