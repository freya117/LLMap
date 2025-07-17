#!/bin/bash

echo "🚀 Setting up LLMap Backend Environment"
echo "======================================"

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "❌ Error: conda not found. Please install Anaconda or Miniconda first."
    exit 1
fi

# Initialize conda for bash (needed for conda activate to work in scripts)
eval "$(conda shell.bash hook)"

# Check if llmap environment exists, create if not
if ! conda env list | grep -q "llmap"; then
    echo "📦 Creating 'llmap' conda environment with Python 3.11..."
    conda create -n llmap python=3.11 -y
else
    echo "✅ 'llmap' environment already exists"
fi

# Activate the environment
echo "🔧 Activating 'llmap' environment..."
conda activate llmap

# Install Python packages
echo "📦 Installing Python packages..."
pip install fastapi uvicorn python-multipart pillow pytesseract
pip install opencv-python geopy requests python-dotenv aiofiles
pip install numpy scikit-image nltk jieba

# Check if Tesseract is installed
echo "🔍 Checking for Tesseract OCR..."
if ! command -v tesseract &> /dev/null; then
    echo "⚠️  Warning: Tesseract OCR not found."
    echo "Please install Tesseract OCR:"
    echo "  macOS: brew install tesseract"
    echo "  Ubuntu: sudo apt-get install tesseract-ocr"
    echo "  Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki"
else
    echo "✅ Tesseract OCR found: $(tesseract --version | head -n 1)"
fi

echo ""
echo "✅ Setup completed!"
echo ""
echo "To use this environment:"
echo "  conda activate llmap"
echo "  python main.py"
echo ""
echo "Or use the activation script:"
echo "  source activate_env.sh"