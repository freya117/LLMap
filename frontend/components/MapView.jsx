import { useState, useEffect, useRef } from 'react';

// FIXED: Correct OpenStreetMap-compatible Web Mercator projection
const webMercatorProjection = {
    // Convert lat/lng to tile coordinates using OpenStreetMap's standard
    latLngToTile: (lat, lng, zoom) => {
        // Clamp latitude to valid Web Mercator range
        const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
        const latRad = clampedLat * Math.PI / 180;
        
        // Calculate tile coordinates using standard OpenStreetMap formulas
        const n = Math.pow(2, zoom);
        const xtile = (lng + 180) / 360 * n;
        const ytile = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
        
        return { xtile, ytile };
    },
    
    // Convert tile coordinates back to lat/lng
    tileToLatLng: (xtile, ytile, zoom) => {
        const n = Math.pow(2, zoom);
        const lng = xtile / n * 360 - 180;
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * ytile / n)));
        const lat = latRad * 180 / Math.PI;
        
        return { lat, lng };
    },
    
    // Convert tile coordinates to pixel coordinates within the tile
    tileToPixel: (xtile, ytile) => {
        const tileSize = 256;
        return {
            x: Math.floor(xtile) * tileSize,
            y: Math.floor(ytile) * tileSize
        };
    }
};

// MapTiles component to render actual map tiles
function MapTiles({ center, zoom, tileUrl }) {
    const [tiles, setTiles] = useState([]);

    useEffect(() => {
        // Get the center tile coordinates
        const centerTile = webMercatorProjection.latLngToTile(center.lat, center.lng, zoom);
        const centerTileX = Math.floor(centerTile.xtile);
        const centerTileY = Math.floor(centerTile.ytile);

        // Calculate how many tiles we need (5x5 grid around center)
        const tilesNeeded = [];
        for (let x = centerTileX - 2; x <= centerTileX + 2; x++) {
            for (let y = centerTileY - 2; y <= centerTileY + 2; y++) {
                const scale = Math.pow(2, zoom);
                if (x >= 0 && y >= 0 && x < scale && y < scale) {
                    // Calculate pixel offset from center
                    const tilePixelX = x * 256;
                    const tilePixelY = y * 256;
                    const centerPixelX = centerTile.xtile * 256;
                    const centerPixelY = centerTile.ytile * 256;
                    
                    const offsetX = tilePixelX - centerPixelX;
                    const offsetY = tilePixelY - centerPixelY;

                    // Build tile URL
                    let url = tileUrl
                        .replace('{s}', ['a', 'b', 'c'][Math.floor(Math.random() * 3)])
                        .replace('{z}', zoom.toString())
                        .replace('{x}', x.toString())
                        .replace('{y}', y.toString());

                    tilesNeeded.push({
                        x,
                        y,
                        url,
                        offsetX,
                        offsetY,
                        key: `${zoom}-${x}-${y}`
                    });
                }
            }
        }

        setTiles(tilesNeeded);
    }, [center.lat, center.lng, zoom, tileUrl]);

    return (
        <div className="absolute inset-0">
            {tiles.map(tile => (
                <img
                    key={tile.key}
                    src={tile.url}
                    alt=""
                    className="absolute"
                    style={{
                        width: '256px',
                        height: '256px',
                        left: `calc(50% + ${tile.offsetX}px)`,
                        top: `calc(50% + ${tile.offsetY}px)`,
                        transform: 'translate(-50%, -50%)'
                    }}
                    onError={(e) => {
                        // Hide broken tiles
                        e.target.style.display = 'none';
                    }}
                />
            ))}
        </div>
    );
}

