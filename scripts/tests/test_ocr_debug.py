#!/usr/bin/env python3
"""
Debug script to test OCR processing directly
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocr_processor import process_image_file
import json

def test_ocr_processing():
    """Test OCR processing with sample images"""
    
    # Test with one of the Google Maps images
    test_images = [
        "data/google map/IMG_3193.PNG",
        "data/google map/IMG_3194.PNG", 
        "data/google map/IMG_3195.PNG",
        "data/google map/IMG_3196.PNG",
        "data/google map/IMG_3197.PNG"
    ]
    
    for image_path in test_images:
        if os.path.exists(image_path):
            print(f"\n{'='*50}")
            print(f"Testing: {image_path}")
            print(f"{'='*50}")
            
            try:
                result = process_image_file(image_path, "auto")
                
                print(f"Success: {result.get('success', False)}")
                print(f"Raw text length: {len(result.get('raw_text', ''))}")
                print(f"Cleaned text length: {len(result.get('cleaned_text', ''))}")
                print(f"Confidence: {result.get('confidence', 0):.2f}")
                
                if result.get('extracted_info'):
                    info = result['extracted_info']
                    print(f"Locations: {len(info.get('locations', []))}")
                    print(f"Addresses: {len(info.get('addresses', []))}")
                    print(f"Businesses: {len(info.get('business_names', []))}")
                    
                    if info.get('locations'):
                        print("Location details:")
                        for loc in info['locations'][:3]:  # Show first 3
                            print(f"  - {loc}")
                    
                    if info.get('business_names'):
                        print("Business name details:")
                        for biz in info['business_names'][:3]:  # Show first 3
                            print(f"  - {biz}")
                else:
                    print("No extracted_info found!")
                
                # Show first 200 chars of raw text
                raw_text = result.get('raw_text', '')
                if raw_text:
                    print(f"Raw text preview: {raw_text[:200]}...")
                else:
                    print("No raw text found!")
                    
            except Exception as e:
                print(f"Error processing {image_path}: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"Image not found: {image_path}")

if __name__ == "__main__":
    test_ocr_processing()