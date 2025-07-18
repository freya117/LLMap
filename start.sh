#!/bin/bash

echo "🚀 Starting LLMap Backend"
echo "========================"

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo "❌ Error: Please run this script from the LLMap project root directory"
    exit 1
fi

# Navigate to backend
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run ./setup.sh first"
    exit 1
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please run ./setup.sh first"
    exit 1
fi

# Check if OPENAI_API_KEY is set
if ! grep -q "OPENAI_API_KEY=sk-" .env 2>/dev/null; then
    echo "⚠️  Warning: OPENAI_API_KEY not set in .env file"
    echo "   The Enhanced OCR + AI Pipeline requires an OpenAI API key"
    echo "   Edit backend/.env and add: OPENAI_API_KEY=sk-your-key-here"
    echo ""
fi

# Start the server
echo "🌟 Starting FastAPI server..."
echo "📊 API Documentation: http://localhost:8000/docs"
echo "🔍 Health check: http://localhost:8000/health"
echo "🛑 Press Ctrl+C to stop"
echo ""

python main.py