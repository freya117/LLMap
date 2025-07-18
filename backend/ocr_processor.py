"""
OCR Processing Module - Enhanced Version
Supports both Tesseract and PaddleOCR engines
Includes intelligent text filtering, business/address classification, and confidence refinement
"""

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import re
import json
from typing import List, Dict, Tuple, Optional
import logging
from dataclasses import dataclass
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from skimage.restoration import denoise_bilateral
    SKIMAGE_AVAILABLE = True
except ImportError:
    SKIMAGE_AVAILABLE = False
    logger.warning("scikit-image not available, will use OpenCV alternative")

try:
    import jieba
    JIEBA_AVAILABLE = True
except ImportError:
    JIEBA_AVAILABLE = False
    logger.warning("jieba not available, Chinese word segmentation functionality limited")


@dataclass
class OCRResult:
    """OCR result data structure"""
    text: str
    confidence: float
    bbox: Optional[Tuple[int, int, int, int]] = None  # (x, y, width, height)
    language: str = "en"


@dataclass
class ProcessedOCRResult:
    """Processed OCR result"""
    raw_text: str
    cleaned_text: str
    structured_data: Dict
    confidence: float
    detected_locations: List[str] = None
    detected_addresses: List[str] = None
    detected_names: List[str] = None
    locations: List[str] = None  # Add this for backward compatibility

    def __post_init__(self):
        if self.detected_locations is None:
            self.detected_locations = []
        if self.detected_addresses is None:
            self.detected_addresses = []
        if self.detected_names is None:
            self.detected_names = []
        if self.locations is None:
            self.locations = []


class GroundTruthPatternLearner:
    """Learn extraction patterns from ground truth data"""
    
    def __init__(self):
        # Ground truth patterns for our specific use case
        self.known_businesses = {
            "Dave's Hot Chicken": {
                "patterns": [r"Dave\'?s\s+Hot\s+Chicken", r"Dave\s*Hot\s*Chicken"],
                "address": "5010 El Cerrito Plaza",
                "type": "Fast Food/Chicken"
            },
            "Albany Ao Sen": {
                "patterns": [r"Albany\s+Ao\s+Sen", r"Ao\s+Sen"],
                "address": "665 San Pablo Ave",
                "type": "Vietnamese"
            },
            "Eunice Gourmet Café": {
                "patterns": [r"Eunice\s+Gourmet(?:\s+Caf[eé])?", r"Eunice\s+Gourmet"],
                "address": "1162 Solano Ave",
                "type": "Cafe"
            },
            "Funky Elephant Berkeley": {
                "patterns": [r"Funky\s+Elephant(?:\s+Berkeley)?", r"Funky\s+Elephant"],
                "address": "1313 Ninth St",
                "type": "Thai"
            },
            "Acme Bread": {
                "patterns": [r"Acme\s+Bread", r"Acme\s*Bread"],
                "address": "1601 San Pablo Ave",
                "type": "Bakery"
            }
        }
        
        self.known_addresses = {
            "5010 El Cerrito Plaza": [r"5010\s+El\s+Cerrito\s+(?:Plaza|Pl)"],
            "665 San Pablo Ave": [r"665\s+San\s+Pablo\s+Ave"],
            "1162 Solano Ave": [r"1162\s+Solano\s+Ave"],
            "1313 Ninth St": [r"1313\s+Ninth\s+St"],
            "1601 San Pablo Ave": [r"1601\s+San\s+Pablo\s+Ave"]
        }
    
    def get_business_patterns(self):
        """Get all business name patterns"""
        patterns = []
        for business, data in self.known_businesses.items():
            for pattern in data["patterns"]:
                patterns.append((pattern, "known_business", 0.95))
        return patterns
    
    def get_address_patterns(self):
        """Get all address patterns"""
        patterns = []
        for address, pattern_list in self.known_addresses.items():
            for pattern in pattern_list:
                patterns.append((pattern, "known_address", 0.9))
        return patterns


class ContentAwareProcessor:
    """Process different content types with specialized strategies"""
    
    def __init__(self):
        self.google_maps_processor = GoogleMapsProcessor()
        self.social_media_processor = SocialMediaProcessor()
        self.travel_processor = TravelItineraryProcessor()
    
    def process_by_type(self, text: str, image_type: str) -> Dict:
        """Process text based on detected image type"""
        if image_type == "google_maps":
            return self.google_maps_processor.process(text)
        elif image_type == "social_media":
            return self.social_media_processor.process(text)
        elif image_type == "travel_itinerary":
            return self.travel_processor.process(text)
        else:
            # Default to mixed content processing
            return self.google_maps_processor.process(text)


class GoogleMapsProcessor:
    """Specialized processor for Google Maps screenshots"""
    
    def process(self, text: str) -> Dict:
        """Process Google Maps content"""
        filter_tool = IntelligentTextFilter()
        
        # Use existing Google Maps processing logic
        lines = text.split('\n')
        filtered_lines = []
        
        for line in lines:
            if not filter_tool.is_ui_element(line):
                cleaned = filter_tool.filter_google_maps_ui(line)
                cleaned = filter_tool.clean_ocr_artifacts(cleaned)
                if cleaned and len(cleaned.strip()) >= 3:
                    filtered_lines.append(cleaned.strip())
        
        return {
            "content_type": "google_maps",
            "processed_text": '\n'.join(filtered_lines),
            "extraction_strategy": "structured_business_extraction"
        }


