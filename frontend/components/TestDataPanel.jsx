import { useState } from 'react';
import { PhotoIcon, MapPinIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { googleMapsData, socialMediaData, simulateAIProcessing, validateLocationData } from '../utils/sampleData';

// Mock data representing your test datasets
const testDataSets = [
  {
    id: 'google-maps',
    name: 'NYC Restaurants',
    description: 'Famous restaurants and eateries in New York City',
    count: 5,
    type: 'Restaurant Collection',
    images: [
      'IMG_3193.PNG',
      'IMG_3194.PNG', 
      'IMG_3195.PNG',
      'IMG_3196.PNG',
      'IMG_3197.PNG'
    ],
    mockLocations: googleMapsData.map(({ coordinates, ...rest }) => rest), // Preview without coordinates
    actualData: googleMapsData
  },
  {
    id: 'social-media',
    name: 'NYC Food Spots',
    description: 'Popular food spots from social media mentions',
    count: 3,
    type: 'Social Media Collection',
    images: [
      'xian_foods.jpg',
      'levain_bakery.jpg',
      'halal_guys.jpg'
    ],
    mockLocations: socialMediaData.map(({ coordinates, ...rest }) => rest),
    actualData: socialMediaData
  }
];

export default function TestDataPanel({ onLoadTestData }) {
  const [selectedDataSet, setSelectedDataSet] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLoadTestData = async (dataSet) => {
    console.log(`=== LOADING TEST DATA: ${dataSet.name} ===`);
    setIsProcessing(true);
    setSelectedDataSet(dataSet.id);
    
    try {
      // Validate data before processing
      console.log('🔍 Validating coordinates...');
      validateLocationData(dataSet.actualData);
      
      // Process data with AI simulation
      const processedData = await simulateAIProcessing(dataSet.actualData);
      console.log(`📤 Sending ${processedData.length} locations to MapView`);
      onLoadTestData(processedData);
    } catch (error) {
      console.error('❌ Error processing test data:', error);
      onLoadTestData([]);
    }
    
    setIsProcessing(false);
    setSelectedDataSet(null);
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Test with Sample Data
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Try LLMap with pre-loaded test data to see how AI extracts and maps location information 
            from different types of content.
          </p>
        </div>

        {/* Test Data Sets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {testDataSets.map((dataSet) => (
            <div key={dataSet.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <PhotoIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-xl font-semibold text-gray-900">{dataSet.name}</h3>
                      <p className="text-sm text-gray-500">{dataSet.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{dataSet.count}</div>
                    <div className="text-xs text-gray-500">Locations</div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <MapPinIcon className="w-3 h-3 mr-1" />
                    {dataSet.type}
                  </span>
                  <span className="text-sm text-gray-500">
                    {dataSet.mockLocations.length} locations ready
                  </span>
                </div>

                {/* Sample Locations Preview */}
                {dataSet.mockLocations.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Locations to map:</h4>
                    <div className="space-y-2">
                      {dataSet.mockLocations.slice(0, 3).map((location, index) => (
                        <div key={index} className="flex items-center text-sm text-gray-600">
                          <MapPinIcon className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="font-medium">{location.name}</span>
                          <span className="mx-2">•</span>
                          <span>{location.type}</span>
                          {location.rating && (
                            <>
                              <span className="ml-auto text-yellow-500">★ {location.rating}</span>
                            </>
                          )}
                        </div>
                      ))}
                      {dataSet.mockLocations.length > 3 && (
                        <div className="text-xs text-gray-400 ml-6">
                          +{dataSet.mockLocations.length - 3} more locations...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={() => handleLoadTestData(dataSet)}
                  disabled={dataSet.count === 0 || isProcessing}
                  className={`
                    w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all
                    ${dataSet.count === 0 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isProcessing && selectedDataSet === dataSet.id
                        ? 'bg-blue-100 text-blue-600 cursor-wait'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                    }
                  `}
                >
                  {isProcessing && selectedDataSet === dataSet.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Processing with AI...
                    </>
                  ) : dataSet.count === 0 ? (
                    'No Data Available'
                  ) : (
                    <>
                      <SparklesIcon className="w-4 h-4 mr-2" />
                      Load Test Data
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Debug Info Panel */}
        <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-start">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <SparklesIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Coordinate Testing</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• <strong>NYC Restaurants:</strong> 5 real restaurant locations in Manhattan and Brooklyn</p>
                <p>• <strong>NYC Food Spots:</strong> 3 popular food spots with verified coordinates</p>
                <p>• <strong>Coordinate Format:</strong> All coordinates are in [longitude, latitude] format (GeoJSON standard)</p>
                <p>• <strong>Debug Mode:</strong> Check browser console for coordinate processing logs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}