// Sample data representing what AI would extract from your test images
// FIXED: All coordinates are in [lng, lat] format (GeoJSON standard)

export const googleMapsData = [
    {
        id: 'img_3193',
        name: 'Sushi Nakazawa',
        type: 'Japanese Restaurant',
        rating: 4.5,
        address: '23 Commerce St, New York, NY 10014',
        priceLevel: 'Expensive',
        coordinates: [-74.0059, 40.7282],
        extractedFrom: 'IMG_3193.PNG',
        confidence: 0.95,
        metadata: {
            hours: 'Open until 10:00 PM',
            phone: '(212) 924-2212',
            website: 'sushinarazawa.com'
        }
    },
    {
        id: 'img_3194',
        name: 'Joes Pizza',
        type: 'Pizza Restaurant',
        rating: 4.2,
        address: '7 Carmine St, New York, NY 10014',
        priceLevel: 'Inexpensive',
        coordinates: [-74.0021, 40.7301],
        extractedFrom: 'IMG_3194.PNG',
        confidence: 0.92,
        metadata: {
            hours: 'Open 24 hours',
            phone: '(212) 366-1182',
            specialty: 'New York Style Pizza'
        }
    },
    {
        id: 'img_3195',
        name: 'Katzs Delicatessen',
        type: 'Delicatessen',
        rating: 4.3,
        address: '205 E Houston St, New York, NY 10002',
        priceLevel: 'Moderate',
        coordinates: [-73.9873, 40.7223],
        extractedFrom: 'IMG_3195.PNG',
        confidence: 0.98,
        metadata: {
            hours: 'Open until 10:45 PM',
            phone: '(212) 254-2246',
            famous: 'Pastrami Sandwich'
        }
    },
    {
        id: 'img_3196',
        name: 'Peter Luger Steak House',
        type: 'Steakhouse',
        rating: 4.4,
        address: '178 Broadway, Brooklyn, NY 11249',
        priceLevel: 'Very Expensive',
        coordinates: [-73.9625, 40.7081],
        extractedFrom: 'IMG_3196.PNG',
        confidence: 0.94,
        metadata: {
            hours: 'Closed now Opens 5:00 PM',
            phone: '(718) 387-7400',
            established: '1887'
        }
    },
    {
        id: 'img_3197',
        name: 'Russ and Daughters',
        type: 'Appetizing Shop',
        rating: 4.6,
        address: '179 E Houston St, New York, NY 10002',
        priceLevel: 'Expensive',
        coordinates: [-73.9881, 40.7223],
        extractedFrom: 'IMG_3197.PNG',
        confidence: 0.96,
        metadata: {
            hours: 'Open until 6:00 PM',
            phone: '(212) 475-4880',
            specialty: 'Bagels and Lox'
        }
    }
];

export const socialMediaData = [
    {
        id: 'social_1',
        name: 'Xian Famous Foods',
        type: 'Chinese Restaurant',
        rating: 4.3,
        address: '81 St Marks Pl, New York, NY 10003',
        priceLevel: 'Inexpensive',
        coordinates: [-73.9857, 40.7282],
        extractedFrom: 'Social Media Screenshot',
        confidence: 0.87,
        metadata: {
            specialty: 'Hand-pulled noodles',
            hours: 'Open until 10:00 PM'
        }
    },
    {
        id: 'social_2',
        name: 'Levain Bakery',
        type: 'Bakery',
        rating: 4.5,
        address: '167 W 74th St, New York, NY 10023',
        priceLevel: 'Inexpensive',
        coordinates: [-73.9781, 40.7794],
        extractedFrom: 'Social Media Screenshot',
        confidence: 0.91,
        metadata: {
            famous: 'Chocolate Chip Cookies',
            hours: 'Open until 11:00 PM'
        }
    },
    {
        id: 'social_3',
        name: 'The Halal Guys',
        type: 'Middle Eastern',
        rating: 4.1,
        address: '307 E 14th St, New York, NY 10003',
        priceLevel: 'Inexpensive',
        coordinates: [-73.9811, 40.7329],
        extractedFrom: 'Social Media Screenshot',
        confidence: 0.89,
        metadata: {
            specialty: 'Chicken and Rice',
            hours: 'Open until 2:00 AM'
        }
    }
];

