#!/bin/bash

echo "🚀 LLMap Quick Setup"
echo "===================="

# Check if we're in the right directory
if [ ! -f "backend/main.py" ] || [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the LLMap project root directory"
    exit 1
fi

echo "📦 Setting up backend..."

# Backend setup
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit backend/.env and add your API keys!"
    echo "   - OPENAI_API_KEY is required for AI processing"
    echo "   - GOOGLE_MAPS_API_KEY is optional (fallback to Nominatim)"
fi

# Check Tesseract installation
if ! command -v tesseract &> /dev/null; then
    echo "⚠️  Warning: Tesseract OCR not found."
    echo "   Install with: brew install tesseract (macOS)"
    echo "   Or: sudo apt-get install tesseract-ocr (Ubuntu)"
fi

cd ..

echo "📦 Setting up frontend..."

# Frontend setup
cd frontend
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the application:"
echo "1. Edit backend/.env and add your OPENAI_API_KEY"
echo "2. Run backend:  ./start.sh"
echo "3. Run frontend: cd frontend && npm run dev"
echo ""
echo "📊 Backend will be available at: http://localhost:8000"
echo "🌐 Frontend will be available at: http://localhost:3000"