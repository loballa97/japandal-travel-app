"use client";

import React, { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Loader2, MapPin, Plane, Home as HomeIcon, Users, Car, Clock } from 'lucide-react';
import LocationInput from '@/components/booking/LocationInput';
import RouteMap from '@/components/booking/RouteMap';

type TripDirection = 'airport-to-home' | 'home-to-airport';
type VehicleType = 'economique' | 'business' | 'first-class';

const vehicleTypes = {
  economique: {
    label: 'Économique',
    description: 'Véhicule standard confortable',
    basePrice: 5,
    pricePerKm: 1,
  },
  business: {
    label: 'Business',
    description: 'Véhicule haut de gamme',
    basePrice: 8,
    pricePerKm: 1.5,
  },
  'first-class': {
    label: 'First Class',
    description: 'Véhicule de luxe avec chauffeur premium',
    basePrice: 12,
    pricePerKm: 2,
  },
};

function BookingForm() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [tripDirection, setTripDirection] = useState<TripDirection>('airport-to-home');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [vehicleType, setVehicleType] = useState<VehicleType>('economique');
  const [estimatedDistance, setEstimatedDistance] = useState(0);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickupPlaceId, setPickupPlaceId] = useState<string>('');
  const [dropoffPlaceId, setDropoffPlaceId] = useState<string>('');

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    
    // Rediriger les chauffeurs vers leur dashboard
    if (!authLoading && userProfile) {
      if (userProfile.role === 'driver') {
        router.push('/driver');
        return;
      }
      // Rediriger les managers et admins vers leurs dashboards respectifs
      if (userProfile.role === 'manager') {
        router.push('/manager');
        return;
      }
      if (userProfile.role === 'admin' || userProfile.role === 'sub-admin') {
        router.push('/admin');
        return;
      }
    }
  }, [user, userProfile, authLoading, router]);

  // Vérifier si l'utilisateur est vérifié (téléphone + identité)
  const isUserVerified = userProfile?.phoneVerified === true && userProfile?.identityStatus === 'verified';
  const canCreateReservation = user && userProfile && isUserVerified;

  React.useEffect(() => {
    // Le calcul de distance est maintenant géré par le composant RouteMap
    if (estimatedDistance > 0) {
      const vehicle = vehicleTypes[vehicleType];
      const price = vehicle.basePrice + (estimatedDistance * vehicle.pricePerKm);
      setEstimatedPrice(Math.round(price * 100) / 100);
    }
  }, [estimatedDistance, vehicleType]);

  const handleDistanceCalculated = (distanceKm: number, durationMin: number) => {
    setEstimatedDistance(distanceKm);
    setEstimatedDuration(durationMin);
  };

  const handlePickupChange = (value: string, placeDetails?: google.maps.places.PlaceResult) => {
    setPickupAddress(value);
    if (placeDetails?.place_id) {
      setPickupPlaceId(placeDetails.place_id);
    }
  };

  const handleDropoffChange = (value: string, placeDetails?: google.maps.places.PlaceResult) => {
    setDropoffAddress(value);
    if (placeDetails?.place_id) {
      setDropoffPlaceId(placeDetails.place_id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Vous devez être connecté pour réserver.',
      });
      return;
    }

    // Vérifier que l'utilisateur est vérifié (téléphone + identité)
    if (!canCreateReservation) {
      toast({
        variant: 'destructive',
        title: 'Vérification requise',
        description: 'Vous devez vérifier votre téléphone et votre identité avant de réserver.',
      });
      router.push('/verification');
      return;
    }

    if (!date || !time) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner une date et une heure.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Préparer les données de réservation
      const reservationData = {
        userId: user.uid,
        userEmail: user.email,
        tripDirection,
        pickupAddress,
        dropoffAddress,
        pickupPlaceId,
        dropoffPlaceId,
        date: date.toISOString(),
        time,
        passengers: parseInt(passengers),
        vehicleType,
        estimatedDistance: Math.round(estimatedDistance * 100) / 100,
        estimatedDuration: Math.round(estimatedDuration),
        estimatedPrice,
      };

      toast({
        title: 'Redirection vers le paiement...',
        description: 'Vous allez être redirigé vers la page de paiement sécurisée.',
      });

      // Créer une session Stripe Checkout
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const createCheckoutSession = httpsCallable(functions, 'createStripeCheckoutSession');
      
      const result = await createCheckoutSession({
        reservationData,
        successUrl: `${window.location.origin}/payment-status?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/booking?canceled=true`,
      });

      const { url } = result.data as { sessionId: string; url: string };

      // Rediriger vers Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('URL de paiement non reçue');
      }

    } catch (error: any) {
      console.error('Erreur lors de la réservation:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de la réservation.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
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
        {/* Alerte de vérification */}
        {!canCreateReservation && (
          <Card className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="text-yellow-600 dark:text-yellow-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Vérification requise
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                    Pour réserver un trajet, vous devez vérifier votre téléphone et votre identité.
                  </p>
                  <Button
                    onClick={() => router.push('/verification')}
                    variant="outline"
                    className="mt-3 border-yellow-600 text-yellow-600 hover:bg-yellow-100 dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-900"
                  >
                    Compléter la vérification
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Car className="h-8 w-8 text-primary" />
              Réserver un trajet
            </CardTitle>
            <CardDescription>
              Réservez votre transport entre l'aéroport et votre domicile
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Direction du trajet */}
              <div className="space-y-2">
                <Label>Direction du trajet</Label>
                <Select value={tripDirection} onValueChange={(value) => setTripDirection(value as TripDirection)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="airport-to-home">
                      <div className="flex items-center gap-2">
                        <Plane className="h-4 w-4" />
                        Aéroport → Domicile
                      </div>
                    </SelectItem>
                    <SelectItem value="home-to-airport">
                      <div className="flex items-center gap-2">
                        <HomeIcon className="h-4 w-4" />
                        Domicile → Aéroport
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Adresse de départ avec autocomplete */}
              <LocationInput
                id="pickup"
                label="Adresse de départ"
                placeholder={tripDirection === 'airport-to-home' ? 'Ex: Aéroport Charles de Gaulle' : 'Ex: 123 Rue de Paris, 75001'}
                value={pickupAddress}
                onChange={handlePickupChange}
                required
              />

              {/* Adresse d'arrivée avec autocomplete */}
              <LocationInput
                id="dropoff"
                label="Adresse d'arrivée"
                placeholder={tripDirection === 'home-to-airport' ? 'Ex: Aéroport Charles de Gaulle' : 'Ex: 123 Rue de Paris, 75001'}
                value={dropoffAddress}
                onChange={handleDropoffChange}
                required
              />

              {/* Carte avec itinéraire */}
              {pickupAddress && dropoffAddress && (
                <div className="space-y-2">
                  <Label>Itinéraire</Label>
                  <RouteMap
                    origin={pickupAddress}
                    destination={dropoffAddress}
                    onDistanceCalculated={handleDistanceCalculated}
                  />
                </div>
              )}

              {/* Date et heure */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date du trajet</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, 'PPP', { locale: fr }) : 'Sélectionner une date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Heure du trajet</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Nombre de passagers */}
              <div className="space-y-2">
                <Label htmlFor="passengers">
                  <Users className="inline h-4 w-4 mr-1" />
                  Nombre de passagers
                </Label>
                <Select value={passengers} onValueChange={setPassengers}>
                  <SelectTrigger id="passengers">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'passager' : 'passagers'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type de véhicule */}
              <div className="space-y-2">
                <Label>Type de véhicule</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(vehicleTypes).map(([key, vehicle]) => (
                    <Card
                      key={key}
                      className={cn(
                        'cursor-pointer transition-all hover:border-primary',
                        vehicleType === key && 'border-primary bg-primary/5'
                      )}
                      onClick={() => setVehicleType(key as VehicleType)}
                    >
                      <CardHeader className="p-4">
                        <CardTitle className="text-lg">{vehicle.label}</CardTitle>
                        <CardDescription className="text-xs">
                          {vehicle.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-sm font-semibold">
                          À partir de {vehicle.basePrice}€
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Estimation du prix */}
              {estimatedPrice > 0 && (
                <Card className="bg-primary/10 border-primary">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Prix estimé</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {Math.round(estimatedDistance)} km
                          </span>
                          {estimatedDuration > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {Math.round(estimatedDuration)} min
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-primary">
                        {estimatedPrice.toFixed(2)}€
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bouton de soumission */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting || !pickupAddress || !dropoffAddress || !date || !time}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  'Passer au paiement'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <BookingForm />
    </Suspense>
  );
}
