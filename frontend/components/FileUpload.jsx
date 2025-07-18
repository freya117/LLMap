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

    // Backend OCR processing function for automatic processing
    const handleBackendOCRProcessing = async (imageFiles) => {
        if (imageFiles.length === 0) return;

        setIsBackendProcessing(true);
        setOCRError(null);

        try {
            // Check if backend is available
            const healthResponse = await fetch('http://localhost:8000/health');
            if (!healthResponse.ok) {
                console.warn('Backend server not available, falling back to frontend processing');
                setIsBackendProcessing(false);
                processFiles(imageFiles, 'auto');
                return;
            }

            // Prepare FormData for backend API
            const formData = new FormData();
            imageFiles.forEach((file) => {
                formData.append('files', file);
            });
            formData.append('engine', 'auto');
            formData.append('enhance_image', 'true');
            formData.append('extract_structured', 'true');

            // Call backend OCR API
            const response = await fetch('http://localhost:8000/api/ocr/batch', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Backend OCR failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
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

            setOCRResults(convertedResults);
            setOCRError(null);
            onOCRComplete?.(convertedResults);

        } catch (error) {
            console.error('Backend OCR processing failed:', error);
            console.log('Falling back to frontend processing');
            setOCRError(`Backend processing failed: ${error.message}. Falling back to frontend processing.`);
            // Fallback to frontend processing
            processFiles(imageFiles, 'auto');
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

            {/* Auto-processing status indicator */}
            {(isProcessing || isBackendProcessing) && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-blue-800">
                            {isBackendProcessing ? 'Processing with backend API...' : 'Automatically processing images...'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}