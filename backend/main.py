from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import tempfile
from typing import List
from dotenv import load_dotenv
import uvicorn
import logging
from datetime import datetime
from ocr_processor import process_image_file, ocr_processor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LLMap Backend API",
    description="AI-powered location extraction and mapping backend with advanced OCR",
    version="1.0.0"
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