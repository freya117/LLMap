/**
 * Test script for enhanced geocoding functionality
 */

// Import the geocoding service (this would normally be imported from the actual module)
// For testing purposes, we'll simulate the enhanced geocoding logic

const testBusinessNames = [
    "Dave's Hot Chicken",
    "Albany Ao Sen",
    "Eunice Gourmet Café",
    "Funky Elephant Berkeley",
    "Acme Bread"
];

// Simulate the enhanced geocoding function
async function testEnhancedGeocoding() {
    console.log('🧪 Testing Enhanced Geocoding with California Context');
    console.log('=' * 60);

    for (const businessName of testBusinessNames) {
        console.log(`\n🔍 Testing: "${businessName}"`);

        // Check if business name has location context
        const hasContext = hasLocationContext(businessName);
        console.log(`  Has location context: ${hasContext}`);

        // Show what the enhanced query would be
        let searchQuery = businessName;
        if (!hasContext) {
            searchQuery = `${businessName}, California, USA`;
            console.log(`  Enhanced query: "${searchQuery}"`);
        } else {
            console.log(`  Original query: "${searchQuery}"`);
        }

        // Simulate geocoding result
        console.log(`  Expected result: Business in California`);
        console.log(`  Bounding box: California (-124.4,32.5,-114.1,42.0)`);
    }
}

// Helper function to check if address has location context
function hasLocationContext(address) {
    const locationIndicators = [
        // State abbreviations
        /\b[A-Z]{2}\b/,
        // Common location words
        /\b(california|ca|san francisco|oakland|berkeley|los angeles|san diego|street|avenue|road|boulevard|drive)\b/i,
        // ZIP codes
        /\b\d{5}(-\d{4})?\b/,
        // Coordinates
        /[-+]?\d{1,3}\.\d+/
    ];

    return locationIndicators.some(pattern => pattern.test(address));
}

// Run the test
testEnhancedGeocoding();