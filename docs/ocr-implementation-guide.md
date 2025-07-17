# OCR Implementation Guide

## Overview

This document provides detailed information about the implementation of OCR (Optical Character Recognition) functionality in the LLMap project, including image preprocessing, text extraction, result post-processing, and geographic information extraction.

## Features

### 🔍 OCR Engine Support
- **Tesseract OCR**: Open source OCR engine with multi-language support
- **PaddleOCR**: Baidu's open source OCR engine with better Chinese support
- **Auto Selection**: Intelligently selects the best engine based on availability and content type

### 🖼️ Image Preprocessing
- **Image Type Detection**: Automatically identifies different types like screenshots, photos, maps
- **Image Enhancement**: Contrast adjustment, sharpness enhancement, noise reduction
- **Skew Correction**: Automatic detection and correction of image skew
- **Size Optimization**: Intelligent image size adjustment to improve OCR accuracy

### 📝 Text Post-processing
- **Error Correction**: Fixes common OCR recognition errors
- **Text Cleaning**: Removes noise characters and standardizes format
- **Structured Extraction**: Extracts structured information like locations, addresses, business names

### 🌍 Geographic Information Extraction
- **Location Recognition**: Identifies location names like restaurants, stores, landmarks
- **Address Parsing**: Extracts complete address information
- **Contact Information**: Extracts phone numbers, emails, websites
- **Rating Information**: Recognizes star ratings and review information

## Architecture Design

### Backend Architecture

```
backend/
├── ocr_processor.py          # Main OCR processor
├── main.py                   # FastAPI server
├── test_ocr_integration.py   # Integration test script
└── requirements.txt          # Python dependencies
```

#### Core Components

1. **ImagePreprocessor**: Image preprocessing engine
   - Image type detection
   - Image enhancement and denoising
   - Skew correction
   - Morphological processing

2. **TesseractOCR**: Tesseract engine wrapper
   - Multi-language support
   - Parameter optimization
   - Confidence assessment

3. **PaddleOCR_Processor**: PaddleOCR engine wrapper
   - Mixed Chinese-English recognition
   - High-precision text detection
   - Angle classification

4. **TextProcessor**: Text post-processor
   - OCR error correction
   - Geographic information extraction
   - Contact information parsing
   - Rating recognition

### Frontend Architecture

```
frontend/components/
├── OCRProcessor.jsx          # Frontend OCR processor
├── OCRPanel.jsx             # OCR operation panel
├── OCRTestPanel.jsx         # OCR test panel
└── OCRIntegration.jsx       # Integration component
```

#### Core Features

1. **Frontend OCR**: Browser-based processing using Tesseract.js
2. **Backend API**: Backend OCR service calls
3. **Image Preprocessing**: Canvas API-based image enhancement
4. **Result Display**: Structured display of extracted geographic information

## API Endpoints

### Get Available Engines
```http
GET /api/ocr/engines
```

Response example:
```json
{
  "engines": {
    "tesseract": {
      "name": "Tesseract OCR",
      "available": true,
      "description": "Open source OCR engine with multi-language support"
    },
    "paddle": {
      "name": "PaddleOCR", 
      "available": true,
      "description": "Baidu's open source OCR engine with better Chinese support"
    }
  },
  "default": "auto",
  "recommended": "paddle"
}
```

### Single File OCR Processing
```http
POST /api/ocr/process
Content-Type: multipart/form-data

file: [image file]
engine: auto|tesseract|paddle
enhance_image: true|false
extract_structured: true|false
```

Response example:
```json
{
  "success": true,
  "raw_text": "Raw OCR text",
  "cleaned_text": "Cleaned text",
  "confidence": 0.85,
  "extracted_info": {
    "locations": ["Location 1", "Location 2"],
    "addresses": ["Address 1", "Address 2"],
    "business_names": ["Business 1", "Business 2"]
  },
  "advanced_extraction": {
    "detailed_locations": [
      {
        "text": "Sushi Nakazawa",
        "type": "business",
        "confidence": 0.95
      }
    ],
    "contact_info": {
      "phones": ["(212) 924-2212"],
      "emails": [],
      "websites": []
    }
  }
}
```

### Batch OCR Processing
```http
POST /api/ocr/batch
Content-Type: multipart/form-data

files: [array of image files]
engine: auto|tesseract|paddle
enhance_image: true|false
extract_structured: true|false
```

### Test Endpoint
```http
POST /api/ocr/test
```

## Usage

