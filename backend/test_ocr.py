#!/usr/bin/env python3
"""
OCR Functionality Test Script
For testing and validating various OCR processor functions
"""

import os
import sys
import json
import time
from pathlib import Path
from ocr_processor import OCRProcessor, process_image_file
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_ocr_with_sample_images():
    """Test OCR functionality with sample images"""
    
    # Find test images
    test_images_dir = Path("../data")
    image_extensions = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG']
    
    test_images = []
    if test_images_dir.exists():
        for ext in image_extensions:
            test_images.extend(test_images_dir.rglob(f"*{ext}"))
    
    if not test_images:
        logger.warning("No test images found, please ensure there are image files in the data/ directory")
        return
    
    logger.info(f"Found {len(test_images)} test images")
    
    # Initialize OCR processor
    ocr_processor = OCRProcessor()
    
    results = []
    
    for i, image_path in enumerate(test_images[:5]):  # Limit testing to first 5 images
        logger.info(f"\n{'='*50}")
        logger.info(f"Testing image {i+1}/{min(5, len(test_images))}: {image_path.name}")
        logger.info(f"{'='*50}")
        
        try:
            start_time = time.time()
            
            # Test different OCR engines
            engines = ["tesseract", "paddle", "auto"]
            
            for engine in engines:
                logger.info(f"\n--- Using {engine.upper()} engine ---")
                
                try:
                    result = process_image_file(str(image_path), engine)
                    processing_time = time.time() - start_time
                    
                    # Output result summary
                    logger.info(f"Processing time: {processing_time:.2f} seconds")
                    logger.info(f"Confidence: {result['confidence']:.2f}")
                    logger.info(f"Extracted text length: {len(result['cleaned_text'])} characters")
                    logger.info(f"Detected locations: {len(result['extracted_info']['locations'])}")
                    logger.info(f"Detected addresses: {len(result['extracted_info']['addresses'])}")
                    logger.info(f"Detected businesses: {len(result['extracted_info']['business_names'])}")
                    
                    # Display extracted location information
                    if result['extracted_info']['locations']:
                        logger.info("Extracted locations:")
                        for loc in result['extracted_info']['locations'][:3]:  # Show first 3
                            logger.info(f"  - {loc}")
                    
                    if result['extracted_info']['addresses']:
                        logger.info("Extracted addresses:")
                        for addr in result['extracted_info']['addresses'][:3]:
                            logger.info(f"  - {addr}")
                    
                    if result['extracted_info']['business_names']:
                        logger.info("Extracted businesses:")
                        for name in result['extracted_info']['business_names'][:3]:
                            logger.info(f"  - {name}")
                    
                    # Display partial raw text
                    if result['cleaned_text']:
                        preview = result['cleaned_text'][:200] + "..." if len(result['cleaned_text']) > 200 else result['cleaned_text']
                        logger.info(f"Text preview: {preview}")
                    
                    # Save results
                    results.append({
                        'image': image_path.name,
                        'engine': engine,
                        'result': result,
                        'processing_time': processing_time
                    })
                    
                    # Only test the first available engine to avoid duplication
                    if result['success']:
                        break
                        
                except Exception as e:
                    logger.error(f"{engine} engine processing failed: {e}")
                    continue
            
        except Exception as e:
            logger.error(f"Failed to process image {image_path.name}: {e}")
    
    # Generate test report
    generate_test_report(results)

def generate_test_report(results):
    """Generate test report"""
    if not results:
        logger.warning("No test results available to generate report")
        return
    
    logger.info(f"\n{'='*60}")
    logger.info("OCR Test Report")
    logger.info(f"{'='*60}")
    
    total_images = len(results)
    successful_results = [r for r in results if r['result']['success']]
    success_rate = len(successful_results) / total_images * 100 if total_images > 0 else 0
    
    logger.info(f"Total test images: {total_images}")
    logger.info(f"Successfully processed: {len(successful_results)} ({success_rate:.1f}%)")
    
    if successful_results:
        avg_confidence = sum(r['result']['confidence'] for r in successful_results) / len(successful_results)
        avg_processing_time = sum(r['processing_time'] for r in successful_results) / len(successful_results)
        total_locations = sum(len(r['result']['extracted_info']['locations']) for r in successful_results)
        total_addresses = sum(len(r['result']['extracted_info']['addresses']) for r in successful_results)
        total_businesses = sum(len(r['result']['extracted_info']['business_names']) for r in successful_results)
        
        logger.info(f"Average confidence: {avg_confidence:.2f}")
        logger.info(f"Average processing time: {avg_processing_time:.2f} seconds")
        logger.info(f"Total extracted locations: {total_locations}")
        logger.info(f"Total extracted addresses: {total_addresses}")
        logger.info(f"Total extracted businesses: {total_businesses}")
    
    # Save detailed report to file
    report_file = "ocr_test_report.json"
    try:
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False, default=str)
        logger.info(f"Detailed report saved to: {report_file}")
    except Exception as e:
        logger.error(f"Failed to save report: {e}")

def test_text_processing():
    """Test text processing functionality"""
    logger.info(f"\n{'='*50}")
    logger.info("Testing text processing functionality")
    logger.info(f"{'='*50}")
    
    # Test text samples
    test_texts = [
        "Sushi Nakazawa Restaurant 23 Commerce St, New York, NY 10014 Rating: 4.5/5 Phone: (212) 924-2212",
        "Joe's Pizza 7 Carmine Street NYC Open 24 hours ★★★★☆ 4.2 stars",
        "Katz's Delicatessen 205 E Houston St New York NY Famous pastrami sandwich since 1888",
        "123 Zhongshan Road Starbucks Coffee Hours: 7:00-22:00 Phone: 021-12345678",
        "Times Square McDonald's 1560 Broadway New York 10036 24/7 Fast Food"
    ]
    
    from ocr_processor import TextProcessor
    processor = TextProcessor()
    
    for i, text in enumerate(test_texts, 1):
        logger.info(f"\n--- Test text {i} ---")
        logger.info(f"Original text: {text}")
        
        # Clean text
        cleaned = processor.clean_text(text)
        logger.info(f"Cleaned text: {cleaned}")
        
        # Extract location information
        locations = processor.extract_locations_advanced(cleaned)
        logger.info(f"Extracted locations ({len(locations)}):")
        for loc in locations:
            logger.info(f"  - {loc['text']} ({loc['type']}, confidence: {loc['confidence']:.2f})")
        
        # Extract contact information
        contact = processor.extract_contact_info(cleaned)
        if any(contact.values()):
            logger.info("Contact information:")
            for key, values in contact.items():
                if values:
                    logger.info(f"  {key}: {values}")

def main():
    """Main function"""
    logger.info("Starting OCR functionality testing")
    
    # Check dependencies
    try:
        import cv2
        import pytesseract
        logger.info("✓ OpenCV and Tesseract available")
    except ImportError as e:
        logger.error(f"✗ Missing dependencies: {e}")
        return
    
    try:
        from paddleocr import PaddleOCR
        logger.info("✓ PaddleOCR available")
    except ImportError:
        logger.warning("⚠ PaddleOCR not available, will only use Tesseract")
    
    # Run tests
    test_text_processing()
    test_ocr_with_sample_images()
    
    logger.info("\nOCR functionality testing completed")

if __name__ == "__main__":
    main()