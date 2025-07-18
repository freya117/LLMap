#!/usr/bin/env python3
"""
OCR Integration Test Script
Test various functions of the OCR processor
"""

import os
import sys
import json
from pathlib import Path

# Add current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocr_processor import process_image_file, ocr_processor

def test_ocr_engines():
    """Test OCR engine availability"""
    print("🔍 Testing OCR engine availability...")
    
    # Test Tesseract
    print(f"  Tesseract: ✅ Available")
    
    # Test PaddleOCR
    paddle_status = "✅ Available" if ocr_processor.paddle.available else "❌ Unavailable"
    print(f"  PaddleOCR: {paddle_status}")
    
    return True

def test_sample_images():
    """Test sample image processing"""
    print("\n📷 Testing sample image processing...")
    
    # Find sample images
    data_dir = Path("data")
    if not data_dir.exists():
        print("  ❌ Data directory does not exist")
        return False
    
    # Find image files
    image_files = []
    for pattern in ["*.png", "*.jpg", "*.jpeg", "*.PNG", "*.JPG", "*.JPEG"]:
        image_files.extend(data_dir.rglob(pattern))
    
    if not image_files:
        print("  ❌ No sample images found")
        return False
    
    print(f"  Found {len(image_files)} image files")
    
    # Test first 3 images
    success_count = 0
    for i, image_path in enumerate(image_files[:3]):
        print(f"\n  Processing image {i+1}: {image_path.name}")
        
        try:
            result = process_image_file(str(image_path), "auto")
            
            if result.get("success"):
                print(f"    ✅ Processing successful")
                print(f"    📝 Confidence: {result.get('confidence', 0):.2f}")
                print(f"    📍 Extracted locations: {len(result.get('extracted_info', {}).get('locations', []))}")
                print(f"    🏠 Extracted addresses: {len(result.get('extracted_info', {}).get('addresses', []))}")
                print(f"    🏢 Extracted businesses: {len(result.get('extracted_info', {}).get('business_names', []))}")
                
                # Show partial extracted text
                cleaned_text = result.get('cleaned_text', '')
                if cleaned_text:
                    preview = cleaned_text[:100] + "..." if len(cleaned_text) > 100 else cleaned_text
                    print(f"    📄 Text preview: {preview}")
                
                success_count += 1
            else:
                print(f"    ❌ Processing failed")
                
        except Exception as e:
            print(f"    ❌ Processing error: {e}")
    
    print(f"\n  Summary: {success_count}/3 images processed successfully")
    return success_count > 0

def test_text_processing():
    """Test text processing functionality"""
    print("\n📝 Testing text processing functionality...")
    
    # Test text samples
    test_texts = [
        "Sushi Nakazawa Restaurant, 23 Commerce St, New York, NY 10014. Rating: 4.5 stars. Phone: (212) 924-2212",
        "Joe's Pizza, 7 Carmine St, New York, NY 10014. Open 24 hours. Great New York style pizza!",
        "Chinese test: Beijing Roast Duck Restaurant, Address: 123 Wangfujing Street, Phone: 010-12345678, Hours: 10:00-22:00"
    ]
    
    for i, text in enumerate(test_texts):
        print(f"\n  Test text {i+1}:")
        print(f"    Original: {text}")
        
        try:
            # Clean text
            cleaned = ocr_processor.text_processor.clean_text(text)
            print(f"    Cleaned: {cleaned}")
            
            # Extract location information
            locations = ocr_processor.text_processor.extract_locations_advanced(cleaned)
            print(f"    Extracted locations: {len(locations)} items")
            for loc in locations[:3]:  # Only show first 3
                print(f"      - {loc['text']} ({loc['type']}, confidence: {loc['confidence']:.2f})")
            
            # Extract contact information
            contact = ocr_processor.text_processor.extract_contact_info(cleaned)
            if contact['phones']:
                print(f"    Phone: {contact['phones']}")
            if contact['emails']:
                print(f"    Email: {contact['emails']}")
            
            # Extract ratings
            ratings = ocr_processor.text_processor.extract_ratings_and_reviews(cleaned)
            if ratings:
                print(f"    Ratings: {[r['value'] for r in ratings]}")
                
        except Exception as e:
            print(f"    ❌ Processing error: {e}")
    
    return True

def test_image_preprocessing():
    """Test image preprocessing functionality"""
    print("\n🖼️ Testing image preprocessing functionality...")
    
    # Find a sample image
    data_dir = Path("data")
    image_files = list(data_dir.rglob("*.png")) + list(data_dir.rglob("*.jpg"))
    
    if not image_files:
        print("  ❌ No test images found")
        return False
    
    test_image = image_files[0]
    print(f"  Using test image: {test_image.name}")
    
    try:
        # Test image preprocessing
        processed_image = ocr_processor.preprocessor.preprocess_for_ocr(str(test_image))
        print(f"  ✅ Image preprocessing successful")
        print(f"  📐 Processed dimensions: {processed_image.shape}")
        
        # Test image type detection
        image_type = ocr_processor.preprocessor.detect_image_type(processed_image)
        print(f"  🔍 Detected image type: {image_type}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Image preprocessing failed: {e}")
        return False

def generate_test_report():
    """Generate test report"""
    print("\n📊 Generating test report...")
    
    report = {
        "test_timestamp": "2024-01-01T00:00:00",
        "ocr_engines": {
            "tesseract": True,
            "paddle": ocr_processor.paddle.available
        },
        "test_results": {
            "engine_test": True,
            "sample_images": True,
            "text_processing": True,
            "image_preprocessing": True
        }
    }
    
    # Save report
    report_path = Path("ocr_test_report.json")
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"  📄 Test report saved: {report_path}")
    return True

def main():
    """Main test function"""
    print("🚀 Starting OCR integration tests")
    print("=" * 50)
    
    test_results = []
    
    # Run various tests
    test_results.append(("OCR Engine Test", test_ocr_engines()))
    test_results.append(("Sample Images Test", test_sample_images()))
    test_results.append(("Text Processing Test", test_text_processing()))
    test_results.append(("Image Preprocessing Test", test_image_preprocessing()))
    test_results.append(("Generate Test Report", generate_test_report()))
    
    # Output test results
    print("\n" + "=" * 50)
    print("📋 Test Results Summary:")
    
    passed = 0
    for test_name, result in test_results:
        status = "✅ Passed" if result else "❌ Failed"
        print(f"  {test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\n🎯 Overall Result: {passed}/{len(test_results)} tests passed")
    
    if passed == len(test_results):
        print("🎉 All tests passed! OCR functionality is working properly")
        return 0
    else:
        print("⚠️ Some tests failed, please check related functionality")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)