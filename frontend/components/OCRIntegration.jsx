import { useState, useCallback } from 'react';
import OCRProcessor, { OCRStatus, OCRResults } from './OCRProcessor';

/**
 * OCR Integration Component - Unified frontend and backend OCR functionality
 * Supports both frontend Tesseract.js and backend API modes
 */
export default function OCRIntegration({ onLocationsExtracted, onError }) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [ocrResults, setOcrResults] = useState(null);
    const [processingMode, setProcessingMode] = useState('frontend'); // 'frontend' or 'backend'
    const [ocrEngine, setOcrEngine] = useState('auto'); // 'tesseract', 'paddle', 'auto'
    const [availableEngines, setAvailableEngines] = useState(null);
    const [isLoadingEngines, setIsLoadingEngines] = useState(false);

    // Initialize OCR processor
    const ocrProcessor = OCRProcessor({
        onOCRComplete: handleOCRComplete,
        onError: handleOCRError
    });

    /**
     * Get available OCR engine information
     */
    const fetchAvailableEngines = useCallback(async () => {
        if (processingMode !== 'backend') return;
        
        setIsLoadingEngines(true);
        try {
            const response = await fetch('http://localhost:8000/api/ocr/engines');
            if (response.ok) {
                const data = await response.json();
                setAvailableEngines(data);
                setOcrEngine(data.recommended || 'auto');
            } else {
                console.warn('Unable to get backend engine information');
            }
        } catch (error) {
            console.warn('Failed to get backend engine information:', error);
        } finally {
            setIsLoadingEngines(false);
        }
    }, [processingMode]);

    /**
     * Handle processing mode change
     */
    const handleModeChange = useCallback((newMode) => {
        setProcessingMode(newMode);
        ocrProcessor.setOcrMode(newMode);
        
        // If switching to backend mode, get available engines
        if (newMode === 'backend') {
            fetchAvailableEngines();
        }
    }, [ocrProcessor, fetchAvailableEngines]);

    /**
     * Handle file selection - automatically start processing
     */
    const handleFileSelect = useCallback(async (event) => {
        const files = Array.from(event.target.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length !== files.length) {
            onError?.('Only image files are supported, non-image files have been filtered out');
        }
        
        setSelectedFiles(imageFiles);
        setOcrResults(null); // Clear previous results
        
        // Automatically start processing
        if (imageFiles.length > 0) {
            setTimeout(() => startOCRProcessing(imageFiles), 500); // Brief delay to ensure state update
        }
    }, [onError, startOCRProcessing]);

    /**
     * Handle drag and drop upload - automatically start processing
     */
    const handleDrop = useCallback(async (event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
            const newFiles = [...selectedFiles, ...imageFiles];
            setSelectedFiles(newFiles);
            setOcrResults(null); // Clear previous results
            
            // Automatically start processing newly uploaded files
            setTimeout(() => startOCRProcessing(newFiles), 500);
        } else {
            onError?.('Please drag image files');
        }
    }, [onError, selectedFiles, startOCRProcessing]);

    const handleDragOver = useCallback((event) => {
        event.preventDefault();
    }, []);

    /**
     * Automatically start OCR processing (triggered after file upload)
     */
    const startOCRProcessing = useCallback(async (filesToProcess = null) => {
        const files = filesToProcess || selectedFiles;
        if (files.length === 0) {
            onError?.('Please select image files first');
            return;
        }

        // Set OCR mode and engine
        ocrProcessor.setOcrMode(processingMode);
        
        // Start processing
        await ocrProcessor.processFiles(files, ocrEngine);
    }, [selectedFiles, processingMode, ocrEngine, ocrProcessor, onError]);

    /**
     * OCR completion callback
     */
    function handleOCRComplete(results) {
        console.log('OCR processing completed:', results);
        setOcrResults(results);
        
        // Pass extracted location information to parent component
        if (results.locations && results.locations.length > 0) {
            // Convert to standard format
            const standardLocations = convertOCRResultsToStandardFormat(results);
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
     * Convert OCR results to standard location format
     */
    const convertOCRResultsToStandardFormat = useCallback((ocrResults) => {
        return ocrResults.locations.map((location, index) => ({
            id: `ocr_${Date.now()}_${index}`,
            name: location.name,
            type: getLocationTypeLabel(location.type),
            address: location.type === 'address' ? location.name : '',
            source: location.source || 'OCR',
            confidence: location.confidence || 0.8,
            extractedFrom: location.source,
            metadata: {
                ocr_type: location.type,
                source_file: location.source,
                needs_geocoding: true,
                processing_mode: processingMode,
                engine_used: ocrEngine
            }
        }));
    }, [processingMode, ocrEngine]);

    /**
     * Get location type label
     */
    const getLocationTypeLabel = useCallback((type) => {
        const typeMap = {
            'business': 'Business',
            'address': 'Address',
            'location': 'Location',
            'landmark': 'Landmark',
            'street': 'Street'
        };
        return typeMap[type] || 'Location';
    }, []);

    /**
     * Remove selected file
     */
    const removeFile = useCallback((index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    /**
     * Clear all files
     */
    const clearAllFiles = useCallback(() => {
        setSelectedFiles([]);
        setOcrResults(null);
    }, []);

    /**
     * Handle location selection callback
     */
    const handleLocationSelect = useCallback((location) => {
        console.log('Selected location:', location);
        // Can add individual location processing logic here
    }, []);

    /**
     * Test backend OCR functionality
     */
    const testBackendOCR = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:8000/api/ocr/test', {
                method: 'POST'
            });
            
            if (response.ok) {
                const testResults = await response.json();
                console.log('Backend OCR test results:', testResults);
                
                // Convert test results to standard format
                if (testResults.sample_results && testResults.sample_results.length > 0) {
                    const testLocations = [];
                    
                    testResults.sample_results.forEach((result, index) => {
                        if (result.success && result.extracted_info) {
                            const { locations, addresses, business_names } = result.extracted_info;
                            
                            [...locations, ...addresses, ...business_names].forEach((name, i) => {
                                testLocations.push({
                                    id: `test_${index}_${i}`,
                                    name: name,
                                    type: 'Test Location',
                                    source: result.sample_image,
                                    confidence: result.confidence || 0.8,
                                    metadata: {
                                        is_test_data: true,
                                        sample_image: result.sample_image
                                    }
                                });
                            });
                        }
                    });
                    
                    if (testLocations.length > 0) {
                        onLocationsExtracted?.(testLocations);
                    }
                }
                
                onError?.(`Backend test completed: processed ${testResults.processed_samples} sample images`);
            } else {
                throw new Error('Backend test failed');
            }
        } catch (error) {
            console.error('Backend OCR test failed:', error);
            onError?.('Backend OCR test failed, please ensure backend service is running');
        }
    }, [onLocationsExtracted, onError]);

    return (
        <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                    🔍 OCR Text Recognition
                </h2>
                <div className="flex items-center space-x-2">
                    {/* OCR Mode Selection */}
                    <select
                        value={processingMode}
                        onChange={(e) => handleModeChange(e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                        disabled={ocrProcessor.isProcessing}
                    >
                        <option value="frontend">Frontend Processing</option>
                        <option value="backend">Backend Processing</option>
                    </select>
                    
                    {/* OCR Engine Selection (Backend Mode) */}
                    {processingMode === 'backend' && (
                        <select
                            value={ocrEngine}
                            onChange={(e) => setOcrEngine(e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                            disabled={ocrProcessor.isProcessing || isLoadingEngines}
                        >
                            <option value="auto">Auto Select</option>
                            <option value="tesseract">Tesseract</option>
                            <option value="paddle">PaddleOCR</option>
                        </select>
                    )}
                    
                    {/* Test Button */}
                    {processingMode === 'backend' && (
                        <button
                            onClick={testBackendOCR}
                            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                            disabled={ocrProcessor.isProcessing}
                        >
                            Test Backend
                        </button>
                    )}
                </div>
            </div>

            {/* Engine Status Display */}
            {processingMode === 'backend' && availableEngines && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Backend Engine Status</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(availableEngines.engines).map(([key, engine]) => (
                            <div key={key} className="flex items-center">
                                <span className={engine.available ? 'text-green-600' : 'text-red-600'}>
                                    {engine.available ? '✅' : '❌'}
                                </span>
                                <span className="ml-1">{engine.name}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-blue-700 mt-1">
                        Recommended Engine: {availableEngines.recommended}
                    </p>
                </div>
            )}

            <p className="text-gray-600 mb-6">
                Upload images containing location information (screenshots, photos, etc.), and the system will automatically start processing and extract geographic location information.
                Supports mixed Chinese and English recognition, and results will be displayed automatically after processing.
            </p>

            {/* File Upload Area */}
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

            {/* Selected Files List */}
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

                    {/* Auto Processing Status Display */}
                    {ocrProcessor.isProcessing && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="text-sm text-blue-800">Automatically processing images...</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* OCR Processing Status */}
            <OCRStatus
                isProcessing={ocrProcessor.isProcessing}
                progress={ocrProcessor.progress}
                currentFile={ocrProcessor.currentFile}
            />

            {/* OCR Results Display */}
            <OCRResults
                results={ocrResults}
                onLocationSelect={handleLocationSelect}
            />

            {/* Processing Mode Description */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Processing Mode Description</h4>
                <div className="text-xs text-gray-600 space-y-1">
                    <p><strong>Frontend Processing:</strong> Uses Tesseract.js in the browser, data is not uploaded to the server, but processing speed is slower</p>
                    <p><strong>Backend Processing:</strong> Uses server-side OCR engines, faster processing speed with more features, but requires image upload</p>
                    <p><strong>Engine Selection:</strong> Tesseract is suitable for English, PaddleOCR has better Chinese support, auto-select will intelligently choose based on availability</p>
                </div>
            </div>
        </div>
    );
}

/**
 * OCR Quick Actions Button Component
 */
export function OCRQuickActions({ onLoadSampleImages, onClearResults, onTestBackend }) {
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
            {onTestBackend && (
                <button
                    onClick={onTestBackend}
                    className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                >
                    🧪 Test Backend
                </button>
            )}
        </div>
    );
}