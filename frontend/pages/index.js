import { useState } from 'react';
import FileUpload from '../components/FileUpload';
import MapView from '../components/MapView';
import OCRPanel from '../components/OCRPanel';
import { googleMapsData } from '../utils/sampleData';

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [extractedLocations, setExtractedLocations] = useState([]);
  const [ocrResults, setOcrResults] = useState(null);
  const [processingMode, setProcessingMode] = useState('test');
  const [processingStatus, setProcessingStatus] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'ocr'
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [ocrTestResults, setOcrTestResults] = useState(null);

  // Handle OCR testing for uploaded files
  const handleOCRTest = async () => {
    if (uploadedFiles.length === 0) {
      setProcessingStatus('Please upload images first');
      return;
    }

    setIsOCRProcessing(true);
    setProcessingStatus('Processing OCR...');
    setOcrTestResults(null);

    try {
      // First check if backend is available
      const healthResponse = await fetch('http://localhost:8000/health');
      if (!healthResponse.ok) {
        throw new Error('Backend server is not running. Please start the backend with: cd backend && python main.py');
      }

      const formData = new FormData();
      uploadedFiles.forEach((fileData, index) => {
        // Extract the actual File object from the wrapped file data
        const actualFile = fileData.file || fileData;
        console.log(`Adding file ${index}:`, actualFile.name, actualFile.type, actualFile.size);
        
        if (actualFile instanceof File) {
          formData.append('files', actualFile);
        } else {
          console.error('Invalid file object:', fileData);
        }
      });
      formData.append('engine', 'auto');
      formData.append('enhance_image', 'true');
      formData.append('extract_structured', 'true');
      
      // Debug FormData contents
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }

      const response = await fetch('http://localhost:8000/api/ocr/batch', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OCR processing failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('OCR Test Results:', result);
      
      // Process and standardize the results
      const standardizedResults = processOCRResultsToStandard(result);
      
      // Compare with ground truth
      const groundTruthComparison = await compareWithGroundTruth(result);
      
      setOcrTestResults({
        ...result,
        standardized: standardizedResults,
        groundTruthComparison: groundTruthComparison
      });
      setProcessingStatus('OCR processing completed');
      
      // Also update the map with extracted locations
      if (result.aggregated_data && result.aggregated_data.locations) {
        const geocodedLocations = await geocodeOCRResults({
          locations: result.aggregated_data.locations
        });
        setExtractedLocations(geocodedLocations);
        setProcessingMode('ocr');
      }

    } catch (error) {
      console.error('OCR Test Error:', error);
      setProcessingStatus(`OCR test failed: ${error.message}`);
    } finally {
      setIsOCRProcessing(false);
    }
  };

  const handleFilesUploaded = (files) => {
    setUploadedFiles(files);
    console.log('Files uploaded:', files);
    setProcessingMode('upload');
  };

  const handleOCRError = (error) => {
    console.error('OCR processing failed:', error);
    setProcessingStatus(`OCR processing failed: ${error}`);
  };

  const handleOCRComplete = async (results) => {
    console.log('OCR processing completed:', results);
    setOcrResults(results);
    setProcessingStatus('Performing geocoding...');
    
    // Convert OCR extracted location information to map-ready format
    try {
      const geocodedLocations = await geocodeOCRResults(results);
      setExtractedLocations(geocodedLocations);
      setProcessingStatus('');
      setProcessingMode('ocr');
    } catch (error) {
      console.error('Geocoding failed:', error);
      setProcessingStatus('Geocoding failed');
    }
  };

  // Convert OCR results to geographic coordinates
  const geocodeOCRResults = async (ocrResults) => {
    const locations = [];
    
    for (const location of ocrResults.locations) {
      try {
        // Use Nominatim API for geocoding (free)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location.name)}&limit=1`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          const result = data[0];
          locations.push({
            id: `ocr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: location.name,
            type: location.type === 'business' ? 'Restaurant' : 'Location',
            address: result.display_name,
            coordinates: [parseFloat(result.lon), parseFloat(result.lat)], // GeoJSON format [lng, lat]
            confidence: location.confidence || 0.8, // OCR + Geocoding confidence
            extractedFrom: location.source || 'OCR',
            metadata: {
              ocr_type: location.type,
              geocoding_confidence: parseFloat(result.importance || 0.5)
            }
          });
        }
      } catch (error) {
        console.warn(`Geocoding failed for ${location.name}:`, error);
      }
      
      // Add delay to avoid API limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return locations;
  };

  // Load and compare with ground truth data
  const compareWithGroundTruth = async (ocrResults) => {
    try {
      const response = await fetch('/data/ground_truth.json');
      const groundTruth = await response.json();
      
      const comparison = {
        ground_truth_total: groundTruth.locations.length,
        ocr_total: ocrResults.aggregated_data?.locations?.length || 0,
        matches: [],
        missing: [],
        false_positives: [],
        accuracy_metrics: {
          exact_matches: 0,
          partial_matches: 0,
          location_matches: 0,
          precision: 0,
          recall: 0,
          f1_score: 0
        }
      };

      // Compare each ground truth location with OCR results
      groundTruth.locations.forEach(gtLocation => {
        const ocrMatches = ocrResults.aggregated_data?.locations?.filter(ocrLoc => {
          const nameMatch = ocrLoc.name.toLowerCase().includes(gtLocation.business_name.toLowerCase()) ||
                           gtLocation.business_name.toLowerCase().includes(ocrLoc.name.toLowerCase());
          const addressMatch = gtLocation.address.toLowerCase().includes(ocrLoc.name.toLowerCase()) ||
                              ocrLoc.name.toLowerCase().includes(gtLocation.address.toLowerCase());
          return nameMatch || addressMatch;
        }) || [];

        if (ocrMatches.length > 0) {
          const bestMatch = ocrMatches[0];
          const exactMatch = bestMatch.name.toLowerCase() === gtLocation.business_name.toLowerCase();
          const partialMatch = bestMatch.name.toLowerCase().includes(gtLocation.business_name.toLowerCase()) ||
                              gtLocation.business_name.toLowerCase().includes(bestMatch.name.toLowerCase());
          
          comparison.matches.push({
            ground_truth: gtLocation,
            ocr_result: bestMatch,
            match_type: exactMatch ? 'exact' : (partialMatch ? 'partial' : 'weak'),
            confidence: bestMatch.confidence
          });

          if (exactMatch) comparison.accuracy_metrics.exact_matches++;
          if (partialMatch) comparison.accuracy_metrics.partial_matches++;
        } else {
          comparison.missing.push(gtLocation);
        }
      });

      // Find false positives (OCR results not in ground truth)
      ocrResults.aggregated_data?.locations?.forEach(ocrLoc => {
        const hasMatch = comparison.matches.some(match => match.ocr_result.name === ocrLoc.name);
        if (!hasMatch) {
          comparison.false_positives.push(ocrLoc);
        }
      });

      // Calculate metrics
      const totalMatches = comparison.matches.length;
      const totalGroundTruth = groundTruth.locations.length;
      const totalOCR = ocrResults.aggregated_data?.locations?.length || 0;

      comparison.accuracy_metrics.precision = totalOCR > 0 ? totalMatches / totalOCR : 0;
      comparison.accuracy_metrics.recall = totalGroundTruth > 0 ? totalMatches / totalGroundTruth : 0;
      comparison.accuracy_metrics.f1_score = 
        (comparison.accuracy_metrics.precision + comparison.accuracy_metrics.recall) > 0 ?
        (2 * comparison.accuracy_metrics.precision * comparison.accuracy_metrics.recall) /
        (comparison.accuracy_metrics.precision + comparison.accuracy_metrics.recall) : 0;

      return comparison;
    } catch (error) {
      console.error('Error loading ground truth data:', error);
      return null;
    }
  };

  // Process OCR results to standard format for AI pipeline
  const processOCRResultsToStandard = (ocrResults) => {
    console.log('Processing OCR results to standard format:', ocrResults);
    
    const standardFormat = {
      metadata: {
        processing_timestamp: new Date().toISOString(),
        total_files_processed: ocrResults.processing_stats?.total_files || 0,
        successful_files: ocrResults.processing_stats?.successful_files || 0,
        failed_files: ocrResults.processing_stats?.failed_files || 0,
        average_confidence: ocrResults.aggregated_data?.summary?.average_confidence || ocrResults.processing_stats?.average_confidence || 0,
        processing_engine: 'auto'
      },
      locations: [],
      raw_extractions: []
    };

    // Process aggregated locations from the backend response
    if (ocrResults.aggregated_data?.locations && ocrResults.aggregated_data.locations.length > 0) {
      console.log('Processing aggregated locations:', ocrResults.aggregated_data.locations);
      
      ocrResults.aggregated_data.locations.forEach((location, index) => {
        standardFormat.locations.push({
          id: `loc_${index + 1}`,
          name: location.name,
          type: location.type,
          source_file: location.source,
          confidence: location.confidence || 0,
          extraction_method: 'ocr_batch',
          needs_geocoding: true,
          raw_text_context: null
        });
      });
    }

    // Process individual file results for context
    if (ocrResults.results && ocrResults.results.length > 0) {
      console.log('Processing individual file results:', ocrResults.results.length);
      
      ocrResults.results.forEach((result, fileIndex) => {
        console.log(`Processing file ${fileIndex + 1}:`, result);
        
        const extraction = {
          file_id: `file_${fileIndex + 1}`,
          filename: result.processing_metadata?.file_info?.filename || `file_${fileIndex + 1}`,
          raw_text: result.raw_text || '',
          cleaned_text: result.cleaned_text || '',
          confidence: result.confidence || 0,
          extracted_locations: result.extracted_info?.locations || [],
          extracted_addresses: result.extracted_info?.addresses || [],
          extracted_businesses: result.extracted_info?.business_names || [],
          processing_metadata: {
            file_size: result.processing_metadata?.file_info?.size || 0,
            processing_time: result.processing_metadata?.processed_at || null,
            engine_used: result.processing_metadata?.engine_used || 'auto'
          }
        };
        
        standardFormat.raw_extractions.push(extraction);
        
        console.log(`File ${fileIndex + 1} extraction:`, extraction);
      });
    }

    console.log('Final standardized format:', standardFormat);
    return standardFormat;
  };

  const handleLoadTestData = () => {
    console.log('Loading test data: NYC Restaurants');
    setProcessingMode('test');
    setExtractedLocations(googleMapsData);
    setOcrResults(null);
    setProcessingStatus('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">LLMap</h1>
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                AI-Powered Mapping
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Files: <span className="font-medium text-gray-900">{uploadedFiles.length}</span>
              </div>
              <div className="text-sm text-gray-500">
                Locations: <span className="font-medium text-gray-900">{extractedLocations.length}</span>
              </div>
              <div className="text-sm text-gray-500">
                Mode: <span className="font-medium text-gray-900">
                  {processingMode === 'test' ? 'Test Data' : 
                   processingMode === 'ocr' ? 'OCR Processing' : 
                   processingMode === 'upload' ? 'File Upload' : 'Manual Input'}
                </span>
              </div>
              <button
                onClick={() => handleLoadTestData()}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
              >
                Load Test Data
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'upload'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                File Upload
              </button>
              <button
                onClick={() => setActiveTab('ocr')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'ocr'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                OCR Processing
              </button>
            </nav>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Panel - Content Processing */}
          <div className="bg-white rounded-lg shadow-sm border">
            {activeTab === 'upload' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Upload Content
                </h2>
                <p className="text-gray-600 mb-6">
                  Upload images, screenshots, or text files containing location information.
                  Our AI will extract and map the locations for you.
                </p>
                
                <FileUpload onFilesUploaded={handleFilesUploaded} />

                {/* Processing Status */}
                {processingStatus && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="animate-pulse h-2 w-2 bg-blue-400 rounded-full mr-2"></div>
                      <span className="text-sm text-blue-800">{processingStatus}</span>
                    </div>
                  </div>
                )}

                {uploadedFiles.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="text-green-500 mr-2">✅</span>
                          <span className="text-sm text-green-800">
                            {uploadedFiles.length} files uploaded successfully
                          </span>
                        </div>
                        <button
                          onClick={handleOCRTest}
                          disabled={isOCRProcessing}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          {isOCRProcessing ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <span>🔍</span>
                              <span>Test OCR</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ocr' && (
              <OCRPanel 
                onLocationsExtracted={handleOCRComplete}
                onError={handleOCRError}
              />
            )}
          </div>

          {/* Right Panel - Map */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Interactive Map
              </h2>
              {processingStatus && (
                <p className="text-sm text-gray-500 mt-1">{processingStatus}</p>
              )}
            </div>
            <div className="h-96">
              <MapView locations={extractedLocations} />
            </div>
            
            {/* Map Statistics */}
            {extractedLocations.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Total Locations:</span>
                    <span className="font-medium ml-1">{extractedLocations.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Source:</span>
                    <span className="font-medium ml-1">
                      {processingMode === 'test' ? 'Test Data' : 
                       processingMode === 'ocr' ? 'OCR Extraction' : 'File Upload'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* OCR Test Results Display */}
        {ocrTestResults && (
          <div className="mt-8 space-y-6">
            {/* Raw OCR Results */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  OCR Processing Results
                </h3>
              
                {/* Processing Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {ocrTestResults.processing_stats?.successful_files || 0}
                    </div>
                    <div className="text-sm text-blue-800">Files Processed</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {ocrTestResults.aggregated_data?.summary?.total_unique_locations || 
                       ocrTestResults.aggregated_data?.locations?.length || 0}
                    </div>
                    <div className="text-sm text-green-800">Locations Found</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {ocrTestResults.aggregated_data?.summary?.average_confidence ? 
                       (ocrTestResults.aggregated_data.summary.average_confidence * 100).toFixed(1) : 
                       ocrTestResults.processing_stats?.average_confidence ? 
                       (ocrTestResults.processing_stats.average_confidence * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-sm text-purple-800">Avg Confidence</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {ocrTestResults.processing_stats?.total_files || 0}
                    </div>
                    <div className="text-sm text-orange-800">Total Files</div>
                  </div>
                </div>

                {/* Location Types Breakdown */}
                {ocrTestResults.aggregated_data?.summary?.location_types && (
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Location Types</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">Businesses</span>
                        <span className="font-medium text-gray-900">
                          {ocrTestResults.aggregated_data.summary.location_types.businesses || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">Addresses</span>
                        <span className="font-medium text-gray-900">
                          {ocrTestResults.aggregated_data.summary.location_types.addresses || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">Locations</span>
                        <span className="font-medium text-gray-900">
                          {ocrTestResults.aggregated_data.summary.location_types.locations || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Extracted Locations List */}
                {ocrTestResults.aggregated_data?.locations && ocrTestResults.aggregated_data.locations.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Extracted Locations</h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {ocrTestResults.aggregated_data.locations.map((location, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{location.name}</div>
                            <div className="text-sm text-gray-500">
                              Type: {location.type} | Source: {location.source}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">
                            {((location.confidence || 0) * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Individual File Results */}
                {ocrTestResults.results && ocrTestResults.results.length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">Individual File Results</h4>
                    <div className="space-y-4">
                      {ocrTestResults.results.map((result, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-gray-900">
                              {result.processing_metadata?.file_info?.filename || `File ${index + 1}`}
                            </div>
                            <div className="flex items-center space-x-2">
                              {result.success ? (
                                <span className="text-green-600 text-sm">✅ Success</span>
                              ) : (
                                <span className="text-red-600 text-sm">❌ Failed</span>
                              )}
                              {result.confidence !== undefined && (
                                <span className="text-sm text-gray-600">
                                  {(result.confidence * 100).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Show extracted locations count */}
                          {result.success && result.extracted_info && (
                            <div className="mb-2 text-sm text-gray-600">
                              Extracted: {result.extracted_info.locations?.length || 0} locations, {' '}
                              {result.extracted_info.addresses?.length || 0} addresses, {' '}
                              {result.extracted_info.business_names?.length || 0} businesses
                            </div>
                          )}
                          
                          {result.success && result.cleaned_text && (
                            <div className="mt-2">
                              <div className="text-sm text-gray-700 mb-1">Extracted Text:</div>
                              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                                {result.cleaned_text.substring(0, 200)}
                                {result.cleaned_text.length > 200 ? '...' : ''}
                              </div>
                            </div>
                          )}
                          
                          {result.error && (
                            <div className="mt-2 text-sm text-red-600">
                              Error: {result.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Standardized Results for AI Pipeline */}
            {ocrTestResults.standardized && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Standardized Results for AI Pipeline
                  </h3>
                  
                  {/* Metadata Summary */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Processing Metadata</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Timestamp:</span>
                        <div className="font-mono text-xs">
                          {new Date(ocrTestResults.standardized.metadata.processing_timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Success Rate:</span>
                        <div className="font-medium">
                          {ocrTestResults.standardized.metadata.successful_files}/{ocrTestResults.standardized.metadata.total_files_processed}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Avg Confidence:</span>
                        <div className="font-medium">
                          {(ocrTestResults.standardized.metadata.average_confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Engine:</span>
                        <div className="font-medium">{ocrTestResults.standardized.metadata.processing_engine}</div>
                      </div>
                    </div>
                  </div>

                  {/* Standardized Locations */}
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Standardized Locations ({ocrTestResults.standardized.locations.length})
                    </h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {ocrTestResults.standardized.locations.map((location, index) => (
                        <div key={index} className="p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-gray-900">
                              {location.id}: {location.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {(location.confidence * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 grid grid-cols-2 gap-2">
                            <div>Type: <span className="font-medium">{location.type}</span></div>
                            <div>Source: <span className="font-medium">{location.source_file}</span></div>
                            <div>Method: <span className="font-medium">{location.extraction_method}</span></div>
                            <div>Geocoding: <span className="font-medium">{location.needs_geocoding ? 'Required' : 'Complete'}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Raw Extractions */}
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Raw Extractions by File ({ocrTestResults.standardized.raw_extractions.length})
                    </h4>
                    <div className="space-y-4">
                      {ocrTestResults.standardized.raw_extractions.map((extraction, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-gray-900">
                              {extraction.file_id}: {extraction.filename}
                            </div>
                            <div className="text-sm text-gray-600">
                              Confidence: {(extraction.confidence * 100).toFixed(1)}%
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm">
                            <div>
                              <span className="text-gray-600">Locations:</span>
                              <span className="font-medium ml-1">{extraction.extracted_locations.length}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Addresses:</span>
                              <span className="font-medium ml-1">{extraction.extracted_addresses.length}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Businesses:</span>
                              <span className="font-medium ml-1">{extraction.extracted_businesses.length}</span>
                            </div>
                          </div>

                          {extraction.cleaned_text && (
                            <div className="mt-2">
                              <div className="text-sm text-gray-700 mb-1">Cleaned Text Preview:</div>
                              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-16 overflow-y-auto font-mono">
                                {extraction.cleaned_text.substring(0, 150)}
                                {extraction.cleaned_text.length > 150 ? '...' : ''}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* JSON Export */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-md font-medium text-gray-900">Export Standardized Data</h4>
                      <button
                        onClick={() => {
                          const dataStr = JSON.stringify(ocrTestResults.standardized, null, 2);
                          const dataBlob = new Blob([dataStr], {type: 'application/json'});
                          const url = URL.createObjectURL(dataBlob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `ocr_standardized_${new Date().toISOString().split('T')[0]}.json`;
                          link.click();
                        }}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Download JSON
                      </button>
                    </div>
                    <div className="text-xs text-gray-600 bg-white p-2 rounded max-h-32 overflow-y-auto font-mono">
                      {JSON.stringify(ocrTestResults.standardized, null, 2).substring(0, 500)}...
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ground Truth Comparison */}
            {ocrTestResults.groundTruthComparison && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Ground Truth Comparison
                  </h3>
                  
                  {/* Accuracy Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {(ocrTestResults.groundTruthComparison.accuracy_metrics.precision * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-green-800">Precision</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {(ocrTestResults.groundTruthComparison.accuracy_metrics.recall * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-blue-800">Recall</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {(ocrTestResults.groundTruthComparison.accuracy_metrics.f1_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-purple-800">F1 Score</div>
                    </div>
                  </div>

                  {/* Match Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-gray-900">
                        {ocrTestResults.groundTruthComparison.ground_truth_total}
                      </div>
                      <div className="text-sm text-gray-600">Ground Truth</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-gray-900">
                        {ocrTestResults.groundTruthComparison.ocr_total}
                      </div>
                      <div className="text-sm text-gray-600">OCR Found</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">
                        {ocrTestResults.groundTruthComparison.matches.length}
                      </div>
                      <div className="text-sm text-green-800">Matches</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-lg font-bold text-red-600">
                        {ocrTestResults.groundTruthComparison.missing.length}
                      </div>
                      <div className="text-sm text-red-800">Missing</div>
                    </div>
                  </div>

                  {/* Successful Matches */}
                  {ocrTestResults.groundTruthComparison.matches.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-gray-900 mb-3 text-green-700">
                        Successful Matches ({ocrTestResults.groundTruthComparison.matches.length})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {ocrTestResults.groundTruthComparison.matches.map((match, index) => (
                          <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium text-green-900">
                                {match.ground_truth.business_name}
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  match.match_type === 'exact' ? 'bg-green-100 text-green-800' :
                                  match.match_type === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {match.match_type}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {((match.confidence || 0) * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">
                              <div>Ground Truth: {match.ground_truth.address}</div>
                              <div>OCR Result: {match.ocr_result.name}</div>
                              <div>Source: {match.ground_truth.image_file}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Locations */}
                  {ocrTestResults.groundTruthComparison.missing.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-gray-900 mb-3 text-red-700">
                        Missing Locations ({ocrTestResults.groundTruthComparison.missing.length})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {ocrTestResults.groundTruthComparison.missing.map((missing, index) => (
                          <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="font-medium text-red-900">{missing.business_name}</div>
                            <div className="text-sm text-red-700">
                              {missing.address} | {missing.image_file}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* False Positives */}
                  {ocrTestResults.groundTruthComparison.false_positives.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-gray-900 mb-3 text-yellow-700">
                        False Positives ({ocrTestResults.groundTruthComparison.false_positives.length})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {ocrTestResults.groundTruthComparison.false_positives.map((fp, index) => (
                          <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="font-medium text-yellow-900">{fp.name}</div>
                            <div className="text-sm text-yellow-700">
                              Type: {fp.type} | Source: {fp.source} | Confidence: {((fp.confidence || 0) * 100).toFixed(1)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Footer */}
        <div className="mt-8 p-4 bg-white rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✅</span>
                <span className="text-gray-700">Frontend Ready</span>
              </div>
              <div className="flex items-center">
                <span className="text-blue-500 mr-2">🗺️</span>
                <span className="text-gray-700">Map Integration</span>
              </div>
              <div className="flex items-center">
                <span className="text-purple-500 mr-2">🔍</span>
                <span className="text-gray-700">OCR Processing</span>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-yellow-500 mr-2">🔄</span>
              <span className="text-blue-800">Backend Integration</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}