export default function MapView({ locations = [] }) {
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [geocodedLocations, setGeocodedLocations] = useState([]);
    const [isClient, setIsClient] = useState(false);
    const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 }); // NYC default
    const [zoom, setZoom] = useState(12);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, centerLat: 0, centerLng: 0 });
    const [mapStyle, setMapStyle] = useState('street');
    const [mapBounds, setMapBounds] = useState(null);
    const [mapDimensions, setMapDimensions] = useState({ width: 800, height: 600 });
    
    // Ref to track the map container element
    const mapContainerRef = useRef(null);
    
    // Update dimensions immediately when container is ready
    useEffect(() => {
        if (!isClient || !mapContainerRef.current) return;
        
        const updateDimensions = () => {
            if (mapContainerRef.current) {
                const rect = mapContainerRef.current.getBoundingClientRect();
                const newDimensions = {
                    width: rect.width || 800,
                    height: rect.height || 600
                };
                
                setMapDimensions(prev => {
                    // Only update if dimensions actually changed
                    if (prev.width !== newDimensions.width || prev.height !== newDimensions.height) {
                        return newDimensions;
                    }
                    return prev;
                });
            }
        };

        // Update immediately
        updateDimensions();
        
        // Also update on resize
        window.addEventListener('resize', updateDimensions);
        
        return () => {
            window.removeEventListener('resize', updateDimensions);
        };
    }, [isClient]);

    // Ensure we're on client side
    useEffect(() => {
        setIsClient(true);
    }, []);

    // FIXED: Direct coordinate handling for GeoJSON format [lng, lat]
    const normalizeCoordinates = (location) => {
        if (!location.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
            console.warn(`❌ Invalid coordinates for ${location.name}:`, location.coordinates);
            return null;
        }
        
        const [lng, lat] = location.coordinates;
        
        // Validate coordinates are numbers and in valid ranges
        if (typeof lng !== 'number' || typeof lat !== 'number' || 
            Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            console.warn(`❌ Invalid coordinate values for ${location.name}: [${lng}, ${lat}]`);
            return null;
        }
        
        return { lng, lat };
    };

    // FIXED: Calculate map boundaries with proper coordinate handling
    const calculateMapBounds = (locations) => {
        if (locations.length === 0) return null;

        console.log('🗺️ Calculating map bounds for', locations.length, 'locations');

        // Filter and normalize valid locations
        const validCoords = locations
            .map(loc => normalizeCoordinates(loc))
            .filter(coord => coord !== null);
            
        if (validCoords.length === 0) {
            console.warn('❌ No valid coordinates found for bounds calculation');
            return null;
        }

        let minLat = validCoords[0].lat;
        let maxLat = validCoords[0].lat;
        let minLng = validCoords[0].lng;
        let maxLng = validCoords[0].lng;

        validCoords.forEach(coord => {
            minLat = Math.min(minLat, coord.lat);
            maxLat = Math.max(maxLat, coord.lat);
            minLng = Math.min(minLng, coord.lng);
            maxLng = Math.max(maxLng, coord.lng);
        });

        // Add buffer (30% padding for better view)
        const latBuffer = Math.max((maxLat - minLat) * 0.3, 0.01); // Minimum buffer
        const lngBuffer = Math.max((maxLng - minLng) * 0.3, 0.01);

        const bounds = {
            minLat: minLat - latBuffer,
            maxLat: maxLat + latBuffer,
            minLng: minLng - lngBuffer,
            maxLng: maxLng + lngBuffer,
            centerLat: (minLat + maxLat) / 2,
            centerLng: (minLng + maxLng) / 2
        };
        
        console.log('✅ Calculated bounds:', bounds);
        return bounds;
    };

    // Process locations and set initial map view - FIXED: Synchronous state updates
    useEffect(() => {
        console.log('📥 MapView received locations:', locations);
        
        if (locations.length === 0) {
            setGeocodedLocations([]);
            setMapBounds(null);
            // Reset to default when no locations
            setMapCenter({ lat: 40.7128, lng: -74.0060 });
            setZoom(12);
            return;
        }

        // Calculate bounds first
        const bounds = calculateMapBounds(locations);
        if (bounds) {
            // Calculate appropriate zoom level
            const latDiff = bounds.maxLat - bounds.minLat;
            const lngDiff = bounds.maxLng - bounds.minLng;
            const maxDiff = Math.max(latDiff, lngDiff);

            let newZoom = 10;
            if (maxDiff < 0.01) newZoom = 15;
            else if (maxDiff < 0.05) newZoom = 13;
            else if (maxDiff < 0.1) newZoom = 12;
            else if (maxDiff < 0.5) newZoom = 10;
            else newZoom = 8;

            console.log(`🎯 Setting map center to [${bounds.centerLat}, ${bounds.centerLng}] with zoom ${newZoom}`);
            
            // CRITICAL FIX: Set all map state synchronously to prevent timing issues
            setMapBounds(bounds);
            setMapCenter({ lat: bounds.centerLat, lng: bounds.centerLng });
            setZoom(newZoom);
            // Only set locations AFTER map position is established
            setGeocodedLocations(locations);
        }
    }, [locations]);

    const handleExportGeoJSON = () => {
        const validLocations = geocodedLocations.filter(loc => {
            const normalized = normalizeCoordinates(loc);
            return normalized !== null;
        });

        const geoJSON = {
            type: "FeatureCollection",
            metadata: {
                generated: new Date().toISOString(),
                count: validLocations.length,
                source: "LLMap - AI-Powered Location Extraction",
                coordinateFormat: "[longitude, latitude]"
            },
            features: validLocations.map((location, index) => {
                const normalized = normalizeCoordinates(location);
                return {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [normalized.lng, normalized.lat] // GeoJSON format: [lng, lat]
                    },
                    properties: {
                        id: location.id || index,
                        name: location.name,
                        type: location.type,
                        rating: location.rating,
                        address: location.address,
                        confidence: location.confidence || 1.0
                    }
                };
            })
        };

        const blob = new Blob([JSON.stringify(geoJSON, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `llmap-locations-${new Date().toISOString().split('T')[0]}.geojson`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // FIXED: Get valid locations with proper coordinate normalization
    const validLocations = geocodedLocations.filter(loc => {
        const normalized = normalizeCoordinates(loc);
        return normalized !== null;
    });

    // Map tile providers (all free!)
    const tileProviders = {
        street: {
            name: 'Street Map',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors'
        },
        satellite: {
            name: 'Satellite',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: '© Esri'
        },
        terrain: {
            name: 'Terrain',
            url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            attribution: '© OpenTopoMap'
        }
    };

    // Convert lat/lng to pixel offset from map center using CORRECT tile coordinate system
    const latLngToPixelOffset = (lat, lng, zoom, centerLat, centerLng) => {
        // Get tile coordinates for both marker and center
        const markerTile = webMercatorProjection.latLngToTile(lat, lng, zoom);
        const centerTile = webMercatorProjection.latLngToTile(centerLat, centerLng, zoom);
        
        // Calculate pixel offset using tile coordinates
        const offsetX = (markerTile.xtile - centerTile.xtile) * 256;
        const offsetY = (markerTile.ytile - centerTile.ytile) * 256;

        return { offsetX, offsetY };
    };

    // Handle map click to close details
    const handleMapClick = (e) => {
        // Close selected location when clicking on map
        if (selectedLocation) {
            setSelectedLocation(null);
        }
    };

    // FIXED: Handle drag functionality with proper coordinate conversion
    const handleMouseDown = (e) => {
        e.preventDefault(); // Prevent image drag/save
        e.stopPropagation();
        setIsDragging(true);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            centerLat: mapCenter.lat,
            centerLng: mapCenter.lng
        });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        // Convert pixel movement to coordinate movement using tile system
        const dragStartTile = webMercatorProjection.latLngToTile(dragStart.centerLat, dragStart.centerLng, zoom);
        
        // Convert pixel deltas to tile coordinate deltas (inverted for natural drag)
        const newTileX = dragStartTile.xtile - deltaX / 256;
        const newTileY = dragStartTile.ytile - deltaY / 256;
        
        // Convert back to lat/lng
        const newCoords = webMercatorProjection.tileToLatLng(newTileX, newTileY, zoom);

        // Constrain to map bounds if they exist
        let constrainedLat = newCoords.lat;
        let constrainedLng = newCoords.lng;
        
        if (mapBounds) {
            constrainedLat = Math.max(mapBounds.minLat, Math.min(mapBounds.maxLat, newCoords.lat));
            constrainedLng = Math.max(mapBounds.minLng, Math.min(mapBounds.maxLng, newCoords.lng));
        }

        setMapCenter({
            lat: constrainedLat,
            lng: constrainedLng
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Handle wheel zoom (like Google Maps) with boundary constraints
    const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        
        // Set zoom limits based on map bounds
        let minZoom = 1;
        let maxZoom = 18;
        
        if (mapBounds) {
            // Calculate minimum zoom to keep all locations visible
            const latDiff = mapBounds.maxLat - mapBounds.minLat;
            const lngDiff = mapBounds.maxLng - mapBounds.minLng;
            const maxDiff = Math.max(latDiff, lngDiff);
            
            // Set minimum zoom to prevent zooming out too far
            if (maxDiff < 0.01) minZoom = 12;
            else if (maxDiff < 0.05) minZoom = 10;
            else if (maxDiff < 0.1) minZoom = 9;
            else if (maxDiff < 0.5) minZoom = 7;
            else minZoom = 5;
        }
        
        setZoom(prevZoom => Math.max(minZoom, Math.min(maxZoom, prevZoom + delta)));
    };

    // FIXED: Handle touch events with proper coordinate conversion
    const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            // Pinch gesture
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            setDragStart(prev => ({ ...prev, pinchDistance: distance }));
        } else if (e.touches.length === 1) {
            // Single touch drag
            const touch = e.touches[0];
            setIsDragging(true);
            setDragStart({
                x: touch.clientX,
                y: touch.clientY,
                centerLat: mapCenter.lat,
                centerLng: mapCenter.lng
            });
        }
    };

    const handleTouchMove = (e) => {
        e.preventDefault();
        if (e.touches.length === 2) {
            // Pinch zoom
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );

            if (dragStart.pinchDistance) {
                const scale = distance / dragStart.pinchDistance;
                const zoomDelta = Math.log2(scale);
                setZoom(prevZoom => Math.max(1, Math.min(18, prevZoom + zoomDelta)));
                setDragStart(prev => ({ ...prev, pinchDistance: distance }));
            }
        } else if (e.touches.length === 1 && isDragging) {
            // Single touch drag - use same logic as mouse drag
            const touch = e.touches[0];
            const deltaX = touch.clientX - dragStart.x;
            const deltaY = touch.clientY - dragStart.y;

            // Convert pixel movement to coordinate movement using tile system
            const dragStartTile = webMercatorProjection.latLngToTile(dragStart.centerLat, dragStart.centerLng, zoom);
            
            // Convert pixel deltas to tile coordinate deltas (inverted for natural drag)
            const newTileX = dragStartTile.xtile - deltaX / 256;
            const newTileY = dragStartTile.ytile - deltaY / 256;
            
            // Convert back to lat/lng
            const newCoords = webMercatorProjection.tileToLatLng(newTileX, newTileY, zoom);

            // Constrain to map bounds if they exist
            let constrainedLat = newCoords.lat;
            let constrainedLng = newCoords.lng;
            
            if (mapBounds) {
                constrainedLat = Math.max(mapBounds.minLat, Math.min(mapBounds.maxLat, newCoords.lat));
                constrainedLng = Math.max(mapBounds.minLng, Math.min(mapBounds.maxLng, newCoords.lng));
            }

            setMapCenter({
                lat: constrainedLat,
                lng: constrainedLng
            });
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        setDragStart(prev => ({ ...prev, pinchDistance: null }));
    };

    // Add event listeners for drag and zoom
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart, mapCenter.lat, mapCenter.lng, zoom, mapBounds]);

    // Show loading state
    if (!isClient) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading map...</p>
                </div>
            </div>
        );
    }

    // No locations state - FIXED: Also check if locations are being processed
    if (geocodedLocations.length === 0 || (locations.length > 0 && geocodedLocations.length === 0)) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    {locations.length > 0 && geocodedLocations.length === 0 ? (
                        <>
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm text-gray-600">Processing locations...</p>
                        </>
                    ) : (
                        <>
                            <div className="text-4xl mb-4">📍</div>
                            <p className="text-lg font-medium text-gray-900 mb-2">No locations yet</p>
                            <p className="text-sm text-gray-500">Upload files or click "Load Test Data" to see locations</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Export Button - Minimal */}
            <div className="absolute top-4 left-4 z-30">
                <button
                    onClick={handleExportGeoJSON}
                    disabled={validLocations.length === 0}
                    className="flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    title={`Export ${validLocations.length} locations as GeoJSON`}
                >
                    💾
                </button>
            </div>

            {/* Map Area - Real Map Tiles */}
            <div
                ref={mapContainerRef}
                className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
                onClick={handleMapClick}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ backgroundColor: '#f0f0f0', touchAction: 'none' }}
            >
                {/* Map Tiles Background */}
                <div className="absolute inset-0">
                    <MapTiles
                        center={mapCenter}
                        zoom={zoom}
                        tileUrl={tileProviders[mapStyle].url}
                    />
                </div>

                {/* FIXED: Location Markers with proper coordinate handling and synchronization check */}
                {validLocations.map((location, index) => {
                    // FIXED: Use normalizeCoordinates for consistent handling
                    const normalized = normalizeCoordinates(location);
                    
                    if (!normalized) {
                        console.warn(`❌ Skipping invalid location ${location.name}:`, location.coordinates);
                        return null;
                    }
                    
                    const { lat, lng } = normalized;
                    
                    // CRITICAL FIX: Only render markers when map state is properly initialized
                    // This prevents the initial positioning mismatch that causes shifting
                    if (!mapBounds || geocodedLocations.length === 0) {
                        return null;
                    }
                    
                    // Calculate marker position using CORRECT tile coordinate system
                    const markerOffset = latLngToPixelOffset(
                        lat,
                        lng,
                        zoom,
                        mapCenter.lat,
                        mapCenter.lng
                    );

                    return (
                        <div
                            key={location.id || index}
                            className="absolute"
                            style={{
                                left: `calc(50% + ${markerOffset.offsetX}px)`,
                                top: `calc(50% + ${markerOffset.offsetY}px)`,
                                transform: 'translate(-50%, -50%)',
                                pointerEvents: 'none'
                            }}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent map click
                                    // Toggle selection - if already selected, deselect
                                    if (selectedLocation === location) {
                                        setSelectedLocation(null);
                                    } else {
                                        setSelectedLocation(location);
                                    }
                                }}
                                className="group z-20"
                                style={{
                                    pointerEvents: 'auto'
                                }}
                            >
                                <div className="relative">
                                    <div className="w-8 h-8 bg-red-500 rounded-full border-2 border-white shadow-lg group-hover:scale-110 transition-transform flex items-center justify-center text-white font-bold">
                                        📍
                                    </div>
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {location.name}
                                    </div>
                                </div>
                            </button>
                        </div>
                    );
                })}

                {/* Selected Location Details */}
                {selectedLocation && (
                    <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 border">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 mb-1">📍 {selectedLocation.name}</h3>
                                <p className="text-sm text-gray-600 mb-2">🏷️ {selectedLocation.type}</p>
                                <p className="text-xs text-gray-500">📍 {selectedLocation.address}</p>
                                {selectedLocation.coordinates && (() => {
                                    const coords = normalizeCoordinates(selectedLocation);
                                    return coords ? (
                                        <p className="text-xs text-gray-400 mt-1">
                                            🌐 {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                                        </p>
                                    ) : null;
                                })()}
                            </div>
                            <div className="flex flex-col items-end ml-4">
                                {selectedLocation.rating && (
                                    <div className="flex items-center mb-1">
                                        <span className="text-yellow-400 mr-1">⭐</span>
                                        <span className="text-sm font-medium">{selectedLocation.rating}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => setSelectedLocation(null)}
                                    className="text-gray-400 hover:text-gray-600 text-lg"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Map Style Selector - Top Right */}
                <div className="absolute top-4 right-4 z-30">
                    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md border overflow-hidden">
                        {Object.entries(tileProviders).map(([key, provider]) => (
                            <button
                                key={key}
                                onClick={() => setMapStyle(key)}
                                className={`block w-full text-left px-3 py-2 text-xs transition-colors ${
                                    mapStyle === key 
                                        ? 'bg-blue-50 text-blue-700 font-medium' 
                                        : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                {provider.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Zoom Controls - Bottom Right */}
                <div className="absolute bottom-4 right-4">
                    <div className="flex flex-col space-y-1">
                        <button
                            onClick={() => {
                                let maxZoom = 18;
                                setZoom(Math.min(maxZoom, zoom + 1));
                            }}
                            className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:shadow-lg transition-all text-xl font-normal"
                            title="Zoom in"
                        >
                            +
                        </button>
                        <button
                            onClick={() => {
                                let minZoom = 1;
                                
                                if (mapBounds) {
                                    // Calculate minimum zoom to keep all locations visible
                                    const latDiff = mapBounds.maxLat - mapBounds.minLat;
                                    const lngDiff = mapBounds.maxLng - mapBounds.minLng;
                                    const maxDiff = Math.max(latDiff, lngDiff);
                                    
                                    // Set minimum zoom to prevent zooming out too far
                                    if (maxDiff < 0.01) minZoom = 12;
                                    else if (maxDiff < 0.05) minZoom = 10;
                                    else if (maxDiff < 0.1) minZoom = 9;
                                    else if (maxDiff < 0.5) minZoom = 7;
                                    else minZoom = 5;
                                }
                                
                                setZoom(Math.max(minZoom, zoom - 1));
                            }}
                            className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:shadow-lg transition-all text-xl font-normal"
                            title="Zoom out"
                        >
                            −
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}