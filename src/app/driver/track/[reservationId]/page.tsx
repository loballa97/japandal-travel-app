'use client'; // <-- AJOUTÉ: Indique que c'est un Client Component (nécessaire pour useState/useEffect)

import React, { useState, useEffect, useCallback } from 'react';
// CORRIGÉ: Utiliser 'next/navigation' à la place de 'next/router' pour l'App Router
import { useRouter } from 'next/navigation'; 
import { doc, onSnapshot, updateDoc, serverTimestamp, Timestamp, DocumentData } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// --- Importations de composants et d'utilitaires (à vérifier vos chemins) ---
import { cn } from '@/lib/utils'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
// Assurez-vous d'importer toutes les icônes nécessaires depuis 'lucide-react'
import { UserRound, Loader2, LogOutIcon, Star, Send, CheckCircle2, AlertTriangle, Navigation, CalendarClock, MapPin, Users, Flag, Play } from 'lucide-react'; 

// --- Hooks et composants externes simulés pour l'autonomie du code (à décommenter/remplacer) ---
// import { useAuth } from '@/hooks/useAuth'; 
// import { useToast } from '@/components/ui/use-toast'; 
// import { firestore } from '@/lib/firebase';
// import MapView from '@/components/MapView';
// import Header from '@/components/Header';
// const customerLocationState = { lat: 0, lng: 0 }; // Simuler ou importer l'état client


// --- DÉFINITION DES TYPES ET INTERFACES (Pour résoudre les erreurs TypeScript) ---
export type ReservationStatus = 'Assigned' | 'DriverEnRouteToPickup' | 'DriverAtPickup' | 'PassengerOnBoard' | 'Completed' | 'Cancelled';
export type TransportMode = 'economy' | 'business' | 'first_class';

export interface GeoPoint {
    lat: number;
    lng: number;
}

interface StatusDisplay {
    text: string;
    class: string;
}

export interface Reservation {
    id: string;
    passengerName: string;
    pickupLocation: string;
    dropoffLocation: string;
    routeMode: TransportMode;
    routeName: string;
    status: ReservationStatus;
    assignedByManagerName?: string;
    driverId: string;
    clientId: string;
    routeCoordinates?: GeoPoint[];
    driverLocation?: GeoPoint;
    customerLocation?: GeoPoint;
    desiredPickupTime: Date | null;
    clientRatingByDriver?: number;
    clientCommentByDriver?: string | null;
    createdAt: Date;
    updatedAt: Date;
    // ... autres champs
}


// --- FONCTIONS UTILITAIRES (Définies une seule fois avant le composant) ---

const convertTimestamp = (ts: any): Date | null => {
    if (ts instanceof Timestamp) return ts.toDate();
    if (ts) return new Date(ts as string); 
    return null;
};

const getStatusDisplay = (status: ReservationStatus): StatusDisplay => {
    switch (status) {
        case 'Assigned': return { text: 'Assignée', class: 'text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded' };
        case 'DriverEnRouteToPickup': return { text: 'En route vers client', class: 'text-blue-700 bg-blue-100 px-2 py-0.5 rounded' };
        case 'DriverAtPickup': return { text: 'Arrivé (Prise en charge)', class: 'text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded' };
        case 'PassengerOnBoard': return { text: 'Passager à bord (En cours)', class: 'text-green-700 bg-green-100 px-2 py-0.5 rounded' };
        case 'Completed': return { text: 'Terminée', class: 'text-red-700 bg-red-100 px-2 py-0.5 rounded' };
        case 'Cancelled': return { text: 'Annulée', class: 'text-gray-700 bg-gray-100 px-2 py-0.5 rounded' };
        default: return { text: status, class: 'text-primary' };
    }
};

// -------------------------------------------------------------------


