from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import tempfile
from typing import List, Optional
from dotenv import load_dotenv
import uvicorn
import logging
from datetime import datetime
import time

# Import Enhanced OCR + AI Pipeline components
from enhanced_ocr_processor import EnhancedOCRProcessor
from ai_processor import AIProcessor
from intelligent_geocoder import IntelligentGeocoder

# Legacy imports for backward compatibility
from ocr_processor import process_image_file, ocr_processor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Enhanced OCR + AI Pipeline components
enhanced_ocr_processor = EnhancedOCRProcessor()
ai_processor = AIProcessor()
intelligent_geocoder = IntelligentGeocoder()

app = FastAPI(
    title="LLMap Backend API - Enhanced OCR + AI Pipeline",
    description="AI-powered location extraction and mapping backend with enhanced OCR and semantic processing",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "LLMap Backend API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/ocr/engines")
async def get_available_engines():
    """
    Get available OCR engine information
    """
    engines = {
        "tesseract": {
            "name": "Tesseract OCR",
            "available": True,
            "description": "Open source OCR engine with multi-language support",
            "languages": ["eng", "chi_sim", "chi_tra"]
        },
        "paddle": {
            "name": "PaddleOCR",
            "available": ocr_processor.paddle.available,
            "description": "Baidu's open source OCR engine with better Chinese support",
            "languages": ["ch", "en"]
        }
    }
    
    return JSONResponse(content={
        "engines": engines,
        "default": "auto",
        "recommended": "paddle" if ocr_processor.paddle.available else "tesseract"
    })

@app.post("/api/ocr/process")
async def process_ocr(
    file: UploadFile = File(...),
    engine: str = Form(default="auto"),
    enhance_image: bool = Form(default=True),
    extract_structured: bool = Form(default=True)
):
    """
    Process uploaded image file and extract text information
    
    Args:
        file: Uploaded image file
        engine: OCR engine selection ("tesseract", "paddle", "auto")
        enhance_image: Whether to perform image enhancement preprocessing
        extract_structured: Whether to extract structured information
    
    Returns:
        JSON: OCR processing results
    """
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files are supported")
    
    temp_file_path = None
    
    try:
        logger.info(f"Starting file processing: {file.filename}, engine: {engine}")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            # Save uploaded file
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Process OCR
        result = process_image_file(temp_file_path, engine)
        
        # Add processing metadata
        result["processing_metadata"] = {
            "engine_used": engine,
            "image_enhanced": enhance_image,
            "structured_extraction": extract_structured,
            "processed_at": datetime.now().isoformat(),
            "file_info": {
                "filename": file.filename,
                "size": len(content),
                "content_type": file.content_type
            }
        }
        
        # If structured extraction is needed, add more information
        if extract_structured and result.get("success"):
            try:
                # Extract advanced geographic information
                advanced_locations = ocr_processor.text_processor.extract_locations_advanced(result["cleaned_text"])
                contact_info = ocr_processor.text_processor.extract_contact_info(result["cleaned_text"])
                ratings = ocr_processor.text_processor.extract_ratings_and_reviews(result["cleaned_text"])
                
                result["advanced_extraction"] = {
                    "detailed_locations": advanced_locations,
                    "contact_info": contact_info,
                    "ratings_reviews": ratings,
                    "extraction_stats": {
                        "total_locations": len(advanced_locations),
                        "high_confidence_locations": len([loc for loc in advanced_locations if loc['confidence'] > 0.8]),
                        "has_contact_info": bool(contact_info['phones'] or contact_info['emails']),
                        "has_ratings": len(ratings) > 0
                    }
                }
            except Exception as e:
                logger.warning(f"Structured extraction failed: {e}")
                result["advanced_extraction"] = {"error": str(e)}
        
        logger.info(f"✅ File processing completed: {file.filename}, extracted {len(result.get('extracted_info', {}).get('locations', []))} locations")
        
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"OCR processing error: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")
    
    finally:
        # Clean up temporary files
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

