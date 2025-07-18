# LLMap Technical Architecture

## Strategic Approach: Enhanced OCR + AI Pipeline

### 🎯 Core Philosophy
**OCR Phase**: Extract all meaningful text with minimal filtering, focus on preservation over precision
**AI Phase**: Let AI handle semantic understanding, geocoding, and structured data extraction

### 🧠 Data Processing & AI Pipeline

#### OCR Layer (Preservation Focus)
- **Multi-Engine OCR**: PaddleOCR (Chinese), Tesseract (English), auto-selection
- **Context Preservation**: Maintain spatial/contextual relationships in text
- **Minimal Filtering**: Extract all meaningful text, avoid aggressive filtering
- **Structured Chunks**: Output rich context chunks rather than individual locations
- **Multi-language Support**: Handle mixed Chinese/English content naturally

#### AI Layer (Intelligence Focus)
- **Semantic Understanding**: GPT-4/Claude for context-aware location extraction
- **Fuzzy Matching**: AI handles OCR errors and text variations
- **Context Awareness**: "Olympic National Park visitor center" vs generic "visitor center"
- **Relationship Understanding**: Links trails to parks, lodges to areas
- **Multi-language Processing**: Natural handling of Chinese place names

#### Geocoding Strategy (AI-Powered)
- **Context-Aware Geocoding**: AI provides geographic context before geocoding
- **Fuzzy Location Matching**: Handle OCR errors in place names
- **Semantic Enrichment**: "住Gateway Inn" → "Gateway Inn accommodation"
- **Relationship Mapping**: Connect related locations (trail → park → region)

### 🗺️ Map Rendering & Interaction
- **Frontend**: Mapbox GL JS for WebGL-powered high-performance rendering
- **Data Format**: GeoJSON with AI-enriched semantic annotations
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

### Phase 1: Enhanced OCR + AI Pipeline (Current - 2 weeks)
**Goal**: Rich OCR → AI Processing → Structured Extraction → Map visualization

**Tech Stack**:
- OCR: PaddleOCR + Tesseract with context preservation
- AI: OpenAI GPT-4 for semantic understanding and geocoding
- Backend: FastAPI with structured chunk processing
- Frontend: React + Next.js + Mapbox GL JS

**Deliverables**:
- Context-preserving OCR system
- AI-powered semantic location extraction
- Intelligent geocoding with context awareness
- Interactive map with AI-enriched markers
- Structured export functionality

### Phase 2: Enhancement
- Agent integration (MCP server)
- Memory system with vector search
- Collaborative features
- Advanced AI-powered filtering and recommendations

## Data Flow Architecture

```
Input (Image/Text/Link) 
    ↓
Enhanced OCR (Context Preservation)
    ↓
Structured Text Chunks with Spatial Context
    ↓
AI Semantic Processing (GPT-4/Claude)
    ↓
Structured Location Data + Context
    ↓
AI-Powered Geocoding with Context
    ↓
Enriched GeoJSON Generation
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