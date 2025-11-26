
"use client";

import * as React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Briefcase, UserCheck, UserCircle, CarIcon, Palette, CreditCard, Loader2, AlertTriangle, Euro, CalendarClock, Wifi, WifiOff } from 'lucide-react'; 
import { useToast } from "@/hooks/use-toast";
import type { Reservation, Driver, UserProfile, TransportMode } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, orderBy, Timestamp, getDoc as getFirestoreDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ManagerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [selectedDrivers, setSelectedDrivers] = React.useState<Record<string, string>>({});
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isAssigning, setIsAssigning] = React.useState<Record<string, boolean>>({});
  const [currentManagerProfile, setCurrentManagerProfile] = React.useState<UserProfile | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (user) { 
      const fetchData = async () => {
        setIsLoadingData(true);
        setError(null);
        try {
          const managerProfileRef = doc(firestore, "userProfiles", user.uid);
          const managerSnap = await getFirestoreDoc(managerProfileRef);
          if (managerSnap.exists()) {
              const profile = managerSnap.data() as UserProfile;
              if (profile.role !== 'manager') {
                toast({ variant: "destructive", title: "Accès refusé", description: "Vous n'êtes pas autorisé à accéder à cette page." });
                router.push('/');
                return;
              }
              setCurrentManagerProfile(profile);
          } else {
              toast({ variant: "destructive", title: "Erreur Profil Gérant", description: "Profil du gérant non trouvé. Certaines actions pourraient être limitées."});
          }

          const driversSnapshot = await getDocs(collection(firestore, "drivers"));
          const fetchedDrivers: Driver[] = driversSnapshot.docs.map(docSnap => ({ 
            id: docSnap.id, 
            ...docSnap.data(),
            isOnline: docSnap.data().isOnline === undefined ? true : docSnap.data().isOnline,
          } as Driver));
          setDrivers(fetchedDrivers);

          const reservationsQuery = query(collection(firestore, "reservations"), orderBy("createdAt", "desc"));
          const reservationsSnapshot = await getDocs(reservationsQuery);
          const fetchedReservations: Reservation[] = reservationsSnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return { 
              id: docSnap.id, 
              ...data,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt as string) : new Date()),
              updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt as string) : new Date()),
              desiredPickupTime: data.desiredPickupTime instanceof Timestamp ? data.desiredPickupTime.toDate() : (data.desiredPickupTime ? new Date(data.desiredPickupTime as string) : null),
            } as Reservation;
          });
          setReservations(fetchedReservations);

        } catch (err) {
          console.error("Error fetching data:", err);
          setError("Failed to load data from Firestore. Please check console for details.");
          toast({
            variant: "destructive",
            title: "Error fetching data",
            description: err instanceof Error ? err.message : "Could not load drivers or reservations.",
          });
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchData();
    }
  }, [user, toast, router]);
  
  const formatDesiredPickupTime = (time: Date | Timestamp | null | undefined): string => {
    if (!time) return 'Immédiat';
    const dateObj = time instanceof Timestamp ? time.toDate() : (time instanceof Date ? time : new Date(time as string));
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

  if (authLoading || (!user && !authLoading) || isLoadingData) { 
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement des informations...</p>
      </div>
    );
  }

  const handleAssignDriver = async (reservationId: string) => {
    const driverId = selectedDrivers[reservationId];
    if (!driverId) {
      toast({
        variant: "destructive",
        title: "Aucun chauffeur sélectionné",
        description: "Veuillez sélectionner un chauffeur à assigner.",
      });
      return;
    }

    const driver = drivers.find(d => d.id === driverId);
    if (!driver) {
       toast({ variant: "destructive", title: "Chauffeur non trouvé" });
       return;
    }
    if (driver.isOnline === false) {
        toast({
            variant: "destructive",
            title: "Chauffeur hors ligne",
            description: `${driver.name} est actuellement hors ligne et ne peut pas être assigné.`,
        });
        return;
    }

    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) {
      toast({ variant: "destructive", title: "Réservation non trouvée" });
      return;
    }

    setIsAssigning(prev => ({ ...prev, [reservationId]: true }));

    try {
      const reservationRef = doc(firestore, "reservations", reservationId);
      await updateDoc(reservationRef, {
        assignedDriverId: driver.id,
        driverDetails: { ...driver.details, name: driver.name }, 
        status: 'Assigned',
        updatedAt: serverTimestamp(),
        assignedByManagerId: currentManagerProfile?.id || null,
        assignedByManagerName: currentManagerProfile?.displayName || currentManagerProfile?.email || "Gérant",
      });

      setReservations(prevReservations =>
        prevReservations.map(res =>
          res.id === reservationId ? { 
            ...res, 
            assignedDriverId: driver.id, 
            status: 'Assigned', 
            driverDetails: { ...driver.details, name: driver.name }, 
            updatedAt: new Date(),
            assignedByManagerId: currentManagerProfile?.id || null,
            assignedByManagerName: currentManagerProfile?.displayName || currentManagerProfile?.email || "Gérant",
          } : res
        )
      );
      
      toast({
        title: "Réservation assignée",
        description: `Le trajet de ${reservation?.passengerName} pour l'itinéraire "${reservation?.routeName}" (${getRouteModeText(reservation?.routeMode)}) a été assigné à ${driver.name}. Le chauffeur verra votre nom (${currentManagerProfile?.displayName || 'Gérant'}) comme assignateur.`,
      });

      toast({
          title: "Notification client (simulation)",
          description: `Le passager ${reservation?.passengerName} serait notifié : Chauffeur ${driver.name}, Voiture : ${driver.details.carColor} ${driver.details.carMake}, Plaque : ${driver.details.licensePlate}.`,
          duration: 8000,
      });

    } catch (err) {
      console.error("Error assigning driver:", err);
      toast({
        variant: "destructive",
        title: "Erreur d'assignation",
        description: err instanceof Error ? err.message : "Impossible d'assigner le chauffeur.",
      });
    } finally {
      setIsAssigning(prev => ({ ...prev, [reservationId]: false }));
    }
  };

  const handleDriverSelectChange = (reservationId: string, driverId: string) => {
    setSelectedDrivers(prev => ({ ...prev, [reservationId]: driverId }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Header />
        <div className="flex items-center space-x-3">
          <Briefcase className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-headline font-semibold">Tableau de bord du gestionnaire</h2>
        </div>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Gestion des Réservations et des Chauffeurs</CardTitle>
            <CardDescription>
              Bienvenue, {currentManagerProfile?.displayName || currentManagerProfile?.email || 'Gérant'} !
              Visualisez toutes les réservations, assignez-les aux chauffeurs disponibles et supervisez les opérations.
              Lors de l'assignation, votre nom sera enregistré.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center text-center py-10 text-destructive">
                <AlertTriangle className="h-12 w-12 mb-3" />
                <p className="font-semibold">Erreur de chargement des données</p>
                <p className="text-sm">{error}</p>
              </div>
            ) : reservations.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2 py-3 sm:px-3 md:px-4">Passager</TableHead>
                      <TableHead className="px-2 py-3 sm:px-3 md:px-4">Date Souhaitée</TableHead>
                      <TableHead className="px-2 py-3 sm:px-3 md:px-4">Prise en charge</TableHead>
                      <TableHead className="px-2 py-3 sm:px-3 md:px-4">Destination</TableHead>
                      <TableHead className="px-2 py-3 sm:px-3 md:px-4">Gamme/Itinéraire</TableHead>
                      <TableHead className="px-2 py-3 sm:px-3 md:px-4">Coût</TableHead>
                      <TableHead className="px-2 py-3 sm:px-3 md:px-4">Statut</TableHead>
                      <TableHead className="px-2 py-3 sm:px-3 md:px-4">Chauffeur / Véhicule Assigné</TableHead>
                      <TableHead className="px-2 py-3 sm:px-3 md:px-4">Créé le</TableHead>
                      <TableHead className="text-right px-2 py-3 sm:px-3 md:px-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((reservation) => {
                      const assignedDriver = drivers.find(d => d.id === reservation.assignedDriverId);
                      return (
                        <TableRow 
                          key={reservation.id} 
                          className={reservation.status === 'Pending' ? 'bg-amber-50/50 hover:bg-amber-100/60 dark:bg-amber-900/30 dark:hover:bg-amber-800/40' : ''}
                        >
                          <TableCell className="font-medium p-2 sm:p-3 md:p-4">{reservation.passengerName}</TableCell>
                          <TableCell className="text-xs p-2 sm:p-3 md:p-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <CalendarClock className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0"/>
                                {formatDesiredPickupTime(reservation.desiredPickupTime)}
                            </div>
                          </TableCell>
                          <TableCell className="p-2 sm:p-3 md:p-4">{reservation.pickupLocation}</TableCell>
                          <TableCell className="p-2 sm:p-3 md:p-4">{reservation.dropoffLocation}</TableCell>
                          <TableCell className="p-2 sm:p-3 md:p-4">{reservation.routeName} ({getRouteModeText(reservation.routeMode)})</TableCell>
                          <TableCell className="p-2 sm:p-3 md:p-4">
                            <div className="flex items-center">
                              <Euro className="h-4 w-4 mr-1 text-muted-foreground" />
                              {typeof reservation.cost === 'number' ? reservation.cost.toFixed(2) : (reservation.cost || 'N/A')}
                            </div>
                          </TableCell>
                          <TableCell className="p-2 sm:p-3 md:p-4">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              reservation.status === 'Pending' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' :
                              reservation.status === 'Assigned' ? 'bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100' :
                              reservation.status === 'DriverEnRouteToPickup' ? 'bg-purple-200 text-purple-800 dark:bg-purple-700 dark:text-purple-100' :
                              reservation.status === 'DriverAtPickup' ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-700 dark:text-indigo-100' :
                              reservation.status === 'PassengerOnBoard' ? 'bg-teal-200 text-teal-800 dark:bg-teal-700 dark:text-teal-100' :
                              reservation.status === 'Completed' ? 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' :
                              'bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100' 
                            }`}>
                              {reservation.status}
                            </span>
                          </TableCell>
                          <TableCell className="p-2 sm:p-3 md:p-4">
                            {reservation.status === 'Pending' || (reservation.status === 'Assigned' && !assignedDriver) ? (
                              <div className="flex items-center gap-2 w-full">
                                <Select
                                  value={selectedDrivers[reservation.id] || ""}
                                  onValueChange={(_value) => handleDriverSelectChange(reservation.id, _value)}
                                  disabled={reservation.status === 'Completed' || reservation.status === 'Cancelled' || drivers.length === 0 || isAssigning[reservation.id]}
                                >
                                  <SelectTrigger className="w-full min-w-[150px] sm:w-[220px] h-9">
                                    <SelectValue placeholder={drivers.length === 0 ? "Aucun chauffeur" : "Choisir Chauffeur"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {drivers.map(driver => (
                                      <SelectItem 
                                        key={driver.id} 
                                        value={driver.id}
                                        disabled={driver.isOnline === false}
                                      >
                                        <div className="flex items-center text-xs">
                                          {driver.isOnline === false ? <WifiOff className="mr-2 h-3.5 w-3.5 text-red-500" /> : <Wifi className="mr-2 h-3.5 w-3.5 text-green-500" />}
                                          <div>
                                            <div>{driver.name} {driver.isOnline === false ? "(Hors ligne)" : "(En ligne)"}</div>
                                            <div className="text-muted-foreground text-xs">
                                              {driver.details.carColor} {driver.details.carMake} - {driver.details.licensePlate}
                                            </div>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : assignedDriver && reservation.driverDetails ? (
                               <div className="flex flex-col text-xs">
                                  <div className="flex items-center font-medium">
                                    <UserCircle className="mr-2 h-4 w-4 text-primary" />
                                    {reservation.driverDetails.name || assignedDriver.name}
                                  </div>
                                  <div className="flex items-center text-muted-foreground ml-1">
                                     <CarIcon className="mr-1 h-3 w-3" /> {reservation.driverDetails.carMake}
                                     <Palette className="ml-2 mr-1 h-3 w-3" /> {reservation.driverDetails.carColor}
                                     <CreditCard className="ml-2 mr-1 h-3 w-3" /> {reservation.driverDetails.licensePlate}
                                  </div>
                                  {reservation.assignedByManagerName && (
                                    <div className="text-xs text-muted-foreground mt-0.5">Assigné par: {reservation.assignedByManagerName}</div>
                                  )}
                                </div>
                            ) : reservation.status === 'Completed' || reservation.status === 'Cancelled' ? (
                               <span className="text-xs text-muted-foreground italic">Statut final</span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">En attente d'infos chauffeur...</span>
                            )}
                          </TableCell>
                           <TableCell className="text-xs text-muted-foreground p-2 sm:p-3 md:p-4">
                            {reservation.createdAt ? format(new Date(reservation.createdAt), 'dd/MM/yy HH:mm', { locale: fr }) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right p-2 sm:p-3 md:p-4">
                            {(reservation.status === 'Pending' || (reservation.status === 'Assigned' && selectedDrivers[reservation.id] && selectedDrivers[reservation.id] !== reservation.assignedDriverId)) && (
                              <Button 
                                size="sm" 
                                onClick={() => handleAssignDriver(reservation.id)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                disabled={(!selectedDrivers[reservation.id] && reservation.status === 'Pending') || drivers.length === 0 || isAssigning[reservation.id] || drivers.find(d => d.id === selectedDrivers[reservation.id])?.isOnline === false}
                              >
                                {isAssigning[reservation.id] ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserCheck className="mr-1 h-4 w-4" />}
                                {reservation.status === 'Pending' ? 'Assigner' : 'Ré-assigner'}
                              </Button>
                            )}
                             {reservation.status === 'Completed' && (
                               <span className="text-sm text-green-600 font-medium">Terminé</span>
                             )}
                             {reservation.status === 'Cancelled' && (
                               <span className="text-sm text-red-600 font-medium">Annulé</span>
                             )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucune réservation à afficher pour le moment.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