@app.post("/api/ocr/batch")
async def process_batch_ocr(
    files: List[UploadFile] = File(...),
    engine: str = Form(default="auto"),
    enhance_image: bool = Form(default=True),
    extract_structured: bool = Form(default=True)
):
    """
    Batch process multiple image files
    
    Args:
        files: List of uploaded image files
        engine: OCR engine selection
        enhance_image: Whether to perform image enhancement preprocessing
        extract_structured: Whether to extract structured information
    
    Returns:
        JSON: Batch OCR processing results
    """
    if len(files) > 10:  # Limit batch processing quantity
        raise HTTPException(status_code=400, detail="Batch processing supports maximum 10 files")
    
    results = []
    temp_files = []
    processing_stats = {
        "total_files": len(files),
        "successful_files": 0,
        "failed_files": 0,
        "total_locations": 0,
        "processing_time": datetime.now().isoformat()
    }
    
    try:
        logger.info(f"Starting batch processing of {len(files)} files")
        
        for i, file in enumerate(files):
            logger.info(f"Processing file {i+1}/{len(files)}: {file.filename}")
            
            # Validate file type
            if not file.content_type.startswith('image/'):
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": "Unsupported file type",
                    "file_index": i,
                    "raw_text": "",
                    "cleaned_text": "",
                    "confidence": 0,
                    "extracted_info": {
                        "locations": [],
                        "addresses": [],
                        "business_names": []
                    }
                })
                processing_stats["failed_files"] += 1
                continue
            
            temp_file_path = None
            
            try:
                # Create temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
                    content = await file.read()
                    temp_file.write(content)
                    temp_file_path = temp_file.name
                    temp_files.append(temp_file_path)
                
                # Process OCR
                result = process_image_file(temp_file_path, engine)
                
                # Ensure result has all required fields
                if not result.get("extracted_info"):
                    result["extracted_info"] = {
                        "locations": [],
                        "addresses": [],
                        "business_names": []
                    }
                
                # Add file information and index
                result["file_index"] = i
                result["processing_metadata"] = {
                    "engine_used": engine,
                    "image_enhanced": enhance_image,
                    "structured_extraction": extract_structured,
                    "processed_at": datetime.now().isoformat(),
                    "file_info": {
                        "filename": file.filename,
                        "size": len(content),
                        "content_type": file.content_type
                    }
                }
                
                # Structured extraction
                if extract_structured and result.get("success"):
                    try:
                        advanced_locations = ocr_processor.text_processor.extract_locations_advanced(result["cleaned_text"])
                        contact_info = ocr_processor.text_processor.extract_contact_info(result["cleaned_text"])
                        ratings = ocr_processor.text_processor.extract_ratings_and_reviews(result["cleaned_text"])
                        
                        result["advanced_extraction"] = {
                            "detailed_locations": advanced_locations,
                            "contact_info": contact_info,
                            "ratings_reviews": ratings
                        }
                        
                        processing_stats["total_locations"] += len(advanced_locations)
                        
                        # Log extraction results for debugging
                        logger.info(f"File {file.filename}: extracted {len(result['extracted_info']['locations'])} locations, "
                                  f"{len(result['extracted_info']['addresses'])} addresses, "
                                  f"{len(result['extracted_info']['business_names'])} businesses, "
                                  f"{len(advanced_locations)} advanced locations")
                        
                    except Exception as e:
                        logger.warning(f"Structured extraction failed for file {file.filename}: {e}")
                        result["advanced_extraction"] = {"error": str(e)}
                
                results.append(result)
                processing_stats["successful_files"] += 1
                
                logger.info(f"✅ File {file.filename} processing completed")
                
            except Exception as e:
                logger.error(f"Error processing file {file.filename}: {e}")
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": str(e),
                    "file_index": i,
                    "raw_text": "",
                    "cleaned_text": "",
                    "confidence": 0,
                    "extracted_info": {
                        "locations": [],
                        "addresses": [],
                        "business_names": []
                    }
                })
                processing_stats["failed_files"] += 1
        
        # Aggregate all extracted location information
        all_locations = []
        all_texts = []
        
        total_confidence_sum = 0
        total_files_with_confidence = 0
        
        for result in results:
            if result.get("success") and result.get("extracted_info"):
                # Collect location information
                locations = result["extracted_info"].get("locations", [])
                addresses = result["extracted_info"].get("addresses", [])
                businesses = result["extracted_info"].get("business_names", [])
                
                # Use the actual confidence from the result
                file_confidence = result.get("confidence", 0)
                if file_confidence > 0:
                    total_confidence_sum += file_confidence
                    total_files_with_confidence += 1
                
                # Standardize location information
                for loc in locations:
                    all_locations.append({
                        "name": loc,
                        "type": "location",
                        "source": result["processing_metadata"]["file_info"]["filename"],
                        "confidence": file_confidence
                    })
                
                for addr in addresses:
                    all_locations.append({
                        "name": addr,
                        "type": "address", 
                        "source": result["processing_metadata"]["file_info"]["filename"],
                        "confidence": file_confidence
                    })
                
                for biz in businesses:
                    all_locations.append({
                        "name": biz,
                        "type": "business",
                        "source": result["processing_metadata"]["file_info"]["filename"],
                        "confidence": file_confidence
                    })
                
                # Collect text information
                all_texts.append({
                    "filename": result["processing_metadata"]["file_info"]["filename"],
                    "raw_text": result.get("raw_text", ""),
                    "cleaned_text": result.get("cleaned_text", ""),
                    "confidence": file_confidence
                })
        
        # Deduplicate location information
        unique_locations = []
        seen_names = set()
        
        for loc in all_locations:
            name_lower = loc["name"].lower().strip()
            if name_lower and name_lower not in seen_names and len(name_lower) > 1:
                unique_locations.append(loc)
                seen_names.add(name_lower)
        
        # Calculate average confidence
        avg_confidence = (total_confidence_sum / total_files_with_confidence) if total_files_with_confidence > 0 else 0
        
        processing_stats["unique_locations"] = len(unique_locations)
        processing_stats["total_raw_locations"] = len(all_locations)
        processing_stats["average_confidence"] = avg_confidence
        
        logger.info(f"✅ Batch processing completed: {processing_stats['successful_files']}/{processing_stats['total_files']} successful, "
                   f"extracted {len(unique_locations)} unique locations from {len(all_locations)} total locations, "
                   f"avg confidence: {avg_confidence:.3f}")
        
        # Log location details for debugging
        for loc in unique_locations[:5]:  # Log first 5 locations
            logger.info(f"Location: {loc['name']} (type: {loc['type']}, confidence: {loc['confidence']:.3f}, source: {loc['source']})")
        
        return JSONResponse(content={
            "success": True,
            "processing_stats": processing_stats,
            "results": results,
            "aggregated_data": {
                "locations": unique_locations,
                "texts": all_texts,
                "summary": {
                    "total_unique_locations": len(unique_locations),
                    "average_confidence": avg_confidence,
                    "location_types": {
                        "locations": len([loc for loc in unique_locations if loc["type"] == "location"]),
                        "addresses": len([loc for loc in unique_locations if loc["type"] == "address"]),
                        "businesses": len([loc for loc in unique_locations if loc["type"] == "business"])
                    }
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Batch OCR processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")
    
    finally:
        # Clean up all temporary files
        for temp_file_path in temp_files:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

@app.post("/api/ai/process-image")
async def process_image_with_ai(
    file: UploadFile = File(...),
    content_type: str = Form(default="auto"),
    ai_model: str = Form(default="gpt-4"),
    preserve_context: bool = Form(default=True),
    enable_geocoding: bool = Form(default=True)
):
    """
    Enhanced OCR + AI Pipeline: Process image with context-preserving OCR and AI semantic processing
    
    Args:
        file: Uploaded image file
        content_type: Content type hint (auto, social_media, travel_itinerary, map_screenshot)
        ai_model: AI model to use (gpt-4, claude-3, auto)
        preserve_context: Whether to preserve spatial context in OCR
        enable_geocoding: Whether to perform AI-enhanced geocoding
    
    Returns:
        JSON: Enhanced processing results with OCR, AI, and geocoding phases
    """
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files are supported")
    
    temp_file_path = None
    start_time = time.time()
    
    try:
        logger.info(f"Starting Enhanced OCR + AI processing: {file.filename}")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Phase 1: Enhanced OCR with context preservation
        logger.info("Phase 1: Enhanced OCR processing...")
        ocr_result = enhanced_ocr_processor.process_image(temp_file_path)
        
        # Phase 2: AI semantic processing
        logger.info("Phase 2: AI semantic processing...")
        ai_result = ai_processor.process_ocr_chunks(
            [chunk.__dict__ for chunk in ocr_result.structured_chunks],
            ocr_result.content_type.content_type
        )
        
        # Phase 3: AI-enhanced geocoding (if enabled)
        geocoding_results = []
        if enable_geocoding and ai_result.semantic_locations:
            logger.info("Phase 3: AI-enhanced geocoding...")
            
            locations_for_geocoding = [
                {
                    'name': loc.name,
                    'context': loc.context,
                    'content_type': ocr_result.content_type.content_type
                }
                for loc in ai_result.semantic_locations
            ]
            
            geocoding_batch = intelligent_geocoder.geocode_batch(locations_for_geocoding)
            geocoding_results = [result.__dict__ for result in geocoding_batch.results]
        
        # Combine results
        processing_time = int((time.time() - start_time) * 1000)
        
        # Create final enriched locations
        final_locations = []
        for i, semantic_loc in enumerate(ai_result.semantic_locations):
            location_data = {
                "name": semantic_loc.name,
                "type": semantic_loc.type,
                "context": semantic_loc.context,
                "confidence": semantic_loc.confidence,
                "relationships": semantic_loc.relationships,
                "source": "ai_enhanced_ocr",
                "original_text": semantic_loc.original_text,
                "spatial_context": semantic_loc.spatial_context
            }
            
            # Add geocoding data if available
            if i < len(geocoding_results):
                geocoding_data = geocoding_results[i]
                location_data.update({
                    "coordinates": geocoding_data.get("coordinates"),
                    "address": geocoding_data.get("address"),
                    "place_id": geocoding_data.get("place_id"),
                    "geocoding_confidence": geocoding_data.get("confidence", 0)
                })
            
            final_locations.append(location_data)
        
        # Build comprehensive response
        response_data = {
            "success": True,
            "processing_pipeline": {
                "ocr_phase": {
                    "raw_text": ocr_result.raw_text,
                    "structured_chunks": [
                        {
                            "text": chunk.text,
                            "spatial_context": chunk.spatial_context,
                            "confidence": chunk.confidence,
                            "chunk_type": chunk.chunk_type,
                            "language": chunk.language
                        }
                        for chunk in ocr_result.structured_chunks
                    ],
                    "content_type": ocr_result.content_type.content_type,
                    "content_type_confidence": ocr_result.content_type.confidence,
                    "ocr_confidence": ocr_result.ocr_confidence,
                    "language_detected": ocr_result.content_type.language_detected
                },
                "ai_phase": {
                    "semantic_locations": [loc.__dict__ for loc in ai_result.semantic_locations],
                    "ai_confidence": ai_result.ai_confidence,
                    "model_used": ai_result.model_used,
                    "relationships_detected": ai_result.relationships_detected,
                    "content_analysis": ai_result.content_analysis
                },
                "geocoding_phase": {
                    "enriched_locations": geocoding_results,
                    "geocoding_enabled": enable_geocoding,
                    "success_rate": len(geocoding_results) / len(ai_result.semantic_locations) if ai_result.semantic_locations else 0
                }
            },
            "final_results": {
                "locations": final_locations,
                "summary": {
                    "total_locations": len(final_locations),
                    "high_confidence_locations": len([loc for loc in final_locations if loc["confidence"] > 0.8]),
                    "geocoded_locations": len([loc for loc in final_locations if loc.get("coordinates")]),
                    "processing_time_ms": processing_time,
                    "content_type": ocr_result.content_type.content_type,
                    "language_detected": ocr_result.content_type.language_detected
                }
            },
            "processing_metadata": {
                "filename": file.filename,
                "file_size": len(content),
                "content_type": file.content_type,
                "processed_at": datetime.now().isoformat(),
                "pipeline_version": "2.0.0"
            }
        }
        
        logger.info(f"✅ Enhanced processing completed: {len(final_locations)} locations, {processing_time}ms")
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"Enhanced OCR + AI processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Enhanced processing failed: {str(e)}")
    
    finally:
        # Clean up temporary files
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

@app.post("/api/ai/process-batch")
async def process_batch_with_ai(
    files: List[UploadFile] = File(...),
    ai_model: str = Form(default="gpt-4"),
    enable_relationship_mapping: bool = Form(default=True),
    enable_geocoding: bool = Form(default=True)
):
    """
    Batch process multiple images with Enhanced OCR + AI Pipeline
    
    Args:
        files: List of uploaded image files
        ai_model: AI model to use for processing
        enable_relationship_mapping: Whether to detect relationships between locations
        enable_geocoding: Whether to perform geocoding
    
    Returns:
        JSON: Batch processing results with aggregated data
    """
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Batch processing supports maximum 10 files")
    
    start_time = time.time()
    results = []
    temp_files = []
    all_locations = []
    
    try:
        logger.info(f"Starting Enhanced AI batch processing of {len(files)} files")
        
        for i, file in enumerate(files):
            logger.info(f"Processing file {i+1}/{len(files)}: {file.filename}")
            
            if not file.content_type.startswith('image/'):
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": "Unsupported file type",
                    "file_index": i
                })
                continue
            
            temp_file_path = None
            
            try:
                # Create temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
                    content = await file.read()
                    temp_file.write(content)
                    temp_file_path = temp_file.name
                    temp_files.append(temp_file_path)
                
                # Process with Enhanced OCR + AI Pipeline
                ocr_result = enhanced_ocr_processor.process_image(temp_file_path)
                ai_result = ai_processor.process_ocr_chunks(
                    [chunk.__dict__ for chunk in ocr_result.structured_chunks],
                    ocr_result.content_type.content_type
                )
                
                # Collect locations for batch geocoding
                file_locations = []
                for loc in ai_result.semantic_locations:
                    location_data = {
                        "name": loc.name,
                        "type": loc.type,
                        "context": loc.context,
                        "confidence": loc.confidence,
                        "source": file.filename,
                        "file_index": i
                    }
                    file_locations.append(location_data)
                    all_locations.append(location_data)
                
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "file_index": i,
                    "content_type": ocr_result.content_type.content_type,
                    "ocr_confidence": ocr_result.ocr_confidence,
                    "ai_confidence": ai_result.ai_confidence,
                    "locations": file_locations,
                    "structured_chunks": len(ocr_result.structured_chunks),
                    "processing_metadata": {
                        "content_type_confidence": ocr_result.content_type.confidence,
                        "language_detected": ocr_result.content_type.language_detected
                    }
                })
                
                logger.info(f"✅ File {file.filename}: {len(file_locations)} locations extracted")
                
            except Exception as e:
                logger.error(f"Error processing file {file.filename}: {e}")
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": str(e),
                    "file_index": i
                })
        
        # Batch geocoding if enabled
        geocoded_locations = []
        if enable_geocoding and all_locations:
            logger.info(f"Batch geocoding {len(all_locations)} locations...")
            
            locations_for_geocoding = [
                {
                    'name': loc['name'],
                    'context': loc['context'],
                    'content_type': 'mixed'
                }
                for loc in all_locations
            ]
            
            geocoding_batch = intelligent_geocoder.geocode_batch(locations_for_geocoding)
            geocoded_locations = [result.__dict__ for result in geocoding_batch.results]
        
        # Relationship mapping if enabled
        relationships = []
        if enable_relationship_mapping and all_locations:
            # This would require implementing cross-file relationship detection
            # For now, we'll leave it as a placeholder
            pass
        
        # Calculate statistics
        successful_files = len([r for r in results if r.get("success", False)])
        total_locations = len(all_locations)
        geocoded_count = len(geocoded_locations)
        processing_time = int((time.time() - start_time) * 1000)
        
        # Deduplicate locations
        unique_locations = []
        seen_names = set()
        
        for i, loc in enumerate(all_locations):
            name_lower = loc["name"].lower().strip()
            if name_lower and name_lower not in seen_names:
                # Add geocoding data if available
                if i < len(geocoded_locations):
                    loc.update(geocoded_locations[i])
                unique_locations.append(loc)
                seen_names.add(name_lower)
        
        response_data = {
            "success": True,
            "processing_stats": {
                "total_files": len(files),
                "successful_files": successful_files,
                "failed_files": len(files) - successful_files,
                "total_locations": total_locations,
                "unique_locations": len(unique_locations),
                "geocoded_locations": geocoded_count,
                "processing_time_ms": processing_time,
                "success_rate": successful_files / len(files) if files else 0,
                "geocoding_success_rate": geocoded_count / total_locations if total_locations else 0
            },
            "results": results,
            "aggregated_data": {
                "locations": unique_locations,
                "relationships": relationships,
                "summary": {
                    "content_types": {},  # Could be populated with content type distribution
                    "languages_detected": {},  # Could be populated with language distribution
                    "location_types": {
                        "restaurants": len([loc for loc in unique_locations if loc["type"] == "restaurant"]),
                        "landmarks": len([loc for loc in unique_locations if loc["type"] == "landmark"]),
                        "accommodations": len([loc for loc in unique_locations if loc["type"] == "accommodation"]),
                        "businesses": len([loc for loc in unique_locations if loc["type"] == "business"]),
                        "areas": len([loc for loc in unique_locations if loc["type"] == "area"])
                    }
                }
            }
        }
        
        logger.info(f"✅ Enhanced batch processing completed: {successful_files}/{len(files)} files, "
                   f"{len(unique_locations)} unique locations, {processing_time}ms")
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"Enhanced batch processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Enhanced batch processing failed: {str(e)}")
    
    finally:
        # Clean up all temporary files
        for temp_file_path in temp_files:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

