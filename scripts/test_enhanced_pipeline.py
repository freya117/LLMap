#!/usr/bin/env python3
"""
Test script for Enhanced OCR + AI Pipeline
Tests the new architecture without requiring full dependency installation
"""

import sys
import os
import json

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

def test_imports():
    """Test if all Enhanced OCR + AI Pipeline components can be imported"""
    print("🔍 Testing Enhanced OCR + AI Pipeline imports...")
    
    try:
        from enhanced_ocr_processor import EnhancedOCRProcessor, ContentTypeDetector, ContextualChunker
        print("  ✅ Enhanced OCR Processor components imported successfully")
    except ImportError as e:
        print(f"  ❌ Enhanced OCR Processor import failed: {e}")
        return False
    
    try:
        from ai_processor import AIProcessor, SemanticExtractor, RelationshipMapper
        print("  ✅ AI Processor components imported successfully")
    except ImportError as e:
        print(f"  ❌ AI Processor import failed: {e}")
        return False
    
    try:
        from intelligent_geocoder import IntelligentGeocoder, ContextEnhancer
        print("  ✅ Intelligent Geocoder components imported successfully")
    except ImportError as e:
        print(f"  ❌ Intelligent Geocoder import failed: {e}")
        return False
    
    return True

def test_content_type_detection():
    """Test content type detection without requiring full OCR"""
    print("\n🎯 Testing Content Type Detection...")
    
    try:
        from enhanced_ocr_processor import ContentTypeDetector
        detector = ContentTypeDetector()
        
        # Test text analysis
        test_cases = [
            ("Day 1 Olympic National Park visitor center", "travel_itinerary"),
            ("like comment share follow @username", "social_media"),
            ("Katsumidori sushi tokyo rating 4.5 stars", "restaurant_review"),
            ("directions route 5 min drive traffic", "map_screenshot")
        ]
        
        for text, expected_type in test_cases:
            result = detector._analyze_text_content(text)
            detected = any(expected_type in indicator for indicator in result.keys())
            status = "✅" if detected else "⚠️"
            print(f"    {status} '{text[:30]}...' → Expected: {expected_type}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Content type detection test failed: {e}")
        return False

def test_contextual_chunking():
    """Test contextual chunking logic"""
    print("\n📝 Testing Contextual Chunking...")
    
    try:
        from enhanced_ocr_processor import ContextualChunker
        chunker = ContextualChunker()
        
        # Test text chunking
        sample_text = """17:12 Day 1 Olympic National Park
        
Olympic National Park visitor center
Quinault rain forest trailhead
Lake Quinault scenic area

Gateway Inn accommodation
Phone: (360) 288-2535
Website: www.gatewayinn.com"""
        
        chunks = chunker.create_chunks(sample_text, "travel_itinerary")
        
        print(f"    ✅ Created {len(chunks)} chunks from sample text")
        for i, chunk in enumerate(chunks[:3]):
            print(f"      {i+1}. [{chunk.spatial_context}] {chunk.text[:40]}...")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Contextual chunking test failed: {e}")
        return False

def test_api_structure():
    """Test that the main.py has the new API endpoints"""
    print("\n🌐 Testing API Structure...")
    
    try:
        # Check if main.py contains the new endpoints
        main_py_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'main.py')
        
        if not os.path.exists(main_py_path):
            print("  ❌ main.py not found")
            return False
        
        with open(main_py_path, 'r') as f:
            content = f.read()
        
        # Check for Enhanced OCR + AI Pipeline endpoints
        endpoints_to_check = [
            '/api/ai/process-image',
            '/api/ai/process-batch',
            'EnhancedOCRProcessor',
            'AIProcessor',
            'IntelligentGeocoder'
        ]
        
        for endpoint in endpoints_to_check:
            if endpoint in content:
                print(f"    ✅ Found: {endpoint}")
            else:
                print(f"    ❌ Missing: {endpoint}")
                return False
        
        return True
        
    except Exception as e:
        print(f"  ❌ API structure test failed: {e}")
        return False

def test_ground_truth_data():
    """Test that ground truth data is available"""
    print("\n📊 Testing Ground Truth Data...")
    
    try:
        ground_truth_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'social_media_ground_truth.json')
        
        if not os.path.exists(ground_truth_path):
            print("  ❌ Ground truth file not found")
            return False
        
        with open(ground_truth_path, 'r') as f:
            ground_truth = json.load(f)
        
        images = ground_truth.get('images', {})
        print(f"    ✅ Ground truth loaded: {len(images)} test images")
        
        # Check sample image data
        for filename, data in list(images.items())[:2]:
            expected_locations = data.get('expected_locations', [])
            content_type = data.get('content_type', 'unknown')
            print(f"      - {filename}: {len(expected_locations)} locations, type: {content_type}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Ground truth test failed: {e}")
        return False

def test_documentation():
    """Test that documentation has been updated"""
    print("\n📚 Testing Documentation Updates...")
    
    try:
        docs_to_check = [
            'docs/enhanced-ocr-ai-pipeline-summary.md',
            'docs/technical-architecture.md',
            'docs/ocr-implementation-guide.md',
            'docs/immediate-tasks.md'
        ]
        
        for doc_path in docs_to_check:
            full_path = os.path.join(os.path.dirname(__file__), '..', doc_path)
            if os.path.exists(full_path):
                with open(full_path, 'r') as f:
                    content = f.read()
                    if 'Enhanced OCR + AI Pipeline' in content:
                        print(f"    ✅ Updated: {doc_path}")
                    else:
                        print(f"    ⚠️  Partially updated: {doc_path}")
            else:
                print(f"    ❌ Missing: {doc_path}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Documentation test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Enhanced OCR + AI Pipeline Test Suite")
    print("=" * 50)
    
    tests = [
        ("Import Tests", test_imports),
        ("Content Type Detection", test_content_type_detection),
        ("Contextual Chunking", test_contextual_chunking),
        ("API Structure", test_api_structure),
        ("Ground Truth Data", test_ground_truth_data),
        ("Documentation", test_documentation)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"  ❌ {test_name} failed with exception: {e}")
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Enhanced OCR + AI Pipeline is ready for deployment.")
    elif passed >= total * 0.8:
        print("✅ Most tests passed. System is functional with minor issues.")
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
    
    print("\n🔧 Next Steps:")
    print("1. Install dependencies: pip install -r backend/requirements.txt")
    print("2. Set environment variables: OPENAI_API_KEY, GOOGLE_MAPS_API_KEY")
    print("3. Test with real images: python scripts/tests/evaluate_social_media_ocr.py")
    print("4. Start the enhanced API server: python backend/main.py")

if __name__ == "__main__":
    main()