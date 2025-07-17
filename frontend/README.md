# LLMap Frontend

React/Next.js frontend for interactive mapping interface.

## Features

- Multi-modal file upload interface
- Interactive map with Mapbox GL JS
- AI-powered location filtering and suggestions
- Export functionality (GeoJSON, images)
- Responsive design

## Setup

```bash
npm install
npm run dev
```

## Environment Variables

```
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Components

- `MapView` - Main interactive map component
- `FileUpload` - Multi-modal file upload
- `LocationList` - Extracted locations display
- `ExportPanel` - Export functionality