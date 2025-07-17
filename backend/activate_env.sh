#!/bin/bash

echo "🔧 Activating LLMap conda environment..."

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "❌ Error: conda not found. Please install Anaconda or Miniconda first."
    exit 1
fi

# Activate the llmap environment
echo "📦 Activating 'llmap' conda environment..."
conda activate llmap

# Check if activation was successful
if [[ "$CONDA_DEFAULT_ENV" == "llmap" ]]; then
    echo "✅ Successfully activated 'llmap' environment"
    echo "🐍 Python version: $(python --version)"
    echo ""
    echo "Now you can install dependencies with:"
    echo "  pip install -r requirements.txt"
    echo ""
    echo "And run the backend with:"
    echo "  python main.py"
else
    echo "❌ Failed to activate 'llmap' environment"
    echo "Please run: conda activate llmap"
fi