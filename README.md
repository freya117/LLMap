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

### 🔍 OCR Capabilities

LLMap features a comprehensive OCR system designed specifically for extracting geographic and business information from various image sources including maps, screenshots, and social media posts.

#### Dual OCR Engine Architecture
- **Tesseract OCR**: Industry-standard engine with multi-language support and optimized configurations for different text types
- **PaddleOCR**: Advanced Chinese-optimized engine with superior accuracy for Asian text and mixed-language content
- **Intelligent Engine Selection**: Automatic fallback system that chooses the best engine based on content analysis and availability
- **Performance Optimization**: Parallel processing capabilities for batch operations

#### Advanced Image Preprocessing Pipeline
- **Smart Enhancement**: Automatic contrast adjustment, brightness optimization, and sharpness enhancement using OpenCV
- **Skew Correction**: Automatic rotation correction using Hough line detection and perspective transformation
- **Noise Reduction**: Bilateral filtering, morphological operations, and Gaussian blur for text clarity
- **Image Type Detection**: Adaptive processing algorithms for maps, screenshots, social media posts, and document images
- **Resolution Optimization**: Dynamic scaling and DPI adjustment for optimal OCR accuracy

#### Intelligent Text Processing & Correction
- **OCR Error Correction**: Advanced pattern matching to fix common character confusions (0/O, 1/I/l, 5/S, etc.)
- **Text Cleaning**: Comprehensive whitespace normalization, punctuation correction, and line break handling
- **Multi-language Support**: Seamless processing of English, Chinese, and mixed-language content
- **Quality Assessment**: Confidence scoring, text quality evaluation, and reliability metrics
- **Context-Aware Filtering**: Removal of OCR artifacts and irrelevant text based on geographic context

#### Structured Data Extraction Engine
- **Geographic Information**: 
  - Street addresses with number, street name, and directional indicators
  - Landmarks, parks, monuments, and points of interest
  - City, state, country, and postal code extraction
  - Coordinate detection from map interfaces
- **Business Information**: 
  - Restaurant names, business types, and category classification
  - Brand recognition and franchise identification
  - Service descriptions and business hours
- **Contact Details**: 
  - Phone numbers with international format support
  - Website URLs and social media handles
  - Email addresses and contact information
- **Ratings & Reviews**: 
  - Star ratings (★★★★☆) and numerical scores
  - Review snippets and sentiment indicators
  - Platform-specific rating formats (Yelp, Google, etc.)

#### Processing Modes & Integration
- **Frontend Processing**: 
  - Browser-based Tesseract.js for privacy-focused processing
  - No server uploads required for sensitive content
  - Real-time preview and instant feedback
- **Backend Processing**: 
  - High-performance server-side engines for accuracy
  - GPU acceleration support for large batches
  - Advanced preprocessing and post-processing pipelines
- **Batch Processing**: 
  - Multiple image processing with aggregated results
  - Progress tracking and status updates
  - Error handling and retry mechanisms
- **API Integration**: 
  - RESTful API endpoints for external integration
  - Webhook support for asynchronous processing
  - Rate limiting and authentication

#### Supported Image Sources
- **Google Maps Screenshots**: Street view, satellite view, and business listings
- **Social Media Posts**: Instagram stories, Facebook check-ins, Twitter location tags
- **Review Platforms**: Yelp screenshots, TripAdvisor reviews, Google Reviews
- **Navigation Apps**: Waze screenshots, Apple Maps, and other GPS applications
- **Business Cards**: Contact information and address extraction
- **Menu Images**: Restaurant menus with location and contact details

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

### Test the System
```bash
# Validate implementation
python scripts/test_enhanced_pipeline.py

# Performance evaluation
python scripts/tests/evaluate_social_media_ocr.py
```

## 📚 Documentation

Our documentation is organized into focused guides:

- **[📖 Documentation Overview](docs/README.md)** - Start here
- **[🏗️ Architecture Guide](docs/architecture.md)** - System design and components
- **[🔌 API Reference](docs/api-reference.md)** - Complete API documentation
- **[💻 Development Guide](docs/development.md)** - Setup and development workflow
- **[⚡ Performance Guide](docs/performance.md)** - Optimization and troubleshooting

## 🎯 API Usage

### Process Single Image
```javascript
// Upload and process an image
const formData = new FormData();
formData.append('file', imageFile);

const response = await fetch('/api/ai/process-image', {
  method: 'POST',
  body: formData
});

const result = await response.json();
// result.final_results.locations contains extracted locations
```

### Batch Processing
```javascript
// Process multiple images at once
const formData = new FormData();
files.forEach(file => formData.append('files', file));

const response = await fetch('/api/ai/process-batch', {
  method: 'POST',
  body: formData
});
```

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

## 🔧 Configuration

```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional (fallback to free Nominatim)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit a pull request

See [Development Guide](docs/development.md) for detailed contribution guidelines.

## 📄 License

MIT License - see LICENSE file for details