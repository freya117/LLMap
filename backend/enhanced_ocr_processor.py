"""
Enhanced OCR Processor - Context Preservation Focus
Implements the Enhanced OCR + AI Pipeline strategy
"""

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageEnhance
import re
import json
from typing import List, Dict, Tuple, Optional, Any
import logging
from dataclasses import dataclass
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class TextChunk:
    """Structured text chunk with spatial context"""
    text: str
    spatial_context: str  # header, body, footer, list_item, etc.
    confidence: float
    bbox: Optional[Tuple[int, int, int, int]] = None  # (x, y, width, height)
    language: str = "mixed"
    chunk_type: str = "text"  # text, title, list_item, contact_info

@dataclass
class ContentTypeResult:
    """Content type detection result"""
    content_type: str  # social_media, travel_itinerary, map_screenshot, review, mixed
    confidence: float
    indicators: List[str]  # What indicated this content type
    language_detected: str  # en, zh, mixed

@dataclass
class EnhancedOCRResult:
    """Enhanced OCR result with context preservation"""
    raw_text: str
    structured_chunks: List[TextChunk]
    content_type: ContentTypeResult
    ocr_confidence: float
    processing_metadata: Dict[str, Any]

class ContentTypeDetector:
    """Detect content type from images and text"""
    
    def __init__(self):
        self.content_indicators = {
            'social_media': [
                'like', 'comment', 'share', 'follow', 'post', '@', '#',
                'ago', 'minutes', 'hours', 'days', 'story', 'feed',
                'timeline', 'retweet', 'favorite', 'instagram', 'facebook'
            ],
            'travel_itinerary': [
                'day 1', 'day 2', 'day 3', 'itinerary', 'trip', 'hotel',
                'lodge', 'trail', 'park', 'visitor center', 'national park',
                '推荐', '住', '第一天', '第二天', 'accommodation', 'check-in'
            ],
            'map_screenshot': [
                'directions', 'route', 'km', 'miles', 'min drive',
                'traffic', 'fastest route', 'avoid tolls', 'satellite',
                'terrain', 'transit', 'walking'
            ],
            'restaurant_review': [
                'rating', 'stars', 'review', 'menu', 'price', 'service',
                'food', 'atmosphere', 'recommend', 'delicious', 'tasty',
                'reservation', 'hours', 'open', 'closed'
            ],
            'business_listing': [
                'phone', 'website', 'hours', 'address', 'reviews',
                'rating', 'photos', 'menu', 'call', 'directions',
                'overview', 'about', 'contact'
            ]
        }
        
        self.language_patterns = {
            'chinese': re.compile(r'[\u4e00-\u9fff]+'),
            'japanese': re.compile(r'[\u3040-\u309f\u30a0-\u30ff]+'),
            'korean': re.compile(r'[\uac00-\ud7af]+'),
            'english': re.compile(r'[a-zA-Z]+')
        }
    
    def detect_content_type(self, image: np.ndarray, text: str = "") -> ContentTypeResult:
        """Detect content type from image and text"""
        
        # Visual analysis
        visual_indicators = self._analyze_visual_features(image)
        
        # Text analysis
        text_indicators = self._analyze_text_content(text)
        
        # Language detection
        language_detected = self._detect_language(text)
        
        # Combine indicators
        all_indicators = {**visual_indicators, **text_indicators}
        
        # Determine content type
        content_type, confidence = self._classify_content_type(all_indicators)
        
        return ContentTypeResult(
            content_type=content_type,
            confidence=confidence,
            indicators=list(all_indicators.keys()),
            language_detected=language_detected
        )
    
    def _analyze_visual_features(self, image: np.ndarray) -> Dict[str, float]:
        """Analyze visual features of the image"""
        indicators = {}
        
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            height, width = gray.shape
            
            # Calculate edge density
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size
            
            # Aspect ratio analysis
            aspect_ratio = width / height
            
            # Color analysis
            color_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            color_std = np.std(color_image)
            
            # Visual feature classification
            if edge_density > 0.15:
                indicators['high_edge_density'] = edge_density
            
            if aspect_ratio > 1.5:
                indicators['wide_aspect_ratio'] = aspect_ratio
            elif aspect_ratio < 0.7:
                indicators['tall_aspect_ratio'] = aspect_ratio
            
            if color_std > 50:
                indicators['colorful_content'] = color_std / 100
            
            # Screen-like characteristics
            if 0.4 < aspect_ratio < 0.6 and height > 1000:  # Phone screenshot
                indicators['mobile_screenshot'] = 0.8
            
        except Exception as e:
            logger.warning(f"Visual analysis failed: {e}")
        
        return indicators
    
    def _analyze_text_content(self, text: str) -> Dict[str, float]:
        """Analyze text content for type indicators"""
        indicators = {}
        text_lower = text.lower()
        
        for content_type, keywords in self.content_indicators.items():
            matches = sum(1 for keyword in keywords if keyword in text_lower)
            if matches > 0:
                # Calculate confidence based on number of matches
                confidence = min(matches / len(keywords), 1.0)
                indicators[f'{content_type}_keywords'] = confidence
        
        return indicators
    
    def _detect_language(self, text: str) -> str:
        """Detect primary language in text"""
        language_scores = {}
        
        for lang, pattern in self.language_patterns.items():
            matches = len(pattern.findall(text))
            if matches > 0:
                language_scores[lang] = matches
        
        if not language_scores:
            return "unknown"
        
        # Check for mixed content
        if len(language_scores) > 1:
            total_chars = sum(language_scores.values())
            primary_lang = max(language_scores, key=language_scores.get)
            primary_ratio = language_scores[primary_lang] / total_chars
            
            if primary_ratio < 0.7:  # Mixed content
                return "mixed"
        
        return max(language_scores, key=language_scores.get) if language_scores else "english"
    
    def _classify_content_type(self, indicators: Dict[str, float]) -> Tuple[str, float]:
        """Classify content type based on indicators"""
        
        type_scores = {}
        
        # Score each content type
        for indicator, score in indicators.items():
            for content_type in self.content_indicators.keys():
                if content_type in indicator:
                    if content_type not in type_scores:
                        type_scores[content_type] = 0
                    type_scores[content_type] += score
        
        # Add visual indicators
        if 'mobile_screenshot' in indicators:
            type_scores['social_media'] = type_scores.get('social_media', 0) + 0.3
        
        if 'wide_aspect_ratio' in indicators:
            type_scores['map_screenshot'] = type_scores.get('map_screenshot', 0) + 0.2
        
        # Determine best match
        if not type_scores:
            return "mixed_content", 0.5
        
        best_type = max(type_scores, key=type_scores.get)
        confidence = min(type_scores[best_type], 1.0)
        
        return best_type, confidence

