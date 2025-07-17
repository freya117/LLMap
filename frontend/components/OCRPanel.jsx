import { useState } from 'react';
import OCRProcessor, { OCRStatus, OCRResults } from './OCRProcessor';

/**
 * OCR Processing Panel - Complete interface integrating OCR functionality
 */
export default function OCRPanel({ onLocationsExtracted, onError }) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [ocrResults, setOcrResults] = useState(null);
    const [processingMode, setProcessingMode] = useState('backend'); // 'frontend' or 'backend'
    const [ocrEngine, setOcrEngine] = useState('auto'); // 'tesseract', 'paddle', 'auto'
    const [sampleImages, setSampleImages] = useState([]);

    // Initialize OCR processor
    const ocrProcessor = OCRProcessor({
        onOCRComplete: handleOCRComplete,
        onError: handleOCRError
    });

    /**
     * Load sample images from data folder
     */
    const loadSampleImages = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/ocr/test', {
                method: 'POST'
            });
            
            if (response.ok) {
                const testResults = await response.json();
                console.log('Sample images loaded:', testResults);
                onError?.(`Loaded ${testResults.processed_samples} sample images for testing`);
                
                // Process the sample results if available
                if (testResults.sample_results && testResults.sample_results.length > 0) {
                    const sampleResults = {
                        locations: [],
                        texts: [],
                        stats: {
                            totalFiles: testResults.processed_samples,
                            successfulFiles: testResults.sample_results.filter(r => r.success).length,
                            averageConfidence: 0
                        }
                    };
                    
                    testResults.sample_results.forEach((result, index) => {
                        if (result.success && result.extracted_info) {
                            const { locations, addresses, business_names } = result.extracted_info;
                            
                            [...locations, ...addresses, ...business_names].forEach((name, i) => {
                                sampleResults.locations.push({
                                    name: name,
                                    type: 'location',
                                    source: result.sample_image,
                                    confidence: result.confidence || 0.8
                                });
                            });
                        }
                    });
                    
                    setOcrResults(sampleResults);
                }
            } else {
                onError?.('Failed to load sample images. Make sure the backend is running.');
            }
        } catch (error) {
            console.error('Error loading sample images:', error);
            onError?.('Error loading sample images. Check backend connection.');
        }
    };

    /**
     * Handle file selection
     */
    const handleFileSelect = (event) => {
        const files = Array.from(event.target.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length !== files.length) {
            onError?.('Only image files are supported. Non-image files have been filtered out.');
        }
        
        setSelectedFiles(imageFiles);
        setOcrResults(null); // Clear previous results
    };

    /**
     * Handle drag and drop upload
     */
    const handleDrop = (event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...imageFiles]);
        } else {
            onError?.('Please drag image files');
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
    };

    /**
     * Start OCR processing
     */
    const startOCRProcessing = async () => {
        if (selectedFiles.length === 0) {
            onError?.('Please select image files first');
            return;
        }

        // Set OCR mode
        ocrProcessor.setOcrMode(processingMode);
        
        // Start processing
        await ocrProcessor.processFiles(selectedFiles, ocrEngine);
    };

    /**
     * OCR completion callback
     */
    function handleOCRComplete(results) {
        console.log('OCR processing completed:', results);
        setOcrResults(results);
        
        // Pass extracted location information to parent component
        if (results.locations && results.locations.length > 0) {
            // Convert to standard format
            const standardLocations = results.locations.map((loc, index) => ({
                id: `ocr_${index}`,
                name: loc.name,
                type: loc.type === 'business' ? 'Business' : 
                      loc.type === 'address' ? 'Address' : 'Location',
                address: loc.type === 'address' ? loc.name : '',
                source: loc.source || 'OCR',
                confidence: 0.8, // Default confidence for OCR extraction
                // Note: No coordinates yet, requires subsequent geocoding
                needsGeocoding: true
            }));
            
            onLocationsExtracted?.(standardLocations);
        }
    }

    /**
     * OCR error callback
     */
    function handleOCRError(error) {
        console.error('OCR processing error:', error);
        onError?.(error);
    }

    /**
     * Remove selected file
     */
    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    /**
     * Clear all files
     */
    const clearAllFiles = () => {
        setSelectedFiles([]);
        setOcrResults(null);
    };

    /**
     * Location selection callback
     */
    const handleLocationSelect = (location) => {
        console.log('Selected location:', location);
        // Location-specific processing logic can be added here
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                    🔍 OCR Text Recognition
                </h2>
                <div className="flex items-center space-x-2">
                    {/* Load sample images button */}
                    <button
                        onClick={loadSampleImages}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                        disabled={ocrProcessor.isProcessing}
                    >
                        📷 Load Sample Images
                    </button>
                    
                    {/* OCR mode selection */}
                    <select
                        value={processingMode}
                        onChange={(e) => setProcessingMode(e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                        disabled={ocrProcessor.isProcessing}
                    >
                        <option value="frontend">Frontend Processing</option>
                        <option value="backend">Backend Processing</option>
                    </select>
                    
                    {/* OCR engine selection (backend mode) */}
                    {processingMode === 'backend' && (
                        <select
                            value={ocrEngine}
                            onChange={(e) => setOcrEngine(e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                            disabled={ocrProcessor.isProcessing}
                        >
                            <option value="auto">Auto Select</option>
                            <option value="tesseract">Tesseract</option>
                            <option value="paddle">PaddleOCR</option>
                        </select>
                    )}
                </div>
            </div>

            <p className="text-gray-600 mb-6">
                Upload images containing location information (screenshots, photos, etc.). AI will automatically recognize and extract geographic location information.
                Supports mixed English and Chinese recognition.
            </p>

            {/* File upload area */}
            <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <div className="space-y-4">
                    <div className="text-4xl">📷</div>
                    <div>
                        <p className="text-lg font-medium text-gray-900">
                            Drag image files here
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            or click to select files
                        </p>
                    </div>
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="ocr-file-input"
                        disabled={ocrProcessor.isProcessing}
                    />
                    <label
                        htmlFor="ocr-file-input"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                    >
                        Select Image Files
                    </label>
                </div>
            </div>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
                <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-900">
                            Selected {selectedFiles.length} files
                        </h3>
                        <button
                            onClick={clearAllFiles}
                            className="text-xs text-red-600 hover:text-red-800"
                            disabled={ocrProcessor.isProcessing}
                        >
                            Clear All
                        </button>
                    </div>
                    
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium">{file.name}</span>
                                    <span className="text-xs text-gray-500">
                                        ({(file.size / 1024).toFixed(1)} KB)
                                    </span>
                                </div>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                    disabled={ocrProcessor.isProcessing}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Start processing button */}
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={startOCRProcessing}
                            disabled={ocrProcessor.isProcessing || selectedFiles.length === 0}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {ocrProcessor.isProcessing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <span>🚀</span>
                                    <span>Start OCR Recognition</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* OCR processing status */}
            <OCRStatus
                isProcessing={ocrProcessor.isProcessing}
                progress={ocrProcessor.progress}
                currentFile={ocrProcessor.currentFile}
            />

            {/* OCR results display */}
            <OCRResults
                results={ocrResults}
                onLocationSelect={handleLocationSelect}
            />

            {/* Processing mode explanation */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Processing Mode Explanation</h4>
                <div className="text-xs text-gray-600 space-y-1">
                    <p><strong>Frontend Processing:</strong> Uses Tesseract.js in browser, data won't be uploaded to server, but processing is slower</p>
                    <p><strong>Backend Processing:</strong> Uses server-side OCR engines, faster processing with more features, but requires image upload</p>
                </div>
            </div>
        </div>
    );
}

/**
 * OCR Quick Actions Button Component
 */
export function OCRQuickActions({ onLoadSampleImages, onClearResults }) {
    return (
        <div className="flex items-center space-x-2 mb-4">
            <button
                onClick={onLoadSampleImages}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
            >
                📷 Load Sample Images
            </button>
            <button
                onClick={onClearResults}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
            >
                🗑️ Clear Results
            </button>
        </div>
    );
}