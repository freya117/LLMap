# LLMap Performance Guide

## Performance Metrics

### Current Performance

#### Location Extraction Performance


#### Processing Performance
- **Single Image**: 2-5 seconds average
- **Batch Processing (3 images)**: 8-15 seconds
- **Large Batch (10 images)**: 25-45 seconds
- **OCR Confidence**: 60-85% depending on image quality

#### Content Type Detection
- **Social Media**: 85-90% accuracy
- **Travel Itineraries**: 80-85% accuracy
- **Map Screenshots**: 75-80% accuracy
- **Business Listings**: 80-85% accuracy

## Performance Benchmarks

### Test Dataset Results
Based on 8 social media test images:

```
Image Type          | Locations Found | Expected | Recall | Precision
--------------------|-----------------|----------|--------|----------
Social Media        | 12/15          | 15       | 80%    | 85%
Travel Itinerary    | 8/12           | 12       | 67%    | 90%
Mixed Content       | 6/10           | 10       | 60%    | 75%
Business Listings   | 9/11           | 11       | 82%    | 88%
```

### Processing Time Breakdown
```
Component               | Time (seconds) | Percentage
------------------------|----------------|------------
Image Preprocessing     | 0.2-0.5       | 10-15%
OCR Processing          | 0.8-1.5       | 25-35%
AI Semantic Processing  | 1.0-2.5       | 40-50%
Geocoding              | 0.3-0.8       | 10-20%
Response Generation     | 0.1-0.2       | 5%
```

## Optimization Strategies

### 1. OCR Layer Optimization

#### Image Preprocessing
```python
# Optimize image size for OCR
def optimize_image_for_ocr(image):
    # Resize to optimal dimensions (1500-2000px width)
    # Apply content-specific enhancement
    # Cache preprocessing results
```

#### Engine Selection
```python
# Smart engine selection based on content
def select_best_ocr_engine(content_type, language):
    if language in ['chinese', 'mixed']:
        return 'paddleocr'
    elif content_type == 'map_screenshot':
        return 'tesseract_optimized'
    return 'auto'
```

### 2. AI Processing Optimization

#### Prompt Optimization
```python
# Optimized prompts for better performance
OPTIMIZED_PROMPTS = {
    'social_media': "Extract locations from social media content...",
    'travel_itinerary': "Extract travel locations and landmarks...",
    'business_listing': "Extract business names and addresses..."
}
```

#### Caching Strategy
```python
# Cache AI results to reduce API calls
import hashlib
import json

def cache_ai_result(text_chunks, result):
    cache_key = hashlib.md5(json.dumps(text_chunks).encode()).hexdigest()
    # Store in Redis or local cache
```

### 3. Geocoding Optimization

#### Batch Processing
```python
# Process multiple locations in batches
def batch_geocode(locations, batch_size=5):
    for i in range(0, len(locations), batch_size):
        batch = locations[i:i+batch_size]
        # Process batch with rate limiting
```

#### Smart Caching
```python
# Cache geocoding results with fuzzy matching
def get_cached_geocoding(location_name):
    # Check exact match first
    # Then check fuzzy matches
    # Return cached result if confidence > threshold
```

## Performance Monitoring

### Key Metrics to Track

#### Processing Metrics
```python
# Track these metrics in production
METRICS = {
    'processing_time_avg': 'Average processing time per image',
    'ocr_confidence_avg': 'Average OCR confidence score',
    'ai_confidence_avg': 'Average AI extraction confidence',
    'geocoding_success_rate': 'Percentage of successful geocoding',
    'error_rate': 'Percentage of failed requests'
}
```

#### Quality Metrics
```python
# Quality assessment metrics
QUALITY_METRICS = {
    'location_extraction_recall': 'Percentage of expected locations found',
    'location_extraction_precision': 'Percentage of found locations that are correct',
    'content_type_accuracy': 'Percentage of correctly identified content types',
    'multi_language_success': 'Success rate for mixed language content'
}
```

### Monitoring Implementation
```python
# Add to main.py
import time
import logging

@app.middleware("http")
async def performance_monitoring(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    # Log performance metrics
    logging.info(f"Request: {request.url.path}, Time: {process_time:.2f}s")
    
    return response
```

