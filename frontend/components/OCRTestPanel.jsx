import { useState } from 'react';
import OCRProcessor, { OCRStatus, OCRResults } from './OCRProcessor';

/**
 * OCR Test Panel - For testing and debugging OCR functionality
 */
export default function OCRTestPanel({ onLocationsExtracted }) {
    const [testFiles, setTestFiles] = useState([]);
    const [ocrResults, setOCRResults] = useState(null);
    const [ocrError, setOCRError] = useState(null);
    const [showRawText, setShowRawText] = useState(false);

    // OCR processor
    const { processFiles, isProcessing, progress, currentFile, ocrMode, setOcrMode } = OCRProcessor({
        onOCRComplete: (results) => {
            console.log('OCR processing completed:', results);
            setOCRResults(results);
            setOCRError(null);

            // Pass extracted location information to parent component
            if (results.locations && results.locations.length > 0) {
                // Convert to format required by map component
                const mapLocations = convertOCRResultsToMapFormat(results);
                onLocationsExtracted?.(mapLocations);
            }
        },
        onError: (error) => {
            console.error('OCR processing error:', error);
            setOCRError(error);
            setOCRResults(null);
        }
    });

    /**
     * Convert OCR results to format required by map component
     */
    const convertOCRResultsToMapFormat = (ocrResults) => {
        return ocrResults.locations.map((location, index) => ({
            id: `ocr_${index}`,
            name: location.name,
            type: location.type === 'business' ? 'Business' :
                location.type === 'address' ? 'Address' : 'Location',
            address: location.name, // Temporarily use name as address
            coordinates: null, // Requires subsequent geocoding
            extractedFrom: location.source || 'OCR',
            confidence: 0.8, // Default confidence
            metadata: {
                ocr_type: location.type,
                source_file: location.source,
                needs_geocoding: true
            }
        }));
    };

    /**
     * Handle file upload
     */
    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files);
        setTestFiles(files);

        // Automatically start OCR processing
        if (files.length > 0) {
            processFiles(files);
        }
    };

    /**
     * Manually trigger OCR processing
     */
    const handleProcessOCR = () => {
        if (testFiles.length > 0) {
            processFiles(testFiles);
        }
    };

    /**
     * Clear results
     */
    const handleClearResults = () => {
        setOCRResults(null);
        setOCRError(null);
        setTestFiles([]);
    };

    /**
     * Handle location selection
     */
    const handleLocationSelect = (location) => {
        console.log('Selected location:', location);
        // Can add more location processing logic here
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                    🔍 OCR Test Panel
                </h2>

                {/* OCR Mode Switch */}
                <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">Mode:</label>
                    <select
                        value={ocrMode}
                        onChange={(e) => setOcrMode(e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                    >
                        <option value="frontend">Frontend (Tesseract.js)</option>
                        <option value="backend">Backend API</option>
                    </select>
                </div>
            </div>

            {/* File Upload Area */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Test Images
                </label>
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />

                {testFiles.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                        Selected {testFiles.length} files: {testFiles.map(f => f.name).join(', ')}
                    </div>
                )}
            </div>

            {/* Control Buttons */}
            <div className="flex space-x-3 mb-6">
                <button
                    onClick={handleProcessOCR}
                    disabled={testFiles.length === 0 || isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? 'Processing...' : 'Start OCR Processing'}
                </button>

                <button
                    onClick={handleClearResults}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                    Clear Results
                </button>

                {ocrResults && (
                    <button
                        onClick={() => setShowRawText(!showRawText)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                        {showRawText ? 'Hide' : 'Show'} Raw Text
                    </button>
                )}
            </div>

            {/* OCR Processing Status */}
            <OCRStatus
                isProcessing={isProcessing}
                progress={progress}
                currentFile={currentFile}
            />

            {/* OCR Error Display */}
            {ocrError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                        <span className="text-red-500 mr-2">❌</span>
                        <span className="text-sm text-red-800">OCR processing failed: {ocrError}</span>
                    </div>
                    <button
                        onClick={handleProcessOCR}
                        className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                        Retry Processing
                    </button>
                </div>
            )}

            {/* OCR Results Display */}
            <OCRResults
                results={ocrResults}
                onLocationSelect={handleLocationSelect}
            />

            {/* Detailed Results Display */}
            {ocrResults && (
                <div className="mt-6 space-y-4">
                    {/* Statistics Information */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Processing Statistics</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Total Files:</span>
                                <span className="font-medium ml-1">{ocrResults.stats.totalFiles}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Success:</span>
                                <span className="font-medium ml-1 text-green-600">{ocrResults.stats.successfulFiles}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Failed:</span>
                                <span className="font-medium ml-1 text-red-600">{ocrResults.stats.failedFiles}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Average Confidence:</span>
                                <span className="font-medium ml-1">{(ocrResults.stats.averageConfidence * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Raw Text Display */}
                    {showRawText && ocrResults.texts && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-gray-900 mb-2">Raw OCR Text</h3>
                            <div className="space-y-3">
                                {ocrResults.texts.map((textResult, index) => (
                                    <div key={index} className="bg-white p-3 rounded border">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-gray-700">
                                                {textResult.filename}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                Confidence: {(textResult.confidence * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                                            {textResult.cleanedText || textResult.rawText}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Extracted Geographic Information Details */}
                    {ocrResults.locations && ocrResults.locations.length > 0 && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-blue-900 mb-2">
                                Extracted Geographic Information ({ocrResults.locations.length} items)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {ocrResults.locations.map((location, index) => (
                                    <div key={index} className="bg-white p-3 rounded border">
                                        <div className="font-medium text-sm">{location.name}</div>
                                        <div className="flex items-center mt-1">
                                            <span className={`text-xs px-2 py-1 rounded-full ${location.type === 'business' ? 'bg-blue-100 text-blue-700' :
                                                location.type === 'address' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                {location.type}
                                            </span>
                                            {location.source && (
                                                <span className="text-xs text-gray-500 ml-2">
                                                    {location.source}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}