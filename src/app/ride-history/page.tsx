
"use client";

import * as React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { History, Euro, Loader2, Info, AlertTriangle, Star, Send, CalendarClock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Reservation, TransportMode } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';


export default function RideHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [rides, setRides] = React.useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isRatingDialogOpen, setIsRatingDialogOpen] = React.useState(false);
  const [rideToRate, setRideToRate] = React.useState<Reservation | null>(null);
  const [currentRating, setCurrentRating] = React.useState<number>(0);
  const [currentComment, setCurrentComment] = React.useState('');
  const [isSubmittingRating, setIsSubmittingRating] = React.useState(false);

  const fetchRides = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const q = query(
        collection(firestore, 'reservations'),
        where('userId', '==', user.uid),
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
      console.error("Error fetching ride history:", err);
      setError("Impossible de charger votre historique de trajets.");
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger votre historique." });
    } finally {
      setIsLoading(false);
    }
  },[user, toast]);


  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
        fetchRides();
    }
  }, [user, authLoading, router, fetchRides]);

  const openRatingDialog = (ride: Reservation) => {
    setRideToRate(ride);
    setCurrentRating(ride.rating || 0);
    setCurrentComment(ride.comment || '');
    setIsRatingDialogOpen(true);
  };

  const handleRatingSubmit = async () => {
    if (!rideToRate || currentRating === 0) {
      toast({ variant: "destructive", title: "Note requise", description: "Veuillez sélectionner une note (nombre d'étoiles)." });
      return;
    }
    setIsSubmittingRating(true);
    try {
      const reservationRef = doc(firestore, "reservations", rideToRate.id);
      await updateDoc(reservationRef, {
        rating: currentRating,
        comment: currentComment.trim() || null,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Avis soumis", description: "Merci pour votre retour !" });
      setIsRatingDialogOpen(false);
      fetchRides(); 
    } catch (err) {
      console.error("Error submitting rating:", err);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de soumettre votre avis." });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const formatDesiredPickupTime = (time: Date | Timestamp | null | undefined): string => {
    if (!time) return 'N/A'; 
    const dateObj = time instanceof Timestamp ? time.toDate() : time;
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
      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Header />
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center">
              <History className="h-8 w-8 mr-3 text-primary" />
              <CardTitle className="text-2xl font-headline">Historique de mes Trajets</CardTitle>
            </div>
            <CardDescription>Consultez ici vos trajets passés (terminés ou annulés).</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Chargement de l'historique...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center text-center py-10 text-destructive">
                <AlertTriangle className="h-12 w-12 mb-3" />
                <p className="font-semibold">Erreur de chargement</p>
                <p className="text-sm">{error}</p>
              </div>
            ) : rides.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-2 sm:px-3 md:px-4">Date Course</TableHead>
                    <TableHead className="px-2 sm:px-3 md:px-4">Gamme/Trajet</TableHead>
                    <TableHead className="px-2 sm:px-3 md:px-4">De</TableHead>
                    <TableHead className="px-2 sm:px-3 md:px-4">À</TableHead>
                    <TableHead className="px-2 sm:px-3 md:px-4">Prix</TableHead>
                    <TableHead className="px-2 sm:px-3 md:px-4">Statut</TableHead>
                    <TableHead className="text-center px-2 sm:px-3 md:px-4">Action (Noter)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rides.map((ride) => (
                    <TableRow key={ride.id}>
                      <TableCell className="text-xs p-2 sm:p-3 md:p-4 whitespace-nowrap">
                         <div className="flex items-center">
                            <CalendarClock className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0"/>
                            {formatDesiredPickupTime(ride.desiredPickupTime)}
                         </div>
                         <span className="text-xs text-muted-foreground block mt-0.5">
                            (Réservé le: {ride.createdAt ? format(new Date(ride.createdAt), 'dd/MM/yy HH:mm', { locale: fr }) : 'N/A'})
                         </span>
                      </TableCell>
                      <TableCell className="font-medium p-2 sm:p-3 md:p-4">{ride.routeName} ({getRouteModeText(ride.routeMode)})</TableCell>
                      <TableCell className="p-2 sm:p-3 md:p-4">{ride.pickupLocation}</TableCell>
                      <TableCell className="p-2 sm:p-3 md:p-4">{ride.dropoffLocation}</TableCell>
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
                      <TableCell className="text-center p-2 sm:p-3 md:p-4">
                        {ride.status === 'Completed' && (
                            ride.rating ? (
                                <div className="flex items-center justify-center text-xs text-muted-foreground">
                                    <Star className="h-4 w-4 mr-1 text-yellow-400 fill-yellow-400"/> Avis laissé ({ride.rating}/5)
                                </div>
                            ) : (
                                <Button variant="outline" size="sm" onClick={() => openRatingDialog(ride)}>
                                  <Star className="mr-1 h-3 w-3"/> Noter et commenter
                                </Button>
                            )
                        )}
                         {ride.status === 'Cancelled' && (
                            <span className="text-xs italic text-muted-foreground">N/A</span>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center text-center py-10 text-muted-foreground">
                <Info className="h-12 w-12 mb-3 text-primary" />
                <p className="font-semibold">Aucun trajet dans votre historique.</p>
                <p className="text-sm">Vos trajets terminés ou annulés apparaîtront ici.</p>
                <Button asChild className="mt-4"><Link href="/">Réserver un trajet</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      {rideToRate && (
        <AlertDialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center">
                    <Star className="mr-2 h-5 w-5 text-primary"/> Noter ce trajet
                </AlertDialogTitle>
                <AlertDialogDescription>
                    Partagez votre expérience pour le trajet du {rideToRate.createdAt ? format(new Date(rideToRate.createdAt), 'Pp', { locale: fr }) : 'N/A'} de {rideToRate.pickupLocation} à {rideToRate.dropoffLocation}.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                <div>
                    <Label htmlFor="rating" className="text-sm font-medium">Votre note :</Label>
                    <div className="flex space-x-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                        key={star}
                        className={cn(
                            "h-8 w-8 cursor-pointer",
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
                    placeholder="Décrivez votre expérience avec le chauffeur et le trajet..."
                    value={currentComment}
                    onChange={(_e) => setCurrentComment(_e.target.value)}
                    rows={3}
                    className="mt-1"
                    disabled={isSubmittingRating}
                    />
                </div>
                </div>
                <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmittingRating}>Annuler</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleRatingSubmit} 
                    disabled={isSubmittingRating || currentRating === 0}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                    {isSubmittingRating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Soumettre l'avis
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
