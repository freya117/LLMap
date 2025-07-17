# LLMap Backend

FastAPI backend for processing multi-modal inputs and AI-powered location extraction.

## Features

- Multi-modal file upload (images, text, links)
- OCR processing for image text extraction
- GPT-based location parsing and geocoding
- GeoJSON generation and export
- RESTful API for frontend integration

## Setup

```bash
pip install -r requirements.txt
python main.py
```

## API Endpoints

- `POST /upload` - Upload and process files
- `POST /extract-locations` - Extract locations from text
- `GET /geocode` - Convert addresses to coordinates
- `POST /generate-map` - Generate map data
- `GET /export/{format}` - Export map data

## Environment Variables

```
OPENAI_API_KEY=your_openai_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
```