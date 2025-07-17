// Free geocoding service using Nominatim (OpenStreetMap)
// FIXED: Ensures consistent coordinate format [lng, lat] throughout

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// Rate limiting to be respectful to the free service
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export class GeocodingService {
  constructor() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  // Rate limit: max 1 request per second to be respectful
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < 1000) {
      await delay(1000 - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  // FIXED: Geocode address to coordinates - always returns [lng, lat] format
  async geocodeAddress(address) {
    console.log(`🔍 Geocoding address: "${address}"`);
    await this.rateLimit();
    
    try {
      const response = await fetch(
        `${NOMINATIM_BASE_URL}/search?` + 
        new URLSearchParams({
          q: address,
          format: 'json',
          limit: 1,
          addressdetails: 1
        })
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const lng = parseFloat(result.lon);
        const lat = parseFloat(result.lat);
        
        // FIXED: Always return coordinates in [lng, lat] format (GeoJSON standard)
        const coordinates = [lng, lat];
        
        console.log(`✅ Geocoded "${address}" -> [${lng}, ${lat}]`);
        
        return {
          success: true,
          coordinates: coordinates, // [lng, lat] format
          displayName: result.display_name,
          confidence: parseFloat(result.importance) || 0.5,
          boundingBox: result.boundingbox ? result.boundingbox.map(parseFloat) : null,
          metadata: {
            osm_id: result.osm_id,
            osm_type: result.osm_type,
            place_id: result.place_id,
            licence: result.licence
          }
        };
      }
      
      console.warn(`❌ No geocoding results for: "${address}"`);
      return {
        success: false,
        error: 'No results found',
        originalAddress: address
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      return {
        success: false,
        error: error.message,
        originalAddress: address
      };
    }
  }

  // FIXED: Reverse geocode coordinates to address - accepts both formats
  async reverseGeocode(lat, lng) {
    // Handle both coordinate input formats gracefully
    let latitude, longitude;
    
    if (Array.isArray(lat)) {
      // If first parameter is an array, assume [lng, lat] format
      [longitude, latitude] = lat;
      console.log(`🔍 Reverse geocoding [lng, lat]: [${longitude}, ${latitude}]`);
    } else {
      // If separate parameters, assume (lat, lng) format
      latitude = lat;
      longitude = lng;
      console.log(`🔍 Reverse geocoding (lat, lng): (${latitude}, ${longitude})`);
    }
    
    await this.rateLimit();
    
    try {
      const response = await fetch(
        `${NOMINATIM_BASE_URL}/reverse?` + 
        new URLSearchParams({
          lat: latitude.toString(),
          lon: longitude.toString(),
          format: 'json',
          addressdetails: 1
        })
      );
      
      const data = await response.json();
      
      if (data && data.display_name) {
        console.log(`✅ Reverse geocoded to: "${data.display_name}"`);
        return {
          success: true,
          address: data.display_name,
          details: data.address,
          coordinates: [longitude, latitude], // Return in [lng, lat] format
          metadata: {
            osm_id: data.osm_id,
            osm_type: data.osm_type,
            place_id: data.place_id
          }
        };
      }
      
      console.warn(`❌ No address found for coordinates: [${longitude}, ${latitude}]`);
      return {
        success: false,
        error: 'No address found',
        coordinates: [longitude, latitude]
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return {
        success: false,
        error: error.message,
        coordinates: [longitude, latitude]
      };
    }
  }

  // FIXED: Batch geocode multiple addresses with progress logging
  async geocodeMultiple(addresses) {
    console.log(`🔄 Starting batch geocoding for ${addresses.length} addresses`);
    const results = [];
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      console.log(`📍 Processing ${i + 1}/${addresses.length}: "${address}"`);
      
      const result = await this.geocodeAddress(address);
      results.push({
        index: i,
        originalAddress: address,
        ...result
      });
      
      // Progress update
      if ((i + 1) % 5 === 0 || i === addresses.length - 1) {
        console.log(`📊 Batch progress: ${i + 1}/${addresses.length} completed`);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Batch geocoding complete: ${successCount}/${addresses.length} successful`);
    
    return results;
  }

  // FIXED: Search for places by name with consistent coordinate format
  async searchPlaces(query, location = null) {
    console.log(`🔍 Searching places for: "${query}"`);
    await this.rateLimit();
    
    try {
      const params = {
        q: query,
        format: 'json',
        limit: 10,
        addressdetails: 1,
        extratags: 1
      };
      
      if (location) {
        // Handle different location format inputs
        if (location.west !== undefined) {
          // Bounding box format
          params.viewbox = `${location.west},${location.south},${location.east},${location.north}`;
          params.bounded = 1;
        } else if (Array.isArray(location) && location.length === 2) {
          // Center point format [lng, lat]
          const [lng, lat] = location;
          const buffer = 0.01; // ~1km buffer
          params.viewbox = `${lng - buffer},${lat - buffer},${lng + buffer},${lat + buffer}`;
          params.bounded = 1;
        }
      }
      
      const response = await fetch(
        `${NOMINATIM_BASE_URL}/search?` + new URLSearchParams(params)
      );
      
      const data = await response.json();
      
      const results = data.map((item, index) => {
        const lng = parseFloat(item.lon);
        const lat = parseFloat(item.lat);
        
        return {
          id: `search_${index}`,
          name: item.display_name,
          coordinates: [lng, lat], // FIXED: Always [lng, lat] format
          type: item.type,
          category: item.class,
          importance: parseFloat(item.importance) || 0,
          boundingBox: item.boundingbox ? item.boundingbox.map(parseFloat) : null,
          metadata: {
            osm_id: item.osm_id,
            osm_type: item.osm_type,
            place_id: item.place_id
          }
        };
      });
      
      console.log(`✅ Found ${results.length} places for "${query}"`);
      return results;
    } catch (error) {
      console.error('Place search error:', error);
      return [];
    }
  }

  // NEW: Validate coordinates format and range
  validateCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return {
        valid: false,
        error: 'Coordinates must be an array of length 2',
        format: 'Expected: [lng, lat]'
      };
    }
    
    const [lng, lat] = coordinates;
    
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return {
        valid: false,
        error: 'Coordinates must be numbers',
        lng: typeof lng,
        lat: typeof lat
      };
    }
    
    if (Math.abs(lat) > 90) {
      return {
        valid: false,
        error: 'Latitude out of range',
        lat: lat,
        range: '[-90, 90]'
      };
    }
    
    if (Math.abs(lng) > 180) {
      return {
        valid: false,
        error: 'Longitude out of range',
        lng: lng,
        range: '[-180, 180]'
      };
    }
    
    return {
      valid: true,
      lng: lng,
      lat: lat,
      format: '[lng, lat]'
    };
  }

  // NEW: Convert different coordinate formats to standard [lng, lat]
  normalizeCoordinates(input) {
    console.log('🔄 Normalizing coordinates:', input);
    
    // Handle array format
    if (Array.isArray(input) && input.length === 2) {
      const [first, second] = input;
      
      // Parse strings if needed
      const firstNum = typeof first === 'string' ? parseFloat(first) : first;
      const secondNum = typeof second === 'string' ? parseFloat(second) : second;
      
      if (isNaN(firstNum) || isNaN(secondNum)) {
        console.error('❌ Invalid coordinate numbers:', input);
        return null;
      }
      
      // Detect format based on valid ranges
      // If first value could be longitude and second could be latitude
      if (Math.abs(firstNum) <= 180 && Math.abs(secondNum) <= 90) {
        console.log('✅ Detected [lng, lat] format');
        return [firstNum, secondNum]; // [lng, lat]
      }
      // If first value could be latitude and second could be longitude
      else if (Math.abs(firstNum) <= 90 && Math.abs(secondNum) <= 180) {
        console.log('✅ Detected [lat, lng] format, converting to [lng, lat]');
        return [secondNum, firstNum]; // Convert to [lng, lat]
      }
      // Default to GeoJSON standard
      else {
        console.warn('⚠️ Ambiguous coordinates, assuming [lng, lat] format');
        return [firstNum, secondNum];
      }
    }
    
    // Handle object format
    if (typeof input === 'object' && input.lat !== undefined && input.lng !== undefined) {
      console.log('✅ Detected {lat, lng} object format, converting to [lng, lat]');
      return [parseFloat(input.lng), parseFloat(input.lat)];
    }
    
    if (typeof input === 'object' && input.latitude !== undefined && input.longitude !== undefined) {
      console.log('✅ Detected {latitude, longitude} object format, converting to [lng, lat]');
      return [parseFloat(input.longitude), parseFloat(input.latitude)];
    }
    
    console.error('❌ Unrecognized coordinate format:', input);
    return null;
  }
}

// Create singleton instance
export const geocodingService = new GeocodingService();

// FIXED: Helper function to extract location info from text using improved patterns
export function extractLocationHints(text) {
  const locationPatterns = [
    // Full address patterns
    /\d+\s+[A-Za-z\s]+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Place|Pl\.?)\s*,?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}/gi,
    // Street address without zip
    /\d+\s+[A-Za-z\s]+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Place|Pl\.?)/gi,
    // City, State ZIP patterns
    /[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/gi,
    // City, State patterns
    /[A-Za-z\s]+,\s*[A-Z]{2}/gi,
    // Simple city names with prepositions
    /(?:in|at|near|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    // Coordinate patterns
    /[-+]?\d{1,3}\.\d+\s*,\s*[-+]?\d{1,3}\.\d+/gi
  ];
  
  const matches = [];
  
  locationPatterns.forEach(pattern => {
    const found = text.match(pattern);
    if (found) {
      matches.push(...found);
    }
  });
  
  // Remove duplicates and clean up
  const uniqueMatches = [...new Set(matches)]
    .map(match => match.trim())
    .filter(match => match.length > 2); // Filter out very short matches
  
  console.log(`📍 Extracted ${uniqueMatches.length} location hints from text:`, uniqueMatches);
  
  return uniqueMatches;
}

// NEW: Helper function to calculate distance between two coordinates
export function calculateDistance(coord1, coord2) {
  // Ensure coordinates are in [lng, lat] format
  const [lng1, lat1] = Array.isArray(coord1) ? coord1 : [coord1.lng, coord1.lat];
  const [lng2, lat2] = Array.isArray(coord2) ? coord2 : [coord2.lng, coord2.lat];
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  
  return distance;
}

// NEW: Helper function to calculate center point of multiple coordinates
export function calculateCenter(coordinates) {
  if (!coordinates || coordinates.length === 0) return null;
  
  let totalLng = 0;
  let totalLat = 0;
  
  coordinates.forEach(coord => {
    const [lng, lat] = Array.isArray(coord) ? coord : [coord.lng, coord.lat];
    totalLng += lng;
    totalLat += lat;
  });
  
  return [
    totalLng / coordinates.length,
    totalLat / coordinates.length
  ]; // Return as [lng, lat]
}