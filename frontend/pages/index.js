import { useState } from 'react';
import FileUpload from '../components/FileUpload';
import MapView from '../components/MapView';
import OCRPanel from '../components/OCRPanel';
import ResultsPanel from '../components/ResultsPanel';
import { googleMapsData } from '../utils/sampleData';

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [extractedLocations, setExtractedLocations] = useState([]);
  const [ocrResults, setOcrResults] = useState(null);
  const [processingMode, setProcessingMode] = useState('test');
  const [processingStatus, setProcessingStatus] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'ocr'
  const [ocrTestResults, setOcrTestResults] = useState(null);
  const [showResultsPanel, setShowResultsPanel] = useState(false);

  const handleFilesUploaded = (files) => {
    setUploadedFiles(files);
    console.log('Files uploaded:', files);
    setProcessingMode('upload');
    setShowResultsPanel(false); // Hide results panel when new files are uploaded
  };

  const handleOCRError = (error) => {
    console.error('OCR processing failed:', error);
    setProcessingStatus(`OCR processing failed: ${error}`);
    setShowResultsPanel(false);
  };

  const handleOCRComplete = async (results) => {
    console.log('OCR processing completed:', results);
    setOcrResults(results);
    
    // If this is from the automatic backend processing, also set detailed results
    if (results.processing_stats || results.aggregated_data) {
      // This is backend API results - show detailed results
      const standardizedResults = processOCRResultsToStandard(results);
      const groundTruthComparison = await compareWithGroundTruth(results);
      
      setOcrTestResults({
        ...results,
        standardized: standardizedResults,
        groundTruthComparison: groundTruthComparison
      });
      
      // Show the results panel
      setShowResultsPanel(true);
      
      // Log detailed performance metrics
      if (groundTruthComparison) {
        console.log('🎯 OCR Performance Analysis:');
        console.log(`📊 Precision: ${(groundTruthComparison.accuracy_metrics.precision * 100).toFixed(1)}%`);
        console.log(`📊 Recall: ${(groundTruthComparison.accuracy_metrics.recall * 100).toFixed(1)}%`);
        console.log(`📊 F1 Score: ${(groundTruthComparison.accuracy_metrics.f1_score * 100).toFixed(1)}%`);
        console.log(`✅ Matches: ${groundTruthComparison.matches.length}/${groundTruthComparison.ground_truth_total}`);
        console.log(`❌ False Positives: ${groundTruthComparison.false_positives.length}`);
        console.log(`⚠️ Missing: ${groundTruthComparison.missing.length}`);
      }
    } else {
      // Simple results, show basic results panel
      setShowResultsPanel(true);
    }
    
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



  // String similarity calculation using Levenshtein distance
  const calculateStringSimilarity = (str1, str2) => {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  };

  // Enhanced ground truth comparison with better matching logic
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
          precision: 0,
          recall: 0,
          f1_score: 0
        }
      };
      
      // Enhanced matching with multiple criteria
      groundTruth.locations.forEach(gtLocation => {
        let bestMatch = null;
        let bestScore = 0;
        
        if (ocrResults.aggregated_data?.locations) {
          ocrResults.aggregated_data.locations.forEach(ocrResult => {
            // Calculate multiple similarity scores
            const nameScore = calculateStringSimilarity(
              gtLocation.business_name.toLowerCase(),
              ocrResult.name.toLowerCase()
            );
            
            // Check for partial matches (e.g., "Dave's Hot Chicken" vs "Dave's")
            const partialNameScore = Math.max(
              gtLocation.business_name.toLowerCase().includes(ocrResult.name.toLowerCase()) ? 0.8 : 0,
              ocrResult.name.toLowerCase().includes(gtLocation.business_name.toLowerCase()) ? 0.8 : 0
            );
            
            // Combined score with weights
            const combinedScore = Math.max(nameScore * 0.7, partialNameScore * 0.8);
            
            if (combinedScore > bestScore && combinedScore > 0.5) {
              bestScore = combinedScore;
              bestMatch = ocrResult;
            }
          });
        }
        
        if (bestMatch) {
          comparison.matches.push({
            ground_truth: gtLocation,
            ocr_result: bestMatch,
            match_type: bestScore > 0.8 ? 'exact' : 'partial',
            confidence: bestScore
          });
        } else {
          comparison.missing.push(gtLocation);
        }
      });
      
      // Find false positives (OCR results that don't match any ground truth)
      if (ocrResults.aggregated_data?.locations) {
        ocrResults.aggregated_data.locations.forEach(ocrResult => {
          const isMatch = comparison.matches.some(match => 
            match.ocr_result.name === ocrResult.name
          );
          if (!isMatch) {
            comparison.false_positives.push({
              name: ocrResult.name,
              type: ocrResult.type || 'Unknown',
              source: ocrResult.source || 'OCR',
              confidence: ocrResult.confidence || 0.5
            });
          }
        });
      }
      
      // Calculate accuracy metrics
      const truePositives = comparison.matches.length;
      const falsePositives = comparison.false_positives.length;
      const falseNegatives = comparison.missing.length;
      
      comparison.accuracy_metrics.precision = truePositives / (truePositives + falsePositives) || 0;
      comparison.accuracy_metrics.recall = truePositives / (truePositives + falseNegatives) || 0;
      comparison.accuracy_metrics.f1_score = 2 * (comparison.accuracy_metrics.precision * comparison.accuracy_metrics.recall) / 
        (comparison.accuracy_metrics.precision + comparison.accuracy_metrics.recall) || 0;
      
      console.log('Ground Truth Comparison Results:', {
        'Expected locations': groundTruth.locations.length,
        'OCR found': ocrResults.aggregated_data?.locations?.length || 0,
        'Correct matches': truePositives,
        'False positives': falsePositives,
        'Missing': falseNegatives,
        'Precision': (comparison.accuracy_metrics.precision * 100).toFixed(1) + '%',
        'Recall': (comparison.accuracy_metrics.recall * 100).toFixed(1) + '%',
        'F1 Score': (comparison.accuracy_metrics.f1_score * 100).toFixed(1) + '%'
      });
      
      return comparison;
    } catch (error) {
      console.error('Error comparing with ground truth:', error);
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
    setOcrTestResults(null);
    setProcessingStatus('');
    setShowResultsPanel(false); // Hide results panel when loading test data
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
                
                <FileUpload 
                  onFilesUploaded={handleFilesUploaded}
                  onOCRComplete={handleOCRComplete}
                />

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
                      <div className="flex items-center">
                        <span className="text-green-500 mr-2">✅</span>
                        <span className="text-sm text-green-800">
                          {uploadedFiles.length} files uploaded successfully - Processing automatically
                        </span>
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

        {/* Results Panel */}
        {showResultsPanel && ocrTestResults && (
          <div className="mt-8">
            <ResultsPanel
              results={ocrTestResults}
              groundTruthComparison={ocrTestResults.groundTruthComparison}
              isVisible={showResultsPanel}
            />
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