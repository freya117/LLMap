# LLMap API Reference

## Base URL
```
http://localhost:8000
```

## Enhanced OCR + AI Pipeline Endpoints

### Process Single Image
```http
POST /api/ai/process-image
Content-Type: multipart/form-data
```

**Parameters:**
- `file` (required): Image file (PNG, JPG, JPEG)
- `content_type` (optional): `auto|social_media|travel_itinerary|map_screenshot`
- `ai_model` (optional): `gpt-4|claude-3|auto`
- `enable_geocoding` (optional): `true|false` (default: true)

**Response:**
```json
{
  "success": true,
  "processing_pipeline": {
    "ocr_phase": {
      "structured_chunks": [
        {
          "text": "Olympic National Park visitor center",
          "spatial_context": "header_section",
          "confidence": 0.85,
          "chunk_type": "text",
          "language": "english"
        }
      ],
      "content_type": "travel_itinerary",
      "ocr_confidence": 0.78,
      "language_detected": "mixed"
    },
    "ai_phase": {
      "semantic_locations": [
        {
          "name": "Olympic National Park Visitor Center",
          "type": "visitor_center",
          "context": "National park facility in Washington State",
          "confidence": 0.95,
          "relationships": ["Olympic National Park"],
          "geocoding_query": "Olympic National Park Visitor Center, Washington"
        }
      ],
      "ai_confidence": 0.92,
      "model_used": "gpt-4"
    },
    "geocoding_phase": {
      "enriched_locations": [
        {
          "name": "Olympic National Park Visitor Center",
          "coordinates": [-123.6044, 47.8021],
          "address": "3002 Mount Angeles Rd, Port Angeles, WA 98362",
          "confidence": 0.98
        }
      ]
    }
  },
  "final_results": {
    "locations": [
      {
        "name": "Olympic National Park Visitor Center",
        "type": "visitor_center",
        "coordinates": [-123.6044, 47.8021],
        "address": "3002 Mount Angeles Rd, Port Angeles, WA 98362",
        "context": "National park facility in Washington State",
        "confidence": 0.95,
        "source": "ai_enhanced_ocr"
      }
    ],
    "summary": {
      "total_locations": 1,
      "high_confidence_locations": 1,
      "processing_time_ms": 2340
    }
  }
}
```

### Process Multiple Images
```http
POST /api/ai/process-batch
Content-Type: multipart/form-data
```

**Parameters:**
- `files` (required): Array of image files (max 10)
- `ai_model` (optional): `gpt-4|claude-3|auto`
- `enable_relationship_mapping` (optional): `true|false`
- `enable_geocoding` (optional): `true|false`

**Response:**
```json
{
  "success": true,
  "processing_stats": {
    "total_files": 3,
    "successful_files": 3,
    "total_locations": 8,
    "unique_locations": 6,
    "geocoded_locations": 5,
    "processing_time_ms": 7200,
    "success_rate": 1.0
  },
  "results": [
    {
      "filename": "travel_photo.jpg",
      "success": true,
      "content_type": "travel_itinerary",
      "locations": [...],
      "ocr_confidence": 0.82,
      "ai_confidence": 0.89
    }
  ],
  "aggregated_data": {
    "locations": [...],
    "relationships": [...],
    "summary": {
      "location_types": {
        "restaurants": 2,
        "landmarks": 3,
        "accommodations": 1
      }
    }
  }
}
```

## Legacy OCR Endpoints (Backward Compatibility)

### Get Available OCR Engines
```http
GET /api/ocr/engines
```

**Response:**
```json
{
  "engines": {
    "tesseract": {
      "name": "Tesseract OCR",
      "available": true,
      "description": "Open source OCR engine"
    },
    "paddle": {
      "name": "PaddleOCR",
      "available": true,
      "description": "Chinese OCR support"
    }
  },
  "default": "auto",
  "recommended": "paddle"
}
```

### Process with Legacy OCR
```http
POST /api/ocr/process
Content-Type: multipart/form-data
```

**Parameters:**
- `file` (required): Image file
- `engine` (optional): `auto|tesseract|paddle`
- `enhance_image` (optional): `true|false`

### Batch Process with Legacy OCR
```http
POST /api/ocr/batch
Content-Type: multipart/form-data
```

**Parameters:**
- `files` (required): Array of image files
- `engine` (optional): `auto|tesseract|paddle`

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Only image files are supported"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Enhanced processing failed: [error details]"
}
```

## Usage Examples

### JavaScript/React
```javascript
// Single image processing
const processImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('content_type', 'travel_itinerary');
  formData.append('enable_geocoding', 'true');

  const response = await fetch('/api/ai/process-image', {
    method: 'POST',
    body: formData
  });

  return await response.json();
};

// Batch processing
const processBatch = async (files) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  formData.append('ai_model', 'gpt-4');

  const response = await fetch('/api/ai/process-batch', {
    method: 'POST',
    body: formData
  });

  return await response.json();
};
```

### Python
```python
import requests

# Single image processing
def process_image(image_path):
    with open(image_path, 'rb') as f:
        files = {'file': f}
        data = {
            'content_type': 'social_media',
            'enable_geocoding': 'true'
        }
        response = requests.post(
            'http://localhost:8000/api/ai/process-image',
            files=files,
            data=data
        )
    return response.json()

# Batch processing
def process_batch(image_paths):
    files = [('files', open(path, 'rb')) for path in image_paths]
    data = {'ai_model': 'gpt-4'}
    
    response = requests.post(
        'http://localhost:8000/api/ai/process-batch',
        files=files,
        data=data
    )
    
    # Close file handles
    for _, f in files:
        f.close()
    
    return response.json()
```

### cURL
```bash
# Single image
curl -X POST "http://localhost:8000/api/ai/process-image" \
  -F "file=@image.jpg" \
  -F "content_type=travel_itinerary" \
  -F "enable_geocoding=true"

# Batch processing
curl -X POST "http://localhost:8000/api/ai/process-batch" \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg" \
  -F "ai_model=gpt-4"
```

## Rate Limits

- **Single Image**: 60 requests per minute
- **Batch Processing**: 10 requests per minute
- **Legacy OCR**: 100 requests per minute

## Content Types Supported

### Image Formats
- PNG, JPG, JPEG
- Max file size: 10MB
- Recommended resolution: 1000-3000px width

### Content Types Detected
- `social_media`: Instagram, Facebook, Twitter screenshots
- `travel_itinerary`: Travel plans, booking confirmations
- `map_screenshot`: Navigation, Google Maps screenshots
- `business_listing`: Restaurant menus, business cards
- `mixed_content`: General mixed content

## Response Time Expectations

- **Single Image**: 2-5 seconds
- **Batch (3 images)**: 8-15 seconds
- **Large Batch (10 images)**: 25-45 seconds

Processing time depends on:
- Image complexity and size
- Content type and language
- AI model response time
- Geocoding API response time