# LLMap Architecture Guide

## System Overview

LLMap uses an **Enhanced OCR + AI Pipeline** strategy that combines context-preserving OCR with AI semantic processing for intelligent location extraction.

### Core Philosophy
- **OCR Phase**: Extract all meaningful text with minimal filtering, preserve spatial context
- **AI Phase**: Let AI handle semantic understanding, fuzzy matching, and intelligent geocoding
- **Result**: Context-aware, error-tolerant, multi-language location extraction

## Architecture Components

### 1. Enhanced OCR Layer
```
Input Image → Content Type Detection → Multi-Engine OCR → Contextual Chunking
```

**Key Features:**
- Multi-engine coordination (PaddleOCR for Chinese, Tesseract for English)
- Content type detection (social media, travel itinerary, map screenshot)
- Spatial relationship preservation
- Minimal aggressive filtering

**Components:**
- `EnhancedOCRProcessor`: Main OCR coordinator
- `ContentTypeDetector`: Analyzes visual and textual features
- `ContextualChunker`: Creates structured chunks with spatial context

### 2. AI Semantic Processing Layer
```
OCR Chunks → GPT-4 Semantic Analysis → Location Extraction → Relationship Mapping
```

**Key Features:**
- GPT-4 integration for context-aware understanding
- Fuzzy matching that handles OCR errors naturally
- Semantic relationship detection (trails→parks, restaurants→districts)
- Multi-language semantic processing

**Components:**
- `SemanticExtractor`: GPT-4 powered location extraction
- `RelationshipMapper`: Detects geographic relationships
- `AIProcessor`: Main AI processing coordinator

### 3. Intelligent Geocoding Layer
```
Semantic Locations → AI Query Enhancement → Multi-Service Geocoding → Confidence Scoring
```

**Key Features:**
- AI-enhanced query optimization before geocoding
- Error-tolerant place name matching
- Multi-service support (Google Maps + Nominatim)
- Batch processing with confidence scoring

**Components:**
- `ContextEnhancer`: AI-powered query optimization
- `GoogleGeocoder`: Google Maps API wrapper
- `IntelligentGeocoder`: Main geocoding coordinator

## Data Flow

```
Image Upload
    ↓
Enhanced OCR (Context Preservation)
    ↓
Structured Text Chunks with Spatial Context
    ↓
AI Semantic Processing (GPT-4)
    ↓
Structured Location Data + Relationships
    ↓
AI-Powered Geocoding with Context
    ↓
Enriched GeoJSON with Coordinates
    ↓
Map Visualization + Export
```

## Technology Stack

### Backend
- **Framework**: FastAPI with async processing
- **OCR Engines**: PaddleOCR (Chinese) + Tesseract (English)
- **AI Models**: OpenAI GPT-4 for semantic processing
- **Geocoding**: Google Maps API + Nominatim fallback
- **Image Processing**: OpenCV + PIL

### Frontend
- **Framework**: React + Next.js
- **Map Rendering**: Mapbox GL JS
- **State Management**: React hooks + context
- **File Upload**: React Dropzone

### Dependencies
```python
# Core AI & OCR
openai>=1.3.0
paddleocr>=2.7.0
pytesseract>=0.3.10

# Web Framework
fastapi>=0.104.0
uvicorn>=0.24.0

# Image Processing
opencv-python>=4.8.0
pillow>=10.0.0
```

## Performance Characteristics

### Expected Performance
- **Location Extraction Recall**: 70-85% (vs 13.3% baseline)
- **Processing Time**: 2-5 seconds per image
- **Multi-language Support**: Natural Chinese/English mixed content
- **Error Tolerance**: Handles OCR artifacts and variations

### Scalability
- **Batch Processing**: Up to 10 images per request
- **Concurrent Requests**: Async processing support
- **Caching**: OCR results cached to reduce reprocessing
- **Rate Limiting**: Built-in API rate limiting

## Security & Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional (fallback to Nominatim)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### API Security
- CORS middleware configured
- File type validation
- Request size limits
- Rate limiting per IP

## Deployment Architecture

### Development
```
Frontend (localhost:3000) ← → Backend (localhost:8000)
```

### Production
```
Frontend (CDN/Static) ← → Backend (Container/Server) ← → AI APIs (OpenAI/Google)
```

## Extension Points

### Adding New OCR Engines
1. Implement OCR engine interface in `enhanced_ocr_processor.py`
2. Add engine selection logic
3. Update configuration

### Adding New AI Models
1. Implement model interface in `ai_processor.py`
2. Add model-specific prompt optimization
3. Update model selection logic

### Adding New Content Types
1. Update `ContentTypeDetector` patterns
2. Add content-specific processing logic
3. Update AI prompts for new content types