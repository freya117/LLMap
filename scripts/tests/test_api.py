#!/usr/bin/env python3
"""
Test the API directly
"""

import requests
import os

def test_api():
    """Test the OCR API with a sample image"""
    
    # Test with one image
    image_path = "../data/google map/IMG_3193.PNG"
    
    if not os.path.exists(image_path):
        print(f"Image not found: {image_path}")
        return
    
    url = "http://localhost:8000/api/ocr/batch"
    
    try:
        with open(image_path, 'rb') as f:
            files = {'files': (os.path.basename(image_path), f, 'image/png')}
            data = {
                'engine': 'auto',
                'enhance_image': 'true',
                'extract_structured': 'true'
            }
            
            print(f"Testing API with {image_path}")
            response = requests.post(url, files=files, data=data)
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print("API Response:")
                print(f"  Success: {result.get('success', False)}")
                print(f"  Processing Stats: {result.get('processing_stats', {})}")
                
                if result.get('results'):
                    for i, file_result in enumerate(result['results']):
                        print(f"  File {i+1}:")
                        print(f"    Success: {file_result.get('success', False)}")
                        print(f"    Confidence: {file_result.get('confidence', 0)}")
                        print(f"    Raw text length: {len(file_result.get('raw_text', ''))}")
                        print(f"    Extracted info: {file_result.get('extracted_info', {})}")
                
                if result.get('aggregated_data'):
                    agg = result['aggregated_data']
                    print(f"  Aggregated locations: {len(agg.get('locations', []))}")
                    if agg.get('locations'):
                        for loc in agg['locations'][:3]:
                            print(f"    - {loc.get('name', 'Unknown')} ({loc.get('type', 'Unknown')})")
            else:
                print(f"Error: {response.text}")
                
    except Exception as e:
        print(f"Error testing API: {e}")

if __name__ == "__main__":
    test_api()