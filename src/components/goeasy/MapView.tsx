// src/components/goeasy/MapView.tsx
"use client";

import * as React from 'react';
import { GoogleMap, MarkerF, PolylineF } from '@react-google-maps/api';
import { useGoogleMaps } from '@/contexts/GoogleMapsContext';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MapViewProps {
  center?: google.maps.LatLngLiteral;
  zoom?: number;
  pathCoordinates?: google.maps.LatLngLiteral[] | null;
  driverLocation?: { lat: number; lng: number } | null;
  customerLocation?: { lat: number; lng: number } | null;
  pickupLocation?: string;
  dropoffLocation?: string;
  markers?: {
    position: { lat: number, lng: number };
    title?: string;
    iconUrl?: string;
  }[];
}

const defaultCenter = {
  lat: 48.8566, // Paris
  lng: 2.3522,
};

export default function MapView({
  center = defaultCenter,
  zoom = 12,
  pathCoordinates,
  driverLocation = null,
  customerLocation = null,
  pickupLocation,
  dropoffLocation,
  markers = [],
}: MapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();

  const mapRef = React.useRef<google.maps.Map | null>(null);

  const onLoad = React.useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  React.useEffect(() => {
    if (mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        let hasPoints = false;
  
        if (pathCoordinates && pathCoordinates.length > 0) {
          pathCoordinates.forEach(coord => bounds.extend(coord));
          hasPoints = true;
        }
        if (driverLocation) {
            bounds.extend(driverLocation);
            hasPoints = true;
        }
        if (customerLocation) {
            bounds.extend(customerLocation);
            hasPoints = true;
        }
        if (markers && markers.length > 0) {
            markers.forEach(marker => bounds.extend(marker.position));
            hasPoints = true;
        }

        if (hasPoints) {
            mapRef.current.fitBounds(bounds, 100); // 100px padding
        } else if (center) {
            mapRef.current.setCenter(center);
            mapRef.current.setZoom(zoom);
        }
    }
  }, [pathCoordinates, center, zoom, driverLocation, customerLocation, markers]);

  const onUnmount = React.useCallback(() => {
    mapRef.current = null;
  }, []);
  
  const apiKeyMissing = !(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '');

  if (loadError || apiKeyMissing) {
    return (
      <div className="relative w-full h-full bg-destructive/10 flex flex-col items-center justify-center p-4 text-center">
        <Card className="bg-background/95 shadow-xl border-destructive max-w-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-3">
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <p className="text-destructive font-semibold text-lg">
                Erreur Critique: Impossible de charger Google Maps.
              </p>
              <p className="text-sm text-muted-foreground">L'affichage de la carte est indisponible car la configuration de l'API Google Maps est incorrecte.</p>
              <div className="text-xs text-destructive text-left mt-3 space-y-2">
                <p className="font-bold">ACTIONS PRIORITAIRES À VÉRIFIER DANS L'ORDRE :</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li className={apiKeyMissing ? "font-extrabold text-destructive" : ""}>
                    <span className="font-bold">Fichier <code>.env</code> :</span> Assurez-vous que votre fichier <code>.env</code> (à la racine du projet) contient bien la ligne :
                    <pre className="inline bg-destructive/20 p-0.5 rounded text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=VOTRE_CLÉ_API_ICI</pre>
                    Remplacez <code>VOTRE_CLÉ_API_ICI</code> par votre clé.
                    {apiKeyMissing && <span className="font-extrabold"> (Cette variable semble manquante ou vide !)</span>}
                  </li>
                  <li className="font-extrabold text-red-700 dark:text-red-400">
                    <span className="underline font-bold">TRÈS IMPORTANT : REDÉMARREZ VOTRE SERVEUR</span> de développement (<code>npm run dev</code>) APRÈS TOUTE MODIFICATION du fichier <code>.env</code>.
                  </li>
                  <li>
                    <span className="font-bold">Dans la console Google Cloud :</span>
                      <ul className="list-disc list-inside pl-5 mt-0.5 space-y-0.5">
                          <li>La <span className="font-bold">FACTURATION</span> doit être activée pour votre projet.</li>
                          <li>Les API suivantes doivent être <span className="font-bold">ACTIVÉES</span> : <strong>Maps JavaScript API</strong>, <strong>Places API</strong> et <strong>Routes API</strong>.</li>
                      </ul>
                  </li>
                  <li>
                    <span className="font-bold">Restrictions de clé API :</span> Si vous avez des restrictions, vérifiez qu'elles autorisent votre domaine de développement (ex: <code>localhost</code>) ET les 3 API listées ci-dessus.
                  </li>
                </ol>
                 {loadError && <p className="mt-2">Message technique: <code>{loadError.message}</code></p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return isLoaded ? (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%', minHeight: '400px' }}
      center={center}
      zoom={zoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      }}
    >
      {pathCoordinates && pathCoordinates.length > 0 && (
        <>
          <PolylineF
            path={pathCoordinates}
            options={{
              strokeColor: '#007BFF',
              strokeOpacity: 0.9,
              strokeWeight: 5,
              geodesic: true,
              icons: [
                {
                  icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: '#0056b3' },
                  offset: "100%",
                  repeat: "75px",
                },
              ],
            }}
          />
          <MarkerF
            position={pathCoordinates[0]}
            label={{ text: "A", color: "white", fontWeight: "bold" }}
            title={pickupLocation || "Point de départ"}
            data-ai-hint="map pin"
          />
          {pathCoordinates.length > 1 && (
            <MarkerF
              position={pathCoordinates[pathCoordinates.length - 1]}
              label={{ text: "B", color: "white", fontWeight: "bold" }}
              title={dropoffLocation || "Point d'arrivée"}
              data-ai-hint="map pin"
            />
          )}
        </>
      )}
      {driverLocation && (
        <MarkerF
          position={driverLocation}
          icon={{
            url: '/driver-icon.png',
            scaledSize: new window.google.maps.Size(35, 35),
          }}
          title="Position du Chauffeur"
          data-ai-hint="car delivery"
        />
      )}
      {customerLocation && (
         <MarkerF
          position={customerLocation}
          icon={{
            url: '/customer-icon.png',
            scaledSize: new window.google.maps.Size(30, 30),
          }}
          title="Votre Position"
          data-ai-hint="person walking"
        />
      )}
       {markers.map((marker, index) => (
        <MarkerF
          key={index}
          position={marker.position}
          title={marker.title}
          icon={marker.iconUrl ? { url: marker.iconUrl, scaledSize: new window.google.maps.Size(35, 35) } : undefined}
        />
      ))}
    </GoogleMap>
  ) : (
    <div className="relative w-full h-full bg-muted flex items-center justify-center p-4 text-center">
      <Card className="bg-background/95 shadow-xl border max-w-md">
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">
              Chargement de la carte Google Maps...
            </p>
             <p className="text-xs text-muted-foreground">
                (Si le chargement échoue, vérifiez que la clé <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> est correctement configurée.)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
