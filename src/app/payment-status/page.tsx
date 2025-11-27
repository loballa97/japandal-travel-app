"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const getStripeSession = httpsCallable(functions, 'getStripeSession');

function PaymentStatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'canceled' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const canceled = searchParams.get('canceled');

    // Paiement annulé
    if (canceled === 'true') {
      setStatus('canceled');
      setMessage('Vous avez annulé le processus de paiement.');
      return;
    }

    // Pas de session ID
    if (!sessionId) {
      setStatus('error');
      setMessage('ID de session manquant.');
      return;
    }

    // Récupérer les détails de la session
    const fetchSession = async () => {
      try {
        const result = await getStripeSession({ sessionId });
        const data = result.data as any;
        
        setSessionData(data);

        if (data.status === 'paid') {
          setStatus('succeeded');
          setMessage('Votre paiement a réussi ! Votre réservation est confirmée.');
          
          toast({
            title: "Paiement réussi",
            description: "Votre réservation est maintenant confirmée.",
          });
        } else {
          setStatus('error');
          setMessage('Le paiement n\'a pas été confirmé.');
        }
      } catch (error: any) {
        console.error('Error fetching session:', error);
        setStatus('error');
        setMessage(error.message || 'Impossible de récupérer les informations de paiement.');
        
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de vérifier le statut du paiement.",
        });
      }
    };

    fetchSession();
  }, [searchParams, toast]);


  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-12 w-12 animate-spin text-primary" />;
      case 'succeeded':
        return <CheckCircle2 className="h-12 w-12 text-green-500" />;
      case 'canceled':
        return <XCircle className="h-12 w-12 text-yellow-500" />;
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
      case 'canceled':
        return 'border-yellow-500';
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
          
          {status === 'succeeded' && sessionData && (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✓ Votre réservation est maintenant en attente d'attribution à un chauffeur.
                  Vous recevrez une notification dès qu'un chauffeur sera assigné.
                </p>
              </div>
              
              <div className="text-sm space-y-1 text-muted-foreground">
                <p><strong>Montant payé:</strong> {(sessionData.amountTotal / 100).toFixed(2)} {sessionData.currency?.toUpperCase()}</p>
                {sessionData.customerEmail && <p><strong>Email:</strong> {sessionData.customerEmail}</p>}
                <p className="text-xs opacity-70">ID de session: {sessionData.id}</p>
              </div>
            </div>
          )}
          
          {status === 'error' && (
            <p className="text-sm text-destructive">
              Veuillez contacter le support si le problème persiste.
            </p>
          )}
          
          {status === 'canceled' && (
            <p className="text-sm text-muted-foreground">
              Votre réservation n'a pas été créée. Vous pouvez retourner à la page de réservation pour réessayer.
            </p>
          )}
          
          {/* Boutons d'action */}
          <div className="flex flex-col gap-2 pt-4">
            {status === 'succeeded' && (
              <>
                <Button asChild className="w-full">
                  <Link href="/my-reservations">Voir mes réservations</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/">Retour à l'accueil</Link>
                </Button>
              </>
            )}
            {(status === 'error' || status === 'canceled') && (
              <>
                <Button asChild className="w-full">
                  <Link href="/booking">Réessayer</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/">Retour à l'accueil</Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentStatusPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <PaymentStatusContent />
    </Suspense>
  );
}