class ContextualChunker:
    """Create structured chunks while preserving context"""
    
    def __init__(self):
        self.spatial_patterns = {
            'header': [
                r'^.{1,50}$',  # Short lines at top
                r'^\d{1,2}:\d{2}',  # Time stamps
                r'^Day \d+',  # Day headers
            ],
            'list_item': [
                r'^\s*[-•*]\s+',  # Bullet points
                r'^\s*\d+\.\s+',  # Numbered lists
                r'^\s*[A-Z][a-z]+:',  # Label: content
            ],
            'contact_info': [
                r'\(\d{3}\)\s*\d{3}-\d{4}',  # Phone numbers
                r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Emails
                r'https?://[^\s]+',  # URLs
            ],
            'address': [
                r'\d+\s+[A-Za-z\s]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Pl)',
                r'[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}',  # City, State ZIP
            ]
        }
    
    def create_chunks(self, text: str, content_type: str) -> List[TextChunk]:
        """Create structured chunks from text"""
        
        # Split text into lines
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        chunks = []
        current_section = "body"
        
        for i, line in enumerate(lines):
            # Determine spatial context
            spatial_context = self._determine_spatial_context(line, i, len(lines))
            
            # Determine chunk type
            chunk_type = self._determine_chunk_type(line)
            
            # Calculate confidence based on line quality
            confidence = self._calculate_line_confidence(line)
            
            # Create chunk
            chunk = TextChunk(
                text=line,
                spatial_context=spatial_context,
                confidence=confidence,
                language=self._detect_line_language(line),
                chunk_type=chunk_type
            )
            
            chunks.append(chunk)
        
        # Post-process chunks to merge related content
        merged_chunks = self._merge_related_chunks(chunks)
        
        return merged_chunks
    
    def _determine_spatial_context(self, line: str, position: int, total_lines: int) -> str:
        """Determine spatial context of a line"""
        
        # Check for specific patterns
        for context, patterns in self.spatial_patterns.items():
            for pattern in patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    return context
        
        # Position-based context
        if position < total_lines * 0.2:
            return "header"
        elif position > total_lines * 0.8:
            return "footer"
        else:
            return "body"
    
    def _determine_chunk_type(self, line: str) -> str:
        """Determine the type of content in the line"""
        
        # Check for contact info
        if re.search(r'\(\d{3}\)\s*\d{3}-\d{4}|@|https?://', line):
            return "contact_info"
        
        # Check for addresses
        if re.search(r'\d+\s+[A-Za-z\s]+(?:St|Ave|Rd|Blvd)', line, re.IGNORECASE):
            return "address"
        
        # Check for titles/headers
        if len(line) < 50 and line.isupper():
            return "title"
        
        # Check for list items
        if re.search(r'^\s*[-•*]\s+|^\s*\d+\.\s+', line):
            return "list_item"
        
        return "text"
    
    def _calculate_line_confidence(self, line: str) -> float:
        """Calculate confidence score for a line"""
        
        # Base confidence
        confidence = 0.7
        
        # Length factor
        if 5 <= len(line) <= 100:
            confidence += 0.1
        elif len(line) < 3:
            confidence -= 0.3
        
        # Character quality
        alpha_ratio = sum(c.isalnum() for c in line) / len(line) if line else 0
        confidence += (alpha_ratio - 0.5) * 0.2
        
        # Special characters (OCR artifacts)
        artifact_chars = sum(1 for c in line if c in '|{}[]()<>@#$%^&*')
        if artifact_chars > len(line) * 0.3:
            confidence -= 0.2
        
        return max(0.1, min(1.0, confidence))
    
    def _detect_line_language(self, line: str) -> str:
        """Detect language of a single line"""
        
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', line))
        english_chars = len(re.findall(r'[a-zA-Z]', line))
        
        if chinese_chars > english_chars:
            return "chinese"
        elif english_chars > 0:
            return "english"
        else:
            return "mixed"
    
    def _merge_related_chunks(self, chunks: List[TextChunk]) -> List[TextChunk]:
        """Merge related chunks to preserve context"""
        
        merged = []
        i = 0
        
        while i < len(chunks):
            current_chunk = chunks[i]
            
            # Look for chunks to merge
            merge_candidates = []
            j = i + 1
            
            while j < len(chunks) and j < i + 3:  # Look ahead max 3 chunks
                next_chunk = chunks[j]
                
                # Merge criteria
                if (current_chunk.spatial_context == next_chunk.spatial_context and
                    current_chunk.chunk_type == next_chunk.chunk_type and
                    len(current_chunk.text) + len(next_chunk.text) < 200):
                    merge_candidates.append(next_chunk)
                    j += 1
                else:
                    break
            
            # Create merged chunk if candidates found
            if merge_candidates:
                merged_text = current_chunk.text
                for candidate in merge_candidates:
                    merged_text += " " + candidate.text
                
                merged_chunk = TextChunk(
                    text=merged_text,
                    spatial_context=current_chunk.spatial_context,
                    confidence=sum(c.confidence for c in [current_chunk] + merge_candidates) / (len(merge_candidates) + 1),
                    language=current_chunk.language,
                    chunk_type=current_chunk.chunk_type
                )
                merged.append(merged_chunk)
                i = j
            else:
                merged.append(current_chunk)
                i += 1
        
        return merged

