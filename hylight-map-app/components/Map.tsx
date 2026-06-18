'use client';

import { env } from '@/lib/env';
import MapboxMap from 'react-map-gl/mapbox';

export default function Map() {
  return (
    // Make the map fill the entire screen using Tailwind CSS
    <div className="h-screen w-full">
      <MapboxMap
        mapboxAccessToken={env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        // Set the initial center to Tokyo (example coordinates)
        initialViewState={{
          longitude: 139.767,
          latitude: 35.6812,
          zoom: 11,
        }}
        // Choose a map style (you can change this to any Mapbox style URL)
        mapStyle="mapbox://styles/mapbox/streets-v12"
      />
    </div>
  );
}
