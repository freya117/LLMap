# 🚀 LLMap Quick Setup Guide

## Simple 2-Step Setup

### Step 1: Backend Setup
```bash
cd backend
pip install fastapi uvicorn python-multipart python-dotenv pillow pytesseract requests opencv-python numpy
python main.py
```

### Step 2: Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## That's it! 

- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs

## What Works Now

✅ **Basic OCR Processing**
- Upload images and extract text
- Location extraction from images
- Batch processing support
- Map visualization

✅ **UI Features**
- File upload with drag & drop
- OCR results display
- Location analysis with ground truth comparison
- Export functionality (text, JSON, GeoJSON)

## For Your Team Member (AI Features)

The AI endpoints are ready but currently fall back to basic OCR:
- `/api/ai/process-image` → falls back to `/api/ocr/process`
- `/api/ai/process-batch` → falls back to `/api/ocr/batch`

To implement AI features:
1. Install AI dependencies: `pip install openai paddleocr`
2. Add `OPENAI_API_KEY` to `backend/.env`
3. Implement the AI processing logic in the AI endpoints

## Troubleshooting

**"Failed to fetch" error?**
- Make sure backend is running on port 8000
- Check `http://localhost:8000/health` in browser

**OCR not working?**
- Install Tesseract: `brew install tesseract` (macOS)
- Or: `sudo apt-get install tesseract-ocr` (Ubuntu)

**Dependencies issues?**
- Use Python 3.8+ 
- Try: `pip install --upgrade pip` first