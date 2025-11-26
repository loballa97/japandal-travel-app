"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Clock, Users, Car, DollarSign, CheckCircle2, XCircle, Play, StopCircle, AlertCircle } from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { RESERVATION_STATUS_LABELS, RESERVATION_STATUS_COLORS, getAvailableActions } from '@/lib/reservationUtils';
import type { ReservationStatus } from '@/types';

export default function DriverCoursesPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (!authLoading && userProfile?.role !== 'driver') {
      router.push('/');
      return;
    }

    // Vérifier si le chauffeur est entièrement vérifié
    if (!authLoading && userProfile) {
      const isDriverVerified = 
        userProfile.phoneVerified === true &&
        userProfile.identityStatus === 'verified' &&
        userProfile.vehicleStatus === 'verified';

      if (!isDriverVerified) {
        // Rediriger vers la page de vérification si pas vérifié
        toast({
          variant: 'destructive',
          title: 'Vérification requise',
          description: 'Vous devez compléter la vérification de votre identité et véhicule pour accepter des courses.',
        });
        router.push('/verification');
        return;
      }
    }
  }, [user, userProfile, authLoading, router, toast]);

  useEffect(() => {
    if (user && userProfile?.role === 'driver') {
      // Écoute en temps réel des réservations attribuées au chauffeur
      const reservationsRef = collection(firestore, 'reservations');
      const q = query(
        reservationsRef,
        where('assignedDriverId', '==', user.uid),
        where('status', 'in', ['driver_assigned', 'driver_accepted', 'in_progress'])
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const reservationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setReservations(reservationsData);
        setLoading(false);
      }, (error) => {
        console.error('Erreur écoute réservations:', error);
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Impossible de charger vos courses.',
        });
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user, userProfile, toast]);

  const handleAction = async (reservationId: string, action: string, newStatus: ReservationStatus) => {
    try {
      setActionLoading(reservationId);

      const reservation = reservations.find(r => r.id === reservationId);
      const reservationRef = doc(firestore, 'reservations', reservationId);
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      // Ajout de timestamps spécifiques selon l'action
      if (action === 'accept') {
        updateData.acceptedAt = serverTimestamp();
      } else if (action === 'refuse') {
        updateData.refusedAt = serverTimestamp();
      } else if (action === 'start') {
        updateData.startedAt = serverTimestamp();
      } else if (action === 'complete') {
        updateData.completedAt = serverTimestamp();
        updateData.status = 'awaiting_review'; // Passer directement en attente d'avis
      }

      await updateDoc(reservationRef, updateData);

      // Envoyer les notifications appropriées
      try {
        const { NotificationService } = await import('@/lib/notificationService');
        
        if (action === 'accept' && reservation?.userId) {
          await NotificationService.notifyClientDriverAccepted(
            reservation.userId,
            reservationId,
            user?.displayName || 'Chauffeur'
          );
        } else if (action === 'refuse') {
          await NotificationService.notifyManagerDriverRefused(
            reservationId,
            user?.displayName || 'Chauffeur',
            reservation?.userEmail || 'Client'
          );
        } else if (action === 'start' && reservation?.userId) {
          await NotificationService.notifyClientRideStarted(
            reservation.userId,
            reservationId,
            user?.displayName || 'Chauffeur'
          );
        } else if (action === 'complete' && reservation?.userId) {
          await NotificationService.notifyClientRideCompleted(
            reservation.userId,
            reservationId
          );
        }
      } catch (notifError) {
        console.error('Erreur notifications:', notifError);
      }

      const messages: Record<string, string> = {
        accept: 'Course acceptée ! Le client sera notifié.',
        refuse: 'Course refusée. Elle sera réattribuée.',
        start: 'Course démarrée ! Bon trajet.',
        complete: 'Course terminée ! Merci.',
      };

      toast({
        title: 'Action effectuée',
        description: messages[action] || 'Action réalisée avec succès.',
      });

    } catch (error: any) {
      console.error('Erreur action:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible d\'effectuer cette action.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Header />
      </div>
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">
            Mes courses
          </h1>
          <p className="text-muted-foreground">
            Gérez vos courses attribuées et en cours
          </p>
        </div>

        {reservations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Aucune course active</h3>
              <p className="text-muted-foreground">
                Vous n'avez aucune course attribuée pour le moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {reservations.map((reservation) => {
              const actions = getAvailableActions(reservation.status as ReservationStatus, 'driver');
              
              return (
                <Card key={reservation.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl mb-2">
                          Course #{reservation.id.slice(-6).toUpperCase()}
                        </CardTitle>
                        <CardDescription>
                          Client: {reservation.userEmail || 'Non spécifié'}
                        </CardDescription>
                      </div>
                      <Badge className={RESERVATION_STATUS_COLORS[reservation.status as ReservationStatus]}>
                        {RESERVATION_STATUS_LABELS[reservation.status as ReservationStatus]}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-6">
                    <div className="space-y-4 mb-6">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-muted-foreground">Point de départ</p>
                          <p className="text-sm">{reservation.pickupAddress}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-muted-foreground">Destination</p>
                          <p className="text-sm">{reservation.dropoffAddress}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-xs text-muted-foreground">Date & Heure</p>
                            <p className="text-sm">
                              {new Date(reservation.date).toLocaleDateString('fr-FR', { 
                                day: 'numeric', 
                                month: 'short' 
                              })} {reservation.time}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-xs text-muted-foreground">Passagers</p>
                            <p className="text-sm">{reservation.passengers}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Car className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-xs text-muted-foreground">Véhicule</p>
                            <p className="text-sm capitalize">{reservation.vehicleType}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-xs text-muted-foreground">Montant</p>
                            <p className="text-sm font-semibold">{reservation.estimatedPrice}€</p>
                          </div>
                        </div>
                      </div>

                      {reservation.estimatedDistance && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                          Distance estimée: {reservation.estimatedDistance} km • 
                          Durée: {Math.round(reservation.estimatedDuration / 60)} min
                        </div>
                      )}
                    </div>

                    {/* Actions disponibles */}
                    {actions.length > 0 && (
                      <div className="border-t pt-6">
                        <div className="flex gap-3 flex-wrap">
                          {actions.map((action) => {
                            const isLoading = actionLoading === reservation.id;
                            const icons: Record<string, any> = {
                              accept: CheckCircle2,
                              refuse: XCircle,
                              start: Play,
                              complete: StopCircle,
                            };
                            const Icon = icons[action.action] || CheckCircle2;
                            const variants: Record<string, any> = {
                              accept: 'default',
                              refuse: 'destructive',
                              start: 'default',
                              complete: 'default',
                            };

                            return (
                              <Button
                                key={action.action}
                                onClick={() => handleAction(reservation.id, action.action, action.newStatus)}
                                disabled={isLoading}
                                variant={variants[action.action]}
                                className={action.action === 'accept' || action.action === 'start' 
                                  ? 'bg-primary hover:bg-primary/90' 
                                  : ''}
                              >
                                {isLoading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Traitement...
                                  </>
                                ) : (
                                  <>
                                    <Icon className="mr-2 h-4 w-4" />
                                    {action.label}
                                  </>
                                )}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
