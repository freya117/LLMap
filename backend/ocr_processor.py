"""
OCR Processing Module
Supports both Tesseract and PaddleOCR engines
Includes image preprocessing, text extraction, and result post-processing functionality
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
    logger.warning(
        "jieba not available, Chinese word segmentation functionality limited"
    )


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

    def __post_init__(self):
        if self.detected_locations is None:
            self.detected_locations = []
        if self.detected_addresses is None:
            self.detected_addresses = []
        if self.detected_names is None:
            self.detected_names = []


class ImagePreprocessor:
    """Enhanced image preprocessor"""

    @staticmethod
    def detect_image_type(image: np.ndarray) -> str:
        """Detect image type (screenshot, photo, map, etc.)"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Calculate image features
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size

        # Calculate color distribution
        hist = cv2.calcHist(
            [image], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256]
        )
        color_diversity = np.count_nonzero(hist) / hist.size

        # Determine image type
        if edge_density > 0.1 and color_diversity > 0.3:
            return "map_screenshot"  # Map screenshot
        elif edge_density < 0.05:
            return "text_heavy"  # Text-heavy image
        else:
            return "mixed_content"  # Mixed content

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
    """Enhanced text post-processor"""

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
        """Clean and standardize text"""
        if not text:
            return ""

        # Remove excess whitespace characters
        text = re.sub(r"\s+", " ", text)

        # Fix common OCR errors
        text = self.fix_common_ocr_errors(text)

        # Remove meaningless character combinations
        text = re.sub(r"[^\w\s.,!?@#$%^&*()_+\-=\[\]{}|;:\'\"<>/\\·•★☆]", "", text)

        # Fix line break issues
        text = re.sub(
            r"(?<=[a-z])\n(?=[a-z])", " ", text
        )  # Line breaks in the middle of words
        text = re.sub(r"\n+", "\n", text)  # Merge multiple line breaks

        return text.strip()

    def extract_locations_advanced(self, text: str) -> List[Dict[str, any]]:
        """Advanced location extraction with detailed information for English and Chinese"""
        locations = []

        # More aggressive patterns for better extraction from Google Maps/restaurant screenshots
        english_patterns = [
            # Complete address format with numbers (stricter)
            (
                r"\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Place|Pl\.?)",
                "full_address",
            ),
            # Business names with specific types (more selective)
            (
                r"[A-Z][a-zA-Z\'&\-\s]{2,40}(?:Restaurant|Cafe|Coffee|Bar|Grill|Bistro|Deli|Pizza|Sushi|Bakery|Market|Store|Shop|Eatery|Kitchen|House|Chicken|Thai|Chinese|Mexican|Italian|BBQ|Burgers?|Noodles?|Ramen)",
                "business",
            ),
            # Proper business names (capitalized words, 2-4 words) - more lenient
            (
                r"[A-Z][a-z\']+(?:\s+[A-Z][a-z\']+){1,4}(?=\s|$|[^\w])",
                "potential_business",
            ),
            # Chain restaurants and known businesses
            (
                r"(?:McDonald\'s|Starbucks|KFC|Subway|Pizza Hut|Burger King|Taco Bell|Dunkin|Chipotle|Dave\'s Hot Chicken|Acme Bread|Funky Elephant|Eunice Gourmet|Albany Ao Sen)",
                "chain_business",
            ),
            # Landmarks with specific keywords
            (
                r"[A-Z][a-z\-]+(?:\s+[A-Z][a-z\-]+)*\s+(?:Plaza|Center|Centre|Mall|Park|Square)",
                "landmark",
            ),
            # Street names without numbers
            (
                r"[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way)",
                "street",
            ),
            # Business names ending with location indicators
            (
                r"[A-Z][a-zA-Z\s&\']{3,30}(?:Oakland|Berkeley|San Francisco|NYC|Manhattan|Brooklyn)",
                "location_business",
            ),
        ]

        # Enhanced Chinese location patterns
        chinese_patterns = [
            # Chinese addresses with numbers
            (
                r"[\u4e00-\u9fff]+(?:路|街|巷|道|大道|广场|中心|商场|酒店|餐厅|咖啡厅|公园|医院|学校|大学|车站)\d*号?",
                "chinese_address",
            ),
            # Chinese business locations
            (
                r"[\u4e00-\u9fff]+(?:餐厅|饭店|酒店|咖啡厅|茶楼|火锅店|烧烤店|小吃店|商场|超市|银行)",
                "chinese_business",
            ),
            # Chinese areas and districts
            (r"[\u4e00-\u9fff]{2,}(?:市|区|县|镇|村|街道|社区)", "chinese_area"),
            # Mixed Chinese-English locations
            (
                r"[\u4e00-\u9fff]+\s*[A-Za-z]+|[A-Za-z]+\s*[\u4e00-\u9fff]+",
                "mixed_location",
            ),
            # Chinese landmarks
            (
                r"[\u4e00-\u9fff]+(?:公园|广场|大厦|中心|商城|购物中心|地铁站|火车站|机场)",
                "chinese_landmark",
            ),
        ]

        all_patterns = english_patterns + chinese_patterns

        for pattern, location_type in all_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                location_text = match.group().strip()
                if len(location_text) > 2:  # Filter out matches that are too short
                    confidence = self._calculate_location_confidence(
                        location_text, location_type
                    )
                    # Lower threshold for better extraction
                    if confidence >= 0.3:  # Minimum 30% confidence instead of 50%
                        locations.append(
                            {
                                "text": location_text,
                                "type": location_type,
                                "confidence": confidence,
                                "position": match.span(),
                            }
                        )

        # Deduplicate and sort by confidence
        unique_locations = []
        seen_texts = set()

        for loc in sorted(locations, key=lambda x: x["confidence"], reverse=True):
            text_lower = loc["text"].lower().strip()
            if text_lower not in seen_texts and loc["confidence"] >= 0.3:
                unique_locations.append(loc)
                seen_texts.add(text_lower)

        # Increase limit to capture more locations
        return unique_locations[:20]  # Increased from 10 to 20

    def _calculate_location_confidence(self, text: str, location_type: str) -> float:
        """Calculate location recognition confidence with better filtering"""
        confidence = 0.4  # Slightly higher base confidence

        # Adjust confidence based on type
        type_confidence = {
            "full_address": 0.9,
            "business": 0.8,  # Increased from 0.7
            "chain_business": 0.95,  # High confidence for known chains
            "landmark": 0.7,
            "potential_business": 0.5,  # Increased from 0.4
            "street": 0.6,
            "location_business": 0.8,
            "chinese_business": 0.8,
            "chinese_address": 0.8,
        }

        confidence = type_confidence.get(location_type, 0.4)

        # Boost confidence for specific business indicators
        if re.search(
            r"(?:Restaurant|Cafe|Coffee|Bakery|Grill|Kitchen|Chicken|Thai|Chinese|Pizza|Sushi)",
            text,
            re.IGNORECASE,
        ):
            confidence += 0.2

        # Boost for complete addresses with numbers
        if re.search(r"\d+.*(?:Street|Ave|Road|Blvd|Dr)", text, re.IGNORECASE):
            confidence += 0.2

        # Boost for known business names from common patterns
        known_businesses = [
            "Dave's Hot Chicken",
            "Albany Ao Sen",
            "Eunice Gourmet",
            "Funky Elephant",
            "Acme Bread",
            "McDonald's",
            "Starbucks",
            "KFC",
            "Subway",
            "Pizza Hut",
            "Burger King",
        ]
        for business in known_businesses:
            if business.lower() in text.lower() or text.lower() in business.lower():
                confidence += 0.3
                break

        # Less aggressive penalization for short matches
        if len(text) < 3:
            confidence -= 0.4
        elif len(text) > 60:
            confidence -= 0.2

        # Penalize common false positives but less aggressively
        false_positive_patterns = [
            r"^(Open|Closed|Hours|Phone|Call|Visit|Website|Map|Directions|Reviews|Photos)$",
            r"^\d+$",  # Just numbers
            r"^[A-Z]$",  # Single letters
            r"^(AM|PM|Mon|Tue|Wed|Thu|Fri|Sat|Sun)$",
            r"^(Today|Tomorrow|Yesterday)$",
        ]

        for pattern in false_positive_patterns:
            if re.match(pattern, text, re.IGNORECASE):
                confidence -= 0.3  # Reduced from 0.5
                break

        return max(0.0, min(confidence, 1.0))

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
            if loc["type"] in ["full_address", "street", "chinese_address"]
        ]
        return addresses

    def extract_business_names(self, text: str) -> List[str]:
        """Extract business names (backward compatibility interface)"""
        advanced_locations = self.extract_locations_advanced(text)
        businesses = [
            loc["text"]
            for loc in advanced_locations
            if loc["type"]
            in [
                "business",
                "landmark",
                "chain_business",
                "potential_business",
                "location_business",
                "chinese_business",
            ]
        ]
        return businesses


