import React, { useState, useEffect } from 'react';

export default function OCRAnalysisPanel({ results, files }) {
  const [groundTruth, setGroundTruth] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [exportFormat, setExportFormat] = useState(null);
  const [activeTab, setActiveTab] = useState('text');

  // Load ground truth data
  useEffect(() => {
    const loadGroundTruth = async () => {
      try {
        const response = await fetch('/data/social_media_ground_truth.json');
        const data = await response.json();
        setGroundTruth(data);
      } catch (error) {
        console.error('Failed to load ground truth:', error);
      }
    };
    loadGroundTruth();
  }, []);

  // Compare results with ground truth
  useEffect(() => {
    if (results && groundTruth && files.length > 0) {
      const compareResults = () => {
        const comparison = {
          files: [],
          overall: {
            expected_total: 0,
            found_total: 0,
            matches: 0,
            precision: 0,
            recall: 0,
            f1_score: 0
          }
        };

        // Process each file
        files.forEach((file, index) => {
          const filename = file.name;
          const fileResult = results.results?.[index];
          const groundTruthData = groundTruth.images?.[filename];

          if (groundTruthData && fileResult) {
            const expectedLocations = groundTruthData.expected_locations || [];
            const foundLocations = [
              ...(fileResult.extracted_info?.locations || []),
              ...(fileResult.extracted_info?.addresses || []),
              ...(fileResult.extracted_info?.business_names || [])
            ];

            // Simple string matching for comparison
            const matches = [];
            const missed = [];

            expectedLocations.forEach(expected => {
              const found = foundLocations.find(found =>
                found.toLowerCase().includes(expected.text.toLowerCase()) ||
                expected.text.toLowerCase().includes(found.toLowerCase())
              );

              if (found) {
                matches.push({ expected: expected.text, found, type: expected.type });
              } else {
                missed.push(expected);
              }
            });

            const falsePositives = foundLocations.filter(found =>
              !expectedLocations.some(expected =>
                found.toLowerCase().includes(expected.text.toLowerCase()) ||
                expected.text.toLowerCase().includes(found.toLowerCase())
              )
            );

            const fileComparison = {
              filename,
              expected: expectedLocations,
              found: foundLocations,
              matches,
              missed,
              falsePositives,
              precision: foundLocations.length > 0 ? matches.length / foundLocations.length : 0,
              recall: expectedLocations.length > 0 ? matches.length / expectedLocations.length : 0
            };

            fileComparison.f1_score = fileComparison.precision + fileComparison.recall > 0
              ? 2 * (fileComparison.precision * fileComparison.recall) / (fileComparison.precision + fileComparison.recall)
              : 0;

            comparison.files.push(fileComparison);
            comparison.overall.expected_total += expectedLocations.length;
            comparison.overall.found_total += foundLocations.length;
            comparison.overall.matches += matches.length;
          }
        });

        // Calculate overall metrics
        comparison.overall.precision = comparison.overall.found_total > 0
          ? comparison.overall.matches / comparison.overall.found_total : 0;
        comparison.overall.recall = comparison.overall.expected_total > 0
          ? comparison.overall.matches / comparison.overall.expected_total : 0;
        comparison.overall.f1_score = comparison.overall.precision + comparison.overall.recall > 0
          ? 2 * (comparison.overall.precision * comparison.overall.recall) / (comparison.overall.precision + comparison.overall.recall)
          : 0;

        setComparison(comparison);
      };

      compareResults();
    }
  }, [results, groundTruth, files]);

  // Generate export format for AI agents
  useEffect(() => {
    if (results && comparison) {
      const generateExportFormat = () => {
        const exportData = {
          metadata: {
            timestamp: new Date().toISOString(),
            processing_pipeline: "Enhanced OCR + AI Pipeline",
            total_files: results.processing_stats?.total_files || 0,
            successful_files: results.processing_stats?.successful_files || 0,
            overall_confidence: results.processing_stats?.average_confidence || 0,
            performance_metrics: comparison ? {
              precision: comparison.overall.precision,
              recall: comparison.overall.recall,
              f1_score: comparison.overall.f1_score
            } : null
          },
          extracted_content: {
            locations: results.aggregated_data?.locations?.map(loc => ({
              name: loc.name,
              type: loc.type,
              confidence: loc.confidence,
              source_file: loc.source,
              context: "extracted_from_image"
            })) || [],
            raw_text_by_file: results.results?.map((result, index) => ({
              filename: files[index]?.name || `file_${index + 1}`,
              raw_text: result.raw_text || "",
              cleaned_text: result.cleaned_text || "",
              confidence: result.confidence || 0,
              content_type: result.content_type || "unknown",
              processing_success: result.success || false
            })) || []
          },
          ai_agent_instructions: {
            task: "process_location_data",
            context: "User uploaded images containing location information. Extract, validate, and organize this data for mapping.",
            data_quality: {
              ocr_confidence: results.processing_stats?.average_confidence || 0,
              location_extraction_confidence: comparison?.overall.precision || 0,
              recommended_validation: comparison?.overall.precision < 0.8 ? "high" : "standard"
            },
            suggested_actions: [
              "Validate extracted locations against known databases",
              "Geocode locations to obtain coordinates",
              "Group related locations by geographic proximity",
              "Generate map visualization with extracted locations",
              comparison?.overall.precision < 0.7 ? "Request user validation for low-confidence extractions" : null
            ].filter(Boolean)
          }
        };

        setExportFormat(exportData);
      };

      generateExportFormat();
    }
  }, [results, comparison, files]);

  if (!results) {
    return (
      <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200 p-8">
        <div className="text-center">
          <div className="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready for Analysis</h3>
          <p className="text-gray-600 mb-6">Upload and process images above to see comprehensive results here</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
            <div className="text-3xl mb-2">📝</div>
            <h4 className="font-semibold text-blue-900 mb-2">Extracted Text</h4>
            <p className="text-sm text-blue-700">Raw and cleaned OCR text with confidence scores</p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
            <div className="text-3xl mb-2">📍</div>
            <h4 className="font-semibold text-green-900 mb-2">Location Analysis</h4>
            <p className="text-sm text-green-700">Extracted locations compared with ground truth data</p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 text-center">
            <div className="text-3xl mb-2">🤖</div>
            <h4 className="font-semibold text-purple-900 mb-2">AI Export Format</h4>
            <p className="text-sm text-purple-700">Structured data ready for AI agent processing</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">OCR Analysis & Export Preview</h3>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('text')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'text'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              📝 Extracted Text
            </button>
            <button
              onClick={() => setActiveTab('locations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'locations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              📍 Location Analysis
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'export'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              🤖 AI Agent Export
            </button>
          </nav>
        </div>

        {/* Extracted Text Tab */}
        {activeTab === 'text' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {results.processing_stats?.successful_files || 0}
                </div>
                <div className="text-sm text-blue-800">Files Processed</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {results.processing_stats?.average_confidence ?
                    (results.processing_stats.average_confidence * 100).toFixed(1) : 0}%
                </div>
                <div className="text-sm text-green-800">Avg OCR Confidence</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {results.results?.reduce((total, result) =>
                    total + (result.cleaned_text?.length || 0), 0) || 0}
                </div>
                <div className="text-sm text-purple-800">Total Characters</div>
              </div>
            </div>

            {results.results?.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    {files[index]?.name || `File ${index + 1}`}
                  </h4>
                  <span className={`px-2 py-1 rounded-full text-xs ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {result.success ? `${(result.confidence * 100).toFixed(1)}% confidence` : 'Failed'}
                  </span>
                </div>

                {files[index] && (
                  <div className="mb-4">
                    <img
                      src={URL.createObjectURL(files[index])}
                      alt={`Preview of ${files[index].name}`}
                      className="max-h-32 rounded border"
                    />
                  </div>
                )}

                {result.success && (
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Raw OCR Text:</h5>
                      <div className="bg-gray-50 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
                        {result.raw_text || 'No raw text available'}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Cleaned Text:</h5>
                      <div className="bg-blue-50 p-3 rounded text-xs max-h-32 overflow-y-auto">
                        {result.cleaned_text || 'No cleaned text available'}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Content Type:</span>
                        <div className="font-medium">{result.content_type || 'Unknown'}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Text Length:</span>
                        <div className="font-medium">{result.cleaned_text?.length || 0} chars</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Language:</span>
                        <div className="font-medium">{result.language_detected || 'Unknown'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {!result.success && result.error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                    Error: {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Location Analysis Tab */}
        {activeTab === 'locations' && (
          <div className="space-y-6">
            {comparison && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {(comparison.overall.precision * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-green-800">Precision</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {(comparison.overall.recall * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-blue-800">Recall</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {(comparison.overall.f1_score * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-purple-800">F1 Score</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {comparison.overall.matches}/{comparison.overall.expected_total}
                  </div>
                  <div className="text-sm text-orange-800">Matches</div>
                </div>
              </div>
            )}

            {/* Per-file comparison */}
            {comparison?.files.map((fileComp, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">{fileComp.filename}</h4>

                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-600">Expected:</span>
                    <div className="font-medium">{fileComp.expected.length} locations</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Found:</span>
                    <div className="font-medium">{fileComp.found.length} locations</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Matches:</span>
                    <div className="font-medium">{fileComp.matches.length} locations</div>
                  </div>
                </div>

                {/* Matches */}
                {fileComp.matches.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-green-700 mb-2">✅ Correct Matches:</h5>
                    <div className="space-y-2">
                      {fileComp.matches.map((match, i) => (
                        <div key={i} className="bg-green-50 p-2 rounded text-sm">
                          <div className="font-medium">Expected: {match.expected}</div>
                          <div className="text-gray-600">Found: {match.found}</div>
                          <div className="text-xs text-gray-500">Type: {match.type}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missed */}
                {fileComp.missed.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-red-700 mb-2">❌ Missed Locations:</h5>
                    <div className="space-y-2">
                      {fileComp.missed.map((missed, i) => (
                        <div key={i} className="bg-red-50 p-2 rounded text-sm">
                          <div className="font-medium">{missed.text}</div>
                          <div className="text-xs text-gray-500">Type: {missed.type}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* False Positives */}
                {fileComp.falsePositives.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-orange-700 mb-2">⚠️ False Positives:</h5>
                    <div className="space-y-2">
                      {fileComp.falsePositives.map((fp, i) => (
                        <div key={i} className="bg-orange-50 p-2 rounded text-sm">
                          <div className="font-medium">{fp}</div>
                          <div className="text-xs text-gray-500">Extracted but not expected</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* AI Agent Export Tab */}
        {activeTab === 'export' && exportFormat && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Export Format for AI Agents</h4>
              <p className="text-sm text-blue-800">
                This structured data format is optimized for AI agents to understand and process the extracted location information.
              </p>
            </div>

            {/* Metadata Section */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Processing Metadata</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Pipeline:</span>
                  <div className="font-medium">{exportFormat.metadata.processing_pipeline}</div>
                </div>
                <div>
                  <span className="text-gray-600">Success Rate:</span>
                  <div className="font-medium">
                    {exportFormat.metadata.successful_files}/{exportFormat.metadata.total_files}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">OCR Confidence:</span>
                  <div className="font-medium">
                    {(exportFormat.metadata.overall_confidence * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Data Quality:</span>
                  <div className="font-medium">
                    {exportFormat.ai_agent_instructions.data_quality.recommended_validation}
                  </div>
                </div>
              </div>
            </div>

            {/* Extracted Locations */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">
                Extracted Locations ({exportFormat.extracted_content.locations.length})
              </h5>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {exportFormat.extracted_content.locations.map((location, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium">{location.name}</div>
                      <div className="text-sm text-gray-500">
                        {location.type} • {(location.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Source: {location.source_file} • Context: {location.context}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Instructions */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">AI Agent Instructions</h5>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Task:</span>
                  <div className="font-medium">{exportFormat.ai_agent_instructions.task}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Context:</span>
                  <div className="text-sm">{exportFormat.ai_agent_instructions.context}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Suggested Actions:</span>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-1">
                    {exportFormat.ai_agent_instructions.suggested_actions.map((action, index) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Export Actions */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Export Options</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(exportFormat, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `llmap-ai-export-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center justify-center"
                >
                  📄 Download AI Export JSON
                </button>

                <button
                  onClick={() => {
                    const geoJSON = {
                      type: "FeatureCollection",
                      metadata: {
                        generated: new Date().toISOString(),
                        source: "LLMap OCR Analysis",
                        processing_pipeline: exportFormat.metadata.processing_pipeline,
                        confidence: exportFormat.metadata.overall_confidence
                      },
                      features: exportFormat.extracted_content.locations.map((location, index) => ({
                        type: "Feature",
                        geometry: {
                          type: "Point",
                          coordinates: [0, 0] // Placeholder - needs geocoding
                        },
                        properties: {
                          id: index,
                          name: location.name,
                          type: location.type,
                          confidence: location.confidence,
                          source_file: location.source_file,
                          needs_geocoding: true
                        }
                      }))
                    };

                    const blob = new Blob([JSON.stringify(geoJSON, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `llmap-locations-${new Date().toISOString().split('T')[0]}.geojson`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center justify-center"
                >
                  🗺️ Download GeoJSON
                </button>

                <button
                  onClick={() => {
                    if (!exportFormat?.extracted_content?.raw_text_by_file) {
                      alert('No text data available to download');
                      return;
                    }

                    const textContent = exportFormat.extracted_content.raw_text_by_file
                      .map(file => `=== ${file.filename} ===\n\nRaw Text:\n${file.raw_text}\n\nCleaned Text:\n${file.cleaned_text}\n\nConfidence: ${(file.confidence * 100).toFixed(1)}%\n\n`)
                      .join('\n');

                    const blob = new Blob([textContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `llmap-extracted-text-${new Date().toISOString().split('T')[0]}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex items-center justify-center"
                >
                  📝 Download Extracted Text
                </button>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                <p>• AI Export JSON: Structured data for AI agent processing</p>
                <p>• GeoJSON: Standard format for mapping applications (coordinates need geocoding)</p>
                <p>• Extracted Text: Raw and cleaned OCR text from all processed files</p>
              </div>
            </div>

            {/* Raw JSON Preview */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-gray-900">Raw JSON Preview</h5>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(exportFormat, null, 2));
                    alert('Export data copied to clipboard!');
                  }}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                >
                  Copy to Clipboard
                </button>
              </div>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(exportFormat, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}