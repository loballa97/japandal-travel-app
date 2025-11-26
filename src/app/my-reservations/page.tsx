
// src/app/my-reservations/page.tsx
'use client'; 

import * as React from 'react'; 
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'; 
import { Button } from '@/components/ui/button';
import { ListChecks, CarIcon, Loader2, Info, AlertTriangle, Eye, XCircle, CheckCircle2, UserCircle as UserIcon, Hourglass, UserCheck2, Navigation, ParkingSquare, Users2, Euro, CalendarClock, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Reservation, ReservationStatus, TransportMode } from '@/types';
import { format, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Removed redundant Stripe imports and handleCheckout function that used a hardcoded key.
// If payment functionality is needed on this page, it should use the Stripe context
// provided by AppProviders and make calls to backend functions for PaymentIntents.

const statusIcons: Record<ReservationStatus, React.ElementType> = {
  Pending: Hourglass,
  Assigned: UserCheck2,
  DriverEnRouteToPickup: Navigation,
  DriverAtPickup: ParkingSquare,
  PassengerOnBoard: Users2,
  Completed: CheckCircle2,
  Cancelled: XCircle,
};


export default function MyReservationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [reservationToCancel, setReservationToCancel] = React.useState<Reservation | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false);
  const [isProcessingCancel, setIsProcessingCancel] = React.useState(false);
  const [cancelDialogContent, setCancelDialogContent] = React.useState({ title: "", description: "", refundMessage: "" });


  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchReservations = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const q = query(
        collection(firestore, 'reservations'),
        where('userId', '==', user.uid),
        where('status', 'in', ['Pending', 'Assigned', 'DriverEnRouteToPickup', 'DriverAtPickup', 'PassengerOnBoard']),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedReservations: Reservation[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt as string),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt as string),
          desiredPickupTime: data.desiredPickupTime instanceof Timestamp ? data.desiredPickupTime.toDate() : (data.desiredPickupTime ? new Date(data.desiredPickupTime as string) : null),
        } as Reservation;
      });
      setReservations(fetchedReservations);
    } catch (err) {
      console.error("Error fetching reservations:", err);
      setError("Impossible de charger vos réservations.");
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger vos réservations." });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const getStatusText = (status: Reservation['status']) => {
    switch (status) {
      case 'Pending': return 'En attente';
      case 'Assigned': return 'Chauffeur assigné';
      case 'DriverEnRouteToPickup': return 'Chauffeur en route';
      case 'DriverAtPickup': return 'Chauffeur sur place';
      case 'PassengerOnBoard': return 'Course en cours';
      default: return status;
    }
  };

  const openCancelDialog = (reservation: Reservation) => {
    setReservationToCancel(reservation);
    const now = new Date();
    let title = "";
    let description = "";
    let refundMessage = "Aucun remboursement applicable.";
    
    // Robustly handle cost whether it's a number or a legacy string
    let costValue = 0;
    let costString = 'N/A';
    if (typeof reservation.cost === 'number') {
        costValue = reservation.cost;
        costString = `${costValue.toFixed(2)} €`;
    } else if (typeof reservation.cost === 'string' && reservation.cost) {
        costString = reservation.cost; // Show the original string
        const parsed = parseFloat(reservation.cost.replace(/[^\d,.]/g, '').replace(',', '.'));
        if (!isNaN(parsed)) {
            costValue = parsed;
        }
    }

    const cancellableByClientStatuses: ReservationStatus[] = ['Pending', 'Assigned', 'DriverEnRouteToPickup', 'DriverAtPickup'];
    if (!cancellableByClientStatuses.includes(reservation.status)) {
        toast({ variant: "destructive", title: "Non annulable", description: "Cette course ne peut plus être annulée à ce stade." });
        return;
    }
    
    if (reservation.status === 'DriverEnRouteToPickup' || reservation.status === 'DriverAtPickup') {
        title = "Confirmer l'Annulation (Aucun Remboursement)";
        description = `Le chauffeur est déjà ${reservation.status === 'DriverEnRouteToPickup' ? 'en route' : 'sur le lieu de prise en charge'} (${getStatusText(reservation.status)}). Aucun remboursement ne sera effectué car la course est considérée comme ayant commencé pour le chauffeur.`;
        refundMessage = "Aucun remboursement.";
    } else if (reservation.status === 'Pending') {
        title = "Confirmer l'Annulation (Remboursement Intégral)";
        description = `Vous êtes sur le point d'annuler votre course pour ${reservation.pickupLocation} vers ${reservation.dropoffLocation}. Comme aucun chauffeur n'a encore été assigné, vous recevrez un remboursement intégral (simulé) de ${costString}.`;
        refundMessage = `Remboursement intégral de ${costString} (simulé).`;
    } else if (reservation.status === 'Assigned') {
        if (!reservation.desiredPickupTime) { // Immediate booking
            const fiftyPercentCost = costValue > 0 ? `${(costValue * 0.5).toFixed(2)} €` : `50% de ${costString}`;
            title = "Confirmer l'Annulation (Remboursement 50%)";
            description = `Le chauffeur a été assigné pour une course immédiate. Vous recevrez un remboursement de 50% (simulé) soit ${fiftyPercentCost} si vous annulez maintenant.`;
            refundMessage = `Remboursement de 50% soit ${fiftyPercentCost} (simulé).`;
        } else {
            const pickupTime = reservation.desiredPickupTime instanceof Timestamp ? reservation.desiredPickupTime.toDate() : new Date(reservation.desiredPickupTime);
            const hoursToPickup = differenceInHours(pickupTime, now);

            if (hoursToPickup > 48) {
                title = "Confirmer l'Annulation (Remboursement Intégral)";
                description = `L'annulation est effectuée plus de 48 heures avant la prise en charge. Vous recevrez un remboursement intégral (simulé) de ${costString}.`;
                refundMessage = `Remboursement intégral de ${costString} (simulé).`;
            } else { 
                const fiftyPercentCost = costValue > 0 ? `${(costValue * 0.5).toFixed(2)} €` : `50% de ${costString}`;
                title = "Confirmer l'Annulation (Remboursement 50%)";
                description = `L'annulation est effectuée moins de 48 heures avant la prise en charge. Vous recevrez un remboursement de 50% (simulé) soit ${fiftyPercentCost}.`;
                refundMessage = `Remboursement de 50% soit ${fiftyPercentCost} (simulé).`;
            }
        }
    }

    setCancelDialogContent({ title, description, refundMessage });
    setIsCancelDialogOpen(true);
  };


  const handleConfirmCancel = async () => {
    if (!reservationToCancel) return;

    setIsProcessingCancel(true);
    try {
      const reservationRef = doc(firestore, "reservations", reservationToCancel.id);
      await updateDoc(reservationRef, {
        status: 'Cancelled',
        updatedAt: serverTimestamp() 
      });
      toast({ 
        title: "Réservation Annulée", 
        description: `${cancelDialogContent.refundMessage} La réservation a été marquée comme annulée.` 
      });
      fetchReservations(); 
      setIsCancelDialogOpen(false);
      setReservationToCancel(null);
    } catch (err) {
      console.error("Error cancelling reservation:", err);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'annuler la réservation." });
    } finally {
      setIsProcessingCancel(false);
    }
  };
  
  const getRouteModeText = (mode: TransportMode) => {
    switch (mode) {
      case 'economy': return 'Economy';
      case 'business': return 'Business';
      case 'first_class': return '1ère Classe';
      default: return mode;
    }
  };
  
  const getStatusClass = (status: Reservation['status']) => {
     switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200';
      case 'Assigned': return 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200';
      case 'DriverEnRouteToPickup': return 'bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200';
      case 'DriverAtPickup': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200';
      case 'PassengerOnBoard': return 'bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
    }
  }
  
  const formatDesiredPickupTime = (time: Date | Timestamp | null | undefined): string => {
    if (!time) return 'Immédiat';
    const dateObj = time instanceof Timestamp ? time.toDate() : time;
    return format(dateObj, 'Pp', { locale: fr });
  };


  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        <Header />
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center">
              <ListChecks className="h-8 w-8 mr-3 text-primary" />
              <CardTitle className="text-2xl font-headline">Mes Réservations Actuelles</CardTitle>
            </div>
            <CardDescription>Consultez ici vos réservations en attente ou assignées. Vous pouvez annuler selon les conditions de remboursement.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Chargement des réservations...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center text-center py-10 text-destructive">
                <AlertTriangle className="h-12 w-12 mb-3" />
                <p className="font-semibold">Erreur de chargement</p>
                <p className="text-sm">{error}</p>
              </div>
            ) : reservations.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2 sm:px-3 md:px-4">Date Souhaitée</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Gamme/Trajet</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">De</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">À</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Prix</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Statut</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Chauffeur &amp; Véhicule</TableHead>
                      <TableHead className="text-right px-2 sm:px-3 md:px-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((res) => {
                      const StatusIcon = statusIcons[res.status] || Info;
                      const canCancel = ['Pending', 'Assigned', 'DriverEnRouteToPickup', 'DriverAtPickup'].includes(res.status);
                      return (
                      <TableRow key={res.id}>
                        <TableCell className="text-xs p-2 sm:p-3 md:p-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <CalendarClock className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0"/>
                            {formatDesiredPickupTime(res.desiredPickupTime)}
                          </div>
                           <span className="text-xs text-muted-foreground block mt-0.5">
                             (Créé le: {res.createdAt ? format(new Date(res.createdAt), 'dd/MM/yy HH:mm', { locale: fr }) : 'N/A'})
                           </span>
                        </TableCell>
                        <TableCell className="font-medium p-2 sm:p-3 md:p-4">{res.routeName} ({getRouteModeText(res.routeMode)})</TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">{res.pickupLocation}</TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">{res.dropoffLocation}</TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">
                            <div className="flex items-center">
                               <Euro className="h-4 w-4 mr-1 text-muted-foreground" />
                               {typeof res.cost === 'number' ? res.cost.toFixed(2) : (res.cost || 'N/A')}
                            </div>
                        </TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusClass(res.status)}`}>
                            <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                            {getStatusText(res.status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs p-2 sm:p-3 md:p-4">
                          {res.status !== 'Pending' && res.driverDetails ? (
                            <div className="space-y-0.5">
                              {res.driverDetails.name && (
                                <div className="flex items-center">
                                  <UserIcon className="h-3.5 w-3.5 mr-1.5 text-primary flex-shrink-0" />
                                  <span className="font-medium">{res.driverDetails.name}</span>
                                </div>
                              )}
                              <div className="flex items-center text-muted-foreground">
                                <CarIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                                <span className="truncate">{res.driverDetails.carMake} {res.driverDetails.carColor} ({res.driverDetails.licensePlate})</span>
                              </div>
                            </div>
                          ) : res.status !== 'Pending' ? (
                              <span className="italic text-muted-foreground">Détails en attente</span>
                          ) : (
                            <span className="italic text-muted-foreground">Non assigné</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1 sm:space-x-2 p-2 sm:p-3 md:p-4 whitespace-nowrap">
                          {(res.status === 'Assigned' || res.status === 'DriverEnRouteToPickup' || res.status === 'DriverAtPickup' || res.status === 'PassengerOnBoard') && (
                             <Button asChild variant="outline" size="sm">
                               <Link href={`/track-ride/${res.id}`}>
                                 <Eye className="mr-1 h-3 w-3" /> Suivre
                               </Link>
                             </Button>
                          )}
                          {canCancel && (
                            <Button variant="destructive" size="sm" onClick={() => openCancelDialog(res)}>
                              <XCircle className="mr-1 h-3 w-3" /> Annuler
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center py-10 text-muted-foreground">
                <Info className="h-12 w-12 mb-3 text-primary" />
                <p className="font-semibold">Aucune réservation active pour le moment.</p>
                <p className="text-sm">Vous pouvez faire une nouvelle réservation depuis la page d'accueil.</p>
                 <Button asChild className="mt-4"><Link href="/">Réserver un trajet</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {reservationToCancel && (
        <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center"><ShieldAlert className="mr-2 h-5 w-5 text-destructive"/>{cancelDialogContent.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {cancelDialogContent.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessingCancel}>Non, maintenir</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmCancel} 
                disabled={isProcessingCancel}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isProcessingCancel ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}
                Oui, annuler la course
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