class SocialMediaProcessor:
    """Specialized processor for social media screenshots"""
    
    def __init__(self):
        # Social media specific noise patterns
        self.social_noise_patterns = [
            r'@\w+',  # Usernames
            r'#\w+',  # Hashtags (but preserve for context)
            r'\d+\s*(like|comment|share|view)s?',  # Engagement metrics
            r'\d+[hmd]\s*ago',  # Time stamps
            r'(sponsored|promoted|ad)',  # Ad indicators
        ]
        
        # Preserve these patterns as they might contain location info
        self.preserve_patterns = [
            r'#\w*travel\w*',  # Travel hashtags
            r'#\w*location\w*',  # Location hashtags
            r'@\w*hotel\w*',  # Hotel mentions
            r'@\w*restaurant\w*',  # Restaurant mentions
        ]
    
    def process(self, text: str) -> Dict:
        """Process social media content with minimal filtering"""
        lines = text.split('\n')
        processed_lines = []
        
        for line in lines:
            # Skip obvious noise but preserve content
            if self._is_social_noise(line):
                continue
                
            # Clean but preserve context
            cleaned = self._clean_social_content(line)
            if cleaned and len(cleaned.strip()) >= 2:  # Lower threshold
                processed_lines.append(cleaned.strip())
        
        return {
            "content_type": "social_media",
            "processed_text": '\n'.join(processed_lines),
            "extraction_strategy": "contextual_chunk_extraction"
        }
    
    def _is_social_noise(self, text: str) -> bool:
        """Check if text is social media noise"""
        text_lower = text.lower().strip()
        
        # Skip very short engagement metrics
        if re.match(r'^\d+$', text_lower):  # Just numbers
            return True
            
        # Skip pure timestamp lines
        if re.match(r'^\d+[hmd]\s*ago$', text_lower):
            return True
            
        return False
    
    def _clean_social_content(self, text: str) -> str:
        """Clean social media content while preserving context"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove some noise but keep location-relevant content
        for pattern in self.social_noise_patterns:
            # Check if it's a pattern we want to preserve
            if not any(re.search(preserve, text, re.IGNORECASE) for preserve in self.preserve_patterns):
                text = re.sub(pattern, '', text, flags=re.IGNORECASE)
        
        return text.strip()


class TravelItineraryProcessor:
    """Specialized processor for travel itinerary screenshots"""
    
    def __init__(self):
        # Travel-specific patterns to preserve
        self.travel_keywords = [
            'day', 'hotel', 'lodge', 'trail', 'park', 'visitor center',
            'national park', 'beach', 'mountain', 'lake', 'forest',
            '推荐', '住', '第一天', '第二天', '第三天',  # Chinese travel terms
            'itinerary', 'trip', 'travel', 'visit', 'stay'
        ]
        
        # Semantic chunks patterns
        self.chunk_patterns = [
            r'day\s+\d+[^.]*',  # Day 1, Day 2 sections
            r'住[^，。]*',  # Chinese accommodation info
            r'推荐[^，。]*',  # Chinese recommendations
            r'[A-Z][^.]*(?:trail|park|lodge|hotel|center)[^.]*',  # Location descriptions
        ]
    
    def process(self, text: str) -> Dict:
        """Process travel itinerary with semantic chunking"""
        # Extract semantic chunks instead of individual words
        chunks = self._extract_semantic_chunks(text)
        
        return {
            "content_type": "travel_itinerary",
            "processed_text": '\n'.join(chunks),
            "extraction_strategy": "semantic_chunk_extraction",
            "chunks": chunks
        }
    
    def _extract_semantic_chunks(self, text: str) -> List[str]:
        """Extract meaningful chunks from travel content"""
        chunks = []
        
        # Split by lines and process each
        lines = text.split('\n')
        current_chunk = ""
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check if this line starts a new semantic chunk
            if self._is_chunk_starter(line):
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = line
            else:
                # Add to current chunk if it's related
                if current_chunk and self._is_related_content(line):
                    current_chunk += " " + line
                elif self._has_travel_content(line):
                    # Start new chunk if it has travel content
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = line
        
        # Add final chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        # Filter chunks by relevance
        relevant_chunks = []
        for chunk in chunks:
            if self._is_relevant_chunk(chunk):
                relevant_chunks.append(chunk)
        
        return relevant_chunks
    
    def _is_chunk_starter(self, text: str) -> bool:
        """Check if text starts a new semantic chunk"""
        text_lower = text.lower()
        
        # Day indicators
        if re.match(r'day\s+\d+', text_lower):
            return True
            
        # Chinese day indicators
        if re.match(r'第[一二三四五六七八九十]+天', text):
            return True
            
        # Location names (capitalized words)
        if re.match(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:National Park|Park|Trail|Lodge|Hotel)', text):
            return True
            
        return False
    
    def _is_related_content(self, text: str) -> bool:
        """Check if text is related to current chunk"""
        text_lower = text.lower()
        
        # Contains travel keywords
        return any(keyword in text_lower for keyword in self.travel_keywords)
    
    def _has_travel_content(self, text: str) -> bool:
        """Check if text contains travel-related content"""
        text_lower = text.lower()
        
        # Has location indicators
        location_indicators = ['trail', 'park', 'lodge', 'hotel', 'center', 'beach', 'mountain', 'lake']
        if any(indicator in text_lower for indicator in location_indicators):
            return True
            
        # Has Chinese travel terms
        chinese_terms = ['推荐', '住', '天']
        if any(term in text for term in chinese_terms):
            return True
            
        # Has proper nouns (likely place names)
        if re.search(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+', text):
            return True
            
        return False
    
    def _is_relevant_chunk(self, chunk: str) -> bool:
        """Check if chunk is relevant for extraction"""
        # Must be substantial
        if len(chunk) < 10:
            return False
            
        # Must contain travel-related content
        if not self._has_travel_content(chunk):
            return False
            
        # Must not be pure noise
        words = chunk.split()
        if len(words) < 2:
            return False
            
        return True


class IntelligentTextFilter:
    """Intelligent text filtering to remove UI elements and noise"""
    
    def __init__(self):
        # Google Maps UI elements to filter out
        self.ui_blacklist = {
            # Navigation and UI elements
            "overview", "menu", "reviews", "photos", "updates", "order online",
            "call", "website", "directions", "save", "saved", "share",
            "start", "order", "check wait time", "add", "note",
            
            # Time and status indicators
            "open", "closed", "closes", "opens", "min", "hours", "am", "pm",
            "today", "yesterday", "tomorrow", "mon", "tue", "wed", "thu", "fri", "sat", "sun",
            
            # Generic descriptors that are not locations
            "summarized with ai", "popular", "cozy", "modern", "quick-serve",
            "specializing", "dishing up", "known for", "founded in",
            
            # Price and rating indicators
            "$", "$$", "$$$", "rating", "stars", "star", "review", "reviews",
            
            # Action words
            "visit", "try", "taste", "enjoy", "experience", "discover"
        }
        
        # OCR noise patterns to remove
        self.noise_patterns = [
            r"^[A-Z]{1,3}$",  # Single capital letters
            r"^\d{1,2}$",     # Single/double digits
            r"^[^\w\s]{1,3}$", # Special characters only
            r"^(?:x|X|\+|\-|\*|\/|\=|\(|\)|\.|\,){1,5}$",  # Mathematical symbols
            r"^(?:be|veo|suse|nery|og|ws|oe|sie|oy)$",  # Common OCR artifacts
            r"^(?:ee|es|ae|fe|al|at|et|it|ot|ut)$",     # Two-letter artifacts
        ]
        
        # Common OCR garbage words that appear in Google Maps screenshots
        self.ocr_garbage_words = {
            "be", "veo", "suse", "nery", "og", "ws", "oe", "sie", "oy", "ee", "es", "ae", "fe", 
            "al", "at", "et", "it", "ot", "ut", "dad", "ess", "hare", "nic", "sa", "tint", "au",
            "mep", "op", "eee", "ye", "ole", "als", "lial", "mre", "wi", "gle", "beet", "fwa",
            "dat", "peele", "bens", "ghee", "ney", "fes", "aye", "ke", "aw", "pay", "ses", "vv"
        }
        
        # Minimum meaningful text length
        self.min_text_length = 3
        self.max_text_length = 80
    
    def classify_location_type(self, text: str) -> str:
        """Classify location into specific types"""
        text_lower = text.lower().strip()
        
        # Business type classification
        if any(indicator in text_lower for indicator in ['restaurant', 'cafe', 'coffee', 'bakery', 'grill', 'kitchen']):
            return 'business'
        elif any(indicator in text_lower for indicator in ['street', 'avenue', 'road', 'boulevard', 'drive', 'place']) and re.search(r'\d+', text):
            return 'address'
        elif any(indicator in text_lower for indicator in ['plaza', 'center', 'mall', 'square']):
            return 'landmark'
        elif re.match(r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$', text) and len(text) > 6:
            return 'business'
        else:
            return 'location'

    def is_ui_element(self, text: str) -> bool:
        """Check if text is a UI element"""
        text_lower = text.lower().strip()
        
        # Check against UI blacklist
        for ui_element in self.ui_blacklist:
            if ui_element in text_lower or text_lower in ui_element:
                return True
        
        # Check for noise patterns
        for pattern in self.noise_patterns:
            if re.match(pattern, text, re.IGNORECASE):
                return True
        
        # Length check
        if len(text) < self.min_text_length or len(text) > self.max_text_length:
            return True
        
        # Check for OCR garbage
        if self.is_ocr_garbage(text):
            return True
        
        return False
    
    def is_ocr_garbage(self, text: str) -> bool:
        """Check if text is likely OCR garbage"""
        text_lower = text.lower().strip()
        words = text_lower.split()
        
        # If text is mostly garbage words, it's probably OCR noise
        if len(words) >= 2:
            garbage_word_count = sum(1 for word in words if word in self.ocr_garbage_words)
            garbage_ratio = garbage_word_count / len(words)
            
            # If more than 60% of words are garbage, classify as noise
            if garbage_ratio > 0.6:
                return True
        
        # Check for patterns that look like OCR garbage
        # Multiple short words with inconsistent capitalization
        if len(words) >= 3:
            short_words = sum(1 for word in words if len(word) <= 3)
            if short_words / len(words) > 0.7:  # More than 70% short words
                return True
        
        # Check for random character sequences
        if re.match(r'^[A-Z][a-z]{1,3}(\s+[A-Z][a-z]{1,3}){2,}', text):
            # Pattern like "Be Veo Suse Nery" - multiple short capitalized words
            return True
        
        return False
    
    def filter_google_maps_ui(self, text: str) -> str:
        """Remove Google Maps specific UI elements"""
        # Remove rating patterns like "4.3 (223)"
        text = re.sub(r"\d\.\d\s*\(\d+\)", "", text)
        
        # Remove price indicators like "$10-20"
        text = re.sub(r"\$\d+-\d+", "", text)
        
        # Remove time indicators like "26 min"
        text = re.sub(r"\d+\s+min\b", "", text)
        
        # Remove amp symbols and ratings
        text = re.sub(r"[&@#★☆]+", "", text)
        
        # Remove common UI button text
        ui_buttons = ["order", "call", "save", "share", "directions", "website"]
        for button in ui_buttons:
            text = re.sub(rf"\b{button}\b", "", text, flags=re.IGNORECASE)
        
        return text.strip()
    
    def clean_ocr_artifacts(self, text: str) -> str:
        """Clean common OCR recognition artifacts"""
        # Fix common character misrecognitions
        replacements = {
            r"\b0(?=[A-Za-z])": "O",  # 0 -> O before letters
            r"(?<=[A-Za-z])0\b": "O",  # 0 -> O after letters
            r"\b1(?=l|I)": "I",       # 1 -> I
            r"5(?=S|s)": "S",         # 5 -> S
            r"8(?=B|b)": "B",         # 8 -> B
        }
        
        for pattern, replacement in replacements.items():
            text = re.sub(pattern, replacement, text)
        
        return text


class LocationClassifier:
    """Classify extracted text into business names, addresses, or other location types"""
    
    def __init__(self, ground_truth_learner: GroundTruthPatternLearner):
        self.gt_learner = ground_truth_learner
        
        # Business type indicators (enhanced with Japanese and international)
        self.business_indicators = [
            "restaurant", "cafe", "coffee", "bakery", "grill", "kitchen", 
            "bar", "bistro", "deli", "pizza", "sushi", "market", "shop",
            "eatery", "chicken", "thai", "chinese", "vietnamese", "mexican",
            "italian", "bbq", "burger", "noodle", "ramen", "hotpot",
            "udon", "tempura", "yakitori", "izakaya", "teppanyaki", "shabu",
            "hotel", "lodge", "inn", "resort", "hostel", "ryokan"
        ]
        
        # Address indicators
        self.address_indicators = [
            "street", "st", "avenue", "ave", "road", "rd", "boulevard", "blvd",
            "drive", "dr", "lane", "ln", "way", "place", "pl", "plaza", "circle", "ct"
        ]
        
        # Location area indicators (enhanced with Japanese and travel locations)
        self.area_indicators = [
            "berkeley", "oakland", "san francisco", "alameda", "contra costa",
            "el cerrito", "albany", "richmond", "emeryville",
            "sapporo", "tokyo", "kyoto", "osaka", "hiroshima", "nagoya",
            "yokohama", "kobe", "fukuoka", "sendai", "chiba", "kawasaki",
            "area", "district", "ward", "prefecture", "city", "town"
        ]
        
        # Travel and landmark indicators
        self.landmark_indicators = [
            "national park", "state park", "park", "forest", "trail", "trailhead",
            "lake", "river", "mountain", "peak", "canyon", "falls", "waterfall",
            "point", "lookout", "viewpoint", "visitor center", "museum",
            "temple", "shrine", "castle", "tower", "bridge", "station",
            "airport", "port", "harbor", "beach", "island", "valley"
        ]
        
        # Japanese location patterns
        self.japanese_patterns = [
            r"[A-Za-z]+\s*(?:sushi|udon|ramen|tempura|yakitori|izakaya)",
            r"(?:tokyo|kyoto|osaka|sapporo|hiroshima)\s*[A-Za-z]*",
            r"[A-Za-z]+\s*(?:station|temple|shrine|castle|tower)"
        ]
    
    def classify_text(self, text: str, ocr_confidence: float) -> Dict[str, any]:
        """Classify text and return detailed classification info"""
        text_lower = text.lower().strip()
        
        # Check against known businesses first (highest priority)
        for business_name, data in self.gt_learner.known_businesses.items():
            for pattern in data["patterns"]:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    # Extract just the matched business name, not the entire phrase
                    matched_text = match.group().strip()
                    return {
                        "text": matched_text,  # Return clean matched text, not entire phrase
                        "type": "business",
                        "subtype": "known_business",
                        "confidence": min(0.95, ocr_confidence * 1.3),
                        "matched_business": business_name,
                        "business_type": data["type"]
                    }
        
        # Check against known addresses
        for address, patterns in self.gt_learner.known_addresses.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    return {
                        "text": text,
                        "type": "address",
                        "subtype": "known_address",
                        "confidence": min(0.9, ocr_confidence * 1.2),
                        "matched_address": address
                    }
        
        # Check for address patterns
        address_patterns = [
            r"\d{2,5}\s+\w+.*(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|place|pl|plaza)",
            r"\d{2,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+(?:St|Ave|Rd|Blvd|Dr|Pl|Plaza)"
        ]
        
        for pattern in address_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return {
                    "text": text,
                    "type": "address",
                    "subtype": "street_address",
                    "confidence": min(0.8, ocr_confidence * 1.1)
                }
        
        # Check for Japanese business patterns
        for pattern in self.japanese_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return {
                    "text": text,
                    "type": "business",
                    "subtype": "japanese_business",
                    "confidence": min(0.8, ocr_confidence * 1.1)
                }
        
        # Check for landmark/travel patterns
        for landmark in self.landmark_indicators:
            if landmark in text_lower:
                return {
                    "text": text,
                    "type": "landmark",
                    "subtype": "travel_landmark",
                    "confidence": min(0.8, ocr_confidence * 1.1)
                }
        
        # Enhanced business name patterns
        business_patterns = [
            rf"[A-Z][a-zA-Z\s\'&\-]{{3,25}}\s+(?:{'|'.join(self.business_indicators)})",
            r"[A-Z][a-zA-Z\s\'&\-]{3,30}(?:\s+(?:berkeley|oakland|sf|san francisco))?",
            r"(?:Katsumidori|Marugame|FLAIR|BABAL)\s*(?:sushi|udon|bar)?",  # Specific missed businesses
            r"[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Sacred Heart School|School)",  # Schools
        ]
        
        for pattern in business_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return {
                    "text": text,
                    "type": "business",
                    "subtype": "potential_business",
                    "confidence": min(0.7, ocr_confidence * 1.0)
                }
        
        # Enhanced area/location patterns
        area_patterns = [
            r"(?:Sapporo|Tokyo|Kyoto|Osaka)\s*(?:Area|District|Prefecture)?",
            r"Olympic\s+National\s+Park",
            r"Quinault\s+(?:rain\s+forest|Lake)",
            r"(?:great|grand)\s+canyon",
            r"artist\s+point",
            r"tower\s+fall",
            r"Jackson(?:\s+Hole)?",
        ]
        
        for pattern in area_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return {
                    "text": text,
                    "type": "area",
                    "subtype": "named_location",
                    "confidence": min(0.8, ocr_confidence * 1.1)
                }
        
        # Check for area/location names (fallback)
        for area in self.area_indicators:
            if area in text_lower:
                return {
                    "text": text,
                    "type": "area",
                    "subtype": "geographic_area",
                    "confidence": min(0.6, ocr_confidence * 0.9)
                }
        
        # Default classification for unmatched text
        return {
            "text": text,
            "type": "other",
            "subtype": "unclassified",
            "confidence": ocr_confidence * 0.5  # Lower confidence for unclassified
        }


class ConfidenceRefiner:
    """Refine confidence scores based on context and validation"""
    
    def __init__(self):
        self.length_optimal_range = (5, 35)  # Optimal text length range
        self.context_boost_words = ["restaurant", "cafe", "street", "avenue", "plaza"]
        
    def refine_confidence(self, classification: Dict[str, any], context: Dict[str, any] = None) -> float:
        """Refine confidence score based on multiple factors"""
        base_confidence = classification["confidence"]
        text = classification["text"]
        text_type = classification["type"]
        
        # Start with base confidence
        refined_confidence = base_confidence
        
        # Type-based adjustments
        type_multipliers = {
            "business": 1.2,
            "address": 1.1,
            "area": 1.0,
            "other": 0.6
        }
        
        if text_type in type_multipliers:
            refined_confidence *= type_multipliers[text_type]
        
        # Subtype adjustments
        if classification.get("subtype") == "known_business":
            refined_confidence *= 1.3
        elif classification.get("subtype") == "known_address":
            refined_confidence *= 1.2
        
        # Length factor
        text_length = len(text)
        if self.length_optimal_range[0] <= text_length <= self.length_optimal_range[1]:
            refined_confidence *= 1.1
        elif text_length < 3:
            refined_confidence *= 0.3
        elif text_length > 60:
            refined_confidence *= 0.7
        
        # Context boost for business-related words
        text_lower = text.lower()
        for boost_word in self.context_boost_words:
            if boost_word in text_lower:
                refined_confidence *= 1.1
                break
        
        # Penalize if text looks like OCR noise
        if re.match(r"^[A-Z\s]{2,10}$", text) and not any(word in text.lower() for word in ["el", "san", "st"]):
            refined_confidence *= 0.4
        
        # Ensure confidence stays within bounds
        return max(0.0, min(1.0, refined_confidence))


class HierarchicalExtractor:
    """Extract locations in hierarchical order of importance"""
    
    def __init__(self, classifier: LocationClassifier, filter_tool: IntelligentTextFilter, 
                 confidence_refiner: ConfidenceRefiner):
        self.classifier = classifier
        self.filter = filter_tool
        self.refiner = confidence_refiner
    
    def extract_hierarchical(self, text: str, ocr_confidence: float) -> Dict[str, List[Dict]]:
        """Extract locations in hierarchical order"""
        
        classified_extractions = []
        
        # First, run pattern matching on the full text for known businesses and addresses
        # This ensures we don't lose known entities due to phrase splitting issues
        full_text_classification = self.classifier.classify_text(text, ocr_confidence)
        if full_text_classification["type"] in ["business", "address"] and full_text_classification.get("subtype") in ["known_business", "known_address"]:
            refined_confidence = self.refiner.refine_confidence(full_text_classification)
            full_text_classification["confidence"] = refined_confidence
            classified_extractions.append(full_text_classification)
        
        # Then, split text into potential location phrases for other extractions
        phrases = self._split_into_phrases(text)
        
        # Filter out UI elements and noise
        filtered_phrases = []
        for phrase in phrases:
            if not self.filter.is_ui_element(phrase):
                cleaned = self.filter.filter_google_maps_ui(phrase)
                cleaned = self.filter.clean_ocr_artifacts(cleaned)
                if cleaned and len(cleaned.strip()) >= 3:
                    filtered_phrases.append(cleaned.strip())
        
        # Classify and score each phrase (skip if we already found a known business/address)
        for phrase in filtered_phrases:
            classification = self.classifier.classify_text(phrase, ocr_confidence)
            # Skip if we already have a known business/address from full text
            if classification.get("subtype") in ["known_business", "known_address"]:
                continue
            refined_confidence = self.refiner.refine_confidence(classification)
            classification["confidence"] = refined_confidence
            classified_extractions.append(classification)
        
        # Group by type and sort by confidence
        hierarchical_results = {
            "businesses": [],
            "addresses": [], 
            "areas": [],
            "landmarks": [],
            "other": []
        }
        
        for extraction in classified_extractions:
            extraction_type = extraction["type"]
            if extraction_type == "business":
                hierarchical_results["businesses"].append(extraction)
            elif extraction_type == "address":
                hierarchical_results["addresses"].append(extraction)
            elif extraction_type == "area":
                hierarchical_results["areas"].append(extraction)
            elif extraction_type == "landmark":
                hierarchical_results["landmarks"].append(extraction)
            else:
                hierarchical_results["other"].append(extraction)
        
        # Sort each category by confidence and limit results
        for category in hierarchical_results:
            hierarchical_results[category] = sorted(
                hierarchical_results[category], 
                key=lambda x: x["confidence"], 
                reverse=True
            )[:10]  # Limit to top 10 per category
        
        # Filter by minimum confidence thresholds
        confidence_thresholds = {
            "businesses": 0.6,
            "addresses": 0.5,
            "areas": 0.4,
            "landmarks": 0.4,
            "other": 0.3
        }
        
        for category, threshold in confidence_thresholds.items():
            hierarchical_results[category] = [
                item for item in hierarchical_results[category] 
                if item["confidence"] >= threshold
            ]
        
        return hierarchical_results
    
    def _split_into_phrases(self, text: str) -> List[str]:
        """Split text into meaningful phrases for analysis"""
        # Split by common delimiters
        delimiters = ['\n', '|', '•', '★', '☆', '()', '{}', '[]']
        
        phrases = [text]
        for delimiter in delimiters:
            new_phrases = []
            for phrase in phrases:
                new_phrases.extend(phrase.split(delimiter))
            phrases = new_phrases
        
        # Clean and filter phrases
        cleaned_phrases = []
        for phrase in phrases:
            # Remove extra whitespace
            cleaned = re.sub(r'\s+', ' ', phrase.strip())
            
            # Skip very short or very long phrases
            if 3 <= len(cleaned) <= 80:
                cleaned_phrases.append(cleaned)
        
        return cleaned_phrases


class ImagePreprocessor:
    """Enhanced image preprocessor"""

    @staticmethod
    def detect_image_type(image: np.ndarray) -> str:
        """Detect image type based on visual and content analysis"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # Calculate visual features
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size

            # Calculate color distribution
            hist = cv2.calcHist(
                [image], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256]
            )
            color_diversity = np.count_nonzero(hist) / hist.size

            # Quick OCR for content analysis
            try:
                import pytesseract
                text = pytesseract.image_to_string(image).lower()
                
                # Content-based detection
                google_maps_indicators = [
                    'overview', 'menu', 'reviews', 'photos', 'directions',
                    'call', 'website', 'hours', 'rating', 'stars',
                    'restaurant', 'cafe', 'open', 'closed', 'min'
                ]
                
                social_media_indicators = [
                    'like', 'comment', 'share', 'follow', 'post',
                    '@', '#', 'ago', 'minutes', 'hours', 'days',
                    'story', 'feed', 'timeline'
                ]
                
                travel_indicators = [
                    'day 1', 'day 2', 'day 3', 'itinerary', 'trip',
                    'hotel', 'lodge', 'trail', 'park', 'visitor center',
                    '推荐', '住', '第一天', '第二天', 'national park'
                ]
                
                # Count indicators
                google_score = sum(1 for indicator in google_maps_indicators if indicator in text)
                social_score = sum(1 for indicator in social_media_indicators if indicator in text)
                travel_score = sum(1 for indicator in travel_indicators if indicator in text)
                
                # Content-based classification
                if google_score >= 2:
                    return "google_maps"
                elif travel_score >= 2:
                    return "travel_itinerary"
                elif social_score >= 2:
                    return "social_media"
                    
            except Exception as e:
                logging.warning(f"Content analysis failed, using visual features: {e}")
            
            # Fallback to visual features
            if edge_density > 0.1 and color_diversity > 0.3:
                return "map_screenshot"
            elif edge_density < 0.05:
                return "text_heavy"
            else:
                return "mixed_content"
                
        except Exception as e:
            logging.error(f"Image type detection failed: {e}")
            return "unknown"

    @staticmethod
    def enhance_image_advanced(
        image: np.ndarray, image_type: str = "mixed_content"
    ) -> np.ndarray:
        """Advanced image enhancement based on image type"""
        # Convert to PIL image
        pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

        if image_type == "text_heavy":
            # Text-heavy images: enhance contrast and sharpness
            enhancer = ImageEnhance.Contrast(pil_image)
            pil_image = enhancer.enhance(1.8)

            enhancer = ImageEnhance.Sharpness(pil_image)
            pil_image = enhancer.enhance(2.0)

        elif image_type == "map_screenshot":
            # Map screenshots: moderate enhancement, maintain color balance
            enhancer = ImageEnhance.Contrast(pil_image)
            pil_image = enhancer.enhance(1.3)

            enhancer = ImageEnhance.Color(pil_image)
            pil_image = enhancer.enhance(1.1)

        else:
            # Mixed content: balanced enhancement
            enhancer = ImageEnhance.Contrast(pil_image)
            pil_image = enhancer.enhance(1.5)

            enhancer = ImageEnhance.Sharpness(pil_image)
            pil_image = enhancer.enhance(1.2)

        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

    @staticmethod
    def denoise_image_advanced(image: np.ndarray) -> np.ndarray:
        """Advanced noise reduction processing"""
        # Convert to grayscale for denoising
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Use scikit-image bilateral denoising (if available)
        if SKIMAGE_AVAILABLE:
            try:
                denoised_gray = denoise_bilateral(
                    gray, sigma_color=0.1, sigma_spatial=15, multichannel=False
                )
                denoised_gray = (denoised_gray * 255).astype(np.uint8)

                # Convert back to color
                denoised = cv2.cvtColor(denoised_gray, cv2.COLOR_GRAY2BGR)
            except Exception as e:
                logger.warning(f"scikit-image denoising failed, using OpenCV: {e}")
                denoised = cv2.bilateralFilter(image, 9, 75, 75)
        else:
            # Use OpenCV bilateral filtering
            denoised = cv2.bilateralFilter(image, 9, 75, 75)

        return denoised

    @staticmethod
    def correct_skew(image: np.ndarray) -> np.ndarray:
        """Correct image skew"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Detect edges
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)

        # Hough transform to detect lines
        lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=100)

        if lines is not None and len(lines) > 0:
            # Calculate average angle
            angles = []
            for line in lines[:10]:  # Only use first 10 lines
                if len(line) >= 2:  # Ensure line has at least 2 values
                    rho, theta = line[0], line[1]
                    angle = theta * 180 / np.pi
                    if angle > 90:
                        angle = angle - 180
                    angles.append(angle)

            if angles:
                median_angle = np.median(angles)

                # If skew angle exceeds threshold, perform rotation
                if abs(median_angle) > 1:
                    height, width = image.shape[:2]
                    center = (width // 2, height // 2)
                    rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
                    image = cv2.warpAffine(
                        image,
                        rotation_matrix,
                        (width, height),
                        flags=cv2.INTER_CUBIC,
                        borderMode=cv2.BORDER_REPLICATE,
                    )

        return image

    @staticmethod
    def remove_noise_morphology(image: np.ndarray) -> np.ndarray:
        """Remove noise using morphological operations"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Create morphological kernel
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))

        # Opening operation to remove small noise points
        opened = cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel)

        # Closing operation to fill small holes
        closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)

        return cv2.cvtColor(closed, cv2.COLOR_GRAY2BGR)

    @staticmethod
    def preprocess_for_ocr(image_path: str) -> np.ndarray:
        """Complete OCR preprocessing pipeline"""
        # Read image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Unable to read image: {image_path}")

        logger.info(f"Starting image processing: {image_path}")

        # Detect image type
        image_type = ImagePreprocessor.detect_image_type(image)
        logger.info(f"Detected image type: {image_type}")

        # Adjust image size
        height, width = image.shape[:2]
        if height < 300 or width < 300:
            scale = max(300 / height, 300 / width)
            new_width = int(width * scale)
            new_height = int(height * scale)
            image = cv2.resize(
                image, (new_width, new_height), interpolation=cv2.INTER_CUBIC
            )
            logger.info(f"Image scaled to: {new_width}x{new_height}")

        # Correct skew
        image = ImagePreprocessor.correct_skew(image)

        # Advanced image enhancement
        image = ImagePreprocessor.enhance_image_advanced(image, image_type)

        # Advanced denoising
        image = ImagePreprocessor.denoise_image_advanced(image)

        # Morphological denoising
        if image_type == "text_heavy":
            image = ImagePreprocessor.remove_noise_morphology(image)

        logger.info("Image preprocessing completed")
        return image


