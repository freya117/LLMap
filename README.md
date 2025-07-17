# LLMap - AI-Powered Multi-Modal Mapping Platform

LLMap is an intelligent mapping platform that transforms multi-modal information (text, images, links) into interactive, AI-enhanced geographical visualizations.

## 🎯 Project Vision

Transform scattered location information from various sources (social media, reviews, recommendations) into intelligent, shareable maps through AI agents.

## 🚀 Key Features

- **Multi-modal Input Processing**: Images, text, links, screenshots
- **Advanced OCR Processing**: Tesseract & PaddleOCR with intelligent preprocessing
- **AI-Powered Location Extraction**: GPT-based geographical information parsing
- **Interactive Visualization**: Dynamic maps with rich context
- **Agent Integration**: MCP-compatible for AI workflow integration
- **Shareable Outputs**: High-quality exports and embeddable components

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

## 🛠 Tech Stack

- **Frontend**: React/Next.js, Mapbox GL JS
- **Backend**: Python FastAPI, OpenAI API
- **Database**: PostgreSQL/SQLite
- **Deployment**: Docker, Vercel/Railway

## 📋 Development Phases

### Phase 1: POC (2 weeks)
- [ ] Multi-modal input processing
- [ ] AI location extraction
- [ ] Basic map visualization
- [ ] Export functionality

### Phase 2: Enhancement
- [ ] Agent integration (MCP)
- [ ] Collaborative features
- [ ] Advanced filtering
- [ ] Production deployment

## 🚀 Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
python main.py

# Frontend
cd frontend
npm install
npm run dev
```

## 📖 Documentation

See `/docs` for detailed documentation and API references.