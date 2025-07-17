# LLMap Documentation

## Architecture Overview

LLMap follows a microservices architecture with clear separation between frontend and backend.

## API Documentation

### Core Endpoints

#### Upload and Process
```
POST /api/upload
Content-Type: multipart/form-data

Response: {
  "file_id": "uuid",
  "extracted_text": "...",
  "locations": [...]
}
```

#### Location Extraction
```
POST /api/extract-locations
{
  "text": "Visit the best ramen in Tokyo...",
  "context": "restaurant recommendations"
}

Response: {
  "locations": [
    {
      "name": "Ramen Shop",
      "address": "Tokyo, Japan",
      "coordinates": [139.6917, 35.6895],
      "confidence": 0.95
    }
  ]
}
```

## Data Formats

### GeoJSON Structure
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [lng, lat]
      },
      "properties": {
        "name": "Location Name",
        "description": "AI-extracted description",
        "source": "image|text|link",
        "confidence": 0.95,
        "tags": ["restaurant", "recommended"]
      }
    }
  ]
}
```

## MCP Integration

LLMap can be integrated as an MCP server for AI agents:

```json
{
  "mcpServers": {
    "llmap": {
      "command": "python",
      "args": ["-m", "llmap.mcp_server"],
      "env": {
        "LLMAP_API_URL": "http://localhost:8000"
      }
    }
  }
}
```