@app.post("/api/ocr/test")
async def test_ocr_with_sample():
    """
    Test OCR functionality with sample images
    """
    # Find sample images
    sample_images_dir = "data"
    
    if not os.path.exists(sample_images_dir):
        raise HTTPException(status_code=404, detail="Sample images directory does not exist")
    
    # Find sample images
    sample_files = []
    for root, dirs, files in os.walk(sample_images_dir):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                sample_files.append(os.path.join(root, file))
    
    if not sample_files:
        raise HTTPException(status_code=404, detail="No sample images found")
    
    # Process first few sample images
    results = []
    for i, image_path in enumerate(sample_files[:3]):  # Only process first 3
        try:
            logger.info(f"Processing sample image: {image_path}")
            result = process_image_file(image_path, "auto")
            result["sample_image"] = os.path.basename(image_path)
            result["image_path"] = image_path
            results.append(result)
        except Exception as e:
            logger.error(f"Failed to process sample image {image_path}: {e}")
            results.append({
                "sample_image": os.path.basename(image_path),
                "image_path": image_path,
                "success": False,
                "error": str(e)
            })
    
    return JSONResponse(content={
        "success": True,
        "sample_results": results,
        "total_samples": len(sample_files),
        "processed_samples": len(results),
        "available_samples": [os.path.basename(f) for f in sample_files]
    })

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)