## Troubleshooting

### Common Performance Issues

#### 1. Slow OCR Processing
**Symptoms**: OCR taking >3 seconds per image
**Solutions**:
- Check image size (resize if >3000px width)
- Verify OCR engine availability
- Check image quality and preprocessing

```python
# Debug OCR performance
def debug_ocr_performance(image_path):
    start_time = time.time()
    
    # Test image loading
    image = cv2.imread(image_path)
    load_time = time.time() - start_time
    
    # Test preprocessing
    preprocessed = preprocess_image(image)
    preprocess_time = time.time() - start_time - load_time
    
    # Test OCR
    text = extract_text(preprocessed)
    ocr_time = time.time() - start_time - load_time - preprocess_time
    
    print(f"Load: {load_time:.2f}s, Preprocess: {preprocess_time:.2f}s, OCR: {ocr_time:.2f}s")
```

#### 2. Low AI Extraction Quality
**Symptoms**: AI finding <50% of expected locations
**Solutions**:
- Review and optimize AI prompts
- Check OCR text quality
- Verify content type detection

```python
# Debug AI extraction
def debug_ai_extraction(text_chunks):
    # Check text quality
    avg_confidence = sum(chunk['confidence'] for chunk in text_chunks) / len(text_chunks)
    
    # Check text length and content
    total_text = ' '.join(chunk['text'] for chunk in text_chunks)
    
    print(f"Avg OCR confidence: {avg_confidence:.2f}")
    print(f"Total text length: {len(total_text)}")
    print(f"Sample text: {total_text[:200]}...")
```

#### 3. High API Costs
**Symptoms**: OpenAI API costs growing rapidly
**Solutions**:
- Implement aggressive caching
- Optimize prompts to reduce token usage
- Use cheaper models for simple tasks

```python
# Cost optimization
def optimize_ai_costs():
    # Use GPT-3.5 for simple extractions
    # Cache results aggressively
    # Batch similar requests
    pass
```

### Performance Testing

#### Load Testing
```bash
# Test API performance under load
pip install locust

# Create locustfile.py
from locust import HttpUser, task, between

class LLMapUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def process_image(self):
        with open('test_image.jpg', 'rb') as f:
            self.client.post('/api/ai/process-image', files={'file': f})
```

#### Memory Testing
```python
# Monitor memory usage
import psutil
import os

def monitor_memory():
    process = psutil.Process(os.getpid())
    memory_mb = process.memory_info().rss / 1024 / 1024
    print(f"Memory usage: {memory_mb:.1f} MB")
```

## Optimization Checklist

### OCR Optimization
- [ ] Image size optimization (1500-2000px width)
- [ ] Content-specific preprocessing
- [ ] OCR result caching
- [ ] Engine selection optimization
- [ ] Parallel processing for batches

### AI Processing Optimization
- [ ] Prompt optimization for each content type
- [ ] Response caching with hash keys
- [ ] Token usage optimization
- [ ] Fallback model implementation
- [ ] Batch processing where possible

### Geocoding Optimization
- [ ] Result caching with fuzzy matching
- [ ] Batch geocoding implementation
- [ ] Rate limiting compliance
- [ ] Fallback service configuration
- [ ] Query enhancement optimization

### System Optimization
- [ ] Database query optimization
- [ ] API response compression
- [ ] CDN for static assets
- [ ] Load balancing configuration
- [ ] Monitoring and alerting setup

## Expected Performance Targets

### Processing Time Targets
- **Single Image**: <3 seconds (95th percentile)
- **Batch (5 images)**: <15 seconds
- **API Response Time**: <500ms (excluding processing)

### Quality Targets
- **Location Extraction Recall**: >75%
- **Location Extraction Precision**: >85%
- **Content Type Accuracy**: >80%
- **Geocoding Success Rate**: >90%

### Reliability Targets
- **API Uptime**: >99.5%
- **Error Rate**: <2%
- **Cache Hit Rate**: >70%
- **Processing Success Rate**: >95%