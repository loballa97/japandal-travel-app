"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Clock, Users, Car, DollarSign, CheckCircle2 } from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { RESERVATION_STATUS_LABELS, RESERVATION_STATUS_COLORS } from '@/lib/reservationUtils';
import type { ReservationStatus } from '@/types';

export default function AssignDriverPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [reservations, setReservations] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (!authLoading && userProfile?.role !== 'manager' && userProfile?.role !== 'admin' && userProfile?.role !== 'sub_admin') {
      router.push('/');
      return;
    }

    // Vérifier si le manager est vérifié
    if (!authLoading && userProfile && userProfile.role === 'manager') {
      const isManagerVerified = 
        userProfile.phoneVerified === true &&
        userProfile.identityStatus === 'verified';

      if (!isManagerVerified) {
        toast({
          variant: 'destructive',
          title: 'Vérification requise',
          description: 'Vous devez compléter la vérification de votre identité pour accéder à cette fonctionnalité.',
        });
        router.push('/verification');
        return;
      }
    }
  }, [user, userProfile, authLoading, router, toast]);

  useEffect(() => {
    if (user && userProfile) {
      loadData();
    }
  }, [user, userProfile]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger les réservations en attente d'attribution ou refusées
      const reservationsRef = collection(firestore, 'reservations');
      const q = query(
        reservationsRef,
        where('status', 'in', ['pending_assignment', 'driver_refused'])
      );
      const reservationsSnap = await getDocs(q);
      const reservationsData = reservationsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReservations(reservationsData);

      // Charger les chauffeurs disponibles
      const driversRef = collection(firestore, 'drivers');
      const driversSnap = await getDocs(driversRef);
      const driversData = driversSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDrivers(driversData);

    } catch (error: any) {
      console.error('Erreur chargement:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger les données.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDriver = async (reservationId: string) => {
    const driverId = selectedDriver[reservationId];
    if (!driverId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner un chauffeur.',
      });
      return;
    }

    try {
      setAssigning(reservationId);

      const driver = drivers.find(d => d.id === driverId);
      const reservation = reservations.find(r => r.id === reservationId);
      const reservationRef = doc(firestore, 'reservations', reservationId);
      
      await updateDoc(reservationRef, {
        assignedDriverId: driverId,
        driverDetails: driver?.details || null,
        status: 'driver_assigned',
        assignedByManagerId: user?.uid,
        assignedByManagerName: user?.displayName || user?.email,
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Notifier le chauffeur et le client
      try {
        const { NotificationService } = await import('@/lib/notificationService');
        
        // Notifier le chauffeur
        await NotificationService.notifyDriverNewAssignment(
          driverId,
          reservationId,
          reservation?.pickupAddress || 'Départ',
          reservation?.dropoffAddress || 'Arrivée'
        );

        // Notifier le client
        if (reservation?.userId) {
          await NotificationService.notifyClientDriverAssigned(
            reservation.userId,
            reservationId,
            driver?.name || 'Chauffeur'
          );
        }
      } catch (notifError) {
        console.error('Erreur notifications:', notifError);
      }

      toast({
        title: 'Chauffeur attribué !',
        description: `Le chauffeur ${driver?.name || 'sélectionné'} a été notifié.`,
      });

      // Recharger les données
      await loadData();
    } catch (error: any) {
      console.error('Erreur attribution:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible d\'attribuer le chauffeur.',
      });
    } finally {
      setAssigning(null);
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
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">
            Attribution des chauffeurs
          </h1>
          <p className="text-muted-foreground">
            Attribuez les chauffeurs disponibles aux réservations en attente
          </p>
        </div>

        {reservations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Aucune réservation en attente</h3>
              <p className="text-muted-foreground">
                Toutes les réservations ont été attribuées.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {reservations.map((reservation) => (
              <Card key={reservation.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl mb-2">
                        Réservation #{reservation.id.slice(-6).toUpperCase()}
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
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-muted-foreground">Départ</p>
                          <p className="text-sm">{reservation.pickupAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-muted-foreground">Arrivée</p>
                          <p className="text-sm">{reservation.dropoffAddress}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm text-muted-foreground">Date & Heure</p>
                          <p className="text-sm">
                            {new Date(reservation.date).toLocaleDateString('fr-FR')} à {reservation.time}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm text-muted-foreground">Passagers</p>
                          <p className="text-sm">{reservation.passengers} personne(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm text-muted-foreground">Véhicule</p>
                          <p className="text-sm capitalize">{reservation.vehicleType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm text-muted-foreground">Prix</p>
                          <p className="text-sm font-semibold">{reservation.estimatedPrice}€</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-2">
                          Sélectionner un chauffeur
                        </label>
                        <Select
                          value={selectedDriver[reservation.id] || ''}
                          onValueChange={(value) => setSelectedDriver({ ...selectedDriver, [reservation.id]: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir un chauffeur..." />
                          </SelectTrigger>
                          <SelectContent>
                            {drivers.map((driver) => (
                              <SelectItem key={driver.id} value={driver.id}>
                                {driver.name || driver.id} - {driver.details?.carMake || 'Véhicule'} ({driver.details?.licensePlate || 'N/A'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={() => handleAssignDriver(reservation.id)}
                        disabled={!selectedDriver[reservation.id] || assigning === reservation.id}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {assigning === reservation.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Attribution...
                          </>
                        ) : (
                          'Attribuer'
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
