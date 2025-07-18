"""
Intelligent Geocoding Service
AI-enhanced geocoding with context awareness and error tolerance
"""

import requests
import json
import logging
import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import os
from dotenv import load_dotenv
import openai
from openai import OpenAI

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class GeocodingResult:
    """Enhanced geocoding result with AI context"""
    name: str
    coordinates: Tuple[float, float]  # (longitude, latitude)
    address: str
    place_id: str
    confidence: float
    source: str  # google, nominatim, ai_enhanced
    context_used: str  # What context was used for geocoding
    alternative_names: List[str] = None

@dataclass
class GeocodingBatch:
    """Batch geocoding results"""
    results: List[GeocodingResult]
    success_rate: float
    total_queries: int
    processing_time_ms: int

class ContextEnhancer:
    """Enhance location queries with AI context"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.client = OpenAI(api_key=api_key or os.getenv('OPENAI_API_KEY'))
        self.model = "gpt-3.5-turbo"  # Use faster model for query enhancement
    
    def enhance_query(self, location_name: str, context: str, 
                     content_type: str = "unknown") -> str:
        """Enhance location query with AI context"""
        
        system_prompt = """You are a geocoding query optimizer. Your task is to transform location names into better geocoding queries.

        Rules:
        1. Add geographic context when helpful
        2. Fix common OCR errors in place names
        3. Standardize business names and landmarks
        4. Add location type hints when useful
        5. Keep queries concise and geocoding-friendly
        
        Examples:
        - "Pump2 J1" → "Pump2 J1 restaurant Japan"
        - "Olympic natio" → "Olympic National Park Washington"
        - "Katsumidori sushi" → "Katsumidori Sushi Tokyo"
        - "SAPPORO AREA" → "Sapporo Japan"
        """
        
        user_prompt = f"""
        Location: {location_name}
        Context: {context}
        Content Type: {content_type}
        
        Enhance this location name for geocoding. Return only the enhanced query, nothing else.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                max_tokens=50
            )
            
            enhanced_query = response.choices[0].message.content.strip()
            logger.debug(f"Enhanced query: '{location_name}' → '{enhanced_query}'")
            return enhanced_query
            
        except Exception as e:
            logger.warning(f"Query enhancement failed: {e}")
            return location_name

