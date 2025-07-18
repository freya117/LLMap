# LLMap - AI-Powered Location Extraction and Mapping

LLMap transforms scattered location information from various sources (social media, travel photos, screenshots) into intelligent, interactive maps through AI-powered processing.


## 🚀 Key Features

- **Multi-Modal Input Processing**: Upload images, screenshots, text, or links
- **AI-Powered Location Extraction**: Intelligent recognition of places, businesses, and landmarks
- **Advanced OCR Processing**: Dual-engine OCR with multi-language support
- **Interactive Map Visualization**: Dynamic maps with rich location context
- **Batch Processing**: Handle multiple images simultaneously
- **Export & Sharing**: Generate GeoJSON, images, and shareable maps

## 🎯 Use Cases

- **Travel Planning**: Extract locations from travel blogs, social media posts, and itineraries
- **Business Intelligence**: Analyze location mentions in reviews, posts, and screenshots
- **Content Analysis**: Process images and screenshots for geographic data
- **Map Creation**: Transform unstructured content into organized, interactive maps

## 📁 Project Structure

```
llmap/
├── frontend/          # React/Next.js frontend
├── backend/           # Python FastAPI backend
├── docs/              # Documentation
├── data/              # Sample data and exports
├── scripts/           # Development and deployment scripts
└── tests/             # Test suites
```

## 🏗️ Technology Stack

- **Backend**: FastAPI + OpenAI GPT-4 + Advanced OCR engines
- **Frontend**: React/Next.js + Mapbox GL JS for interactive maps
- **AI Processing**: GPT-4 for intelligent location understanding
- **Geocoding**: Multiple services for accurate coordinate mapping

## 🚀 Quick Start

### Prerequisites
- Python 3.8+, Node.js 16+
- OpenAI API key (required)
- Google Maps API key (optional, fallback to Nominatim)

### Setup
```bash
# Backend
cd backend
pip install -r requirements.txt
export OPENAI_API_KEY=your_openai_api_key
python main.py

# Frontend
cd frontend
npm install && npm run dev
```

## 📚 Documentation

Our documentation is organized into focused guides:

- **[📖 Documentation Overview](docs/README.md)** - Start here
- **[🏗️ Architecture Guide](docs/architecture.md)** - System design and components
- **[🔌 API Reference](docs/api-reference.md)** - Complete API documentation
- **[💻 Development Guide](docs/development.md)** - Setup and development workflow
- **[⚡ Performance Guide](docs/performance.md)** - Optimization and troubleshooting


## 🧪 Testing & Validation

### Ground Truth Evaluation
- **8 test images** with expected results
- **Precision/Recall metrics** for location extraction
- **Content type accuracy** measurement
- **Multi-language performance** testing

### Test Coverage
- Social media screenshots (Instagram, Facebook)
- Travel itineraries (mixed Chinese/English)
- Business listings and reviews
- Map screenshots and navigation

## 🎉 Key Advantages

### 1. Context Awareness
- **Before**: "visitor center" → generic location
- **After**: "Olympic National Park visitor center" → specific facility with context

### 2. Error Tolerance
- **Before**: "Olympic natio" → no match
- **After**: AI recognizes as "Olympic National Park"

### 3. Multi-language Intelligence
- **Before**: Chinese text often ignored
- **After**: Natural mixed Chinese/English processing

### 4. Relationship Understanding
- **Before**: Isolated location extraction
- **After**: Understands trails→parks, restaurants→districts


## 📄 License

MIT License - see LICENSE file for details