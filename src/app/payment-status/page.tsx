"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStripe } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase'; // Assurez-vous que votre instance de Firebase Functions est exportée ici
import { useToast } from '@/hooks/use-toast';

const updateReservationStatus = httpsCallable(functions, 'updateReservationStatus'); // Supposons que vous créerez cette fonction backend

export default function PaymentStatusPage() {
  const stripe = useStripe();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'processing' | 'requires_payment_method' | 'canceled' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [updateAttempted, setUpdateAttempted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!stripe) {
      return;
    }

    const clientSecret = searchParams.get('payment_intent_client_secret');

    if (!clientSecret) {
      setStatus('error');
      setMessage('Client secret de paiement manquant.');
      return;
    }

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      if (!paymentIntent) {
        setStatus('error');
        setMessage('Impossible de récupérer l\'intention de paiement.');
        return;
      }

      setStatus(paymentIntent.status as typeof status);
      setReservationId(paymentIntent.metadata.reservationId || null);

      switch (paymentIntent.status) {
        case 'succeeded':
          setMessage('Votre paiement a réussi ! Votre réservation est confirmée.');
          // Trigger backend update for reservation status
          break;
        case 'processing':
          setMessage('Votre paiement est en cours de traitement.');
          break;
        case 'requires_payment_method':
          setMessage('Votre paiement n\'a pas abouti, veuillez réessayer.');
          break;
        case 'canceled':
          setMessage('Votre paiement a été annulé.');
          break;
        default:
          setMessage('Statut de paiement inattendu.');
          break;
      }
    }).catch(error => {
      console.error("Error retrieving payment intent:", error);
      setStatus('error');
      setMessage('Erreur lors de la vérification du statut du paiement.');
      toast({ variant: "destructive", title: "Erreur de paiement", description: "Impossible de vérifier le statut de votre paiement." });
    });
  }, [stripe, searchParams, toast]);

  // Effectuer la mise à jour de la réservation côté backend si le paiement a réussi et n'a pas déjà été tenté
  useEffect(() => {
    if (status === 'succeeded' && reservationId && !updateAttempted) {
      setUpdateAttempted(true); // Marquer la tentative pour éviter les appels multiples
      updateReservationStatus({ reservationId: reservationId, paymentStatus: status })
        .then(() => {
          toast({ title: "Réservation mise à jour", description: "Le statut de votre réservation a été mis à jour avec succès." });
        })
        .catch((error) => {
          console.error("Error updating reservation status:", error);
          toast({ variant: "destructive", title: "Erreur de mise à jour", description: "Impossible de mettre à jour le statut de votre réservation dans la base de données." });
        });
    }
  }, [status, reservationId, updateAttempted, toast]);


  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-12 w-12 animate-spin text-primary" />;
      case 'succeeded':
        return <CheckCircle2 className="h-12 w-12 text-green-500" />;
      case 'processing':
        return <Clock className="h-12 w-12 text-blue-500" />;
      case 'requires_payment_method':
        return <AlertTriangle className="h-12 w-12 text-yellow-500" />;
      case 'canceled':
        return <XCircle className="h-12 w-12 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-12 w-12 text-destructive" />;
      default:
        return <Loader2 className="h-12 w-12 animate-spin text-primary" />;
    }
  };

  const getCardClass = () => {
    switch (status) {
      case 'succeeded':
        return 'border-green-500';
      case 'requires_payment_method':
      case 'canceled':
      case 'error':
        return 'border-destructive';
      default:
        return 'border-primary';
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className={cn("w-full max-w-md text-center", getCardClass())}>
        <CardHeader className="flex flex-col items-center">
          {getStatusIcon()}
          <CardTitle className="mt-4 text-2xl font-headline">Statut du Paiement</CardTitle>
          {status === 'loading' && <CardDescription>Vérification de votre paiement en cours...</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {message && <p className="text-muted-foreground">{message}</p>}
          {status === 'succeeded' && reservationId && (
             <p className="text-sm text-muted-foreground">
                Votre réservation avec l'ID {reservationId} est maintenant confirmée.
             </p>
          )}
           {status === 'error' && (
             <p className="text-sm text-destructive">
                Veuillez contacter le support si le problème persiste.
             </p>
          )}
           {status === 'requires_payment_method' && (
             <p className="text-sm text-muted-foreground">
                Un problème est survenu lors du traitement de votre carte. Veuillez vérifier vos informations ou utiliser une autre méthode.
             </p>
          )}
           {status === 'canceled' && (
             <p className="text-sm text-muted-foreground">
                Votre paiement a été annulé. Vous pouvez essayer de réserver à nouveau.
             </p>
          )}
          {/* Vous pourriez ajouter ici un bouton pour retourner à la page d'accueil ou aux réservations */}
        </CardContent>
      </Card>
    </div>
  );
}