# LLMap Development Guide

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- OpenAI API key

### Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Set environment variables
export OPENAI_API_KEY=your_openai_api_key
export GOOGLE_MAPS_API_KEY=your_google_maps_api_key  # Optional

# Start server
python main.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Test the System
```bash
# Run validation tests
python scripts/test_enhanced_pipeline.py

# Test with social media images
python scripts/tests/evaluate_social_media_ocr.py
```

## Development Workflow

### 1. Testing OCR Improvements
```bash
# Test individual components
cd backend
python -c "
from enhanced_ocr_processor import EnhancedOCRProcessor
processor = EnhancedOCRProcessor()
result = processor.process_image('path/to/test/image.jpg')
print(f'Locations: {len(result.structured_chunks)}')
"
```

### 2. Testing AI Processing
```bash
# Test AI semantic extraction
python -c "
from ai_processor import AIProcessor
processor = AIProcessor()
# Test with sample chunks...
"
```

### 3. Performance Evaluation
```bash
# Run full evaluation suite
python scripts/tests/evaluate_social_media_ocr.py

# Check specific metrics
python scripts/analyze_performance.py
```

## Project Structure

```
LLMap/
├── backend/
│   ├── enhanced_ocr_processor.py    # Context-preserving OCR
│   ├── ai_processor.py              # AI semantic processing
│   ├── intelligent_geocoder.py      # AI-enhanced geocoding
│   ├── main.py                      # FastAPI server
│   └── requirements.txt
├── frontend/
│   ├── components/
│   │   ├── SocialMediaOCRDemo.jsx   # Main demo component
│   │   ├── MapView.jsx              # Map visualization
│   │   └── FileUpload.jsx           # File upload UI
│   ├── pages/
│   │   └── index.js                 # Main page
│   └── package.json
├── data/
│   ├── social media/                # Test images
│   ├── social_media_ground_truth.json
│   └── social_media_evaluation_results.json
├── scripts/
│   ├── test_enhanced_pipeline.py    # Validation tests
│   └── tests/
│       └── evaluate_social_media_ocr.py
└── docs/
    ├── README.md
    ├── architecture.md
    ├── api-reference.md
    └── development.md
```

## Key Components

### Enhanced OCR Processor
**File**: `backend/enhanced_ocr_processor.py`

**Key Classes**:
- `EnhancedOCRProcessor`: Main coordinator
- `ContentTypeDetector`: Analyzes image content
- `ContextualChunker`: Creates structured text chunks

**Testing**:
```python
from enhanced_ocr_processor import EnhancedOCRProcessor

processor = EnhancedOCRProcessor()
result = processor.process_image('test_image.jpg')

print(f"Content Type: {result.content_type.content_type}")
print(f"Chunks: {len(result.structured_chunks)}")
```

### AI Processor
**File**: `backend/ai_processor.py`

**Key Classes**:
- `AIProcessor`: Main AI coordinator
- `SemanticExtractor`: GPT-4 location extraction
- `RelationshipMapper`: Geographic relationships

**Testing**:
```python
from ai_processor import AIProcessor

processor = AIProcessor()
# Process OCR chunks through AI pipeline
```

### Intelligent Geocoder
**File**: `backend/intelligent_geocoder.py`

**Key Classes**:
- `IntelligentGeocoder`: Main geocoding coordinator
- `ContextEnhancer`: AI query optimization
- `GoogleGeocoder`: Google Maps integration

## Testing Framework

### Ground Truth Evaluation
**File**: `data/social_media_ground_truth.json`

Contains expected results for 8 test images:
- Expected locations and their types
- Content type classifications
- OCR difficulty assessments

### Evaluation Script
**File**: `scripts/tests/evaluate_social_media_ocr.py`

Measures:
- Location extraction precision/recall
- Content type accuracy
- Processing performance

### Running Tests
```bash
# Full evaluation
python scripts/tests/evaluate_social_media_ocr.py

# Quick validation
python scripts/test_enhanced_pipeline.py

# Performance analysis
python scripts/analyze_performance.py  # Create this for detailed analysis
```

## Performance Optimization

### 1. OCR Optimization
- Adjust image preprocessing parameters
- Optimize engine selection logic
- Implement result caching

### 2. AI Processing Optimization
- Optimize GPT-4 prompts for better extraction
- Implement response caching
- Add fallback models

### 3. Geocoding Optimization
- Cache geocoding results
- Optimize batch processing
- Implement smart retry logic

## Common Development Tasks

### Adding New Content Types
1. Update `ContentTypeDetector` patterns
2. Add content-specific processing logic
3. Update AI prompts
4. Add test cases

### Improving Location Extraction
1. Analyze failed cases in evaluation results
2. Update AI prompts with specific examples
3. Add new location type patterns
4. Test with ground truth data

### Adding New OCR Engines
1. Implement engine interface
2. Add to `EnhancedOCRProcessor`
3. Update configuration logic
4. Test performance comparison

## Debugging

### OCR Issues
```python
# Debug OCR processing
from enhanced_ocr_processor import EnhancedOCRProcessor
import cv2

processor = EnhancedOCRProcessor()
image = cv2.imread('problematic_image.jpg')

# Check content type detection
content_type = processor.content_detector.detect_content_type(image)
print(f"Detected: {content_type.content_type} (confidence: {content_type.confidence})")

# Check OCR results
result = processor.process_image('problematic_image.jpg')
for chunk in result.structured_chunks:
    print(f"[{chunk.spatial_context}] {chunk.text} (conf: {chunk.confidence})")
```

### AI Processing Issues
```python
# Debug AI extraction
from ai_processor import AIProcessor

processor = AIProcessor()
# Check what AI extracts from specific text chunks
```

### API Issues
```bash
# Check API logs
tail -f backend/logs/api.log

# Test API directly
curl -X POST "http://localhost:8000/api/ai/process-image" \
  -F "file=@test_image.jpg" \
  -v
```

## Environment Configuration

### Development Environment
```bash
# .env file
OPENAI_API_KEY=your_development_key
GOOGLE_MAPS_API_KEY=your_development_key
DEBUG=true
LOG_LEVEL=DEBUG
```

### Production Environment
```bash
# Production settings
OPENAI_API_KEY=your_production_key
GOOGLE_MAPS_API_KEY=your_production_key
DEBUG=false
LOG_LEVEL=INFO
CORS_ORIGINS=https://your-domain.com
```

## Deployment

### Backend Deployment
```bash
# Using Docker
docker build -t llmap-backend .
docker run -p 8000:8000 -e OPENAI_API_KEY=your_key llmap-backend

# Using systemd
sudo systemctl start llmap-backend
```

### Frontend Deployment
```bash
# Build for production
npm run build

# Deploy to static hosting
npm run export
```

## Contributing

### Code Style
- Python: Follow PEP 8
- JavaScript: Use Prettier + ESLint
- Commit messages: Use conventional commits

### Pull Request Process
1. Create feature branch
2. Add tests for new functionality
3. Update documentation
4. Run full test suite
5. Submit PR with clear description

### Testing Requirements
- All new features must have tests
- Maintain >80% test coverage
- Performance tests for OCR improvements
- Integration tests for API changes