// FIXED: Enhanced simulateAIProcessing with coordinate validation and logging
export const simulateAIProcessing = (data, delayMs = 2000) => {
    console.log('=== AI PROCESSING SIMULATION START ===');
    console.log('Input data:', data);
    
    return new Promise((resolve) => {
        setTimeout(() => {
            // Validate and process each location
            const processedData = data.map((location, index) => {
                console.log(`Processing location ${index + 1}: ${location.name}`);
                
                // Check if coordinates exist and are valid
                if (!location.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
                    console.error(`❌ Invalid coordinates for ${location.name}:`, location.coordinates);
                    return null;
                }
                
                const [lng, lat] = location.coordinates;
                
                // Validate coordinate ranges
                if (typeof lng !== 'number' || typeof lat !== 'number') {
                    console.error(`❌ Non-numeric coordinates for ${location.name}: lng=${lng}, lat=${lat}`);
                    return null;
                }
                
                if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                    console.error(`❌ Out of range coordinates for ${location.name}: lng=${lng}, lat=${lat}`);
                    return null;
                }
                
                // Log successful processing
                console.log(`✅ ${location.name}: [${lng}, ${lat}] (${location.address})`);
                
                // Return processed location with additional metadata
                return {
                    ...location,
                    processed: true,
                    processedAt: new Date().toISOString(),
                    coordinateFormat: '[lng, lat]'
                };
            }).filter(Boolean); // Remove null entries
            
            console.log(`=== AI PROCESSING COMPLETE ===`);
            console.log(`Successfully processed ${processedData.length} out of ${data.length} locations`);
            console.log('Final processed data:', processedData);
            
            resolve(processedData);
        }, delayMs);
    });
};

// FIXED: Enhanced test data with coordinate validation
export const testDataSets = {
    restaurants: {
        id: 'nyc-restaurants',
        name: 'NYC Famous Restaurants',
        description: 'Collection of famous restaurants in New York City',
        data: googleMapsData,
        expectedCenter: { lat: 40.7200, lng: -73.9900 }, // Approximate center of locations
        expectedBounds: {
            north: 40.7350,
            south: 40.7050,
            east: -73.9600,
            west: -74.0100
        }
    },
    socialSpots: {
        id: 'nyc-social-spots',
        name: 'Social Media Food Spots',
        description: 'Popular food spots from social media',
        data: socialMediaData,
        expectedCenter: { lat: 40.7500, lng: -73.9800 },
        expectedBounds: {
            north: 40.7800,
            south: 40.7200,
            east: -73.9750,
            west: -73.9900
        }
    }
};

// Helper function to validate coordinate data
export const validateLocationData = (locations) => {
    console.log('=== VALIDATING LOCATION DATA ===');
    
    const results = locations.map(location => {
        const errors = [];
        
        // Check required fields
        if (!location.name) errors.push('Missing name');
        if (!location.coordinates) errors.push('Missing coordinates');
        if (!location.type) errors.push('Missing type');
        
        // Check coordinate format
        if (location.coordinates) {
            if (!Array.isArray(location.coordinates)) {
                errors.push('Coordinates not an array');
            } else if (location.coordinates.length !== 2) {
                errors.push('Coordinates array length != 2');
            } else {
                const [lng, lat] = location.coordinates;
                if (typeof lng !== 'number') errors.push('Longitude not a number');
                if (typeof lat !== 'number') errors.push('Latitude not a number');
                if (Math.abs(lat) > 90) errors.push('Latitude out of range');
                if (Math.abs(lng) > 180) errors.push('Longitude out of range');
            }
        }
        
        return {
            location: location.name || 'Unknown',
            valid: errors.length === 0,
            errors: errors
        };
    });
    
    const validCount = results.filter(r => r.valid).length;
    console.log(`Validation complete: ${validCount}/${results.length} locations valid`);
    
    results.forEach(result => {
        if (!result.valid) {
            console.warn(`❌ ${result.location}:`, result.errors);
        } else {
            console.log(`✅ ${result.location}: Valid`);
        }
    });
    
    return results;
};