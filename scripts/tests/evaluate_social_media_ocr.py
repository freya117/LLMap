#!/usr/bin/env python3
"""
Social Media OCR Evaluation Script
Evaluates OCR performance against ground truth data
"""

import sys
import os
import json
from typing import Dict, List, Tuple

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from ocr_processor import OCRProcessor

def load_ground_truth(file_path: str) -> Dict:
    """Load ground truth data from JSON file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def normalize_text(text: str) -> str:
    """Normalize text for comparison"""
    return text.lower().strip().replace(' ', '')

def calculate_text_similarity(expected: str, actual: str) -> float:
    """Calculate simple text similarity score"""
    expected_norm = normalize_text(expected)
    actual_norm = normalize_text(actual)
    
    if not expected_norm:
        return 1.0 if not actual_norm else 0.0
    
    if expected_norm in actual_norm or actual_norm in expected_norm:
        return 1.0
    
    # Simple character overlap
    common_chars = set(expected_norm) & set(actual_norm)
    total_chars = set(expected_norm) | set(actual_norm)
    
    return len(common_chars) / len(total_chars) if total_chars else 0.0

def evaluate_location_extraction(expected_locations: List[Dict], actual_locations: List[str]) -> Dict:
    """Evaluate location extraction performance"""
    results = {
        'total_expected': len(expected_locations),
        'total_extracted': len(actual_locations),
        'correctly_identified': 0,
        'false_positives': 0,
        'missed_locations': [],
        'found_locations': [],
        'precision': 0.0,
        'recall': 0.0,
        'f1_score': 0.0
    }
    
    # Check each expected location
    for expected_loc in expected_locations:
        expected_text = expected_loc['text']
        found = False
        
        for actual_loc in actual_locations:
            similarity = calculate_text_similarity(expected_text, actual_loc)
            if similarity > 0.5:  # Threshold for match
                results['correctly_identified'] += 1
                results['found_locations'].append({
                    'expected': expected_text,
                    'actual': actual_loc,
                    'similarity': similarity,
                    'type': expected_loc['type']
                })
                found = True
                break
        
        if not found:
            results['missed_locations'].append(expected_loc)
    
    # Calculate false positives
    matched_actual = {loc['actual'] for loc in results['found_locations']}
    results['false_positives'] = len(actual_locations) - len(matched_actual)
    
    # Calculate metrics
    if results['total_extracted'] > 0:
        results['precision'] = results['correctly_identified'] / results['total_extracted']
    
    if results['total_expected'] > 0:
        results['recall'] = results['correctly_identified'] / results['total_expected']
    
    if results['precision'] + results['recall'] > 0:
        results['f1_score'] = 2 * (results['precision'] * results['recall']) / (results['precision'] + results['recall'])
    
    return results

def evaluate_text_content(expected_contains: List[str], actual_text: str) -> Dict:
    """Evaluate if expected text content is present"""
    results = {
        'total_expected': len(expected_contains),
        'found_count': 0,
        'found_items': [],
        'missed_items': [],
        'accuracy': 0.0
    }
    
    actual_text_norm = actual_text.lower()
    
    for expected_text in expected_contains:
        expected_norm = expected_text.lower()
        if expected_norm in actual_text_norm:
            results['found_count'] += 1
            results['found_items'].append(expected_text)
        else:
            results['missed_items'].append(expected_text)
    
    if results['total_expected'] > 0:
        results['accuracy'] = results['found_count'] / results['total_expected']
    
    return results

def evaluate_single_image(image_path: str, ground_truth: Dict, processor: OCRProcessor) -> Dict:
    """Evaluate OCR performance for a single image"""
    print(f"\n📸 Evaluating {os.path.basename(image_path)}...")
    
    try:
        # Process image with OCR
        result = processor.process_image(image_path)
        
        # Extract data for evaluation
        actual_locations = result.locations if hasattr(result, 'locations') else []
        actual_text = result.cleaned_text
        actual_confidence = result.confidence
        
        # Get expected data
        expected_locations = ground_truth.get('expected_locations', [])
        expected_text_contains = ground_truth.get('expected_text_contains', [])
        expected_content_type = ground_truth.get('content_type', 'unknown')
        expected_difficulty = ground_truth.get('ocr_difficulty', 'unknown')
        
        # Evaluate location extraction
        location_eval = evaluate_location_extraction(expected_locations, actual_locations)
        
        # Evaluate text content
        text_eval = evaluate_text_content(expected_text_contains, actual_text)
        
        # Overall evaluation
        evaluation = {
            'image': os.path.basename(image_path),
            'expected_content_type': expected_content_type,
            'expected_difficulty': expected_difficulty,
            'ocr_confidence': actual_confidence,
            'location_extraction': location_eval,
            'text_content': text_eval,
            'raw_text_length': len(result.raw_text),
            'cleaned_text_length': len(actual_text),
            'success': True
        }
        
        # Print summary
        print(f"  ✅ OCR Confidence: {actual_confidence:.3f}")
        print(f"  📍 Locations: {location_eval['correctly_identified']}/{location_eval['total_expected']} found (Precision: {location_eval['precision']:.3f}, Recall: {location_eval['recall']:.3f})")
        print(f"  📝 Text Content: {text_eval['found_count']}/{text_eval['total_expected']} expected items found ({text_eval['accuracy']:.3f})")
        
        if location_eval['found_locations']:
            print("  🎯 Found locations:")
            for loc in location_eval['found_locations']:
                print(f"    - {loc['expected']} → {loc['actual']} (similarity: {loc['similarity']:.3f})")
        
        if location_eval['missed_locations']:
            print("  ❌ Missed locations:")
            for loc in location_eval['missed_locations']:
                print(f"    - {loc['text']} ({loc['type']})")
        
        return evaluation
        
    except Exception as e:
        print(f"  ❌ Error processing image: {e}")
        return {
            'image': os.path.basename(image_path),
            'success': False,
            'error': str(e)
        }

def main():
    """Main evaluation function"""
    print("🔍 Social Media OCR Evaluation")
    print("=" * 50)
    
    # Load ground truth
    ground_truth_path = 'data/social_media_ground_truth.json'
    if not os.path.exists(ground_truth_path):
        print(f"❌ Ground truth file not found: {ground_truth_path}")
        return
    
    ground_truth = load_ground_truth(ground_truth_path)
    print(f"📋 Loaded ground truth for {len(ground_truth['images'])} images")
    
    # Initialize OCR processor
    processor = OCRProcessor()
    
    # Evaluate each image
    evaluations = []
    social_media_dir = 'data/social media'
    
    for image_filename, expected_data in ground_truth['images'].items():
        image_path = os.path.join(social_media_dir, image_filename)
        
        if not os.path.exists(image_path):
            print(f"⚠️  Image not found: {image_path}")
            continue
        
        evaluation = evaluate_single_image(image_path, expected_data, processor)
        evaluations.append(evaluation)
    
    # Calculate overall statistics
    successful_evals = [e for e in evaluations if e.get('success', False)]
    
    if not successful_evals:
        print("❌ No successful evaluations")
        return
    
    print(f"\n📊 Overall Results ({len(successful_evals)} images)")
    print("=" * 50)
    
    # OCR confidence statistics
    confidences = [e['ocr_confidence'] for e in successful_evals]
    avg_confidence = sum(confidences) / len(confidences)
    print(f"🎯 Average OCR Confidence: {avg_confidence:.3f}")
    
    # Location extraction statistics
    total_expected_locations = sum(e['location_extraction']['total_expected'] for e in successful_evals)
    total_found_locations = sum(e['location_extraction']['correctly_identified'] for e in successful_evals)
    total_extracted_locations = sum(e['location_extraction']['total_extracted'] for e in successful_evals)
    
    overall_precision = total_found_locations / total_extracted_locations if total_extracted_locations > 0 else 0
    overall_recall = total_found_locations / total_expected_locations if total_expected_locations > 0 else 0
    overall_f1 = 2 * (overall_precision * overall_recall) / (overall_precision + overall_recall) if (overall_precision + overall_recall) > 0 else 0
    
    print(f"📍 Location Extraction:")
    print(f"   - Total Expected: {total_expected_locations}")
    print(f"   - Total Found: {total_found_locations}")
    print(f"   - Total Extracted: {total_extracted_locations}")
    print(f"   - Precision: {overall_precision:.3f}")
    print(f"   - Recall: {overall_recall:.3f}")
    print(f"   - F1 Score: {overall_f1:.3f}")
    
    # Text content statistics
    total_expected_text = sum(e['text_content']['total_expected'] for e in successful_evals)
    total_found_text = sum(e['text_content']['found_count'] for e in successful_evals)
    text_accuracy = total_found_text / total_expected_text if total_expected_text > 0 else 0
    
    print(f"📝 Text Content Recognition:")
    print(f"   - Expected Items: {total_expected_text}")
    print(f"   - Found Items: {total_found_text}")
    print(f"   - Accuracy: {text_accuracy:.3f}")
    
    # Content type breakdown
    content_types = {}
    for eval_result in successful_evals:
        content_type = eval_result.get('expected_content_type', 'unknown')
        if content_type not in content_types:
            content_types[content_type] = {'count': 0, 'avg_confidence': 0, 'confidences': []}
        content_types[content_type]['count'] += 1
        content_types[content_type]['confidences'].append(eval_result['ocr_confidence'])
    
    print(f"\n📱 Performance by Content Type:")
    for content_type, stats in content_types.items():
        avg_conf = sum(stats['confidences']) / len(stats['confidences'])
        print(f"   - {content_type}: {stats['count']} images, avg confidence: {avg_conf:.3f}")
    
    # Save detailed results
    results_file = 'data/social_media_evaluation_results.json'
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump({
            'evaluation_date': '2025-01-18',
            'overall_stats': {
                'total_images': len(successful_evals),
                'avg_ocr_confidence': avg_confidence,
                'location_extraction': {
                    'precision': overall_precision,
                    'recall': overall_recall,
                    'f1_score': overall_f1,
                    'total_expected': total_expected_locations,
                    'total_found': total_found_locations,
                    'total_extracted': total_extracted_locations
                },
                'text_content_accuracy': text_accuracy,
                'content_type_breakdown': content_types
            },
            'individual_results': evaluations
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Detailed results saved to: {results_file}")
    
    # Recommendations
    print(f"\n💡 Recommendations:")
    if overall_recall < 0.5:
        print("   - Location extraction recall is low - consider improving location detection patterns")
    if overall_precision < 0.7:
        print("   - Location extraction precision is low - consider stricter filtering")
    if avg_confidence < 0.6:
        print("   - OCR confidence is low - consider better image preprocessing")
    if text_accuracy < 0.7:
        print("   - Text content recognition needs improvement - check OCR quality")

if __name__ == "__main__":
    main()