const ReservationManagementPage = () => {
    // --- Initialisation des hooks et variables ---
    // Note: Dans next/navigation, router.query n'existe pas. On utilise les params de la page.
    // Next.js App Router passe les paramètres de route via le prop `params`.
    // Puisque c'est un Client Component, nous utilisons `useRouter` pour la navigation (`router.push`).
    const router = useRouter(); 
    // IMPORTANT : Si vous accédez à reservationId via l'URL, vous devez utiliser `useParams`
    // Si votre composant est dans `src/app/driver/track/[reservationId]/page.tsx`,
    // l'ID est accessible comme ceci dans l'App Router :
    // const params = useParams() as { reservationId: string };
    // const reservationId = params.reservationId;
    
    // Pour que le code ci-dessous fonctionne sans dépendre de useParams dans ce fichier:
    const reservationId = 'reservation_id_from_url'; // PLACEHOLDER: Remplacez par la logique d'obtention de l'ID via `useParams` (dans un Client Component, vous devez l'importer de 'next/navigation')
    
    
    // REMPLACER ces lignes par vos vrais hooks si nécessaire:
    const { user, authLoading } = { user: { uid: 'driver_id_123' }, authLoading: false }; // SIMULÉ
    const { toast } = ({} as any); // SIMULÉ
    const firestore = ({} as any); // SIMULÉ
    const MapView = ({} as any); // SIMULÉ
    const Header = ({} as any); // SIMULÉ
    const customerLocationState = ({} as any); // SIMULÉ

    // --- États locaux ---
    const [reservation, setReservation] = useState<Reservation | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [driverLocationState, setDriverLocationState] = useState<GeoPoint | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
    const [showClientRatingForm, setShowClientRatingForm] = useState<boolean>(false);
    const [clientRatingSubmitted, setClientRatingSubmitted] = useState<boolean>(false);
    const [currentClientRating, setCurrentClientRating] = useState<number>(0);
    const [currentClientComment, setCurrentClientComment] = useState<string>('');
    const [isSubmittingClientRating, setIsSubmittingClientRating] = useState<boolean>(false);


    // --- useEffect 1: ABONNEMENT FIREBASE (Lecture des données) ---
    useEffect(() => {
        if (!reservationId) {
            if (!authLoading) setIsLoading(false);
            return;
        }

        if (user && !authLoading) {
            const unsub = onSnapshot(doc(firestore, "reservations", reservationId), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as DocumentData;

                    // Vérification de l'accès 
                    if (data.driverId !== user.uid) {
                        toast({ variant: "destructive", title: "Accès refusé" });
                        setReservation(null);
                        router.push('/driver');
                        return;
                    }

                    // Correction de l'erreur 2783: Omettre l'ID du spread
                    const { _id, ...restOfData } = data; 
                    
                    const currentReservation: Reservation = {
                        id: docSnap.id,
                        ...(restOfData as Omit<Reservation, 'createdAt' | 'updatedAt' | 'desiredPickupTime' | 'id'>),
                        createdAt: convertTimestamp(data.createdAt) as Date,
                        updatedAt: convertTimestamp(data.updatedAt) as Date,
                        desiredPickupTime: convertTimestamp(data.desiredPickupTime),
                        clientCommentByDriver: data.clientCommentByDriver || null,
                    };
                    
                    if (data.driverLocation) {
                         setDriverLocationState(data.driverLocation as GeoPoint);
                    }

                    setReservation(currentReservation);
                    setError(null);

                    // Logique d'affichage du formulaire d'avis
                    if (currentReservation.status === 'Completed') {
                        if (currentReservation.clientRatingByDriver === undefined) {
                            setShowClientRatingForm(true);
                            setClientRatingSubmitted(false);
                        } else {
                            setShowClientRatingForm(false);
                            setClientRatingSubmitted(true);
                            toast({ title: "Client déjà noté", description: "Redirection vers le tableau de bord." });
                            setTimeout(() => router.push('/driver'), 1500);
                        }
                    } else if (currentReservation.status === 'Cancelled') {
                        toast({ title: "Course annulée", description: "Redirection vers le tableau de bord." });
                        router.push('/driver');
                    } else {
                        setShowClientRatingForm(false);
                    }
                } else {
                    setError("Course non trouvée.");
                    toast({ variant: "destructive", title: "Erreur", description: "Course non trouvée." });
                    setReservation(null);
                }
                setIsLoading(false);
            }, (err) => {
                console.error("Error fetching reservation:", err);
                setError("Impossible de charger les détails de la course.");
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger la course." });
                setIsLoading(false);
            });
            return () => unsub();
        } else if (!authLoading && !user) {
            setIsLoading(false);
        }
    }, [user, reservationId, toast, authLoading, router, firestore]); 


    // --- useEffect 2: SUIVI GPS (Mise à jour en temps réel) ---
    useEffect(() => {
        let watchId: number | null = null;

        const shouldStartTracking = reservation && (
            reservation.status === 'DriverEnRouteToPickup' ||
            reservation.status === 'DriverAtPickup' ||
            reservation.status === 'PassengerOnBoard'
        );

        if (user && reservationId && shouldStartTracking && 'geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    const newDriverLocation: GeoPoint = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };

                    // Vérification du mouvement significatif
                    const isSignificantMove = !driverLocationState || 
                        Math.abs(newDriverLocation.lat - driverLocationState.lat) > 0.0001 || 
                        Math.abs(newDriverLocation.lng - driverLocationState.lng) > 0.0001; 
                    
                    setDriverLocationState(newDriverLocation); 

                    if (isSignificantMove) {
                        try {
                            const reservationRef = doc(firestore, "reservations", reservationId);
                            await updateDoc(reservationRef, {
                                driverLocation: newDriverLocation,
                                updatedAt: serverTimestamp()
                            });
                        } catch (error) {
                            console.error("Error updating driver location in Firestore:", error);
                        }
                    }
                },
                (error) => {
                    console.error("Error getting driver location:", error);
                    toast({ variant: "destructive", title: "Erreur de localisation", description: "Impossible d'obtenir votre position GPS. Vérifiez les permissions." });
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
            );
        }

        return () => {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
            }
        }
    }, [user, reservationId, toast, reservation, driverLocationState, firestore]);


    // --- GESTION DES ACTIONS ---

    const handleUpdateStatus = useCallback(async (newStatus: ReservationStatus) => {
        if (!reservation) return;
        setIsUpdatingStatus(true);
        try {
            const reservationRef = doc(firestore, "reservations", reservation.id);
            await updateDoc(reservationRef, {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            toast({ title: "Statut mis à jour", description: `La course est maintenant: ${getStatusDisplay(newStatus).text}` });

            if (newStatus === 'Completed') {
                if (reservation.clientRatingByDriver === undefined) {
                    // La logique onSnapshot gérera l'affichage du formulaire
                } else {
                    router.push('/driver');
                }
            } else if (newStatus === 'Cancelled') {
                router.push('/driver');
            }
        } catch (err) {
            console.error("Error updating status:", err);
            toast({ variant: "destructive", title: "Erreur de mise à jour", description: "Impossible de mettre à jour le statut." });
        } finally {
            setIsUpdatingStatus(false);
        }
    }, [reservation, router, toast, firestore]);

    const handleClientRatingSubmit = async () => {
        if (!reservation || currentClientRating === 0) {
            toast({ variant: "destructive", title: "Note requise", description: "Veuillez sélectionner une note (nombre d'étoiles) pour le client." });
            return;
        }
        setIsSubmittingClientRating(true);
        try {
            const reservationRef = doc(firestore, "reservations", reservation.id);
            await updateDoc(reservationRef, {
                clientRatingByDriver: currentClientRating,
                clientCommentByDriver: currentClientComment.trim() || null,
                updatedAt: serverTimestamp(),
            });
            toast({ title: "Avis client soumis", description: "Merci pour votre retour sur le client !" });
            setClientRatingSubmitted(true);
            setShowClientRatingForm(false);
            setTimeout(() => router.push('/driver'), 1500);
        } catch (err) {
            console.error("Error submitting client rating:", err);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de soumettre votre avis sur le client." });
        } finally {
            setIsSubmittingClientRating(false);
        }
    };

    const formatDesiredPickupTime = (time: Date | null): string => {
        if (!time) return 'Immédiat';
        return format(time, 'Pp', { locale: fr });
    };

    const getRouteModeText = (mode: TransportMode) => {
        switch (mode) {
            case 'economy': return 'Economy';
            case 'business': return 'Business';
            case 'first_class': return '1ère Classe';
            default: return mode;
        }
    };

    const renderActionButtons = useCallback(() => {
        if (!reservation || isUpdatingStatus) {
            return <Button disabled className="w-full"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mise à jour...</Button>;
        }

        if (showClientRatingForm || clientRatingSubmitted) return null;

        switch (reservation.status) {
            case 'Assigned':
                return <Button onClick={() => handleUpdateStatus('DriverEnRouteToPickup')} className="w-full bg-green-600 hover:bg-green-700"><Play className="mr-2 h-4 w-4"/>Démarrer (En route vers client)</Button>;
            case 'DriverEnRouteToPickup':
                return <Button onClick={() => handleUpdateStatus('DriverAtPickup')} className="w-full bg-blue-600 hover:bg-blue-700"><MapPin className="mr-2 h-4 w-4"/>Arrivé au lieu de prise en charge</Button>;
            case 'DriverAtPickup':
                return <Button onClick={() => handleUpdateStatus('PassengerOnBoard')} className="w-full bg-purple-600 hover:bg-purple-700"><Users className="mr-2 h-4 w-4"/>Passager à bord</Button>;
            case 'PassengerOnBoard':
                return (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button className="w-full bg-red-600 hover:bg-red-700"><Flag className="mr-2 h-4 w-4"/>Terminer la course</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmer la fin de la course ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cela marquera la course comme terminée. Vous pourrez ensuite noter le client.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleUpdateStatus('Completed')} className="bg-red-600 hover:bg-red-700">
                                    Oui, terminer
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                );
            case 'Completed':
            case 'Cancelled':
                return <p className="text-sm text-muted-foreground font-semibold">Statut final atteint. {reservation.status === 'Completed' ? "Merci pour la course." : "La course est annulée."}</p>;
            default:
                return <p className="text-sm text-muted-foreground">Aucune action disponible pour ce statut.</p>;
        }
    }, [isUpdatingStatus, showClientRatingForm, clientRatingSubmitted, reservation, handleUpdateStatus]);


    // --- RENDERING : ÉTATS DE CHARGEMENT ET D'ERREUR ---
    if (authLoading || isLoading) {
        return (
            <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Chargement de la gestion de course...</p>
            </div>
        );
    }

    if (error || !reservation) {
        return (
            <div className="flex flex-col min-h-screen bg-background text-foreground">
                <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <Header />
                    <div className="flex flex-col items-center text-center py-10 text-destructive">
                        <AlertTriangle className="h-12 w-12 mb-3" />
                        <p className="font-semibold">{error || "Course introuvable ou accès non autorisé."}</p>
                        <Button onClick={() => router.push('/driver')} className="mt-4">Retour au tableau de bord</Button>
                    </div>
                </main>
            </div>
        );
    }

    // --- RENDERING PRINCIPAL ---
    const statusDisplay = getStatusDisplay(reservation.status);

    return (
        <div className={cn(
            "flex flex-col md:flex-row bg-background text-foreground",
            "min-h-screen md:max-h-screen md:overflow-hidden"
        )}>
            {/* Panneau de Gauche (Détails et Actions) */}
            <div className={cn(
                "w-full md:w-[420px] lg:w-[480px] p-4 sm:p-6 space-y-4 sm:space-y-6 md:overflow-y-auto md:h-screen flex-shrink-0 scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent"
            )}>
                <Header />
                <Card className="shadow-lg" style={{ border: reservation.status === 'PassengerOnBoard' ? '2px solid #34D399' : undefined }}>
                    <CardHeader>
                        <div className="flex items-center">
                            <Navigation className="h-6 w-6 mr-3 text-primary" />
                            <CardTitle className="text-xl font-headline">Gestion de Course</CardTitle>
                        </div>
                        <CardDescription>Passager : **{reservation.passengerName}**</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p><span className="font-semibold">De :</span> {reservation.pickupLocation}</p>
                        <p><span className="font-semibold">À :</span> {reservation.dropoffLocation}</p>
                        <p><span className="font-semibold">Gamme :</span> {getRouteModeText(reservation.routeMode)} (**{reservation.routeName}**)</p>
                        {reservation.desiredPickupTime && (
                            <p className="flex items-center text-sm">
                                <CalendarClock className="h-4 w-4 mr-2 text-muted-foreground" />
                                <span className="font-semibold">Départ souhaité par client :</span>&nbsp;{formatDesiredPickupTime(reservation.desiredPickupTime)}
                            </p>
                        )}
                        <p>
                            <span className="font-semibold">Statut actuel :</span>
                            <span className={cn("font-medium ml-2", statusDisplay.class)}>{statusDisplay.text}</span>
                        </p>

                        {reservation.status === 'Assigned' && reservation.assignedByManagerName && (
                            <p className="text-sm text-muted-foreground flex items-center">
                                <UserRound className="mr-2 h-4 w-4" />
                                <span className="font-semibold">Assigné par :</span> {reservation.assignedByManagerName}
                            </p>
                        )}

                        <div className="pt-4 space-y-2">
                            {renderActionButtons()}
                        </div>
                        
                        {!showClientRatingForm && !clientRatingSubmitted && (
                            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => router.push('/driver')}>
                                <LogOutIcon className="mr-2 h-4 w-4" /> Retour au tableau de bord
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Formulaire de notation du client */}
                {showClientRatingForm && !clientRatingSubmitted && (
                    <Card className="mt-6 border-amber-500">
                        <CardHeader>
                            <CardTitle className="text-xl font-headline text-amber-700 flex items-center">
                                <Star className="mr-2 h-6 w-6" /> Noter le client
                            </CardTitle>
                            <CardDescription>Comment s'est comporté(_e) **{reservation.passengerName}** ?</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="clientRating" className="text-sm font-medium">Votre note :</Label>
                                <div className="flex space-x-1 mt-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={cn(
                                                "h-7 w-7 cursor-pointer transition-colors",
                                                currentClientRating >= star ? "text-amber-500 fill-amber-500" : "text-gray-300 hover:text-amber-300"
                                            )}
                                            onClick={() => setCurrentClientRating(star)}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="clientComment" className="text-sm font-medium">Votre commentaire (optionnel) :</Label>
                                <Textarea
                                    id="clientComment"
                                    placeholder="Décrivez votre expérience avec le client..."
                                    value={currentClientComment}
                                    onChange={(_e) => setCurrentClientComment(_e.target.value)}
                                    rows={3}
                                    className="mt-1"
                                    disabled={isSubmittingClientRating}
                                />
                            </div>
                            <Button onClick={handleClientRatingSubmit} disabled={isSubmittingClientRating || currentClientRating === 0} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                                {isSubmittingClientRating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Soumettre l'avis sur le client
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Confirmation d'avis soumis */}
                {clientRatingSubmitted && (
                    <Card className="mt-4 border-green-500">
                        <CardContent className="pt-6 text-center text-green-600">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                            <p>Merci, votre avis sur le client a été enregistré.</p>
                            <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => router.push('/driver')}>
                                Retour au tableau de bord
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Panneau de Droite (Carte) */}
            <div className={cn(
                "flex-1 relative w-full bg-muted flex items-center justify-center p-4 text-center",
                "h-[50vh] md:h-auto"
            )}>
                <MapView
                    pathCoordinates={reservation.routeCoordinates || undefined}
                    driverLocation={driverLocationState}
                    customerLocation={customerLocationState}
                    pickupLocation={reservation.pickupLocation}
                    dropoffLocation={reservation.dropoffLocation}
                />
            </div>
        </div>
    );
}

export default ReservationManagementPage;