class EnhancedOCRProcessor:
    """Main enhanced OCR processor with context preservation"""
    
    def __init__(self):
        self.content_detector = ContentTypeDetector()
        self.chunker = ContextualChunker()
        
        # OCR engines
        self.tesseract_available = True
        try:
            import paddleocr
            self.paddle_ocr = paddleocr.PaddleOCR(use_angle_cls=True, lang='ch')
            self.paddle_available = True
        except ImportError:
            self.paddle_available = False
            logger.warning("PaddleOCR not available, using Tesseract only")
    
    def process_image(self, image_path: str) -> EnhancedOCRResult:
        """Process image with enhanced OCR pipeline"""
        
        logger.info(f"Starting enhanced OCR processing: {image_path}")
        
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not load image: {image_path}")
        
        # Detect content type
        content_type_result = self.content_detector.detect_content_type(image)
        logger.info(f"Detected content type: {content_type_result.content_type} "
                   f"(confidence: {content_type_result.confidence:.2f})")
        
        # Extract text using appropriate OCR engine
        raw_text, ocr_confidence = self._extract_text_with_best_engine(
            image, content_type_result
        )
        
        # Create structured chunks
        structured_chunks = self.chunker.create_chunks(
            raw_text, content_type_result.content_type
        )
        
        # Processing metadata
        processing_metadata = {
            'image_path': image_path,
            'image_size': image.shape,
            'content_type_indicators': content_type_result.indicators,
            'language_detected': content_type_result.language_detected,
            'total_chunks': len(structured_chunks),
            'ocr_engine_used': self._get_best_engine_name(content_type_result)
        }
        
        result = EnhancedOCRResult(
            raw_text=raw_text,
            structured_chunks=structured_chunks,
            content_type=content_type_result,
            ocr_confidence=ocr_confidence,
            processing_metadata=processing_metadata
        )
        
        logger.info(f"Enhanced OCR completed: {len(structured_chunks)} chunks, "
                   f"confidence: {ocr_confidence:.2f}")
        
        return result
    
    def _extract_text_with_best_engine(self, image: np.ndarray, 
                                     content_type: ContentTypeResult) -> Tuple[str, float]:
        """Extract text using the best OCR engine for the content type"""
        
        # Choose engine based on content type and language
        if (content_type.language_detected in ['chinese', 'mixed'] and 
            self.paddle_available):
            return self._extract_with_paddle(image)
        else:
            return self._extract_with_tesseract(image, content_type.language_detected)
    
    def _extract_with_paddle(self, image: np.ndarray) -> Tuple[str, float]:
        """Extract text using PaddleOCR"""
        try:
            result = self.paddle_ocr.ocr(image, cls=True)
            
            text_lines = []
            confidences = []
            
            for line in result:
                for word_info in line:
                    text = word_info[1][0]
                    confidence = word_info[1][1]
                    text_lines.append(text)
                    confidences.append(confidence)
            
            full_text = '\n'.join(text_lines)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            return full_text, avg_confidence
            
        except Exception as e:
            logger.error(f"PaddleOCR extraction failed: {e}")
            return self._extract_with_tesseract(image, "mixed")
    
    def _extract_with_tesseract(self, image: np.ndarray, language: str) -> Tuple[str, float]:
        """Extract text using Tesseract"""
        try:
            # Convert to PIL Image
            pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
            
            # Configure Tesseract based on language
            config = '--oem 3 --psm 6'  # Default config
            
            if language == 'chinese' or language == 'mixed':
                config += ' -l chi_sim+eng'
            else:
                config += ' -l eng'
            
            # Extract text
            text = pytesseract.image_to_string(pil_image, config=config)
            
            # Get confidence data
            data = pytesseract.image_to_data(pil_image, config=config, output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) / 100 if confidences else 0.0
            
            return text, avg_confidence
            
        except Exception as e:
            logger.error(f"Tesseract extraction failed: {e}")
            return "", 0.0
    
    def _get_best_engine_name(self, content_type: ContentTypeResult) -> str:
        """Get the name of the best engine for content type"""
        if (content_type.language_detected in ['chinese', 'mixed'] and 
            self.paddle_available):
            return "PaddleOCR"
        else:
            return "Tesseract"

# Example usage and testing
if __name__ == "__main__":
    processor = EnhancedOCRProcessor()
    
    # Test with sample image
    sample_image_path = "data/social media/IMG_3205.PNG"
    
    if os.path.exists(sample_image_path):
        result = processor.process_image(sample_image_path)
        
        print(f"Content Type: {result.content_type.content_type}")
        print(f"OCR Confidence: {result.ocr_confidence:.2f}")
        print(f"Total Chunks: {len(result.structured_chunks)}")
        print("\nStructured Chunks:")
        
        for i, chunk in enumerate(result.structured_chunks[:5]):  # Show first 5
            print(f"  Chunk {i+1} ({chunk.spatial_context}, {chunk.chunk_type}):")
            print(f"    Text: {chunk.text[:100]}...")
            print(f"    Confidence: {chunk.confidence:.2f}")
            print()
    else:
        print(f"Sample image not found: {sample_image_path}")