class OCRProcessor:
    """Main OCR processor"""

    def __init__(self):
        self.tesseract = TesseractOCR()
        self.paddle = PaddleOCR_Processor()
        self.preprocessor = ImagePreprocessor()
        self.text_processor = TextProcessor()

    def process_image(
        self, image_path: str, engine: str = "auto"
    ) -> ProcessedOCRResult:
        """
        Process image and return structured results

        Args:
            image_path: Image file path
            engine: OCR engine ("tesseract", "paddle", "auto")
        """
        try:
            # Image preprocessing
            processed_image = self.preprocessor.preprocess_for_ocr(image_path)

            # Select OCR engine
            if engine == "auto":
                # Prefer PaddleOCR (better Chinese support)
                if self.paddle.available:
                    ocr_result = self.paddle.extract_text(processed_image)
                else:
                    ocr_result = self.tesseract.extract_text(processed_image)
            elif engine == "paddle" and self.paddle.available:
                ocr_result = self.paddle.extract_text(processed_image)
            else:
                ocr_result = self.tesseract.extract_text(processed_image)

            # Text post-processing
            cleaned_text = self.text_processor.clean_text(ocr_result.text)

            # Extract structured information
            locations = self.text_processor.extract_locations(cleaned_text)
            addresses = self.text_processor.extract_addresses(cleaned_text)
            names = self.text_processor.extract_business_names(cleaned_text)

            # Build structured data
            structured_data = {
                "locations": locations,
                "addresses": addresses,
                "business_names": names,
                "has_ratings": bool(re.search(r"\d+\.\d+", cleaned_text)),
                "has_phone": bool(re.search(r"\(\d{3}\)\s*\d{3}-\d{4}", cleaned_text)),
                "text_length": len(cleaned_text),
                "word_count": len(cleaned_text.split()),
            }

            # Debug logging with more details
            logger.info(f"OCR processing completed for {image_path}:")
            logger.info(f"  Raw text length: {len(ocr_result.text)}")
            logger.info(f"  Cleaned text length: {len(cleaned_text)}")
            logger.info(f"  Locations found: {len(locations)}")
            logger.info(f"  Addresses found: {len(addresses)}")
            logger.info(f"  Business names found: {len(names)}")
            logger.info(f"  Confidence: {ocr_result.confidence:.2f}")

            if locations:
                logger.info(f"  Location details: {locations}")
            if addresses:
                logger.info(f"  Address details: {addresses}")
            if names:
                logger.info(f"  Business name details: {names}")

            # Log a sample of the cleaned text for debugging
            if cleaned_text:
                sample_text = (
                    cleaned_text[:200] + "..."
                    if len(cleaned_text) > 200
                    else cleaned_text
                )
                logger.info(f"  Sample cleaned text: {sample_text}")

            return ProcessedOCRResult(
                raw_text=ocr_result.text,
                cleaned_text=cleaned_text,
                structured_data=structured_data,
                confidence=ocr_result.confidence,
                detected_locations=locations,
                detected_addresses=addresses,
                detected_names=names,
            )

        except Exception as e:
            logger.error(f"OCR processing error for {image_path}: {e}")
            return ProcessedOCRResult(
                raw_text="",
                cleaned_text="",
                structured_data={
                    "locations": [],
                    "addresses": [],
                    "business_names": [],
                    "has_ratings": False,
                    "has_phone": False,
                    "text_length": 0,
                    "word_count": 0,
                },
                confidence=0.0,
                detected_locations=[],
                detected_addresses=[],
                detected_names=[],
            )


# Global OCR processor instance
ocr_processor = OCRProcessor()


def process_image_file(image_path: str, engine: str = "auto") -> Dict:
    """
    Convenience function for processing image files

    Returns:
        Dict: Dictionary containing OCR results
    """
    result = ocr_processor.process_image(image_path, engine)

    # Determine success based on whether we extracted any meaningful content
    has_text = len(result.raw_text.strip()) > 0 or len(result.cleaned_text.strip()) > 0
    has_extractions = (len(result.detected_locations) > 0 or 
                      len(result.detected_addresses) > 0 or 
                      len(result.detected_names) > 0)
    
    success = has_text and (result.confidence > 0.1 or has_extractions)
    
    logger.info(f"Process image file result: success={success}, has_text={has_text}, has_extractions={has_extractions}, confidence={result.confidence}")

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
