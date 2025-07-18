"""
AI Semantic Processing Layer
Handles context-aware location extraction and semantic understanding
"""

import json
import logging
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import openai
from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class SemanticLocation:
    """Semantic location with AI-enhanced context"""
    name: str
    type: str  # restaurant, landmark, accommodation, etc.
    context: str  # AI-generated context description
    confidence: float
    relationships: List[str]  # Related locations
    geocoding_query: str  # Enhanced query for geocoding
    original_text: str  # Original OCR text
    spatial_context: str  # Where in the image this was found

@dataclass
class AIProcessingResult:
    """Result from AI semantic processing"""
    semantic_locations: List[SemanticLocation]
    ai_confidence: float
    model_used: str
    processing_time_ms: int
    relationships_detected: List[Dict[str, Any]]
    content_analysis: Dict[str, Any]

class SemanticExtractor:
    """Extract semantic meaning from OCR text using AI"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.client = OpenAI(api_key=api_key or os.getenv('OPENAI_API_KEY'))
        self.model = "gpt-4-1106-preview"  # Use latest GPT-4 Turbo
        
    def extract_locations_from_chunks(self, text_chunks: List[Dict[str, Any]], 
                                    content_type: str = "unknown") -> List[SemanticLocation]:
        """Extract semantic locations from structured text chunks"""
        
        # Prepare context for AI
        context_prompt = self._build_context_prompt(text_chunks, content_type)
        
        # Create AI prompt for location extraction
        system_prompt = """You are an expert at extracting location information from OCR text. 
        Your task is to identify locations, businesses, landmarks, and places from the provided text chunks.
        
        Focus on:
        1. Restaurants, cafes, hotels, and businesses
        2. Landmarks, parks, and tourist attractions  
        3. Geographic areas, cities, and regions
        4. Transportation hubs and infrastructure
        
        For each location, provide:
        - name: Clean, standardized name
        - type: Category (restaurant, landmark, accommodation, etc.)
        - context: Brief description with geographic/semantic context
        - confidence: 0.0-1.0 confidence score
        - relationships: List of related locations mentioned
        - geocoding_query: Enhanced query for geocoding APIs
        
        Handle OCR errors gracefully and use context to disambiguate locations.
        For mixed language content, provide English names when possible.
        """
        
        user_prompt = f"""
        Content Type: {content_type}
        
        Text Chunks:
        {context_prompt}
        
        Extract all meaningful locations from this content. Return as JSON array with this structure:
        [
          {{
            "name": "Clean location name",
            "type": "restaurant|landmark|accommodation|area|business|transportation",
            "context": "Brief context description",
            "confidence": 0.95,
            "relationships": ["related location 1", "related location 2"],
            "geocoding_query": "Enhanced query for geocoding",
            "original_text": "Original OCR text that contained this location",
            "spatial_context": "header|body|footer|list_item"
          }}
        ]
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,  # Low temperature for consistent extraction
                max_tokens=2000
            )
            
            # Parse AI response
            ai_response = response.choices[0].message.content
            logger.info(f"AI Response: {ai_response[:200]}...")
            
            # Extract JSON from response
            locations_data = self._parse_ai_response(ai_response)
            
            # Convert to SemanticLocation objects
            semantic_locations = []
            for loc_data in locations_data:
                semantic_locations.append(SemanticLocation(
                    name=loc_data.get('name', ''),
                    type=loc_data.get('type', 'unknown'),
                    context=loc_data.get('context', ''),
                    confidence=float(loc_data.get('confidence', 0.5)),
                    relationships=loc_data.get('relationships', []),
                    geocoding_query=loc_data.get('geocoding_query', loc_data.get('name', '')),
                    original_text=loc_data.get('original_text', ''),
                    spatial_context=loc_data.get('spatial_context', 'unknown')
                ))
            
            logger.info(f"Extracted {len(semantic_locations)} semantic locations")
            return semantic_locations
            
        except Exception as e:
            logger.error(f"AI location extraction failed: {e}")
            return []
    
    def _build_context_prompt(self, text_chunks: List[Dict[str, Any]], content_type: str) -> str:
        """Build context prompt from text chunks"""
        context_lines = []
        
        for i, chunk in enumerate(text_chunks):
            text = chunk.get('text', '')
            spatial_context = chunk.get('spatial_context', 'unknown')
            confidence = chunk.get('confidence', 0.0)
            
            context_lines.append(f"Chunk {i+1} ({spatial_context}, confidence: {confidence:.2f}):")
            context_lines.append(f"  {text}")
            context_lines.append("")
        
        return "\n".join(context_lines)
    
    def _parse_ai_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse AI response and extract JSON"""
        try:
            # Try to find JSON array in response
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                return json.loads(json_str)
            
            # If no array found, try to parse entire response
            return json.loads(response)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            logger.error(f"Response was: {response}")
            return []

class RelationshipMapper:
    """Map relationships between locations"""
    
    def __init__(self):
        self.relationship_types = {
            'contains': ['park contains trail', 'city contains restaurant'],
            'near': ['hotel near airport', 'restaurant near landmark'],
            'part_of': ['trail part of park', 'district part of city'],
            'serves': ['restaurant serves area', 'transportation serves route']
        }
    
    def detect_relationships(self, locations: List[SemanticLocation]) -> List[Dict[str, Any]]:
        """Detect relationships between extracted locations"""
        relationships = []
        
        for i, loc1 in enumerate(locations):
            for j, loc2 in enumerate(locations):
                if i != j:
                    relationship = self._analyze_relationship(loc1, loc2)
                    if relationship:
                        relationships.append(relationship)
        
        return relationships
    
    def _analyze_relationship(self, loc1: SemanticLocation, loc2: SemanticLocation) -> Optional[Dict[str, Any]]:
        """Analyze relationship between two locations"""
        
        # Check if locations are mentioned in each other's relationships
        if loc2.name.lower() in [r.lower() for r in loc1.relationships]:
            return {
                'source': loc1.name,
                'target': loc2.name,
                'type': 'related',
                'confidence': 0.8
            }
        
        # Check for hierarchical relationships
        if self._is_hierarchical_relationship(loc1, loc2):
            return {
                'source': loc1.name,
                'target': loc2.name,
                'type': 'contains' if loc1.type in ['park', 'area', 'city'] else 'part_of',
                'confidence': 0.7
            }
        
        return None
    
    def _is_hierarchical_relationship(self, loc1: SemanticLocation, loc2: SemanticLocation) -> bool:
        """Check if locations have hierarchical relationship"""
        hierarchical_pairs = [
            ('park', 'trail'),
            ('city', 'restaurant'),
            ('area', 'business'),
            ('landmark', 'business')
        ]
        
        for parent_type, child_type in hierarchical_pairs:
            if (loc1.type == parent_type and loc2.type == child_type) or \
               (loc1.type == child_type and loc2.type == parent_type):
                return True
        
        return False

class AIProcessor:
    """Main AI processing coordinator"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.semantic_extractor = SemanticExtractor(api_key)
        self.relationship_mapper = RelationshipMapper()
    
    def process_ocr_chunks(self, text_chunks: List[Dict[str, Any]], 
                          content_type: str = "unknown") -> AIProcessingResult:
        """Process OCR chunks through AI pipeline"""
        
        import time
        start_time = time.time()
        
        logger.info(f"Starting AI processing of {len(text_chunks)} chunks (content_type: {content_type})")
        
        # Extract semantic locations
        semantic_locations = self.semantic_extractor.extract_locations_from_chunks(
            text_chunks, content_type
        )
        
        # Detect relationships
        relationships = self.relationship_mapper.detect_relationships(semantic_locations)
        
        # Calculate overall confidence
        if semantic_locations:
            ai_confidence = sum(loc.confidence for loc in semantic_locations) / len(semantic_locations)
        else:
            ai_confidence = 0.0
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Content analysis
        content_analysis = {
            'total_chunks': len(text_chunks),
            'locations_extracted': len(semantic_locations),
            'relationships_found': len(relationships),
            'content_type': content_type,
            'avg_confidence': ai_confidence
        }
        
        result = AIProcessingResult(
            semantic_locations=semantic_locations,
            ai_confidence=ai_confidence,
            model_used=self.semantic_extractor.model,
            processing_time_ms=processing_time,
            relationships_detected=relationships,
            content_analysis=content_analysis
        )
        
        logger.info(f"AI processing completed: {len(semantic_locations)} locations, "
                   f"{len(relationships)} relationships, {processing_time}ms")
        
        return result

# Example usage and testing
if __name__ == "__main__":
    # Test with sample data
    sample_chunks = [
        {
            "text": "Olympic National Park visitor center Day 1",
            "spatial_context": "header",
            "confidence": 0.85
        },
        {
            "text": "Quinault rain forest trailhead Lake Quinault",
            "spatial_context": "body",
            "confidence": 0.78
        },
        {
            "text": "Gateway Inn accommodation near park entrance",
            "spatial_context": "body", 
            "confidence": 0.82
        }
    ]
    
    processor = AIProcessor()
    result = processor.process_ocr_chunks(sample_chunks, "travel_itinerary")
    
    print(f"Extracted {len(result.semantic_locations)} locations:")
    for loc in result.semantic_locations:
        print(f"  - {loc.name} ({loc.type}) - {loc.confidence:.2f}")
        print(f"    Context: {loc.context}")
        print(f"    Geocoding query: {loc.geocoding_query}")
        print()