# LLMap Technical Architecture

## Core Technology Stack

### 🧠 Data Processing & AI
- **NLU + Information Extraction**: OpenAI GPT-4/5 for named entity recognition (locations, prices, categories)
- **Multi-modal Processing**: OCR (PaddleOCR, Tesseract.js) + Vision models
- **Geocoding**: Mapbox/Google Geocoding API, Nominatim for address → coordinates
- **Memory System**: Vector embeddings with FAISS/Chroma for user preferences

### 🗺️ Map Rendering & Interaction
- **Frontend**: Mapbox GL JS for WebGL-powered high-performance rendering
- **Data Format**: GeoJSON standard for unified geographic data representation
- **State Management**: Zustand for React state management
- **Export**: Canvas/SVG → high-resolution images with embedded metadata

### 🤖 AI Agent System
- **Framework**: ReAct Agent with OpenAI Function Calling
- **Planning**: Multi-step task execution with user interruption support
- **Memory**: Context-aware recommendations based on user history
- **Natural Language Operations**: "Show only ❤️ marked places" → semantic filtering

### 🔄 Collaboration & Sharing
- **Real-time**: WebSocket + CRDT (yjs) for collaborative editing
- **Export Formats**: 
  - `gptmap_v1.geojson`: Coordinates + semantic annotations
  - `.mcp` (Map Context Pack): Layers + preferences + behavior history
- **ShareMAP**: High-resolution images with human + machine-readable context

## Implementation Phases

### Phase 1: POC (Current - 2 weeks)
**Goal**: Upload → AI extraction → Map visualization → Export

**Tech Stack**:
- Frontend: React + Next.js + Mapbox GL JS
- Backend: FastAPI + OpenAI API + PaddleOCR
- Geocoding: Google Maps API / Nominatim

**Deliverables**:
- Multi-modal file upload (images, text)
- AI-powered location extraction
- Interactive map with clickable markers
- GeoJSON export functionality

### Phase 2: Enhancement
- Agent integration (MCP server)
- Memory system with vector search
- Collaborative features
- Advanced filtering and recommendations

## Data Flow Architecture

```
Input (Image/Text/Link) 
    ↓
OCR + NLU Processing (GPT-4)
    ↓
Location Extraction + Geocoding
    ↓
GeoJSON Generation
    ↓
Map Visualization (Mapbox GL)
    ↓
User Interaction + AI Suggestions
    ↓
Export (GeoJSON + ShareMAP)
```

## API Design

### Core Endpoints
- `POST /api/upload` - Multi-modal file processing
- `POST /api/extract-locations` - AI location extraction
- `GET /api/geocode` - Address to coordinates
- `POST /api/generate-map` - Create map data
- `GET /api/export/{format}` - Export functionality

### Data Models
```json
{
  "location": {
    "name": "string",
    "address": "string", 
    "coordinates": [lng, lat],
    "confidence": 0.95,
    "source": "image|text|link",
    "tags": ["restaurant", "recommended"],
    "metadata": {
      "price": "$$$",
      "rating": 4.5,
      "description": "AI-extracted context"
    }
  }
}
```