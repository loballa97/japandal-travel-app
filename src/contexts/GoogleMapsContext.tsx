// src/contexts/GoogleMapsContext.tsx
"use client";

import * as React from 'react';
import { useJsApiLoader, type Libraries } from '@react-google-maps/api';

const GOOGLE_MAPS_LIBRARIES: Libraries = ['places', 'routes']; // Changed 'directions' to 'routes'

interface GoogleMapsContextType {
  isLoaded: boolean;
  loadError?: Error;
}

const GoogleMapsContext = React.createContext<GoogleMapsContextType | undefined>(undefined);

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script-main', // Unique ID for the loader
    googleMapsApiKey: (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '') || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  const context = React.useContext(GoogleMapsContext);
  if (context === undefined) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
  }
  return context;
}
