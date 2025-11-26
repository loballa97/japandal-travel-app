
"use client";

import * as React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { History, Loader2, Info, AlertTriangle, UserCircle, CarIcon, Euro, CalendarClock, Hash } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc as getFirestoreDoc } from 'firebase/firestore';
import type { Reservation, UserProfile, TransportMode } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function ManagerRideHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [rides, setRides] = React.useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = React.useState<UserProfile | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      const fetchProfile = async () => {
        const profileDoc = await getFirestoreDoc(doc(firestore, "userProfiles", user.uid));
        if (profileDoc.exists() && profileDoc.data()?.role === 'manager') {
          setCurrentUserProfile(profileDoc.data() as UserProfile);
        } else {
          toast({ variant: "destructive", title: "Accès non autorisé" });
          router.push('/');
        }
      };
      fetchProfile();
    }
  }, [user, authLoading, router, toast]);

  React.useEffect(() => {
    if (currentUserProfile) { 
      const fetchRides = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const q = query(
            collection(firestore, 'reservations'),
            where('status', 'in', ['Completed', 'Cancelled']),
            orderBy('createdAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          const fetchedRides: Reservation[] = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt as string),
              updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt as string),
              desiredPickupTime: data.desiredPickupTime instanceof Timestamp ? data.desiredPickupTime.toDate() : (data.desiredPickupTime ? new Date(data.desiredPickupTime as string) : null),
            } as Reservation;
          });
          setRides(fetchedRides);
        } catch (err) {
          console.error("Error fetching manager ride history:", err);
          setError("Impossible de charger l'historique global des courses.");
          toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger l'historique." });
        } finally {
          setIsLoading(false);
        }
      };
      fetchRides();
    }
  }, [currentUserProfile, toast]);
  
  const formatDesiredPickupTime = (time: Date | Timestamp | null | undefined): string => {
    if (!time) return 'N/A';
    const dateObj = time instanceof Timestamp ? time.toDate() : time;
    if (isNaN(dateObj.getTime())) return 'Date invalide';
    return format(dateObj, 'Pp', { locale: fr });
  };

  const getRouteModeText = (mode: TransportMode) => {
    switch (mode) {
      case 'economy': return 'Economy';
      case 'business': return 'Business';
      case 'first_class': return '1ère Classe';
      default: return mode;
    }
  };

  if (authLoading || isLoading || !currentUserProfile) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement de l'historique...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Header />
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center">
              <History className="h-8 w-8 mr-3 text-primary" />
              <CardTitle className="text-2xl font-headline">Historique Global des Courses</CardTitle>
            </div>
            <CardDescription>Consultez ici toutes les courses terminées ou annulées du système, incluant les détails financiers et d'identification.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center text-center py-10 text-destructive">
                <AlertTriangle className="h-12 w-12 mb-3" />
                <p className="font-semibold">Erreur de chargement</p>
                <p className="text-sm">{error}</p>
              </div>
            ) : rides.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2 sm:px-3 md:px-4">ID Résa.</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Date Prise en charge</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Passager</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Chauffeur Assigné</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Prise en charge</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Destination</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Gamme/Itinéraire</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Coût</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Statut Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rides.map((ride) => (
                      <TableRow key={ride.id}>
                        <TableCell className="text-xs p-2 sm:p-3 md:p-4">
                          <div className="flex items-center text-muted-foreground">
                            <Hash className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate w-20" title={ride.id}>{ride.id}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs p-2 sm:p-3 md:p-4 whitespace-nowrap">
                          <div className="flex items-center">
                             <CalendarClock className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0"/>
                             {formatDesiredPickupTime(ride.desiredPickupTime)}
                          </div>
                           <span className="text-xs text-muted-foreground block mt-0.5">
                             (Créé le: {ride.createdAt ? format(new Date(ride.createdAt), 'dd/MM/yy HH:mm', { locale: fr }) : 'N/A'})
                           </span>
                        </TableCell>
                        <TableCell className="font-medium p-2 sm:p-3 md:p-4">
                            <div className="flex items-center">
                                <UserCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                                {ride.passengerName || 'N/A'}
                            </div>
                        </TableCell>
                         <TableCell className="text-xs p-2 sm:p-3 md:p-4">
                          {ride.driverDetails && ride.driverDetails.name ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center font-medium">
                                <UserCircle className="h-3.5 w-3.5 mr-1.5 text-primary flex-shrink-0" />
                                {ride.driverDetails.name}
                              </div>
                              <div className="flex items-center text-muted-foreground">
                                <CarIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                                <span className="truncate">{ride.driverDetails.carMake} {ride.driverDetails.carColor} ({ride.driverDetails.licensePlate})</span>
                              </div>
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground">Non assigné / Infos manquantes</span>
                          )}
                        </TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">{ride.pickupLocation}</TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">{ride.dropoffLocation}</TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">{ride.routeName} ({getRouteModeText(ride.routeMode)})</TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">
                            <div className="flex items-center">
                               <Euro className="h-4 w-4 mr-1 text-muted-foreground" />
                               {typeof ride.cost === 'number' ? ride.cost.toFixed(2) : (ride.cost || 'N/A')}
                            </div>
                        </TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            ride.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200' :
                            ride.status === 'Cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                          }`}>
                            {ride.status === 'Completed' ? 'Terminé' : ride.status === 'Cancelled' ? 'Annulé' : ride.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center py-10 text-muted-foreground">
                <Info className="h-12 w-12 mb-3 text-primary" />
                <p className="font-semibold">Aucune course dans l'historique global.</p>
                <p className="text-sm">Les courses terminées ou annulées apparaîtront ici.</p>
                 <Button asChild className="mt-4"><Link href="/manager">Retour au tableau de bord</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
