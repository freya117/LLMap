#!/usr/bin/env python3
"""
Debug script to test phrase splitting and filtering
"""

import sys
import os
import logging
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocr_processor import HierarchicalExtractor, LocationClassifier, IntelligentTextFilter, ConfidenceRefiner

# Set up logging to see debug output
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')

def test_phrase_splitting():
    """Test phrase splitting and filtering"""
    
    # Sample texts that should contain businesses but are not being found
    test_texts = [
        ("Albany Ao Sen", "es WF Fe ea 3 sie  oy. SweeiPotatoes = ) Kyoto, Ramere\\ Sar < STEN \\ Oras Ae I es \\ Ws oe 2 eee Sant: ) Up: BeetiGafe Na Nae oe \\EN c , Albany Ao Sen hf x - Vietnamese restaurant - - Closed - Ope"),
        ("Eunice Gourmet", "MEP OP radersloe's\\a og eee EE al q Ke 3 \\ 8 \\ ye ae At = Gv ard Ave \\ : 28 \\e 6 Be ea Brighton\\Ave Eunice Gourmet Café () x 47 (101) - Cafe - - - Opens 08:00 Thu Saved in 1% La KX i ix rs Pe = =e"),
        ("Funky Elephant", "YE Ole ALS lial? OS8 mre Wi a + n\\e gle i \\ es Beet FWA t > | \\ae *\\1ash) a AN, 4 Sie Dat i Peele A Be | Funky Elephant Berkeley (} x - Thai restaurant - - Open - Closes 20:30 Saved in 1X A Start"),
        ("Acme Bread", "<e BENS ghee, z NEY FES AYE  ke McDonaldsxQHy o\\ s\\n i. Vs: AW PAY Fe: ae es Acme Bread () x 48 (1, 278) - Bakery - - - Opens 08:00 Thu Saved in 1% . | 1) 2 Ses et ee ed \"i8- <a), Ee Overview Menu")
    ]
    
    # Create the components
    from ocr_processor import GroundTruthPatternLearner
    gt_learner = GroundTruthPatternLearner()
    classifier = LocationClassifier(gt_learner)
    filter_tool = IntelligentTextFilter()
    confidence_refiner = ConfidenceRefiner()
    extractor = HierarchicalExtractor(classifier, filter_tool, confidence_refiner)
    
    for expected_business, text in test_texts:
        print(f"\n{'='*60}")
        print(f"Testing: {expected_business}")
        print(f"Text: {text[:100]}...")
        print(f"{'='*60}")
        
        # Test phrase splitting
        phrases = extractor._split_into_phrases(text)
        print(f"\nSplit into {len(phrases)} phrases:")
        for i, phrase in enumerate(phrases):
            print(f"  {i+1}. '{phrase}'")
        
        # Test filtering
        print(f"\nTesting filtering:")
        filtered_phrases = []
        for i, phrase in enumerate(phrases):
            is_ui = filter_tool.is_ui_element(phrase)
            if not is_ui:
                cleaned = filter_tool.filter_google_maps_ui(phrase)
                cleaned = filter_tool.clean_ocr_artifacts(cleaned)
                if cleaned and len(cleaned.strip()) >= 3:
                    filtered_phrases.append(cleaned.strip())
                    print(f"  ✅ Phrase {i+1} kept: '{cleaned.strip()}'")
                else:
                    print(f"  ❌ Phrase {i+1} filtered (too short after cleaning): '{phrase}'")
            else:
                print(f"  ❌ Phrase {i+1} filtered (UI element): '{phrase}'")
        
        print(f"\nFiltered phrases ({len(filtered_phrases)}):")
        for i, phrase in enumerate(filtered_phrases):
            print(f"  {i+1}. '{phrase}'")
        
        # Test classification
        print(f"\nTesting classification:")
        for i, phrase in enumerate(filtered_phrases):
            classification = classifier.classify_text(phrase, 0.7)
            print(f"  Phrase {i+1}: '{phrase}' -> {classification['type']} ({classification.get('subtype', 'N/A')}) - confidence: {classification['confidence']:.2f}")
            if classification.get('matched_business'):
                print(f"    Matched business: {classification['matched_business']}")

if __name__ == "__main__":
    test_phrase_splitting()