#!/bin/bash

echo "🚀 Setting up LLMap development environment..."

# Backend setup
echo "📦 Setting up backend..."
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
echo "✅ Backend setup complete"

# Frontend setup
echo "📦 Setting up frontend..."
cd ../frontend
npm install
echo "✅ Frontend setup complete"

echo "🎉 Development environment ready!"
echo "Next steps:"
echo "1. Add your API keys to backend/.env"
echo "2. Run backend: cd backend && python main.py"
echo "3. Run frontend: cd frontend && npm run dev"