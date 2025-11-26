"use client";

import React, { useEffect, useState } from 'react';
import { GoogleMap, DirectionsRenderer } from '@react-google-maps/api';
import { useGoogleMaps } from '@/contexts/GoogleMapsContext';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface RouteMapProps {
  origin: string;
  destination: string;
  onDistanceCalculated?: (distanceKm: number, durationMin: number) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const defaultCenter = {
  lat: 48.8566, // Paris
  lng: 2.3522,
};

export default function RouteMap({ origin, destination, onDistanceCalculated }: RouteMapProps) {
  const { isLoaded } = useGoogleMaps();
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded || !origin || !destination) {
      setDirections(null);
      return;
    }

    setLoading(true);
    setError(null);

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        setLoading(false);
        
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          
          // Extraire la distance et la durée
          const route = result.routes[0];
          if (route && route.legs[0]) {
            const distanceMeters = route.legs[0].distance?.value || 0;
            const durationSeconds = route.legs[0].duration?.value || 0;
            
            const distanceKm = distanceMeters / 1000;
            const durationMin = durationSeconds / 60;
            
            onDistanceCalculated?.(distanceKm, durationMin);
          }
        } else {
          setError('Impossible de calculer l\'itinéraire');
          console.error('Directions request failed:', status);
        }
      }
    );
  }, [isLoaded, origin, destination, onDistanceCalculated]);

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Chargement de la carte...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 relative">
        {loading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={12}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: false,
                polylineOptions: {
                  strokeColor: '#FF6B35',
                  strokeWeight: 5,
                },
              }}
            />
          )}
        </GoogleMap>
      </CardContent>
    </Card>
  );
}
