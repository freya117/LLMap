#!/usr/bin/env python3
"""
Debug script to test the full OCR pipeline
"""

import sys
import os
import logging

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocr_processor import OCRProcessor

# Set up logging to see debug output
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")


def test_full_pipeline():
    """Test the full OCR pipeline with one image"""

    # Test all images
    test_images = [
        ("data/google map/IMG_3193.PNG", "Dave's Hot Chicken"),
        ("data/google map/IMG_3194.PNG", "Albany Ao Sen"),
        ("data/google map/IMG_3195.PNG", "Eunice Gourmet"),
        ("data/google map/IMG_3196.PNG", "Funky Elephant"),
        ("data/google map/IMG_3197.PNG", "Acme Bread"),
    ]

    # Create OCR processor
    processor = OCRProcessor()

    for test_image, expected_business in test_images:
        if not os.path.exists(test_image):
            print(f"Image not found: {test_image}")
            continue

        print(f"\nTesting: {test_image}")
        print(f"Expected: {expected_business}")
        print("=" * 60)

        # Process the image
        try:
            result = processor.process_image(test_image, engine="auto")

            print(f"Processing completed!")
            print(f"Raw text length: {len(result.raw_text)}")
            print(f"Cleaned text length: {len(result.cleaned_text)}")
            print(f"Confidence: {result.confidence:.2f}")

            print(f"\nDetected locations: {len(result.detected_locations)}")
            for i, loc in enumerate(result.detected_locations):
                print(f"  {i+1}. {loc}")

            print(f"\nDetected addresses: {len(result.detected_addresses)}")
            for i, addr in enumerate(result.detected_addresses):
                print(f"  {i+1}. {addr}")

            print(f"\nDetected business names: {len(result.detected_names)}")
            for i, name in enumerate(result.detected_names):
                print(f"  {i+1}. {name}")

            # Check if expected business is found
            expected_found = False
            for loc in (
                result.detected_locations
                + result.detected_addresses
                + result.detected_names
            ):
                if expected_business.lower() in loc.lower():
                    print(f"✅ Found expected business: '{loc}'")
                    expected_found = True
                    break

            if not expected_found:
                print(
                    f"❌ Expected business '{expected_business}' not found in results"
                )

        except Exception as e:
            print(f"Error processing image: {e}")
            import traceback

            traceback.print_exc()


if __name__ == "__main__":
    test_full_pipeline()