### 1. Environment Setup

#### Backend Dependencies Installation
```bash
cd backend
pip install -r requirements.txt

# Install Tesseract (macOS)
brew install tesseract

# Install PaddleOCR (optional)
pip install paddlepaddle paddleocr
```

#### Frontend Dependencies Installation
```bash
cd frontend
npm install tesseract.js
```

### 2. Start Services

#### Start Backend Service
```bash
cd backend
python main.py
```

#### Start Frontend Service
```bash
cd frontend
npm run dev
```

### 3. Using OCR Functionality

#### Using in React Components
```jsx
import OCRIntegration from '../components/OCRIntegration';

function MyComponent() {
  const handleLocationsExtracted = (locations) => {
    console.log('Extracted locations:', locations);
    // Process extracted location information
  };

  const handleError = (error) => {
    console.error('OCR error:', error);
  };

  return (
    <OCRIntegration
      onLocationsExtracted={handleLocationsExtracted}
      onError={handleError}
    />
  );
}
```

#### Direct Backend API Calls
```javascript
const formData = new FormData();
formData.append('file', imageFile);
formData.append('engine', 'auto');

const response = await fetch('http://localhost:8000/api/ocr/process', {
  method: 'POST',
  body: formData
});

const result = await response.json();
```

## Testing and Debugging

### Run Integration Tests
```bash
cd backend
python test_ocr_integration.py
```

### Test Output Example
```
🚀 Starting OCR integration tests
==================================================
🔍 Testing OCR engine availability...
  Tesseract: ✅ Available
  PaddleOCR: ✅ Available

📷 Testing sample image processing...
  Found 8 image files

  Processing image 1: IMG_3193.PNG
    ✅ Processing successful
    📝 Confidence: 0.87
    📍 Extracted locations: 3
    🏠 Extracted addresses: 1
    🏢 Extracted businesses: 2

🎯 Overall results: 5/5 tests passed
🎉 All tests passed! OCR functionality working properly
```

## Performance Optimization

### Image Preprocessing Optimization
- Smart size adjustment: Avoid excessive enlargement or reduction
- Selective enhancement: Apply different enhancement strategies based on image type
- Cache processing results: Avoid reprocessing the same images

### OCR Engine Optimization
- Engine selection strategy: Automatically select the best engine based on content type and language
- Parameter tuning: Optimize OCR parameters for different scenarios
- Parallel processing: Use multithreading for batch processing

### Text Processing Optimization
- Regex optimization: Use efficient regular expression patterns
- Cache extraction results: Avoid reprocessing the same text
- Incremental processing: Only process changed parts

## Common Issues

### Q: Low OCR recognition accuracy?
A: 
1. Check image quality, ensure sufficient clarity
2. Try different OCR engines
3. Adjust image preprocessing parameters
4. Check for image skew, use skew correction feature

### Q: Poor Chinese recognition results?
A:
1. Use PaddleOCR engine, which has better Chinese support
2. Ensure Chinese fonts in images are clear
3. Check if Chinese language packs are installed

### Q: Slow processing speed?
A:
1. Use backend processing mode instead of frontend processing
2. Adjust image size, avoid oversized images
3. Use batch processing interface for multiple files

### Q: Inaccurate geographic information extraction?
A:
1. Check OCR text quality
2. Adjust regular expressions for geographic information extraction
3. Use structured extraction feature for more detailed information

## Extension Features

### Adding New OCR Engines
1. Create new engine class in `ocr_processor.py`
2. Implement `extract_text` method
3. Integrate new engine in `OCRProcessor`

### Adding New Geographic Information Extraction Patterns
1. Add new extraction methods in `TextProcessor`
2. Define new regular expression patterns
3. Update structured data format

### Integrating Geocoding Services
1. Add geocoding API calls
2. Convert extracted addresses to coordinates
3. Validate and filter geocoding results

## Summary

LLMap's OCR functionality provides a complete image text recognition and geographic information extraction solution. Through a combined frontend-backend architecture design, supporting multiple OCR engines and processing modes, it can effectively extract geographic location information from various images, providing data support for map visualization.

Key advantages:
- 🎯 **High Accuracy**: Multi-engine support and intelligent preprocessing
- 🚀 **High Performance**: Dual frontend-backend modes, batch processing support
- 🌍 **Multi-language**: Mixed Chinese-English recognition
- 🔧 **Easy Extension**: Modular design, easy to add new features
- 📊 **Monitorable**: Detailed processing statistics and error reporting