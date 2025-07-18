import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, DocumentTextIcon, MapPinIcon, CodeBracketIcon } from '@heroicons/react/24/outline';

export default function ResultsPanel({ results, groundTruthComparison, isVisible = false }) {
    const [activeTab, setActiveTab] = useState('extracted'); // 'extracted', 'locations', 'export'
    const [expandedSections, setExpandedSections] = useState({
        rawText: false,
        processedText: false,
        matchedLocations: true,
        missingLocations: false,
        falsePositives: false,
        exportData: false
    });

    if (!isVisible || !results) {
        return null;
    }

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Format extracted text for display
    const formatExtractedText = (text) => {
        if (!text) return 'No text extracted';
        return text.replace(/\n+/g, '\n').trim();
    };

    // Get statistics
    const getStats = () => {
        const totalLocations = results.aggregated_data?.locations?.length || 0;
        const matchedLocations = groundTruthComparison?.matches?.length || 0;
        const missingLocations = groundTruthComparison?.missing?.length || 0;
        const falsePositives = groundTruthComparison?.false_positives?.length || 0;

        return {
            totalProcessed: results.processing_stats?.successful_files || 0,
            totalFailed: results.processing_stats?.failed_files || 0,
            totalLocations,
            matchedLocations,
            missingLocations,
            falsePositives,
            accuracy: groundTruthComparison?.accuracy_metrics?.precision || 0,
            recall: groundTruthComparison?.accuracy_metrics?.recall || 0,
            f1Score: groundTruthComparison?.accuracy_metrics?.f1_score || 0
        };
    };

    const stats = getStats();

    const tabs = [
        { id: 'extracted', label: 'Extracted Text', icon: DocumentTextIcon },
        { id: 'locations', label: 'Location Analysis', icon: MapPinIcon },
        { id: 'export', label: 'Export Data', icon: CodeBracketIcon }
    ];

    return (
        <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Processing Results
                </h3>

                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                        <div className="text-xl font-bold text-blue-600">{stats.totalProcessed}</div>
                        <div className="text-sm text-blue-800">Files Processed</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                        <div className="text-xl font-bold text-green-600">{stats.totalLocations}</div>
                        <div className="text-sm text-green-800">Locations Found</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg text-center">
                        <div className="text-xl font-bold text-purple-600">{stats.matchedLocations}</div>
                        <div className="text-sm text-purple-800">Accurate Matches</div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg text-center">
                        <div className="text-xl font-bold text-orange-600">
                            {(stats.accuracy * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-orange-800">Precision</div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-white text-blue-700 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <Icon className="h-4 w-4 mr-2" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="p-6">
                {/* Extracted Text Tab */}
                {activeTab === 'extracted' && (
                    <div className="space-y-6">
                        {/* Raw Extracted Text */}
                        <div>
                            <button
                                onClick={() => toggleSection('rawText')}
                                className="flex items-center w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                {expandedSections.rawText ? (
                                    <ChevronDownIcon className="h-5 w-5 mr-2 text-gray-500" />
                                ) : (
                                    <ChevronRightIcon className="h-5 w-5 mr-2 text-gray-500" />
                                )}
                                <h4 className="text-md font-medium text-gray-900">
                                    Raw Extracted Text ({results.individual_results?.length || 0} files)
                                </h4>
                            </button>
                            
                            {expandedSections.rawText && (
                                <div className="mt-3 space-y-4">
                                    {results.individual_results?.map((result, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h5 className="text-sm font-medium text-gray-700">
                                                    {result.filename}
                                                </h5>
                                                <span className="text-xs text-gray-500">
                                                    Confidence: {((result.confidence || 0) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded border max-h-40 overflow-y-auto">
                                                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                                                    {formatExtractedText(result.text)}
                                                </pre>
                                            </div>
                                        </div>
                                    )) || (
                                        <div className="text-center text-gray-500 py-4">
                                            No individual results available
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Processed Text Summary */}
                        <div>
                            <button
                                onClick={() => toggleSection('processedText')}
                                className="flex items-center w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                {expandedSections.processedText ? (
                                    <ChevronDownIcon className="h-5 w-5 mr-2 text-gray-500" />
                                ) : (
                                    <ChevronRightIcon className="h-5 w-5 mr-2 text-gray-500" />
                                )}
                                <h4 className="text-md font-medium text-gray-900">
                                    Processed & Structured Text
                                </h4>
                            </button>
                            
                            {expandedSections.processedText && (
                                <div className="mt-3">
                                    <div className="bg-gray-50 p-4 rounded border">
                                        <h6 className="text-sm font-medium text-gray-700 mb-2">All Extracted Text Combined:</h6>
                                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
                                            {formatExtractedText(results.aggregated_data?.all_text || 'No combined text available')}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Location Analysis Tab */}
                {activeTab === 'locations' && groundTruthComparison && (
                    <div className="space-y-6">
                        {/* Performance Metrics */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-green-50 p-4 rounded-lg text-center">
                                <div className="text-lg font-bold text-green-600">
                                    {(stats.accuracy * 100).toFixed(1)}%
                                </div>
                                <div className="text-sm text-green-800">Precision</div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg text-center">
                                <div className="text-lg font-bold text-blue-600">
                                    {(stats.recall * 100).toFixed(1)}%
                                </div>
                                <div className="text-sm text-blue-800">Recall</div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg text-center">
                                <div className="text-lg font-bold text-purple-600">
                                    {(stats.f1Score * 100).toFixed(1)}%
                                </div>
                                <div className="text-sm text-purple-800">F1 Score</div>
                            </div>
                        </div>

                        {/* Matched Locations */}
                        <div>
                            <button
                                onClick={() => toggleSection('matchedLocations')}
                                className="flex items-center w-full text-left p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                            >
                                {expandedSections.matchedLocations ? (
                                    <ChevronDownIcon className="h-5 w-5 mr-2 text-green-600" />
                                ) : (
                                    <ChevronRightIcon className="h-5 w-5 mr-2 text-green-600" />
                                )}
                                <h4 className="text-md font-medium text-green-800">
                                    ✅ Successful Matches ({stats.matchedLocations})
                                </h4>
                            </button>
                            
                            {expandedSections.matchedLocations && (
                                <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
                                    {groundTruthComparison.matches?.map((match, index) => (
                                        <div key={index} className="border border-green-200 bg-green-50 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-green-900">
                                                    {match.ground_truth.business_name}
                                                </span>
                                                <div className="flex items-center space-x-2">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                                        match.match_type === 'exact' ? 'bg-green-100 text-green-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                        {match.match_type}
                                                    </span>
                                                    <span className="text-sm text-green-600">
                                                        {((match.confidence || 0) * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-sm text-green-700">
                                                <div><strong>Ground Truth:</strong> {match.ground_truth.address}</div>
                                                <div><strong>OCR Result:</strong> {match.ocr_result.name}</div>
                                                <div><strong>Source:</strong> {match.ground_truth.image_file}</div>
                                            </div>
                                        </div>
                                    )) || (
                                        <div className="text-center text-green-600 py-4">
                                            No matches found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Missing Locations */}
                        <div>
                            <button
                                onClick={() => toggleSection('missingLocations')}
                                className="flex items-center w-full text-left p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                            >
                                {expandedSections.missingLocations ? (
                                    <ChevronDownIcon className="h-5 w-5 mr-2 text-red-600" />
                                ) : (
                                    <ChevronRightIcon className="h-5 w-5 mr-2 text-red-600" />
                                )}
                                <h4 className="text-md font-medium text-red-800">
                                    ❌ Missing Locations ({stats.missingLocations})
                                </h4>
                            </button>
                            
                            {expandedSections.missingLocations && (
                                <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
                                    {groundTruthComparison.missing?.map((missing, index) => (
                                        <div key={index} className="border border-red-200 bg-red-50 rounded-lg p-3">
                                            <div className="font-medium text-red-900">{missing.business_name}</div>
                                            <div className="text-sm text-red-700">
                                                {missing.address} | {missing.image_file}
                                            </div>
                                        </div>
                                    )) || (
                                        <div className="text-center text-red-600 py-4">
                                            No missing locations
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* False Positives */}
                        <div>
                            <button
                                onClick={() => toggleSection('falsePositives')}
                                className="flex items-center w-full text-left p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
                            >
                                {expandedSections.falsePositives ? (
                                    <ChevronDownIcon className="h-5 w-5 mr-2 text-yellow-600" />
                                ) : (
                                    <ChevronRightIcon className="h-5 w-5 mr-2 text-yellow-600" />
                                )}
                                <h4 className="text-md font-medium text-yellow-800">
                                    ⚠️ False Positives ({stats.falsePositives})
                                </h4>
                            </button>
                            
                            {expandedSections.falsePositives && (
                                <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
                                    {groundTruthComparison.false_positives?.map((fp, index) => (
                                        <div key={index} className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                                            <div className="font-medium text-yellow-900">{fp.name}</div>
                                            <div className="text-sm text-yellow-700">
                                                Type: {fp.type} | Source: {fp.source} | Confidence: {((fp.confidence || 0) * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    )) || (
                                        <div className="text-center text-yellow-600 py-4">
                                            No false positives
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Export Data Tab */}
                {activeTab === 'export' && (
                    <div className="space-y-6">
                        {/* Export Preview */}
                        <div>
                            <button
                                onClick={() => toggleSection('exportData')}
                                className="flex items-center w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                {expandedSections.exportData ? (
                                    <ChevronDownIcon className="h-5 w-5 mr-2 text-gray-500" />
                                ) : (
                                    <ChevronRightIcon className="h-5 w-5 mr-2 text-gray-500" />
                                )}
                                <h4 className="text-md font-medium text-gray-900">
                                    Complete Export Data (JSON)
                                </h4>
                            </button>
                            
                            {expandedSections.exportData && (
                                <div className="mt-3">
                                    <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
                                        <pre>{JSON.stringify(results, null, 2)}</pre>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Export Actions */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => {
                                    const blob = new Blob([JSON.stringify(results, null, 2)], { 
                                        type: 'application/json' 
                                    });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `ocr-results-${new Date().toISOString().split('T')[0]}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="p-4 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-left"
                            >
                                <div className="text-blue-600 font-medium mb-1">💾 Full Results JSON</div>
                                <div className="text-sm text-gray-600">Complete processing results with metadata</div>
                            </button>

                            <button
                                onClick={() => {
                                    const locationsOnly = {
                                        locations: results.aggregated_data?.locations || [],
                                        summary: results.aggregated_data?.summary || {}
                                    };
                                    const blob = new Blob([JSON.stringify(locationsOnly, null, 2)], { 
                                        type: 'application/json' 
                                    });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `locations-${new Date().toISOString().split('T')[0]}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="p-4 border border-green-200 rounded-lg hover:bg-green-50 transition-colors text-left"
                            >
                                <div className="text-green-600 font-medium mb-1">📍 Locations Only</div>
                                <div className="text-sm text-gray-600">Just the extracted location data</div>
                            </button>

                            <button
                                onClick={() => {
                                    if (groundTruthComparison) {
                                        const blob = new Blob([JSON.stringify(groundTruthComparison, null, 2)], { 
                                            type: 'application/json' 
                                        });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `ground-truth-comparison-${new Date().toISOString().split('T')[0]}.json`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }
                                }}
                                disabled={!groundTruthComparison}
                                className="p-4 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="text-purple-600 font-medium mb-1">📊 Analysis Report</div>
                                <div className="text-sm text-gray-600">Ground truth comparison results</div>
                            </button>
                        </div>

                        {/* Format Information */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h5 className="text-md font-medium text-blue-900 mb-2">Export Format Information</h5>
                            <div className="text-sm text-blue-800 space-y-2">
                                <div><strong>Full Results:</strong> Contains all OCR text, processing stats, and location data</div>
                                <div><strong>Locations Only:</strong> Simplified format with just location names, types, and confidence scores</div>
                                <div><strong>Analysis Report:</strong> Ground truth comparison with accuracy metrics and match details</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 