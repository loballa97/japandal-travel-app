
"use client";

import * as React from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import type { Driver } from '@/types';
import MapView from '@/components/goeasy/MapView';
import { Loader2, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const PARIS_CENTER = { lat: 48.8566, lng: 2.3522 };

export default function LiveDriversMap() {
  const [onlineDrivers, setOnlineDrivers] = React.useState<Driver[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const driversQuery = query(collection(firestore, "drivers"), where("isOnline", "==", true));

    const unsubscribe = onSnapshot(driversQuery, (snapshot) => {
      const drivers: Driver[] = [];
      snapshot.forEach(doc => {
        // Ensure driverLocation exists and has lat/lng to be considered for the map
        const data = doc.data();
        if (data.driverLocation && typeof data.driverLocation.lat === 'number' && typeof data.driverLocation.lng === 'number') {
           drivers.push({ id: doc.id, ...data } as Driver);
        }
      });
      setOnlineDrivers(drivers);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching live drivers:", err);
      setError("Impossible de charger les données des chauffeurs en temps réel.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Chargement de la carte des chauffeurs...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive text-center">{error}</p>;
  }

  return (
    <Card className="h-full min-h-[500px] flex flex-col">
       <CardHeader>
          <CardTitle>Carte des Chauffeurs Actifs</CardTitle>
          <CardDescription>Visualisation en temps réel des chauffeurs actuellement en ligne.</CardDescription>
       </CardHeader>
      <CardContent className="flex-grow p-0">
        {onlineDrivers.length > 0 ? (
          <MapView
            center={PARIS_CENTER}
            zoom={11}
            markers={onlineDrivers.map(driver => ({
              position: driver.driverLocation!,
              title: `${driver.name} - ${driver.details.licensePlate}`,
              iconUrl: '/driver-icon.png' 
            }))}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <WifiOff className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Aucun chauffeur en ligne pour le moment.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
