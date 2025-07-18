import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon, PhotoIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import OCRProcessor, { OCRStatus, OCRResults } from './OCRProcessor';

export default function FileUpload({ onFilesUploaded, onOCRComplete }) {
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [ocrResults, setOCRResults] = useState(null);
    const [ocrError, setOCRError] = useState(null);
    const [isBackendProcessing, setIsBackendProcessing] = useState(false);
    
    // Enhanced progress tracking for backend processing
    const [backendProgress, setBackendProgress] = useState({
        currentStep: '',
        currentFile: '',
        filesProcessed: 0,
        totalFiles: 0,
        percentage: 0,
        status: 'idle' // 'idle', 'uploading', 'processing', 'extracting', 'completed', 'error'
    });

    // Backend OCR processing function with enhanced progress tracking
    const handleBackendOCRProcessing = async (imageFiles) => {
        if (imageFiles.length === 0) return;

        setIsBackendProcessing(true);
        setOCRError(null);
        
        // Initialize progress tracking
        setBackendProgress({
            currentStep: 'Initializing...',
            currentFile: '',
            filesProcessed: 0,
            totalFiles: imageFiles.length,
            percentage: 0,
            status: 'processing'
        });

        try {
            // Step 1: Check backend availability
            setBackendProgress(prev => ({
                ...prev,
                currentStep: 'Connecting to backend server...',
                percentage: 5
            }));

            const healthResponse = await fetch('http://localhost:8000/health');
            if (!healthResponse.ok) {
                console.warn('Backend server not available, falling back to frontend processing');
                setIsBackendProcessing(false);
                setBackendProgress(prev => ({ ...prev, status: 'idle' }));
                processFiles(imageFiles, 'auto');
                return;
            }

            // Step 2: Prepare upload
            setBackendProgress(prev => ({
                ...prev,
                currentStep: 'Preparing files for upload...',
                percentage: 10
            }));

            const formData = new FormData();
            imageFiles.forEach((file, index) => {
                formData.append('files', file);
                setBackendProgress(prev => ({
                    ...prev,
                    currentStep: `Adding file ${index + 1}/${imageFiles.length}: ${file.name}`,
                    percentage: 10 + (index / imageFiles.length) * 10
                }));
            });
            formData.append('engine', 'auto');
            formData.append('enhance_image', 'true');
            formData.append('extract_structured', 'true');

            // Step 3: Upload and process
            setBackendProgress(prev => ({
                ...prev,
                currentStep: 'Uploading files to backend...',
                percentage: 25,
                status: 'uploading'
            }));

            // Create XMLHttpRequest to track upload progress
            const uploadPromise = new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                
                // Track upload progress
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const uploadProgress = (e.loaded / e.total) * 100;
                        setBackendProgress(prev => ({
                            ...prev,
                            currentStep: 'Uploading files to backend...',
                            percentage: 25 + (uploadProgress * 0.25), // 25% to 50% for upload
                            status: 'uploading'
                        }));
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response);
                        } catch (error) {
                            reject(new Error('Failed to parse response'));
                        }
                    } else {
                        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Network error occurred'));
                });

                xhr.open('POST', 'http://localhost:8000/api/ocr/batch');
                xhr.send(formData);
            });

            // Step 4: Processing simulation (since we can't get real-time progress from backend)
            const processingInterval = setInterval(() => {
                setBackendProgress(prev => {
                    if (prev.percentage < 85) {
                        return {
                            ...prev,
                            currentStep: 'Processing images with OCR...',
                            percentage: Math.min(prev.percentage + 2, 85),
                            status: 'processing'
                        };
                    }
                    return prev;
                });
            }, 500);

            const result = await uploadPromise;
            clearInterval(processingInterval);

            // Step 5: Processing complete
            setBackendProgress(prev => ({
                ...prev,
                currentStep: 'Extracting location data...',
                percentage: 90,
                status: 'extracting'
            }));

            console.log('Backend OCR Results:', result);

            // Convert backend results to format expected by onOCRComplete
            const convertedResults = {
                ...result,
                locations: result.aggregated_data?.locations || [],
                stats: {
                    totalFiles: result.processing_stats?.total_files || 0,
                    successfulFiles: result.processing_stats?.successful_files || 0,
                    failedFiles: result.processing_stats?.failed_files || 0,
                    averageConfidence: result.processing_stats?.average_confidence || 0
                }
            };

            // Final step
            setBackendProgress(prev => ({
                ...prev,
                currentStep: 'Processing completed successfully!',
                percentage: 100,
                status: 'completed'
            }));

            setOCRResults(convertedResults);
            setOCRError(null);
            onOCRComplete?.(convertedResults);

            // Reset progress after a short delay
            setTimeout(() => {
                setBackendProgress(prev => ({ ...prev, status: 'idle' }));
            }, 2000);

        } catch (error) {
            console.error('Backend OCR processing failed:', error);
            setBackendProgress(prev => ({
                ...prev,
                currentStep: `Error: ${error.message}`,
                status: 'error'
            }));
            
            console.log('Falling back to frontend processing');
            setOCRError(`Backend processing failed: ${error.message}. Falling back to frontend processing.`);
            
            // Reset progress and fallback to frontend processing
            setTimeout(() => {
                setBackendProgress(prev => ({ ...prev, status: 'idle' }));
                processFiles(imageFiles, 'auto');
            }, 3000);
        } finally {
            setIsBackendProcessing(false);
        }
    };

    // OCR processor
    const { processFiles, isProcessing, progress, currentFile } = OCRProcessor({
        onOCRComplete: (results) => {
            setOCRResults(results);
            setOCRError(null);
            onOCRComplete?.(results);
        },
        onError: (error) => {
            setOCRError(error);
            setOCRResults(null);
        }
    });

    const onDrop = useCallback((acceptedFiles) => {
        setIsUploading(true);

        // Process files and create previews
        const processedFiles = acceptedFiles.map(file => ({
            file,
            id: Math.random().toString(36).substring(2, 11),
            name: file.name,
            size: file.size,
            type: file.type,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
        }));

        setUploadedFiles(prev => [...prev, ...processedFiles]);
        setIsUploading(false);

        // Callback to parent component
        if (onFilesUploaded) {
            onFilesUploaded(processedFiles);
        }

        // Auto-start backend OCR processing (image files only)
        const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
            setTimeout(() => {
                handleBackendOCRProcessing(imageFiles);
            }, 500); // Brief delay to ensure UI update
        }
    }, [onFilesUploaded]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
            'text/*': ['.txt'],
            'application/json': ['.json']
        },
        multiple: true
    });

    const removeFile = (fileId) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
        // Clear OCR results if all files are removed
        if (uploadedFiles.length === 1) {
            setOCRResults(null);
            setOCRError(null);
        }
    };

    const handleLocationSelect = (location) => {
        console.log('Selected location:', location);
        // Location selection logic can be added here
    };

    const handleProcessOCR = () => {
        const imageFiles = uploadedFiles
            .filter(fileData => fileData.type.startsWith('image/'))
            .map(fileData => fileData.file);

        if (imageFiles.length > 0) {
            processFiles(imageFiles, 'auto');
        }
    };

    const getFileIcon = (fileType) => {
        if (fileType.startsWith('image/')) {
            return <PhotoIcon className="h-8 w-8 text-blue-500" />;
        }
        return <DocumentTextIcon className="h-8 w-8 text-gray-500" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="w-full">
            {/* Upload Zone */}
            <div
                {...getRootProps()}
                className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
          ${isDragActive
                        ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-purple-50 scale-105'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
            >
                <input {...getInputProps()} />
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <CloudArrowUpIcon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {isDragActive ? 'Drop files here...' : 'Upload your content'}
                </h3>
                <p className="text-gray-600 mb-4">
                    Drag & drop or click to select files
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
                    <span className="px-2 py-1 bg-gray-100 rounded">Google Maps Screenshots</span>
                    <span className="px-2 py-1 bg-gray-100 rounded">Social Media Posts</span>
                    <span className="px-2 py-1 bg-gray-100 rounded">Text Files</span>
                    <span className="px-2 py-1 bg-gray-100 rounded">JSON Data</span>
                </div>
            </div>

            {/* File List */}
            {uploadedFiles.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Uploaded Files ({uploadedFiles.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {uploadedFiles.map((fileData) => (
                            <div
                                key={fileData.id}
                                className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                        {fileData.preview ? (
                                            <img
                                                src={fileData.preview}
                                                alt={fileData.name}
                                                className="h-12 w-12 object-cover rounded"
                                            />
                                        ) : (
                                            getFileIcon(fileData.type)
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {fileData.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatFileSize(fileData.size)}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeFile(fileData.id)}
                                        className="ml-2 text-red-400 hover:text-red-600 text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Processing Status */}
            {isUploading && (
                <div className="mt-4 text-center">
                    <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-lg">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        <span className="text-sm text-blue-600">Processing files...</span>
                    </div>
                </div>
            )}

            {/* Enhanced Backend Processing Progress Bar */}
            {(isBackendProcessing || backendProgress.status !== 'idle') && (
                <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-900">
                            Processing Images with AI
                        </h4>
                        <span className="text-sm text-gray-500">
                            {backendProgress.percentage.toFixed(0)}%
                        </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                        <div 
                            className={`h-2.5 rounded-full transition-all duration-300 ${
                                backendProgress.status === 'error' ? 'bg-red-500' :
                                backendProgress.status === 'completed' ? 'bg-green-500' :
                                'bg-blue-500'
                            }`}
                            style={{ width: `${backendProgress.percentage}%` }}
                        ></div>
                    </div>
                    
                    {/* Status Text */}
                    <div className="flex items-center justify-between">
                        <span className={`text-sm ${
                            backendProgress.status === 'error' ? 'text-red-600' :
                            backendProgress.status === 'completed' ? 'text-green-600' :
                            'text-blue-600'
                        }`}>
                            {backendProgress.currentStep}
                        </span>
                        
                        {/* File Counter */}
                        {backendProgress.totalFiles > 0 && (
                            <span className="text-xs text-gray-500">
                                {backendProgress.filesProcessed}/{backendProgress.totalFiles} files
                            </span>
                        )}
                    </div>

                    {/* Current File */}
                    {backendProgress.currentFile && (
                        <div className="mt-2 text-xs text-gray-600 truncate">
                            Current: {backendProgress.currentFile}
                        </div>
                    )}

                    {/* Status Icon */}
                    <div className="flex items-center mt-2">
                        {backendProgress.status === 'completed' && (
                            <span className="text-green-500 mr-2">✅</span>
                        )}
                        {backendProgress.status === 'error' && (
                            <span className="text-red-500 mr-2">❌</span>
                        )}
                        {(backendProgress.status === 'processing' || backendProgress.status === 'uploading' || backendProgress.status === 'extracting') && (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                        )}
                    </div>
                </div>
            )}

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

            {/* OCR Results */}
            <OCRResults
                results={ocrResults}
                onLocationSelect={handleLocationSelect}
            />
        </div>
    );
}