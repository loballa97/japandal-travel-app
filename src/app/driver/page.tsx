"use client";

import type { Reservation, DriverDetails, UserProfile, DriverAnnouncement, Driver } from '@/types';
// Ajout des types de document pour les fonctions Firestore
import { collection, query, where, getDocs, orderBy, Timestamp, doc, getDoc as getFirestoreDoc, updateDoc, serverTimestamp, onSnapshot, DocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Info, Loader2, ClipboardList, Edit, PlayCircle, UserRound, UserCog, History as HistoryIcon, Car as CarIcon, Palette, FileText, MessageSquare, Lightbulb, Gift, Wifi, WifiOff, CalendarClock } from 'lucide-react';
import * as React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Type générique pour les données Firestore si le type spécifique n'est pas trouvé
type FirestoreData = {
    [key: string]: any;
    createdAt?: Timestamp | string;
    updatedAt?: Timestamp | string;
    desiredPickupTime?: Timestamp | string | null;
};

// Icon map for dynamic rendering
const iconMap: { [key: string]: React.ElementType } = {
  Lightbulb,
  Gift,
  MessageSquare,
  Info,
};

const renderDynamicIcon = (iconName?: string) => {
  // Contrôle de nullité pour garantir que l'icône existe
  const IconComponent = iconName && iconMap[iconName] ? iconMap[iconName] : Info;
  return <IconComponent className="h-5 w-5 mr-3 mt-1 text-yellow-500 flex-shrink-0" />;
};


