
"use client";

import * as React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { History, Loader2, Info, AlertTriangle, UserCircle, Star, Send, CalendarClock } from 'lucide-react';
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

export default function DriverRideHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [rides, setRides] = React.useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isRatingDialogOpen, setIsRatingDialogOpen] = React.useState(false);
  const [rideToRate, setRideToRate] = React.useState<Reservation | null>(null);
  const [currentClientRating, setCurrentClientRating] = React.useState<number>(0);
  const [currentClientComment, setCurrentClientComment] = React.useState('');
  const [isSubmittingClientRating, setIsSubmittingClientRating] = React.useState(false);

  const fetchRides = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const q = query(
        collection(firestore, 'reservations'),
        where('assignedDriverId', '==', user.uid),
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
      console.error("Error fetching driver ride history:", err);
      setError("Impossible de charger votre historique de courses.");
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
    setCurrentClientRating(ride.clientRatingByDriver || 0);
    setCurrentClientComment(ride.clientCommentByDriver || '');
    setIsRatingDialogOpen(true);
  };

  const handleClientRatingSubmit = async () => {
    if (!rideToRate || currentClientRating === 0) {
      toast({ variant: "destructive", title: "Note requise", description: "Veuillez sélectionner une note (nombre d'étoiles) pour le client." });
      return;
    }
    setIsSubmittingClientRating(true);
    try {
      const reservationRef = doc(firestore, "reservations", rideToRate.id);
      await updateDoc(reservationRef, {
        clientRatingByDriver: currentClientRating,
        clientCommentByDriver: currentClientComment.trim() || null,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Avis client soumis", description: "Merci pour votre retour sur le client !" });
      setIsRatingDialogOpen(false);
      fetchRides(); 
    } catch (err) {
      console.error("Error submitting client rating:", err);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de soumettre votre avis sur le client." });
    } finally {
      setIsSubmittingClientRating(false);
    }
  };
  
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
              <CardTitle className="text-2xl font-headline">Historique de mes Courses (Chauffeur)</CardTitle>
            </div>
            <CardDescription>
              Consultez ici vos courses terminées ou annulées. Les informations financières (prix des courses) ne sont pas affichées ici. Vous pouvez noter les clients pour les courses terminées.
            </CardDescription>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2 sm:px-3 md:px-4">Date Prise en charge</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Passager</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Prise en charge</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Destination</TableHead>
                       <TableHead className="px-2 sm:px-3 md:px-4">Gamme</TableHead>
                      <TableHead className="px-2 sm:px-3 md:px-4">Statut</TableHead>
                      <TableHead className="text-center px-2 sm:px-3 md:px-4">Action (Note Client)</TableHead>
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
                            (Réservé le: {ride.createdAt ? format(new Date(ride.createdAt), 'dd/MM/yy HH:mm', {locale: fr}) : 'N/A'})
                          </span>
                        </TableCell>
                        <TableCell className="font-medium p-2 sm:p-3 md:p-4">
                            <div className="flex items-center">
                                <UserCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                                {ride.passengerName || 'N/A'}
                            </div>
                        </TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">{ride.pickupLocation}</TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">{ride.dropoffLocation}</TableCell>
                        <TableCell className="p-2 sm:p-3 md:p-4">{getRouteModeText(ride.routeMode)}</TableCell>
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
                            ride.clientRatingByDriver ? (
                              <div className="flex items-center justify-center text-xs text-muted-foreground">
                                <Star className="h-4 w-4 mr-1 text-yellow-400 fill-yellow-400" />
                                Client Noté ({ride.clientRatingByDriver}/5)
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => openRatingDialog(ride)}>
                                <Star className="mr-1 h-3 w-3" /> Noter Client
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
              </div>
            ) : (
              <div className="flex flex-col items-center text-center py-10 text-muted-foreground">
                <Info className="h-12 w-12 mb-3 text-primary" />
                <p className="font-semibold">Aucune course dans votre historique.</p>
                <p className="text-sm">Vos courses terminées ou annulées apparaîtront ici.</p>
                 <Button asChild className="mt-4"><Link href="/driver">Retour au tableau de bord</Link></Button>
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
                <Star className="mr-2 h-5 w-5 text-primary" /> Noter le client : {rideToRate.passengerName}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Course du {rideToRate.createdAt ? format(new Date(rideToRate.createdAt), 'Pp', { locale: fr }) : 'N/A'} de {rideToRate.pickupLocation} à {rideToRate.dropoffLocation}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="clientRating" className="text-sm font-medium">Note pour le client :</Label>
                <div className="flex space-x-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-8 w-8 cursor-pointer",
                        currentClientRating >= star ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-300"
                      )}
                      onClick={() => setCurrentClientRating(star)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="clientComment" className="text-sm font-medium">Commentaire (optionnel) :</Label>
                <Textarea
                  id="clientComment"
                  placeholder="Un commentaire sur le comportement du client..."
                  value={currentClientComment}
                  onChange={(_e) => setCurrentClientComment(_e.target.value)}
                  rows={3}
                  className="mt-1"
                  disabled={isSubmittingClientRating}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmittingClientRating}>Annuler</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleClientRatingSubmit} 
                disabled={isSubmittingClientRating || currentClientRating === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmittingClientRating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Soumettre l'avis
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
