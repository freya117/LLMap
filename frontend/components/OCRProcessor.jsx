import { useState } from 'react';
import { createWorker } from 'tesseract.js';
// Image preprocessing tools - using Canvas API as browser-compatible solution

/**
 * OCR Processing Component
 * Supports both frontend Tesseract.js and backend API modes
 */
export default function OCRProcessor({ onOCRComplete, onError }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentFile, setCurrentFile] = useState('');
    const [ocrMode, setOcrMode] = useState('frontend'); // 'frontend' or 'backend'

    /**
     * Image preprocessing - using Canvas API to improve OCR accuracy
     */
    const preprocessImage = async (file) => {
        try {
            console.log(`Starting image preprocessing: ${file.name}`);
            
            // Create image object
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Convert file to Data URL
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            // Load image
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
            });
            
            // Calculate new dimensions - scale up if image is too small
            let newWidth = img.width;
            let newHeight = img.height;
            
            if (newWidth < 800 || newHeight < 600) {
                const scale = Math.max(800 / newWidth, 600 / newHeight);
                newWidth = Math.round(newWidth * scale);
                newHeight = Math.round(newHeight * scale);
                console.log(`Image scaled: ${img.width}x${img.height} -> ${newWidth}x${newHeight}`);
            }
            
            // Set canvas dimensions
            canvas.width = newWidth;
            canvas.height = newHeight;
            
            // Draw and preprocess image
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            
            // Get image data for processing
            const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
            const data = imageData.data;
            
            // Image preprocessing: convert to grayscale + enhance contrast
            for (let i = 0; i < data.length; i += 4) {
                // Convert to grayscale
                const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                
                // Enhance contrast (simple linear stretch)
                const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.3 + 128));
                
                data[i] = enhanced;     // R
                data[i + 1] = enhanced; // G
                data[i + 2] = enhanced; // B
                // data[i + 3] remains unchanged (Alpha)
            }
            
            // Put processed data back to canvas
            ctx.putImageData(imageData, 0, 0);
            
            // Convert to Blob
            const processedBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png', 0.95);
            });
            
            // Create new File object
            const processedFile = new File([processedBlob], `processed_${file.name}`, {
                type: 'image/png'
            });
            
            console.log(`✅ Image preprocessing completed: ${file.name} -> ${processedFile.name}`);
            return processedFile;
            
        } catch (error) {
            console.warn('Image preprocessing failed, using original image:', error);
            return file; // If preprocessing fails, return original file
        }
    };

    /**
     * Frontend Tesseract.js OCR processing - Enhanced version
     */
    const processFrontendOCR = async (file) => {
        let worker = null;
        
        try {
            setProgress(5);
            console.log(`Starting file processing: ${file.name}`);
            
            // Step 1: Image preprocessing
            setCurrentFile(`Preprocessing image: ${file.name}`);
            const preprocessedFile = await preprocessImage(file);
            setProgress(15);
            
            // Step 2: Create OCR worker
            setCurrentFile(`Initializing OCR engine: ${file.name}`);
            worker = await createWorker('eng+chi_sim', 1, {
                logger: m => {
                    console.log('OCR Progress:', m);
                    if (m.status === 'recognizing text') {
                        setProgress(50 + Math.round(m.progress * 40)); // 50-90%
                    } else if (m.status === 'loading tesseract core') {
                        setProgress(15 + Math.round(m.progress * 15)); // 15-30%
                    } else if (m.status === 'initializing tesseract') {
                        setProgress(30 + Math.round(m.progress * 20)); // 30-50%
                    }
                }
            });

            // Step 3: Optimize OCR parameters
            await worker.setParameters({
                // Extended character whitelist with more symbols and Chinese punctuation
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,!?@#$%^&*()_+-=[]{}|;:\'\"<>/\\ ·•★☆⭐️🌟💫✨⚡️🔥💯👍👎❤️💕🎉🎊🎈',
                tessedit_pageseg_mode: '6',     // Uniform text block
                preserve_interword_spaces: '1', // Preserve inter-word spaces
                tessedit_do_invert: '0',       // Don't invert image
                tessedit_create_hocr: '1',     // Create HOCR output
                tessedit_create_tsv: '1'       // Create TSV output
            });

            // Step 4: Execute OCR recognition
            setCurrentFile(`Recognizing text: ${file.name}`);
            const { data: { text, confidence, hocr, tsv } } = await worker.recognize(preprocessedFile);
            setProgress(90);
            
            // Step 5: Process and clean text
            setCurrentFile(`Processing results: ${file.name}`);
            const processedResult = await processFrontendOCRText(text, confidence, file.name, hocr, tsv);
            setProgress(100);
            
            console.log(`✅ OCR processing completed: ${file.name}, confidence: ${confidence.toFixed(1)}%`);
            return processedResult;
            
        } catch (error) {
            console.error('Frontend OCR processing error:', error);
            throw new Error(`OCR processing failed: ${error.message}`);
        } finally {
            if (worker) {
                await worker.terminate();
            }
        }
    };

    /**
     * Process frontend OCR text results - Enhanced version
     */
    const processFrontendOCRText = async (text, confidence, filename, hocr = null, tsv = null) => {
        console.log(`Starting OCR text result processing: ${filename}`);
        
        // Step 1: Text cleaning and denoising
        const cleanedText = cleanAndDenoiseText(text);
        
        // Step 2: Extract structured information
        const structuredData = await extractStructuredData(cleanedText, hocr, tsv);
        
        // Step 3: Geographic information extraction
        const geoInfo = extractGeographicInfo(cleanedText);
        
        // Step 4: Business information extraction
        const businessInfo = extractBusinessInfo(cleanedText);
        
        // Step 5: Rating and contact information extraction
        const contactInfo = extractContactInfo(cleanedText);
        
        console.log(`✅ Text processing completed: ${filename}, extracted ${geoInfo.locations.length + geoInfo.addresses.length + businessInfo.business_names.length} locations`);
        
        return {
            success: true,
            filename: filename,
            raw_text: text,
            cleaned_text: cleanedText,
            confidence: confidence / 100, // Convert to 0-1 range
            processing_metadata: {
                hocr_available: !!hocr,
                tsv_available: !!tsv,
                processed_at: new Date().toISOString(),
                text_quality: assessTextQuality(cleanedText, confidence)
            },
            structured_data: {
                ...geoInfo,
                ...businessInfo,
                ...contactInfo,
                text_stats: {
                    text_length: cleanedText.length,
                    word_count: cleanedText.split(/\s+/).length,
                    line_count: cleanedText.split('\n').length,
                    has_chinese: /[\u4e00-\u9fff]/.test(cleanedText),
                    has_numbers: /\d/.test(cleanedText),
                    has_special_chars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(cleanedText)
                }
            },
            extracted_info: {
                locations: [...geoInfo.locations, ...geoInfo.addresses, ...businessInfo.business_names],
                addresses: geoInfo.addresses,
                business_names: businessInfo.business_names,
                ratings: contactInfo.ratings,
                phone_numbers: contactInfo.phone_numbers,
                websites: contactInfo.websites,
                social_handles: contactInfo.social_handles
            }
        };
    };

    /**
     * Text cleaning and denoising
     */
    const cleanAndDenoiseText = (text) => {
        let cleaned = text;
        
        // 1. Remove excess whitespace characters
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        // 2. Fix common OCR errors
        const ocrFixes = {
            // Number fixes
            'O': '0', 'l': '1', 'I': '1', 'S': '5',
            // Common word fixes
            'rn': 'm', 'vv': 'w', 'ii': 'll',
            // Punctuation fixes
            '，': ',', '。': '.', '：': ':', '；': ';'
        };
        
        // Apply OCR fixes (carefully applied to avoid over-correction)
        Object.entries(ocrFixes).forEach(([wrong, correct]) => {
            // Only fix in specific contexts
            cleaned = cleaned.replace(new RegExp(`\\b${wrong}\\b`, 'g'), correct);
        });
        
        // 3. Normalize line breaks
        cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // 4. Remove duplicate punctuation
        cleaned = cleaned.replace(/([.!?])\1+/g, '$1');
        
        // 5. Fix spacing issues
        cleaned = cleaned.replace(/\s+([.!?,:;])/g, '$1'); // Space before punctuation
        cleaned = cleaned.replace(/([.!?])\s*([A-Z])/g, '$1 $2'); // Space between sentences
        
        return cleaned.trim();
    };

    /**
     * Assess text quality
     */
    const assessTextQuality = (text, confidence) => {
        let score = confidence / 100; // Base score from OCR confidence
        
        // Length factor
        if (text.length > 100) score += 0.1;
        if (text.length > 500) score += 0.1;
        
        // Structure factor
        if (/\d+\.\d+/.test(text)) score += 0.05; // Has ratings
        if (/\(\d{3}\)/.test(text)) score += 0.05; // Has phone
        if (/[A-Z][a-z]+ (Street|Ave|Road)/.test(text)) score += 0.1; // Has address
        
        // Noise penalty
        const noiseRatio = (text.match(/[^\w\s.,!?-]/g) || []).length / text.length;
        if (noiseRatio > 0.1) score -= 0.2;
        
        return Math.max(0, Math.min(1, score));
    };

    /**
     * Extract structured data
     */
    const extractStructuredData = async (text, hocr, tsv) => {
        const structured = {
            paragraphs: text.split('\n\n').filter(p => p.trim()),
            sentences: text.split(/[.!?]+/).filter(s => s.trim()),
            lines: text.split('\n').filter(l => l.trim())
        };
        
        // If HOCR data is available, extract position information
        if (hocr) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(hocr, 'text/html');
                const words = doc.querySelectorAll('.ocrx_word');
                structured.word_positions = Array.from(words).map(word => ({
                    text: word.textContent,
                    bbox: word.getAttribute('title')?.match(/bbox (\d+) (\d+) (\d+) (\d+)/)?.slice(1).map(Number)
                }));
            } catch (error) {
                console.warn('HOCR parsing failed:', error);
            }
        }
        
        return structured;
    };

    /**
     * Extract geographic information - Enhanced version
     */
    const extractGeographicInfo = (text) => {
        const locations = [];
        const addresses = [];
        const landmarks = [];
        
        // Address patterns (more comprehensive)
        const addressPatterns = [
            /\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Place|Pl|Court|Ct)/gi,
            /\d+\s+[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(Street|St|Avenue|Ave|Road|Rd)/gi,
            /[A-Z][a-z]+\s+(Street|Avenue|Road|Boulevard|Drive|Lane)\s+\d+/gi
        ];
        
        // Location name patterns
        const locationPatterns = [
            /[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}(?=\s+(Restaurant|Cafe|Bar|Grill|Bistro|Deli|Shop|Store|Market|Plaza|Center|Mall|Park|Square))/gi,
            /[A-Z][a-z']+(?:\s+[A-Z][a-z']+)*(?=\s+\d+\.\d+)/g, // Names before ratings
            /(Times Square|Central Park|Brooklyn Bridge|Manhattan|Queens|Bronx|Staten Island)/gi // Famous landmarks
        ];
        
        // City and state patterns
        const cityStatePatterns = [
            /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s+\d{5}/g, // City, ST 12345
            /(New York|NYC|Manhattan|Brooklyn|Queens|Bronx|Staten Island)/gi
        ];
        
        // Extract addresses
        addressPatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            addresses.push(...matches.map(addr => addr.trim()));
        });
        
        // Extract location names
        locationPatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            locations.push(...matches.map(loc => loc.trim()));
        });
        
        // Extract cities and states
        const cityStateMatches = [];
        cityStatePatterns.forEach(pattern => {
            const matches = [...text.matchAll(pattern)];
            cityStateMatches.push(...matches.map(match => match[0]));
        });
        
        return {
            locations: [...new Set(locations)],
            addresses: [...new Set(addresses)],
            cities_states: [...new Set(cityStateMatches)],
            landmarks: [...new Set(landmarks)]
        };
    };

    /**
     * Extract business information
     */
    const extractBusinessInfo = (text) => {
        const businessNames = [];
        const businessTypes = [];
        
        // Business name patterns (more precise)
        const businessPatterns = [
            /[A-Z][a-z'&]+(?:\s+[A-Z][a-z'&]+)*\s+(Restaurant|Cafe|Coffee|Bar|Grill|Bistro|Deli|Bakery|Pizza|Sushi|Thai|Chinese|Italian|Mexican|Indian)/gi,
            /[A-Z][a-z'&]+(?:\s+[A-Z][a-z'&]+)*(?=\s+[•·]\s*\d+\.\d+)/g, // Names before ratings
            /(McDonald's|Starbucks|Subway|KFC|Pizza Hut|Domino's|Burger King|Taco Bell)/gi // Famous chains
        ];
        
        // Business type patterns
        const typePatterns = [
            /(Restaurant|Cafe|Coffee Shop|Bar|Grill|Bistro|Deli|Bakery|Fast Food|Fine Dining)/gi,
            /(Shopping Mall|Department Store|Grocery Store|Supermarket|Pharmacy|Bank)/gi,
            /(Hotel|Motel|Inn|Resort|Bed & Breakfast)/gi
        ];
        
        businessPatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            businessNames.push(...matches.map(name => name.trim()));
        });
        
        typePatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            businessTypes.push(...matches.map(type => type.trim()));
        });
        
        return {
            business_names: [...new Set(businessNames)],
            business_types: [...new Set(businessTypes)]
        };
    };

    /**
     * Extract contact information and ratings
     */
    const extractContactInfo = (text) => {
        // Rating patterns
        const ratings = [];
        const ratingPatterns = [
            /\b([1-5])\.([0-9])\s*(?:stars?|★|⭐)/gi,
            /\b([1-5])\s*\/\s*5\s*(?:stars?)?/gi,
            /★+\s*([1-5]\.[0-9])/gi
        ];
        
        ratingPatterns.forEach(pattern => {
            const matches = [...text.matchAll(pattern)];
            ratings.push(...matches.map(match => parseFloat(match[1] + '.' + (match[2] || '0'))));
        });
        
        // Phone number patterns
        const phoneNumbers = [];
        const phonePatterns = [
            /\((\d{3})\)\s*(\d{3})-(\d{4})/g, // (123) 456-7890
            /(\d{3})-(\d{3})-(\d{4})/g,       // 123-456-7890
            /(\d{3})\.(\d{3})\.(\d{4})/g      // 123.456.7890
        ];
        
        phonePatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            phoneNumbers.push(...matches);
        });
        
        // Websites and social media
        const websites = text.match(/https?:\/\/[^\s]+/gi) || [];
        const socialHandles = text.match(/@[a-zA-Z0-9_]+/g) || [];
        
        return {
            ratings: [...new Set(ratings)],
            phone_numbers: [...new Set(phoneNumbers)],
            websites: [...new Set(websites)],
            social_handles: [...new Set(socialHandles)],
            has_ratings: ratings.length > 0,
            has_phone: phoneNumbers.length > 0,
            has_website: websites.length > 0
        };
    };

    /**
     * Extract location information from text
     */
    const extractLocationsFromText = (text) => {
        const patterns = [
            /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,  // Two capitalized words
            /\b[A-Z][a-z]+ Street\b/g,       // Street names
            /\b[A-Z][a-z]+ Ave\b/g,          // Avenue names
            /\b[A-Z][a-z]+ Road\b/g,         // Road names
        ];
        
        const locations = [];
        patterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            locations.push(...matches);
        });
        
        return [...new Set(locations)]; // Remove duplicates
    };

    /**
     * Extract address information from text
     */
    const extractAddressesFromText = (text) => {
        const patterns = [
            /\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)/g,
            /\d+\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd)/g,
        ];
        
        const addresses = [];
        patterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            addresses.push(...matches);
        });
        
        return [...new Set(addresses)];
    };

    /**
     * Extract business names from text
     */
    const extractBusinessNamesFromText = (text) => {
        const patterns = [
            /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Restaurant|Cafe|Bar|Grill|Bistro|Deli)/g,
            /[A-Z][a-z']+(?:\s+[A-Z][a-z']+)*(?=\s+\d+\.\d+)/g,  // Names before ratings
        ];
        
        const names = [];
        patterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            names.push(...matches);
        });
        
        return [...new Set(names)];
    };

    /**
     * Backend API OCR processing
     */
    const processBackendOCR = async (file, engine = 'auto') => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('engine', engine);

        try {
            const response = await fetch('http://localhost:8000/api/ocr/process', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`OCR processing failed: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Backend OCR processing error:', error);
            throw error;
        }
    };

    /**
     * Batch OCR processing for files
     */
    const processBatchFiles = async (files, engine = 'auto') => {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });
        formData.append('engine', engine);

        try {
            const response = await fetch('http://localhost:8000/api/ocr/batch', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Batch OCR processing failed: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Batch OCR processing error:', error);
            throw error;
        }
    };

    /**
     * Main processing function - supports frontend and backend modes
     */
    const processFiles = async (files, engine = 'auto') => {
        if (!files || files.length === 0) {
            onError?.('No files selected');
            return;
        }

        setIsProcessing(true);
        setProgress(0);

        try {
            let results = [];
            
            // Choose processing method based on mode
            if (ocrMode === 'frontend') {
                // Frontend processing mode
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    setCurrentFile(`Processing ${file.name} (${i + 1}/${files.length})`);
                    
                    try {
                        const result = await processFrontendOCR(file);
                        results.push(result);
                    } catch (error) {
                        console.error(`Failed to process file ${file.name}:`, error);
                        results.push({
                            filename: file.name,
                            success: false,
                            error: error.message
                        });
                    }
                }
            } else {
                // Backend processing mode
                if (files.length === 1) {
                    setCurrentFile(files[0].name);
                    const result = await processBackendOCR(files[0], engine);
                    results = [result];
                } else {
                    setCurrentFile(`Processing ${files.length} files`);
                    const batchResult = await processBatchFiles(files, engine);
                    results = batchResult.results;
                }
            }

            // Unify result format
            const unifiedResults = {
                success: true,
                processed_count: results.filter(r => r.success).length,
                total_count: files.length,
                results: results
            };

            // Process results and extract geographic information
            const processedResults = processOCRResults(unifiedResults);
            
            onOCRComplete?.(processedResults);

        } catch (error) {
            console.error('OCR processing failed:', error);
            onError?.(error.message || 'OCR processing failed');
        } finally {
            setIsProcessing(false);
            setProgress(0);
            setCurrentFile('');
        }
    };

    /**
     * Process OCR results and extract geographic information
     */
    const processOCRResults = (ocrResults) => {
        const allLocations = [];
        const allTexts = [];
        const processingStats = {
            totalFiles: ocrResults.total_count,
            successfulFiles: ocrResults.processed_count,
            failedFiles: ocrResults.total_count - ocrResults.processed_count,
            totalConfidence: 0,
            averageConfidence: 0
        };

        let totalConfidence = 0;
        let confidenceCount = 0;

        ocrResults.results.forEach((result, index) => {
            if (result.success) {
                // Collect text
                allTexts.push({
                    filename: result.filename || result.file_info?.filename || `File${index + 1}`,
                    rawText: result.raw_text,
                    cleanedText: result.cleaned_text,
                    confidence: result.confidence
                });

                // Collect geographic information
                if (result.extracted_info) {
                    const { locations, addresses, business_names } = result.extracted_info;
                    
                    // Combine all possible location information
                    const combinedLocations = [
                        ...locations.map(loc => ({ name: loc, type: 'location', source: result.filename })),
                        ...addresses.map(addr => ({ name: addr, type: 'address', source: result.filename })),
                        ...business_names.map(name => ({ name: name, type: 'business', source: result.filename }))
                    ];

                    allLocations.push(...combinedLocations);
                }

                // Calculate confidence statistics
                if (result.confidence > 0) {
                    totalConfidence += result.confidence;
                    confidenceCount++;
                }
            }
        });

        // Calculate average confidence
        processingStats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
        processingStats.totalConfidence = totalConfidence;

        // Deduplicate location information
        const uniqueLocations = allLocations.filter((location, index, self) => 
            index === self.findIndex(l => l.name.toLowerCase() === location.name.toLowerCase())
        );

        return {
            locations: uniqueLocations,
            texts: allTexts,
            stats: processingStats,
            rawResults: ocrResults
        };
    };

    return {
        processFiles,
        isProcessing,
        progress,
        currentFile,
        ocrMode,
        setOcrMode
    };
}

/**
 * OCR Status Display Component
 */
export function OCRStatus({ isProcessing, progress, currentFile }) {
    if (!isProcessing) return null;

    return (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center mb-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm font-medium text-blue-900">Processing OCR...</span>
            </div>
            
            {currentFile && (
                <p className="text-xs text-blue-700 mb-2">{currentFile}</p>
            )}
            
            <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            
            <p className="text-xs text-blue-600 mt-1">{progress}% Complete</p>
        </div>
    );
}

/**
 * OCR Results Display Component
 */
export function OCRResults({ results, onLocationSelect }) {
    if (!results || !results.locations.length) return null;

    return (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-sm font-medium text-green-900 mb-3">
                🔍 OCR Extraction Results ({results.locations.length} locations)
            </h3>
            
            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                <div className="bg-white p-2 rounded">
                    <span className="text-gray-500">Processed files:</span>
                    <span className="font-medium ml-1">
                        {results.stats.successfulFiles}/{results.stats.totalFiles}
                    </span>
                </div>
                <div className="bg-white p-2 rounded">
                    <span className="text-gray-500">Average confidence:</span>
                    <span className="font-medium ml-1">
                        {(results.stats.averageConfidence * 100).toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* Location list */}
            <div className="space-y-2 max-h-40 overflow-y-auto">
                {results.locations.map((location, index) => (
                    <div 
                        key={index}
                        className="flex items-center justify-between p-2 bg-white rounded border hover:bg-gray-50 cursor-pointer"
                        onClick={() => onLocationSelect?.(location)}
                    >
                        <div className="flex-1">
                            <span className="text-sm font-medium">{location.name}</span>
                            <div className="flex items-center mt-1">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                    location.type === 'business' ? 'bg-blue-100 text-blue-700' :
                                    location.type === 'address' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-700'
                                }`}>
                                    {location.type === 'business' ? 'Business' : 
                                     location.type === 'address' ? 'Address' : 'Location'}
                                </span>
                                {location.source && (
                                    <span className="text-xs text-gray-500 ml-2">
                                        Source: {location.source}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button className="text-blue-600 hover:text-blue-800 text-sm">
                            Select →
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}