"use client";

import * as React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Navigation, Loader2, AlertTriangle, UserCircleIcon, Timer, CheckCircle2, ShieldAlert, Ban, Info, Hourglass, UserCheck2, ParkingSquare, Users2, Star, Send, CalendarClock, Euro } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation'; 
import { doc, onSnapshot, Timestamp, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import type { Reservation, ReservationStatus, TransportMode } from '@/types';
import { useToast } from '@/hooks/use-toast';
import MapView from '@/components/goeasy/MapView'; // Import MapView
import { getRealTimeUpdates, type RealTimeUpdatesInput, type RealTimeUpdatesOutput } from '@/ai/flows/real-time-update';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

const aiStatusIcons: Record<RealTimeUpdatesOutput['overallStatus'], React.ElementType> = {
  smooth: CheckCircle2,
  minor_delays: Timer,
  significant_delays: ShieldAlert,
  disrupted: Ban,
};

const reservationStatusIcons: Record<ReservationStatus, React.ElementType> = {
  Pending: Hourglass,
  Assigned: UserCheck2,
  DriverEnRouteToPickup: Navigation,
  DriverAtPickup: ParkingSquare,
  PassengerOnBoard: Users2,
  Completed: CheckCircle2,
  Cancelled: Ban,
};


export default function TrackRidePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const reservationId = params.reservationId as string;
  const { toast } = useToast();

  const [reservation, setReservation] = React.useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  const [aiUpdate, setAiUpdate] = React.useState<RealTimeUpdatesOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = React.useState(false);

  const [showRatingForm, setShowRatingForm] = React.useState(false);
  const [currentRating, setCurrentRating] = React.useState<number>(0);
  const [currentComment, setCurrentComment] = React.useState('');
  const [isSubmittingRating, setIsSubmittingRating] = React.useState(false);
  const [ratingSubmitted, setRatingSubmitted] = React.useState(false);

  // State for real-time locations
  const [driverLocationState, setDriverLocationState] = React.useState<{ lat: number; lng: number } | null>(null);
  const [myCurrentLocation, setMyCurrentLocation] = React.useState<{ lat: number; lng: number } | null>(null);


  const handleGetAiUpdates = React.useCallback(async (currentReservation: Reservation | null) => {
    if (!currentReservation || !currentReservation.driverDetails) {
        // Do not toast here as it might be called automatically
        // toast({ title:"Info", description: "Pas encore de chauffeur assigné ou détails chauffeur manquants pour obtenir des mises à jour."});
        return;
    }
    setIsAiLoading(true);
    const input: RealTimeUpdatesInput = {
        routeDescription: `Trajet de ${currentReservation.pickupLocation} à ${currentReservation.dropoffLocation} en ${getRouteModeText(currentReservation.routeMode)} (${currentReservation.routeName}). Chauffeur: ${currentReservation.driverDetails.name || 'Non spécifié'}, Véhicule: ${currentReservation.driverDetails.carMake} ${currentReservation.driverDetails.carColor}, Plaque: ${currentReservation.driverDetails.licensePlate}`,
    };
    try {
        const result = await getRealTimeUpdates(input);
        setAiUpdate(result);
    } catch (aiError) {
        console.error("Error fetching AI updates:", aiError);
        toast({ variant: "destructive", title: "Erreur IA", description: "Impossible d'obtenir les mises à jour intelligentes."});
    } finally {
        setIsAiLoading(false);
    }
  }, [toast]);


  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (user && reservationId) {
      setIsLoading(true);
      const unsub = onSnapshot(doc(firestore, "reservations", reservationId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Reservation;
          if (data.userId !== user.uid) {
            setError("Vous n'êtes pas autorisé à voir cette réservation.");
            toast({ variant: "destructive", title: "Accès refusé", description: "Cette réservation ne vous appartient pas."});
            setReservation(null);
          } else {
            const updatedReservation = {
              id: docSnap.id,
              ...data,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt as string),
              updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt as string),
              desiredPickupTime: data.desiredPickupTime instanceof Timestamp ? data.desiredPickupTime.toDate() : (data.desiredPickupTime ? new Date(data.desiredPickupTime as string) : null),
            };
            setReservation(updatedReservation);
            setError(null);

            if (data.driverLocation) {
              setDriverLocationState(data.driverLocation);
            }

            if (updatedReservation.status === 'Completed') {
              if (!updatedReservation.rating) {
                setShowRatingForm(true);
                setRatingSubmitted(false);
              } else {
                setShowRatingForm(false);
                setRatingSubmitted(true); 
              }
            } else {
              setShowRatingForm(false);
            }

            const relevantStatusesForAI: ReservationStatus[] = ['Assigned', 'DriverEnRouteToPickup', 'DriverAtPickup', 'PassengerOnBoard'];
            if (relevantStatusesForAI.includes(updatedReservation.status) && updatedReservation.driverDetails && !aiUpdate && !isAiLoading) {
              handleGetAiUpdates(updatedReservation);
            }
          }
        } else {
          setError("Réservation non trouvée.");
          toast({ variant: "destructive", title: "Erreur", description: "Réservation non trouvée."});
          setReservation(null);
        }
        setIsLoading(false);
      }, (err) => {
        console.error("Error fetching reservation:", err);
        setError("Impossible de charger les détails de la réservation.");
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger la réservation."});
        setIsLoading(false);
      });
      return () => unsub();
    } else if (!authLoading && !user) {
        setIsLoading(false); 
    }
  }, [user, reservationId, toast, authLoading, router, handleGetAiUpdates, aiUpdate, isAiLoading]);

  // Effect to track customer's own location and update Firestore
  React.useEffect(() => {
    let watchId: number | null = null;
    const relevantStatusesForSharing: ReservationStatus[] = ['DriverEnRouteToPickup', 'DriverAtPickup'];

    if (user && reservationId && reservation && relevantStatusesForSharing.includes(reservation.status)) {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const newCustomerLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setMyCurrentLocation(newCustomerLocation); // Update local state for immediate map update for client

            try {
              const reservationRef = doc(firestore, "reservations", reservationId);
              await updateDoc(reservationRef, { 
                customerLocation: newCustomerLocation,
                updatedAt: serverTimestamp() 
              });
            } catch (err) {
              console.error("Error updating customer location in Firestore:", err);
              // Optionally, inform the user if the update fails, but be mindful of toast frequency
            }
          },
          (err) => {
            console.warn("Error getting/watching client's current location:", err.message);
             if (err.code === 1) { // PERMISSION_DENIED
                // toast({ variant: "default", title: "Localisation non partagée", description: "Vous n'avez pas autorisé le partage de votre position."});
             }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [user, reservationId, reservation]);

  const getRouteModeText = (mode: TransportMode) => {
    switch (mode) {
      case 'economy': return 'Economy';
      case 'business': return 'Business';
      case 'first_class': return '1ère Classe';
      default: return mode;
    }
  };
  
  const handleRatingSubmit = async () => {
    if (!reservation || currentRating === 0) {
      toast({ variant: "destructive", title: "Note requise", description: "Veuillez sélectionner une note (nombre d'étoiles)." });
      return;
    }
    setIsSubmittingRating(true);
    try {
      const reservationRef = doc(firestore, "reservations", reservation.id);
      await updateDoc(reservationRef, {
        rating: currentRating,
        comment: currentComment.trim() || null,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Avis soumis", description: "Merci pour votre retour !" });
      setRatingSubmitted(true);
      setShowRatingForm(false);
    } catch (err) {
      console.error("Error submitting rating:", err);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de soumettre votre avis." });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const formatDesiredPickupTime = (time: Date | Timestamp | null | undefined): string => {
    if (!time) return 'Immédiat';
    const dateObj = time instanceof Timestamp ? time.toDate() : new Date(time as string); 
    if (isNaN(dateObj.getTime())) return 'Date invalide';
    return format(dateObj, 'Pp', { locale: fr });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement du suivi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
          <Header />
          <div className="flex flex-col items-center text-center py-10 text-destructive">
            <AlertTriangle className="h-12 w-12 mb-3" />
            <p className="font-semibold">Erreur de Suivi</p>
            <p className="text-sm">{error}</p>
             <Button onClick={() => router.push('/my-reservations')} className="mt-4">Mes réservations</Button>
          </div>
        </main>
      </div>
    );
  }
  
  if (!reservation) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
           <AlertTriangle className="h-12 w-12 mb-3 text-destructive" />
           <p className="mt-4 text-muted-foreground">Réservation introuvable.</p>
           <Button onClick={() => router.push('/my-reservations')} className="mt-4">Mes réservations</Button>
      </div>
    );
  }
  
  const AiStatusIcon = aiUpdate ? aiStatusIcons[aiUpdate.overallStatus] : null;
  const ReservationStatusIcon = reservationStatusIcons[reservation.status] || Info;
  
  const getStatusText = (status: Reservation['status']) => {
    switch (status) {
      case 'Pending': return 'En attente de confirmation';
      case 'Assigned': return 'Chauffeur assigné, en attente du démarrage';
      case 'DriverEnRouteToPickup': return 'Votre chauffeur est en route';
      case 'DriverAtPickup': return 'Votre chauffeur est arrivé au lieu de prise en charge';
      case 'PassengerOnBoard': return 'Vous êtes à bord, course en cours';
      case 'Completed': return 'Course terminée';
      case 'Cancelled': return 'Course annulée';
      default: return status;
    }
  };

  return (
    <div className={cn(
        "flex flex-col md:flex-row bg-background text-foreground",
        "min-h-screen md:max-h-screen md:overflow-hidden" 
      )}>
      <div className={cn(
          "w-full md:w-[420px] lg:w-[480px] p-4 sm:p-6 space-y-4 sm:space-y-6 flex-shrink-0",
          "md:overflow-y-auto md:h-screen scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent"
        )}>
        <Header />
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center">
              <ReservationStatusIcon className="h-7 w-7 mr-3 text-primary" />
              <CardTitle className="text-xl font-headline">Suivi de votre Trajet</CardTitle>
            </div>
            <CardDescription>Gamme : {getRouteModeText(reservation.routeMode)} ({reservation.routeName})</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-md bg-primary/10 border border-primary/30">
                <p className="text-sm font-semibold text-primary mb-1">Statut actuel de la course :</p>
                <p className="text-lg font-medium text-primary flex items-center">
                    <ReservationStatusIcon className="h-5 w-5 mr-2" />
                    {getStatusText(reservation.status)}
                </p>
            </div>

            <p><span className="font-semibold">De :</span> {reservation.pickupLocation}</p>
            <p><span className="font-semibold">À :</span> {reservation.dropoffLocation}</p>
            <p className="flex items-center">
                <Euro className="h-4 w-4 mr-1 text-muted-foreground" />
                <span className="font-semibold">Prix :</span>&nbsp;
                {typeof reservation.cost === 'number' ? `${reservation.cost.toFixed(2)} €` : (reservation.cost || 'N/A')}
            </p>
            {reservation.desiredPickupTime && (
              <p className="flex items-center text-sm">
                <CalendarClock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-semibold">Départ souhaité :</span>&nbsp;{formatDesiredPickupTime(reservation.desiredPickupTime)}
              </p>
            )}
            
            {reservation.status !== 'Pending' && reservation.driverDetails && (
              <Card className="bg-secondary/50 p-3 mt-3 border-border">
                <CardTitle className="text-base mb-2 flex items-center"><UserCircleIcon className="mr-2 h-5 w-5 text-primary"/> Infos Chauffeur & Véhicule</CardTitle>
                {reservation.driverDetails.name && (
                    <p className="text-sm"><span className="font-medium">Nom :</span> {reservation.driverDetails.name}</p>
                )}
                <p className="text-sm"><span className="font-medium">Véhicule :</span> {reservation.driverDetails.carMake} {reservation.driverDetails.carColor}</p>
                <p className="text-sm"><span className="font-medium">Plaque :</span> {reservation.driverDetails.licensePlate}</p>
              </Card>
            )}
             {reservation.status === 'Completed' && !showRatingForm && ratingSubmitted && (
                <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-700 mt-2">
                    <p className="font-semibold flex items-center"><CheckCircle2 className="mr-2 h-5 w-5"/>Course terminée. Merci pour votre avis !</p>
                </div>
            )}
            {reservation.status === 'Completed' && !showRatingForm && !ratingSubmitted && (
                 <p className="text-green-600 font-semibold mt-2 flex items-center"><CheckCircle2 className="mr-2 h-5 w-5"/>Ce trajet est terminé.</p>
            )}
            {reservation.status === 'Cancelled' && (
                <p className="text-red-600 font-semibold mt-2 flex items-center"><Ban className="mr-2 h-5 w-5"/>Ce trajet a été annulé.</p>
            )}

            {(reservation.status === 'Assigned' || reservation.status === 'DriverEnRouteToPickup' || reservation.status === 'DriverAtPickup' || reservation.status === 'PassengerOnBoard') && (
                 <Card className="mt-4 border-accent/50">
                    <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-md flex items-center text-accent-foreground/90">Mises à jour intelligentes</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        {isAiLoading && <Skeleton className="h-10 w-full" />}
                        {!isAiLoading && aiUpdate && AiStatusIcon &&(
                             <div className="space-y-1">
                                <div className="flex items-center">
                                    <AiStatusIcon className="h-5 w-5 mr-2 text-primary"/>
                                    <p className="font-medium">{aiUpdate.statusMessage}</p>
                                </div>
                                {aiUpdate.estimatedDelay && <p className="text-xs pl-7 text-muted-foreground">Retard estimé : {aiUpdate.estimatedDelay}</p>}
                                {aiUpdate.suggestedAction && <p className="text-xs pl-7 text-muted-foreground">Suggestion : {aiUpdate.suggestedAction}</p>}
                            </div>
                        )}
                        {!isAiLoading && !aiUpdate && <p className="text-xs text-muted-foreground">Cliquez pour obtenir les dernières informations de trafic et météo.</p>}
                         <Button onClick={() => handleGetAiUpdates(reservation)} disabled={isAiLoading || !reservation.driverDetails} size="sm" className="w-full mt-3 bg-accent text-accent-foreground hover:bg-accent/90">
                            {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Navigation className="h-4 w-4 mr-2"/>}
                            Actualiser infos trafic
                        </Button>
                    </CardContent>
                 </Card>
            )}
          </CardContent>
        </Card>

        {showRatingForm && !ratingSubmitted && reservation.status === 'Completed' && (
          <Card className="mt-6 border-amber-500">
            <CardHeader>
              <CardTitle className="text-xl font-headline text-amber-700 flex items-center">
                <Star className="mr-2 h-6 w-6" /> Laissez votre avis !
              </CardTitle>
              <CardDescription>Comment s'est passée votre course avec {reservation.driverDetails?.name || 'votre chauffeur'} ?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="rating" className="text-sm font-medium">Votre note :</Label>
                <div className="flex space-x-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-7 w-7 cursor-pointer",
                        currentRating >= star ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-300"
                      )}
                      onClick={() => setCurrentRating(star)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="comment" className="text-sm font-medium">Votre commentaire (optionnel) :</Label>
                <Textarea
                  id="comment"
                  placeholder="Décrivez votre expérience..."
                  value={currentComment}
                  onChange={(_e) => setCurrentComment(_e.target.value)}
                  rows={3}
                  className="mt-1"
                  disabled={isSubmittingRating}
                />
              </div>
              <Button onClick={handleRatingSubmit} disabled={isSubmittingRating || currentRating === 0} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                {isSubmittingRating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Soumettre mon avis
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <div className={cn(
        "flex-1 relative w-full bg-muted flex items-center justify-center p-4 text-center",
        "h-[50vh] md:h-auto" 
      )}>
        <MapView
          pathCoordinates={reservation.routeCoordinates || undefined}
          driverLocation={driverLocationState}
          customerLocation={myCurrentLocation} 
          pickupLocation={reservation.pickupLocation}
          dropoffLocation={reservation.dropoffLocation}
        />
      </div>
    </div>
  );
}