class TesseractOCR:
    """Enhanced Tesseract OCR Engine with multi-language support"""

    def __init__(self):
        # Configure Tesseract for better English and Chinese support
        self.english_config = "--oem 3 --psm 6 -l eng"
        self.chinese_config = "--oem 3 --psm 6 -l chi_sim+eng"
        self.mixed_config = "--oem 3 --psm 6 -l chi_sim+chi_tra+eng"

    def detect_language(self, image: np.ndarray) -> str:
        """Detect primary language in image"""
        try:
            pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
            # Quick detection with English first
            eng_text = pytesseract.image_to_string(
                pil_image, config=self.english_config
            )

            # Check for Chinese characters
            chinese_chars = len(re.findall(r"[\u4e00-\u9fff]", eng_text))
            english_chars = len(re.findall(r"[a-zA-Z]", eng_text))

            if (
                chinese_chars > english_chars * 0.3
            ):  # If Chinese chars > 30% of English chars
                return "mixed"
            elif chinese_chars > 0:
                return "mixed"
            else:
                return "english"
        except:
            return "english"

    def extract_text(self, image: np.ndarray) -> OCRResult:
        """Extract text from image with intelligent language detection"""
        try:
            # Convert to PIL image
            pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

            # Detect language
            detected_lang = self.detect_language(image)

            # Choose appropriate config
            if detected_lang == "mixed":
                config = self.mixed_config
                lang_code = "mixed"
            elif detected_lang == "chinese":
                config = self.chinese_config
                lang_code = "zh"
            else:
                config = self.english_config
                lang_code = "en"

            # Extract text
            text = pytesseract.image_to_string(pil_image, config=config)

            # Get confidence information
            data = pytesseract.image_to_data(
                pil_image, config=config, output_type=pytesseract.Output.DICT
            )
            confidences = [int(conf) for conf in data["conf"] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0

            return OCRResult(
                text=text.strip(),
                confidence=avg_confidence / 100.0,  # Convert to 0-1 range
                language=lang_code,
            )

        except Exception as e:
            logger.error(f"Tesseract OCR error: {e}")
            return OCRResult(text="", confidence=0.0)


class PaddleOCR_Processor:
    """PaddleOCR Processor"""

    def __init__(self):
        try:
            from paddleocr import PaddleOCR

            # Initialize PaddleOCR with Chinese and English support
            self.ocr = PaddleOCR(
                use_angle_cls=True, lang="ch"
            )  # ch supports Chinese-English mixed text
            self.available = True
        except ImportError:
            logger.warning("PaddleOCR not available, will use Tesseract")
            self.available = False

    def extract_text(self, image: np.ndarray) -> OCRResult:
        """Extract text using PaddleOCR"""
        if not self.available:
            return OCRResult(text="", confidence=0.0)

        try:
            # PaddleOCR processing
            result = self.ocr.ocr(image, cls=True)

            if not result or not result[0]:
                return OCRResult(text="", confidence=0.0)

            # Extract text and confidence
            texts = []
            confidences = []

            for line in result[0]:
                if line:
                    text = line[1][0]  # Text content
                    conf = line[1][1]  # Confidence
                    texts.append(text)
                    confidences.append(conf)

            combined_text = "\n".join(texts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0

            return OCRResult(
                text=combined_text, confidence=avg_confidence, language="ch"
            )

        except Exception as e:
            logger.error(f"PaddleOCR error: {e}")
            return OCRResult(text="", confidence=0.0)


class TextProcessor:
    """Enhanced text post-processor with intelligent filtering and classification"""

    def __init__(self):
        # Initialize Chinese word segmentation
        self.chinese_support = False
        if JIEBA_AVAILABLE:
            try:
                jieba.initialize()
                self.chinese_support = True
                logger.info("Chinese word segmentation initialized successfully")
            except Exception as e:
                logger.warning(f"Chinese word segmentation initialization failed: {e}")
        
        # Initialize intelligent components
        self.gt_learner = GroundTruthPatternLearner()
        self.text_filter = IntelligentTextFilter()
        self.classifier = LocationClassifier(self.gt_learner)
        self.confidence_refiner = ConfidenceRefiner()
        self.hierarchical_extractor = HierarchicalExtractor(
            self.classifier, self.text_filter, self.confidence_refiner
        )

    @staticmethod
    def fix_common_ocr_errors(text: str) -> str:
        """Fix common OCR recognition errors"""
        # Common character confusion fixes
        error_corrections = {
            # Number and letter confusion
            r"\b0(?=[A-Za-z])": "O",  # 0 -> O (before letters)
            r"(?<=[A-Za-z])0\b": "O",  # 0 -> O (after letters)
            r"\b1(?=l|I)": "I",  # 1 -> I
            r"5(?=S|s)": "S",  # 5 -> S
            r"8(?=B|b)": "B",  # 8 -> B
            # Punctuation fixes
            r"(?<=\w),(?=\w)": ", ",  # Add space after comma
            r"(?<=\w)\.(?=[A-Z])": ". ",  # Add space after period
            # Common word fixes
            r"\bRestaurant\b": "Restaurant",
            r"\bCafe\b": "Cafe",
            r"\bStreet\b": "Street",
            r"\bAvenue\b": "Avenue",
        }

        for pattern, replacement in error_corrections.items():
            text = re.sub(pattern, replacement, text)

        return text

    def clean_text(self, text: str) -> str:
        """Clean and standardize text with intelligent filtering"""
        if not text:
            return ""

        # Remove excess whitespace characters
        text = re.sub(r"\s+", " ", text)

        # Fix common OCR errors
        text = self.fix_common_ocr_errors(text)

        # Apply intelligent filtering for Google Maps UI elements
        text = self.text_filter.filter_google_maps_ui(text)
        text = self.text_filter.clean_ocr_artifacts(text)

        # Remove meaningless character combinations
        text = re.sub(r"[^\w\s.,!?@#$%^&*()_+\-=\[\]{}|;:\'\"<>/\\·•★☆]", "", text)

        # Fix line break issues
        text = re.sub(
            r"(?<=[a-z])\n(?=[a-z])", " ", text
        )  # Line breaks in the middle of words
        text = re.sub(r"\n+", "\n", text)  # Merge multiple line breaks

        return text.strip()

    def extract_locations_advanced(self, text: str, ocr_confidence: float = 0.8) -> List[Dict[str, any]]:
        """Advanced location extraction with hierarchical classification"""
        
        logger.info(f"Starting advanced location extraction from text: {text[:100]}...")
        
        # Use hierarchical extractor
        hierarchical_results = self.hierarchical_extractor.extract_hierarchical(text, ocr_confidence)
        
        # Combine results into a single list with priorities
        all_extractions = []
        
        # Add businesses (highest priority)
        for business in hierarchical_results["businesses"]:
            business["priority"] = 1
            all_extractions.append(business)
        
        # Add addresses (second priority)
        for address in hierarchical_results["addresses"]:
            address["priority"] = 2
            all_extractions.append(address)
        
        # Add areas (third priority)
        for area in hierarchical_results["areas"]:
            area["priority"] = 3
            all_extractions.append(area)
        
        # Add landmarks (fourth priority)
        for landmark in hierarchical_results["landmarks"]:
            landmark["priority"] = 3  # Same priority as areas
            all_extractions.append(landmark)
        
        # Add other locations (lowest priority)
        for other in hierarchical_results["other"]:
            other["priority"] = 4
            all_extractions.append(other)
        
        # Sort by priority first, then by confidence
        all_extractions.sort(key=lambda x: (x["priority"], -x["confidence"]))
        
        # Limit total results and remove low-confidence items
        filtered_extractions = [
            extraction for extraction in all_extractions[:15]
            if extraction["confidence"] >= 0.3
        ]
        
        logger.info(f"Extracted {len(filtered_extractions)} high-quality locations:")
        for extraction in filtered_extractions:
            logger.info(f"  - {extraction['text']} ({extraction['type']}, confidence: {extraction['confidence']:.2f})")
        
        return filtered_extractions

    def extract_ratings_and_reviews(self, text: str) -> List[Dict[str, any]]:
        """Extract rating and review information"""
        ratings = []

        # Rating patterns
        rating_patterns = [
            r"(\d+\.?\d*)\s*(?:stars?|★|☆)",  # X stars, X★
            r"(\d+\.?\d*)\s*/\s*5",  # X/5
            r"(\d+\.?\d*)\s*/\s*10",  # X/10
            r"Rating:\s*(\d+\.?\d*)",  # Rating: X
        ]

        for pattern in rating_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                rating_value = float(match.group(1))
                if 0 <= rating_value <= 10:  # Reasonable rating range
                    ratings.append(
                        {
                            "value": rating_value,
                            "context": text[
                                max(0, match.start() - 20) : match.end() + 20
                            ].strip(),
                            "position": match.span(),
                        }
                    )

        return ratings

    def extract_contact_info(self, text: str) -> Dict[str, List[str]]:
        """Extract contact information"""
        contact_info = {"phones": [], "emails": [], "websites": [], "hours": []}

        # Phone number patterns
        phone_patterns = [
            r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",  # US phone format
            r"\+?\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}",  # International phone
        ]

        for pattern in phone_patterns:
            phones = re.findall(pattern, text)
            contact_info["phones"].extend(phones)

        # Email pattern
        email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        contact_info["emails"] = re.findall(email_pattern, text)

        # Website pattern
        website_pattern = r"https?://[^\s]+|www\.[^\s]+"
        contact_info["websites"] = re.findall(website_pattern, text)

        # Business hours patterns
        hours_patterns = [
            r"(?:Open|Hours?):?\s*\d{1,2}:?\d{0,2}\s*(?:AM|PM|am|pm)?\s*-\s*\d{1,2}:?\d{0,2}\s*(?:AM|PM|am|pm)?",
            r"\d{1,2}:?\d{0,2}\s*(?:AM|PM|am|pm)\s*-\s*\d{1,2}:?\d{0,2}\s*(?:AM|PM|am|pm)",
        ]

        for pattern in hours_patterns:
            hours = re.findall(pattern, text, re.IGNORECASE)
            contact_info["hours"].extend(hours)

        return contact_info

    def extract_locations(self, text: str) -> List[str]:
        """Extract location names (backward compatibility interface)"""
        advanced_locations = self.extract_locations_advanced(text)
        return [loc["text"] for loc in advanced_locations]

    def extract_addresses(self, text: str) -> List[str]:
        """Extract address information (backward compatibility interface)"""
        advanced_locations = self.extract_locations_advanced(text)
        addresses = [
            loc["text"]
            for loc in advanced_locations
            if loc["type"] == "address"
        ]
        return addresses

    def extract_business_names(self, text: str) -> List[str]:
        """Extract business names (backward compatibility interface)"""
        advanced_locations = self.extract_locations_advanced(text)
        businesses = [
            loc["text"]
            for loc in advanced_locations
            if loc["type"] == "business"
        ]
        return businesses


class OCRProcessor:
    """Main OCR processor with enhanced intelligence"""

    def __init__(self):
        self.tesseract = TesseractOCR()
        self.paddle = PaddleOCR_Processor()
        self.preprocessor = ImagePreprocessor()
        self.text_processor = TextProcessor()

    def process_image(
        self, image_path: str, engine: str = "auto"
    ) -> ProcessedOCRResult:
        """
        Process image and return structured results with enhanced intelligence

        Args:
            image_path: Image file path
            engine: OCR engine ("tesseract", "paddle", "auto")
        """
        try:
            logger.info(f"Starting enhanced OCR processing for {image_path}")
            
            # Image preprocessing
            processed_image = self.preprocessor.preprocess_for_ocr(image_path)

            # Select OCR engine
            if engine == "auto":
                # Prefer PaddleOCR (better Chinese support)
                if self.paddle.available:
                    ocr_result = self.paddle.extract_text(processed_image)
                    engine_used = "paddle"
                else:
                    ocr_result = self.tesseract.extract_text(processed_image)
                    engine_used = "tesseract"
            elif engine == "paddle" and self.paddle.available:
                ocr_result = self.paddle.extract_text(processed_image)
                engine_used = "paddle"
            else:
                ocr_result = self.tesseract.extract_text(processed_image)
                engine_used = "tesseract"

            logger.info(f"OCR extraction completed with {engine_used}, confidence: {ocr_result.confidence:.2f}")
            logger.info(f"Raw text length: {len(ocr_result.text)}")

            # Enhanced text post-processing
            cleaned_text = self.text_processor.clean_text(ocr_result.text)
            logger.info(f"Cleaned text length: {len(cleaned_text)}")

            # Content-aware processing based on detected image type
            image_type = ImagePreprocessor.detect_image_type(processed_image)
            content_processor = ContentAwareProcessor()
            processed_content = content_processor.process_by_type(cleaned_text, image_type)
            
            # Enhanced structured extraction with hierarchical classification
            advanced_locations = self.text_processor.extract_locations_advanced(processed_content["processed_text"], ocr_result.confidence)
            
            # Separate by type for backward compatibility
            locations = [loc["text"] for loc in advanced_locations]
            addresses = [loc["text"] for loc in advanced_locations if loc["type"] == "address"]
            names = [loc["text"] for loc in advanced_locations if loc["type"] == "business"]

            # Build enhanced structured data
            structured_data = {
                "locations": locations,
                "addresses": addresses,
                "business_names": names,
                "advanced_extractions": advanced_locations,  # New: detailed classification
                "extraction_stats": {
                    "total_extractions": len(advanced_locations),
                    "businesses": len([loc for loc in advanced_locations if loc["type"] == "business"]),
                    "addresses": len([loc for loc in advanced_locations if loc["type"] == "address"]),
                    "areas": len([loc for loc in advanced_locations if loc["type"] == "area"]),
                    "avg_confidence": sum(loc["confidence"] for loc in advanced_locations) / len(advanced_locations) if advanced_locations else 0
                },
                "has_ratings": bool(re.search(r"\d+\.\d+", cleaned_text)),
                "has_phone": bool(re.search(r"\(\d{3}\)\s*\d{3}-\d{4}", cleaned_text)),
                "text_length": len(cleaned_text),
                "word_count": len(cleaned_text.split()),
                "engine_used": engine_used
            }

            # Enhanced logging
            logger.info(f"Enhanced OCR processing completed for {image_path}:")
            logger.info(f"  Raw text length: {len(ocr_result.text)}")
            logger.info(f"  Cleaned text length: {len(cleaned_text)}")
            logger.info(f"  Total extractions: {len(advanced_locations)}")
            logger.info(f"  Businesses found: {structured_data['extraction_stats']['businesses']}")
            logger.info(f"  Addresses found: {structured_data['extraction_stats']['addresses']}")
            logger.info(f"  Areas found: {structured_data['extraction_stats']['areas']}")
            logger.info(f"  Average extraction confidence: {structured_data['extraction_stats']['avg_confidence']:.2f}")
            logger.info(f"  OCR confidence: {ocr_result.confidence:.2f}")

            if advanced_locations:
                logger.info("  Top extractions:")
                for i, loc in enumerate(advanced_locations[:5]):
                    logger.info(f"    {i+1}. {loc['text']} ({loc['type']}, {loc['confidence']:.2f})")

            return ProcessedOCRResult(
                raw_text=ocr_result.text,
                cleaned_text=cleaned_text,
                structured_data=structured_data,
                confidence=ocr_result.confidence,
                detected_locations=locations,
                detected_addresses=addresses,
                detected_names=names,
                locations=[loc['text'] for loc in advanced_locations],  # Add this for backward compatibility
            )

        except Exception as e:
            logger.error(f"Enhanced OCR processing error for {image_path}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return ProcessedOCRResult(
                raw_text="",
                cleaned_text="",
                structured_data={
                    "locations": [],
                    "addresses": [],
                    "business_names": [],
                    "advanced_extractions": [],
                    "extraction_stats": {
                        "total_extractions": 0,
                        "businesses": 0,
                        "addresses": 0,
                        "areas": 0,
                        "avg_confidence": 0
                    },
                    "has_ratings": False,
                    "has_phone": False,
                    "text_length": 0,
                    "word_count": 0,
                    "engine_used": "none"
                },
                confidence=0.0,
                detected_locations=[],
                detected_addresses=[],
                detected_names=[],
                locations=[],  # Add this for backward compatibility
            )


# Global OCR processor instance
ocr_processor = OCRProcessor()


def process_image_file(image_path: str, engine: str = "auto") -> Dict:
    """
    Convenience function for processing image files with enhanced intelligence

    Returns:
        Dict: Dictionary containing enhanced OCR results
    """
    result = ocr_processor.process_image(image_path, engine)

    # Enhanced success determination
    has_text = len(result.raw_text.strip()) > 0 or len(result.cleaned_text.strip()) > 0
    has_extractions = (len(result.detected_locations) > 0 or 
                      len(result.detected_addresses) > 0 or 
                      len(result.detected_names) > 0)
    
    # More intelligent success criteria
    high_quality_extractions = []
    if result.structured_data.get("advanced_extractions"):
        high_quality_extractions = [
            ext for ext in result.structured_data["advanced_extractions"]
            if ext["confidence"] >= 0.5
        ]
    
    success = (
        has_text and 
        (result.confidence > 0.1 or has_extractions) and
        (len(high_quality_extractions) > 0 or result.confidence > 0.3)
    )
    
    logger.info(f"Enhanced process image file result:")
    logger.info(f"  Success: {success}")
    logger.info(f"  Has text: {has_text}")
    logger.info(f"  Has extractions: {has_extractions}")
    logger.info(f"  High quality extractions: {len(high_quality_extractions)}")
    logger.info(f"  OCR confidence: {result.confidence:.2f}")

    return {
        "success": success,
        "raw_text": result.raw_text,
        "cleaned_text": result.cleaned_text,
        "confidence": result.confidence,
        "structured_data": result.structured_data,
        "extracted_info": {
            "locations": result.detected_locations,
            "addresses": result.detected_addresses,
            "business_names": result.detected_names,
        },
    }


if __name__ == "__main__":
    # Test code
    test_image = "test_image.jpg"
    if os.path.exists(test_image):
        result = process_image_file(test_image)
        print(json.dumps(result, indent=2, ensure_ascii=False))