class GoogleGeocoder:
    """Google Maps Geocoding API wrapper"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GOOGLE_MAPS_API_KEY')
        self.base_url = "https://maps.googleapis.com/maps/api/geocode/json"
        self.rate_limit_delay = 0.1  # 10 requests per second
        self.last_request_time = 0
    
    def geocode(self, query: str, context: str = "") -> Optional[GeocodingResult]:
        """Geocode a location query"""
        
        if not self.api_key:
            logger.warning("Google Maps API key not available")
            return None
        
        # Rate limiting
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - time_since_last)
        
        try:
            params = {
                'address': query,
                'key': self.api_key
            }
            
            response = requests.get(self.base_url, params=params, timeout=10)
            self.last_request_time = time.time()
            
            if response.status_code != 200:
                logger.error(f"Google Geocoding API error: {response.status_code}")
                return None
            
            data = response.json()
            
            if data['status'] != 'OK' or not data['results']:
                logger.debug(f"No results for query: {query}")
                return None
            
            # Use the first result
            result = data['results'][0]
            location = result['geometry']['location']
            
            return GeocodingResult(
                name=result['formatted_address'].split(',')[0],  # First part of address
                coordinates=(location['lng'], location['lat']),
                address=result['formatted_address'],
                place_id=result['place_id'],
                confidence=self._calculate_confidence(result, query),
                source="google",
                context_used=context
            )
            
        except Exception as e:
            logger.error(f"Google geocoding failed for '{query}': {e}")
            return None
    
    def _calculate_confidence(self, result: Dict, original_query: str) -> float:
        """Calculate confidence score for geocoding result"""
        
        confidence = 0.7  # Base confidence
        
        # Check geometry accuracy
        location_type = result['geometry'].get('location_type', '')
        if location_type == 'ROOFTOP':
            confidence += 0.2
        elif location_type == 'RANGE_INTERPOLATED':
            confidence += 0.1
        
        # Check if result name matches query
        formatted_address = result['formatted_address'].lower()
        query_lower = original_query.lower()
        
        # Simple name matching
        query_words = query_lower.split()
        matches = sum(1 for word in query_words if word in formatted_address)
        if query_words:
            match_ratio = matches / len(query_words)
            confidence += match_ratio * 0.2
        
        return min(confidence, 1.0)

class NominatimGeocoder:
    """OpenStreetMap Nominatim geocoder (free alternative)"""
    
    def __init__(self):
        self.base_url = "https://nominatim.openstreetmap.org/search"
        self.rate_limit_delay = 1.0  # 1 request per second for Nominatim
        self.last_request_time = 0
    
    def geocode(self, query: str, context: str = "") -> Optional[GeocodingResult]:
        """Geocode using Nominatim"""
        
        # Rate limiting
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - time_since_last)
        
        try:
            params = {
                'q': query,
                'format': 'json',
                'limit': 1,
                'addressdetails': 1
            }
            
            headers = {
                'User-Agent': 'LLMap/1.0 (https://github.com/your-repo/llmap)'
            }
            
            response = requests.get(self.base_url, params=params, headers=headers, timeout=10)
            self.last_request_time = time.time()
            
            if response.status_code != 200:
                logger.error(f"Nominatim API error: {response.status_code}")
                return None
            
            data = response.json()
            
            if not data:
                logger.debug(f"No Nominatim results for query: {query}")
                return None
            
            result = data[0]
            
            return GeocodingResult(
                name=result.get('display_name', '').split(',')[0],
                coordinates=(float(result['lon']), float(result['lat'])),
                address=result.get('display_name', ''),
                place_id=result.get('place_id', ''),
                confidence=float(result.get('importance', 0.5)),
                source="nominatim",
                context_used=context
            )
            
        except Exception as e:
            logger.error(f"Nominatim geocoding failed for '{query}': {e}")
            return None

class IntelligentGeocoder:
    """Main intelligent geocoding service"""
    
    def __init__(self, google_api_key: Optional[str] = None, 
                 openai_api_key: Optional[str] = None):
        self.context_enhancer = ContextEnhancer(openai_api_key)
        self.google_geocoder = GoogleGeocoder(google_api_key)
        self.nominatim_geocoder = NominatimGeocoder()
        
        # Geocoding strategy
        self.use_google = bool(google_api_key or os.getenv('GOOGLE_MAPS_API_KEY'))
        self.use_ai_enhancement = bool(openai_api_key or os.getenv('OPENAI_API_KEY'))
    
    def geocode_location(self, location_name: str, context: str = "", 
                        content_type: str = "unknown") -> Optional[GeocodingResult]:
        """Geocode a single location with AI enhancement"""
        
        logger.info(f"Geocoding: '{location_name}' with context: '{context[:50]}...'")
        
        # Enhance query with AI if available
        enhanced_query = location_name
        if self.use_ai_enhancement and context:
            enhanced_query = self.context_enhancer.enhance_query(
                location_name, context, content_type
            )
        
        # Try geocoding with enhanced query
        result = self._try_geocoding(enhanced_query, context)
        
        # If enhanced query fails, try original
        if not result and enhanced_query != location_name:
            logger.debug(f"Enhanced query failed, trying original: '{location_name}'")
            result = self._try_geocoding(location_name, context)
        
        # Try fuzzy matching if still no result
        if not result:
            result = self._try_fuzzy_geocoding(location_name, context)
        
        if result:
            logger.info(f"Geocoded '{location_name}' → {result.name} "
                       f"({result.coordinates[1]:.4f}, {result.coordinates[0]:.4f})")
        else:
            logger.warning(f"Failed to geocode: '{location_name}'")
        
        return result
    
    def geocode_batch(self, locations: List[Dict[str, Any]]) -> GeocodingBatch:
        """Geocode multiple locations"""
        
        start_time = time.time()
        results = []
        
        logger.info(f"Starting batch geocoding of {len(locations)} locations")
        
        for i, location_data in enumerate(locations):
            location_name = location_data.get('name', '')
            context = location_data.get('context', '')
            content_type = location_data.get('content_type', 'unknown')
            
            logger.debug(f"Geocoding {i+1}/{len(locations)}: {location_name}")
            
            result = self.geocode_location(location_name, context, content_type)
            if result:
                results.append(result)
            
            # Small delay to be respectful to APIs
            time.sleep(0.1)
        
        processing_time = int((time.time() - start_time) * 1000)
        success_rate = len(results) / len(locations) if locations else 0
        
        logger.info(f"Batch geocoding completed: {len(results)}/{len(locations)} successful "
                   f"({success_rate:.1%}) in {processing_time}ms")
        
        return GeocodingBatch(
            results=results,
            success_rate=success_rate,
            total_queries=len(locations),
            processing_time_ms=processing_time
        )
    
    def _try_geocoding(self, query: str, context: str) -> Optional[GeocodingResult]:
        """Try geocoding with available services"""
        
        # Try Google first if available
        if self.use_google:
            result = self.google_geocoder.geocode(query, context)
            if result and result.confidence > 0.6:
                return result
        
        # Try Nominatim as fallback
        result = self.nominatim_geocoder.geocode(query, context)
        if result and result.confidence > 0.4:
            return result
        
        return None
    
    def _try_fuzzy_geocoding(self, location_name: str, context: str) -> Optional[GeocodingResult]:
        """Try fuzzy matching for difficult locations"""
        
        # Common OCR error corrections
        corrections = {
            'natio': 'national',
            'centr': 'center',
            'restauran': 'restaurant',
            'hote': 'hotel',
            'par': 'park'
        }
        
        corrected_name = location_name
        for error, correction in corrections.items():
            if error in location_name.lower():
                corrected_name = location_name.lower().replace(error, correction)
                break
        
        if corrected_name != location_name:
            logger.debug(f"Trying fuzzy correction: '{location_name}' → '{corrected_name}'")
            return self._try_geocoding(corrected_name, context)
        
        return None

# Example usage and testing
if __name__ == "__main__":
    geocoder = IntelligentGeocoder()
    
    # Test single location
    test_locations = [
        {
            'name': 'Olympic National Park',
            'context': 'Day 1 travel itinerary visitor center',
            'content_type': 'travel_itinerary'
        },
        {
            'name': 'Katsumidori sushi tokyo',
            'context': 'Restaurant recommendation social media post',
            'content_type': 'social_media'
        },
        {
            'name': 'SAPPORO AREA',
            'context': 'Japanese travel location',
            'content_type': 'social_media'
        }
    ]
    
    # Test batch geocoding
    batch_result = geocoder.geocode_batch(test_locations)
    
    print(f"Batch Results: {len(batch_result.results)}/{batch_result.total_queries} successful")
    print(f"Success Rate: {batch_result.success_rate:.1%}")
    print(f"Processing Time: {batch_result.processing_time_ms}ms")
    print()
    
    for result in batch_result.results:
        print(f"Location: {result.name}")
        print(f"  Coordinates: {result.coordinates}")
        print(f"  Address: {result.address}")
        print(f"  Confidence: {result.confidence:.2f}")
        print(f"  Source: {result.source}")
        print()