#!/usr/bin/env python3
"""
Debug script to test hierarchical extraction directly
"""

import sys
import os
import logging
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocr_processor import GroundTruthPatternLearner, LocationClassifier, IntelligentTextFilter
import re

# Set up logging to see debug output
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')

def test_pattern_matching():
    """Test pattern matching with known text samples"""
    
    # Sample texts from the OCR results that should contain businesses
    test_texts = [
        # IMG_3194.PNG - Contains "Albany Ao Sen"
        ("Albany Ao Sen", "es WF Fe ea 3 sie oy. SweeiPotatoes = ) Kyoto, Ramere\\ Sar < STEN \\ Oras Ae I es \\ Ws oe 2 eee Sant: ) Up: BeetiGafe Na Nae oe \\EN c , Albany Ao Sen hf x - Vietnamese restaurant - - Closed - Ope"),
        
        # IMG_3193.PNG - Contains "Dave's Hot Chicken"
        ("Dave's Hot Chicken", "Be Veo Suse. Nery og | eK EliCerritoiPlaza Vb F Dave's Hot Chicken () x - Chicken restaurant - - Open - Closes 00:00 A Start Wa XY Saved _ a DAD ESS Hare nic = Sa Oe ee tint au thee. Overvie"),
        
        # IMG_3195.PNG - Contains "Eunice Gourmet Café"
        ("Eunice Gourmet", "MEP OP radersloe's\\a og eee EE al q Ke 3 \\ 8 \\ ye ae At = Gv ard Ave \\ : 28 \\e 6 Be ea Brighton\\Ave Eunice Gourmet Café () x 47 (101) - Cafe - - - Opens 08:00 Thu Saved in 1% La KX i ix rs Pe = =e"),
        
        # IMG_3196.PNG - Contains "Funky Elephant Berkeley"
        ("Funky Elephant", "YE Ole ALS lial? OS8 mre Wi a + n\\e gle i \\ es Beet FWA t > | \\ae *\\1ash) a AN, 4 Sie Dat i Peele A Be | Funky Elephant Berkeley (} x - Thai restaurant - - Open - Closes 20:30 Saved in 1X A Start"),
        
        # IMG_3197.PNG - Contains "Acme Bread"
        ("Acme Bread", "<e BENS ghee, z NEY FES AYE ke McDonaldsxQHy o\\ s\\n i. Vs: AW PAY Fe: ae es Acme Bread () x 48 (1, 278) - Bakery - - - Opens 08:00 Thu Saved in 1% . | 1) 2 Ses et ee ed \"i8- <a), Ee Overview Menu")
    ]
    
    # Create the pattern learner
    gt_learner = GroundTruthPatternLearner()
    filter_tool = IntelligentTextFilter()
    classifier = LocationClassifier(gt_learner)
    
    for i, (expected_business, text) in enumerate(test_texts, 1):
        print(f"\n{'='*60}")
        print(f"Testing Text Sample {i} - Looking for: {expected_business}")
        print(f"{'='*60}")
        print(f"Text: {text[:100]}...")
        print(f"Full length: {len(text)} characters")
        
        # Test individual business patterns
        print(f"\nTesting business pattern matching:")
        found_any = False
        
        for business, data in gt_learner.known_businesses.items():
            print(f"  Looking for: {business}")
            for pattern in data["patterns"]:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                match_found = False
                for match in matches:
                    match_found = True
                    found_any = True
                    match_text = match.group().strip()
                    print(f"    ✅ Pattern '{pattern}' found: '{match_text}'")
                    
                    # Test filters
                    is_noise = filter_tool.is_ui_element(match_text)
                    print(f"    Filters - UI Element: {is_noise}")
                    
                if not match_found:
                    print(f"    ❌ Pattern '{pattern}' - NO MATCH")
        
        if not found_any:
            print(f"  ⚠️  NO BUSINESS PATTERNS MATCHED!")
            
        # Test classifier on the whole text
        print(f"\nTesting classifier on full text:")
        classification = classifier.classify_text(text, 0.7)
        print(f"  Classification: {classification}")
        
        # Test simple string search for expected business
        if expected_business.lower() in text.lower():
            print(f"  ✅ Simple string search found '{expected_business}' in text")
        else:
            print(f"  ❌ Simple string search did NOT find '{expected_business}' in text")

if __name__ == "__main__":
    test_pattern_matching()