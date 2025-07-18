import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import OCRAnalysisPanel from './OCRAnalysisPanel';

export default function SocialMediaOCRDemo() {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    setFiles(acceptedFiles);
    setIsProcessing(true);
    setError(null);
    setResults(null);
    
    try {
      console.log('Processing files:', acceptedFiles.map(f => f.name));
      
      setProcessingStage('Preparing files for upload...');
      
      // Process files with backend API
      const formData = new FormData();
      acceptedFiles.forEach(file => {
        formData.append('files', file);
      });
      
      // Add additional parameters
      formData.append('engine', 'auto');
      formData.append('enhance_image', 'true');
      formData.append('extract_structured', 'true');
      
      setProcessingStage('Uploading to backend API...');
      
      // Call basic OCR API
      const response = await fetch('http://localhost:8000/api/ocr/batch', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OCR processing failed (${response.status}): ${errorText}`);
      }
      
      setProcessingStage('Processing OCR results...');
      
      const data = await response.json();
      console.log('OCR Results:', data);
      setResults(data);
      
    } catch (err) {
      console.error('Error processing files:', err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg']
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Social Media & Travel OCR Demo</h2>
      <p className="text-gray-600 mb-6">
        Upload social media screenshots or travel itineraries to extract location information.
        This demo shows how the system handles mixed content types and languages.
      </p>
      
      {/* Upload area */}
      <div 
        {...getRootProps()} 
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer mb-6 group"
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="text-5xl group-hover:scale-110 transition-transform duration-200">📱</div>
          <p className="text-lg font-medium group-hover:text-blue-600 transition-colors">Drop social media screenshots here</p>
          <p className="text-sm text-gray-500">or click to select files</p>
          <div className="flex items-center justify-center space-x-2 text-xs text-gray-400 mt-2">
            <span className="px-2 py-1 bg-gray-100 rounded">PNG</span>
            <span className="px-2 py-1 bg-gray-100 rounded">JPG</span>
            <span className="px-2 py-1 bg-gray-100 rounded">JPEG</span>
          </div>
        </div>
      </div>
      
      {/* Processing indicator with progress bar */}
      {isProcessing && (
        <div className="mb-6 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-blue-800 font-semibold text-lg">Processing with backend API...</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-4 mb-3">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full animate-pulse shadow-sm" style={{ width: '100%' }}></div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-sm text-blue-700 font-medium">
              {processingStage || `Processing ${files.length} file(s) • OCR + Location Extraction + AI Analysis`}
            </div>
            <div className="text-xs text-blue-600">
              This may take a few moments depending on file size and content complexity
            </div>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">❌</span>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}
      
      {/* Results display */}
      {results && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">OCR Results</h3>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {results.processing_stats?.successful_files || 0}
              </div>
              <div className="text-sm text-blue-800">Files Processed</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {results.aggregated_data?.locations?.length || 0}
              </div>
              <div className="text-sm text-green-800">Locations Found</div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {results.processing_stats?.average_confidence ? 
                  (results.processing_stats.average_confidence * 100).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-purple-800">Avg Confidence</div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {results.processing_stats?.total_files || 0}
              </div>
              <div className="text-sm text-orange-800">Total Files</div>
            </div>
          </div>
          
          {/* Extracted locations */}
          {results.aggregated_data?.locations && results.aggregated_data.locations.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h4 className="text-lg font-medium mb-4">Extracted Locations</h4>
              <div className="space-y-3">
                {results.aggregated_data.locations.map((location, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{location.name}</div>
                      <div className="text-sm text-gray-500">
                        {location.type} • {(location.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    {location.source && (
                      <div className="text-xs text-gray-500 mt-1">
                        Source: {location.source}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Individual file results */}
          {results.results && results.results.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h4 className="text-lg font-medium mb-4">Individual File Results</h4>
              <div className="space-y-6">
                {results.results.map((result, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-medium">{result.filename || `File ${index + 1}`}</div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {result.success ? 'Success' : 'Failed'}
                        </span>
                        {result.confidence && (
                          <span className="text-sm text-gray-500">
                            {(result.confidence * 100).toFixed(0)}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* File preview */}
                    {files[index] && (
                      <div className="mb-3">
                        <img 
                          src={URL.createObjectURL(files[index])} 
                          alt={`Preview of ${result.filename || `File ${index + 1}`}`}
                          className="max-h-40 rounded border"
                        />
                      </div>
                    )}
                    
                    {/* Error display */}
                    {!result.success && result.error && (
                      <div className="mb-3 p-2 bg-red-50 rounded text-red-800 text-sm">
                        Error: {result.error}
                      </div>
                    )}
                    
                    {/* Text preview */}
                    {result.success && (result.cleaned_text || result.raw_text) && (
                      <div className="text-sm mb-3">
                        <div className="font-medium mb-1">Extracted Text:</div>
                        <div className="bg-gray-50 p-3 rounded max-h-32 overflow-y-auto whitespace-pre-wrap text-xs">
                          {result.cleaned_text || result.raw_text}
                        </div>
                      </div>
                    )}
                    
                    {/* Extracted information */}
                    {result.success && result.extracted_info && (
                      <div className="space-y-2">
                        {/* Locations */}
                        {result.extracted_info.locations && result.extracted_info.locations.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-1">Locations:</div>
                            <div className="flex flex-wrap gap-1">
                              {result.extracted_info.locations.map((loc, i) => (
                                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  {loc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Addresses */}
                        {result.extracted_info.addresses && result.extracted_info.addresses.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-1">Addresses:</div>
                            <div className="flex flex-wrap gap-1">
                              {result.extracted_info.addresses.map((addr, i) => (
                                <span key={i} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                  {addr}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Business names */}
                        {result.extracted_info.business_names && result.extracted_info.business_names.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-1">Businesses:</div>
                            <div className="flex flex-wrap gap-1">
                              {result.extracted_info.business_names.map((biz, i) => (
                                <span key={i} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                                  {biz}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Show message if no extractions */}
                        {(!result.extracted_info.locations || result.extracted_info.locations.length === 0) &&
                         (!result.extracted_info.addresses || result.extracted_info.addresses.length === 0) &&
                         (!result.extracted_info.business_names || result.extracted_info.business_names.length === 0) && (
                          <div className="text-sm text-gray-500 italic">
                            No locations, addresses, or business names extracted
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Debug information */}
          {results && (
            <details className="bg-gray-50 rounded-lg p-4">
              <summary className="cursor-pointer font-medium text-gray-700">
                Debug Information (Click to expand)
              </summary>
              <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-40">
                {JSON.stringify(results, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* OCR Analysis Panel - Always visible comprehensive analysis section */}
      <div className="mt-8 border-t-2 border-gray-200 pt-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">📊 Comprehensive OCR Analysis & Results</h2>
          <p className="text-gray-600">Detailed analysis of extracted text, location comparison, and AI export formats</p>
        </div>
        <OCRAnalysisPanel results={results} files={files} />
      </div>
    </div>
  );
}