export default function DriverDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [activeRides, setActiveRides] = React.useState<Reservation[]>([]);
  const [driverDetails, setDriverDetails] = React.useState<DriverDetails | null>(null);
  // Amélioration du chargement : un état global 'isLoading' pour l'écran de chargement initial
  const [isLoadingData, setIsLoadingData] = React.useState(true); // Pour les détails initiaux du chauffeur
  const [isLoadingRides, setIsLoadingRides] = React.useState(true); // Spécifiquement pour les courses
  const [dataError, setDataError] = React.useState<string | null>(null); // Pour les erreurs de détails du chauffeur
  const [ridesError, setRidesError] = React.useState<string | null>(null); // Pour les erreurs de courses actives

  const [announcements, setAnnouncements] = React.useState<DriverAnnouncement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = React.useState(true);
  const [announcementsError, setAnnouncementsError] = React.useState<string | null>(null);
  const [isOnline, setIsOnline] = React.useState(true);

  const handleOnlineStatusChange = async (online: boolean) => {
    if (!user) return;
    const previousStatus = isOnline;
    setIsOnline(online);

    try {
        const driverRef = doc(firestore, "drivers", user.uid);
        await updateDoc(driverRef, {
            isOnline: online,
            updatedAt: serverTimestamp()
        });
        toast({
            title: "Statut mis à jour",
            description: `Vous êtes maintenant ${online ? "En ligne" : "Hors ligne"}.`,
        });
    } catch (error) {
        console.error("Error updating online status:", error);
        toast({
            variant: "destructive",
            title: "Erreur de mise à jour",
            description: "Impossible de mettre à jour votre statut en ligne.",
        });
        setIsOnline(previousStatus);
    }
  };


  React.useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      // Mettre les états de chargement à faux après la redirection pour éviter le chargement infini
      setIsLoadingData(false);
      setIsLoadingAnnouncements(false);
      setIsLoadingRides(false);
      return;
    }

    // Fetch non-realtime data (Profile, Driver Details, Announcements)
    const fetchStaticData = async () => {
      setIsLoadingData(true);
      setIsLoadingAnnouncements(true);
      setDataError(null);
      setAnnouncementsError(null);
      setDriverDetails(null);
      setAnnouncements([]);

      try {
        const userProfileRef = doc(firestore, "userProfiles", user.uid);
        // Typage explicite du snapshot
        const userProfileSnap: DocumentSnapshot<UserProfile> = await getFirestoreDoc(userProfileRef) as DocumentSnapshot<UserProfile>;

        if (!userProfileSnap.exists() || userProfileSnap.data()?.role !== 'driver') {
          toast({ variant: "destructive", title: "Accès non autorisé", description: "Vous n'êtes pas un chauffeur." });
          router.push('/');
          return;
        }

        const driverDataRef = doc(firestore, "drivers", user.uid);
        // Typage explicite du snapshot
        const driverDataSnap: DocumentSnapshot<Driver> = await getFirestoreDoc(driverDataRef) as DocumentSnapshot<Driver>;
        if (driverDataSnap.exists()) {
          const driverFullData = driverDataSnap.data(); // Déjà typé grâce à l'appel
          setDriverDetails(driverFullData.details);
          setIsOnline(driverFullData.isOnline === undefined ? true : driverFullData.isOnline);
        } else {
          console.warn(`Driver details not found for ${user.uid}. Driver should complete their profile.`);
        }
      } catch (err) {
        console.error("Error fetching driver details:", err);
        const errorMessage = err instanceof Error ? err.message : "Could not load driver details.";
        setDataError(errorMessage);
        toast({ variant: "destructive", title: "Erreur chargement (Détails Chauffeur)", description: errorMessage });
      } finally {
        setIsLoadingData(false);
      }

      try {
        const announcementsQuery = query(
          collection(firestore, "driverTipsAndAnnouncements"),
          where("isActive", "==", true),
          orderBy("createdAt", "desc")
        );
        const announcementsSnapshot = await getDocs(announcementsQuery);
        // Typage explicite du paramètre docSnap (Résolution 7006)
        const fetchedAnnouncements: DriverAnnouncement[] = announcementsSnapshot.docs.map((docSnap: DocumentSnapshot<FirestoreData>) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            // Assurer la conversion de Timestamp en Date
            createdAt: data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data?.createdAt as string),
          } as DriverAnnouncement;
        });
        setAnnouncements(fetchedAnnouncements);
      } catch (err) {
        console.error("Error fetching announcements:", err);
        const annErrorMessage = err instanceof Error ? err.message : "Could not load announcements.";
        setAnnouncementsError(annErrorMessage);
        toast({ variant: "destructive", title: "Erreur chargement (Annonces)", description: annErrorMessage });
      } finally {
        setIsLoadingAnnouncements(false);
      }
    };

    fetchStaticData();

    // Setup real-time listener for active rides
    setIsLoadingRides(true);
    setRidesError(null); // Reset rides error on new fetch attempt
    const activeStatuses: Reservation['status'][] = ['Assigned', 'DriverEnRouteToPickup', 'DriverAtPickup', 'PassengerOnBoard'];
    const ridesQuery = query(
      collection(firestore, "reservations"),
      where("assignedDriverId", "==", user.uid),
      where("status", "in", activeStatuses),
      orderBy("createdAt", "asc")
    );

    // Typage explicite des paramètres querySnapshot et docSnap (Résolution 7006)
    const unsubscribeRides = onSnapshot(ridesQuery, (querySnapshot: QuerySnapshot<FirestoreData>) => {
      const fetchedRides: Reservation[] = querySnapshot.docs.map((docSnap: DocumentSnapshot<FirestoreData>) => {
        const data = docSnap.data();
          // Assurer la conversion de Timestamp en Date pour toutes les propriétés
        const convertTimestamp = (ts: Timestamp | string | null | undefined) => {
          if (ts instanceof Timestamp) return ts.toDate();
          if (typeof ts === 'string') return new Date(ts);
          return null;
        };
        
        return {
          id: docSnap.id,
          ...data,
          createdAt: convertTimestamp(data?.createdAt),
          updatedAt: convertTimestamp(data?.updatedAt),
          desiredPickupTime: convertTimestamp(data?.desiredPickupTime),
        } as Reservation;
      }).filter(ride => ride.id !== undefined && ride.createdAt !== null) as Reservation[]; // Filtrer les entrées non valides
        
      setActiveRides(fetchedRides);
      setIsLoadingRides(false);
      setRidesError(null); // Clear error on successful fetch
    // Typage explicite du paramètre error (Résolution 7006)
    }, (error: Error) => {
      console.error("Error fetching active rides in real-time:", error);
      const ridesErrorMessage = "Erreur de chargement des courses actives.";
      setRidesError(ridesErrorMessage);
      toast({ variant: "destructive", title: "Erreur Courses Actives", description: "Impossible de charger les courses en temps réel." });
      setIsLoadingRides(false);
    });

    return () => {
      unsubscribeRides(); // Cleanup listener on unmount
    };

  }, [user, authLoading, router, toast]);


  // Affichage de l'écran de chargement principal si l'une des données clés est encore en attente
  if (authLoading || (user && (isLoadingData || isLoadingAnnouncements || isLoadingRides))) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement du tableau de bord chauffeur...</p>
      </div>
    );
  }

  const getStatusText = (status: Reservation['status']) => {
    switch (status) {
      case 'Assigned': return 'Prêt à démarrer';
      case 'DriverEnRouteToPickup': return 'En route vers le client';
      case 'DriverAtPickup': return 'Au lieu de prise en charge';
      case 'PassengerOnBoard': return 'Client à bord';
      default: return status;
    }
  };

  const getStatusClass = (status: Reservation['status']) => {
    switch (status) {
      case 'Assigned': return 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200';
      case 'DriverEnRouteToPickup': return 'bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200';
      case 'DriverAtPickup': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200';
      case 'PassengerOnBoard': return 'bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
    }
  };
  
  const formatDesiredPickupTime = (time: Date | Timestamp | null | undefined): string => {
    if (!time) return 'Immédiat';
    const dateObj = time instanceof Timestamp ? time.toDate() : (time instanceof Date ? time : new Date(time as string));
     if (isNaN(dateObj.getTime())) return 'Date invalide';
    return format(dateObj, 'Pp', { locale: fr });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        <Header />
        <div className="flex items-center space-x-2">
          <UserCircle className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-headline font-semibold">Tableau de bord du Chauffeur</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bienvenue, {user?.displayName || 'Chauffeur'} !</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="online-status"
                    checked={isOnline}
                    onCheckedChange={handleOnlineStatusChange}
                    aria-label="Statut en ligne"
                  />
                  <Label htmlFor="online-status" className={cn("font-medium", isOnline ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                    {isOnline ? (
                        <span className="flex items-center"><Wifi className="mr-2 h-5 w-5"/>Vous êtes En Ligne</span>
                    ) : (
                        <span className="flex items-center"><WifiOff className="mr-2 h-5 w-5"/>Vous êtes Hors Ligne</span>
                    )}
                  </Label>
                </div>
                <p className="text-muted-foreground text-sm">
                  {isOnline ? "Vous êtes visible et pouvez recevoir des demandes de courses." : "Vous n'êtes pas visible et ne recevrez pas de nouvelles demandes."}
                </p>
                <p className="text-muted-foreground">
                  Consultez ici vos courses actives et gérez leur progression.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href="/driver/profile">
                      <UserCog className="mr-2 h-4 w-4" /> Mon Profil Chauffeur
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href="/driver/history">
                      <HistoryIcon className="mr-2 h-4 w-4" /> Historique des Courses
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center">
                  <ClipboardList className="h-6 w-6 mr-3 text-primary" />
                  <CardTitle className="text-xl">Vos Courses Actives {activeRides.length > 0 ? `(${activeRides.length})` : ''}</CardTitle>
                </div>
                <CardDescription>Voici les courses en attente de démarrage ou en cours.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingRides && activeRides.length === 0 && !ridesError && (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="ml-3 text-muted-foreground">Chargement des courses...</p>
                  </div>
                )}
                {!isLoadingRides && ridesError && (
                  <div className="flex flex-col items-center text-center py-10 text-destructive">
                    <AlertTriangle className="h-12 w-12 mb-3" />
                    <p className="font-semibold">Erreur de chargement des courses</p>
                    <p className="text-sm">{ridesError}</p>
                  </div>
                )}
                {!isLoadingRides && !ridesError && activeRides.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-2 sm:px-3 md:px-4">Passager</TableHead>
                          <TableHead className="px-2 sm:px-3 md:px-4">Prise en charge</TableHead>
                          <TableHead className="px-2 sm:px-3 md:px-4">Destination</TableHead>
                          <TableHead className="px-2 sm:px-3 md:px-4">Statut / Info</TableHead>
                          <TableHead className="text-right px-2 sm:px-3 md:px-4">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeRides.map((ride: Reservation) => ( // Typage explicite du paramètre ride
                          <TableRow key={ride.id}>
                            <TableCell className="font-medium p-2 sm:p-3 md:px-4">{ride.passengerName}</TableCell>
                            <TableCell className="p-2 sm:p-3 md:px-4">{ride.pickupLocation}</TableCell>
                            <TableCell className="p-2 sm:p-3 md:px-4">{ride.dropoffLocation}</TableCell>
                            <TableCell className="p-2 sm:p-3 md:px-4">
                              <span className={cn(
                                  "block mb-1 px-2 py-1 text-xs font-semibold rounded-full w-fit",
                                  getStatusClass(ride.status)
                                )}>
                                  {getStatusText(ride.status)}
                                </span>
                                {ride.status === 'Assigned' && ride.assignedByManagerName && (
                                  <span className="flex items-center text-xs text-muted-foreground mt-1">
                                    <UserRound className="mr-1 h-3.5 w-3.5" /> Assigné par: {ride.assignedByManagerName}
                                  </span>
                                )}
                                {ride.status === 'Assigned' && ride.desiredPickupTime && (
                                  <span className="flex items-center text-xs text-muted-foreground mt-1">
                                    <CalendarClock className="mr-1 h-3.5 w-3.5" /> Prise en charge: {formatDesiredPickupTime(ride.desiredPickupTime)}
                                  </span>
                                )}
                            </TableCell>
                            <TableCell className="text-right p-2 sm:p-3 md:px-4">
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/driver/track/${ride.id}`}>
                                  {ride.status === 'Assigned' ? <PlayCircle className="mr-2 h-4 w-4"/> : <Edit className="mr-2 h-4 w-4" />}
                                  {ride.status === 'Assigned' ? 'Démarrer' : 'Gérer'}
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {!isLoadingRides && !ridesError && activeRides.length === 0 && (
                  <div className="flex flex-col items-center text-center py-10 text-muted-foreground">
                    <Info className="h-12 w-12 mb-3 text-primary" />
                    <p className="font-semibold">Aucune course active pour le moment.</p>
                    <p className="text-sm">Les nouvelles courses assignées apparaîtront ici.</p>
                    {!isOnline && (
                       <p className="text-sm mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 rounded-md text-yellow-700 dark:text-yellow-300">
                          Vous êtes actuellement <span className="font-semibold">Hors Ligne</span>. Passez "En Ligne" (ci-dessus) pour être visible et recevoir de nouvelles demandes.
                       </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-md">
              <CardHeader>
                <div className="flex items-center">
                  <CarIcon className="h-6 w-6 mr-3 text-primary" />
                  <CardTitle className="text-xl">Mon Véhicule Actuel</CardTitle>
                </div>
                <CardDescription>Informations sur votre véhicule enregistré.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingData && !driverDetails && (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-5 w-2/3" />
                  </div>
                )}
                {!isLoadingData && driverDetails && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <CarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                      <strong>Marque :</strong>&nbsp;{driverDetails.carMake || <span className="italic text-muted-foreground">Non défini</span>}
                    </div>
                    <div className="flex items-center">
                      <Palette className="h-4 w-4 mr-2 text-muted-foreground" />
                      <strong>Couleur :</strong>&nbsp;{driverDetails.carColor || <span className="italic text-muted-foreground">Non défini</span>}
                    </div>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                      <strong>Plaque :</strong>&nbsp;{driverDetails.licensePlate || <span className="italic text-muted-foreground">Non défini</span>}
                    </div>
                  </div>
                )}
                {!isLoadingData && !driverDetails && !dataError && (
                  <div className="flex flex-col items-center text-center py-6 text-muted-foreground">
                    <AlertTriangle className="h-10 w-10 mb-2 text-amber-500" />
                    <p className="font-semibold">Détails du véhicule non trouvés.</p>
                    <p className="text-xs">Veuillez compléter votre profil ou contacter un administrateur.</p>
                    <Button asChild variant="link" size="sm" className="mt-2">
                      <Link href="/driver/profile">Aller à mon profil</Link>
                    </Button>
                  </div>
                )}
                 {!isLoadingData && !driverDetails && dataError && (
                  <div className="flex flex-col items-center text-center py-6 text-destructive">
                    <AlertTriangle className="h-10 w-10 mb-2" />
                    <p className="font-semibold">Erreur chargement véhicule</p>
                    <p className="text-xs">{dataError}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-md">
                <CardHeader>
                    <div className="flex items-center">
                        <MessageSquare className="h-6 w-6 mr-3 text-primary" />
                        <CardTitle className="text-xl">Conseils &amp; Annonces</CardTitle>
                    </div>
                    <CardDescription>Informations utiles et mises à jour.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    {isLoadingAnnouncements && (
                        <div className="space-y-3">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    )}
                    {!isLoadingAnnouncements && announcementsError && (
                        <div className="flex flex-col items-center text-center py-6 text-destructive">
                            <AlertTriangle className="h-10 w-10 mb-2" />
                            <p className="font-semibold">Erreur chargement annonces</p>
                            <p className="text-xs">{announcementsError}</p>
                        </div>
                    )}
                    {!isLoadingAnnouncements && !announcementsError && announcements.length === 0 && (
                        <div className="flex flex-col items-center text-center py-6 text-muted-foreground">
                            <Info className="h-10 w-10 mb-2 text-primary" />
                            <p className="font-semibold">Aucun conseil ou annonce pour le moment.</p>
                        </div>
                    )}
                    {!isLoadingAnnouncements && !announcementsError && announcements.length > 0 && (
                        announcements.map((announcement) => (
                            <div key={announcement.id} className="flex items-start p-3 rounded-md bg-secondary/30 border border-border/70">
                                {renderDynamicIcon(announcement.iconName)}
                                <div>
                                    <h4 className="font-semibold">{announcement.title}</h4>
                                    <p className="text-muted-foreground text-xs">{announcement.message}</p>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}