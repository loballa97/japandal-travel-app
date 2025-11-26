"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Star, CheckCircle2 } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

export default function ReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const reservationId = searchParams.get('reservation');
  const [reservation, setReservation] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (!reservationId) {
      router.push('/my-reservations');
      return;
    }
  }, [user, authLoading, reservationId, router]);

  useEffect(() => {
    if (user && reservationId) {
      loadReservation();
    }
  }, [user, reservationId]);

  const loadReservation = async () => {
    try {
      setLoading(true);
      const reservationRef = doc(firestore, 'reservations', reservationId!);
      const reservationSnap = await getDoc(reservationRef);

      if (!reservationSnap.exists()) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Réservation introuvable.',
        });
        router.push('/my-reservations');
        return;
      }

      const reservationData = { id: reservationSnap.id, ...reservationSnap.data() };

      // Vérifier que la réservation appartient au client
      if (reservationData.userId !== user?.uid) {
        toast({
          variant: 'destructive',
          title: 'Accès refusé',
          description: 'Cette réservation ne vous appartient pas.',
        });
        router.push('/my-reservations');
        return;
      }

      // Vérifier que la réservation est en attente d'avis
      if (reservationData.status !== 'awaiting_review' && reservationData.status !== 'completed') {
        toast({
          variant: 'destructive',
          title: 'Avis non disponible',
          description: 'Vous pouvez laisser un avis uniquement après la fin de la course.',
        });
        router.push('/my-reservations');
        return;
      }

      // Vérifier si un avis a déjà été laissé
      if (reservationData.rating && reservationData.rating > 0) {
        setSubmitted(true);
        setRating(reservationData.rating);
        setComment(reservationData.comment || '');
      }

      setReservation(reservationData);
    } catch (error: any) {
      console.error('Erreur chargement réservation:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger la réservation.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast({
        variant: 'destructive',
        title: 'Note requise',
        description: 'Veuillez attribuer une note entre 1 et 5 étoiles.',
      });
      return;
    }

    try {
      setSubmitting(true);

      const reservationRef = doc(firestore, 'reservations', reservationId!);
      await updateDoc(reservationRef, {
        rating,
        comment: comment.trim() || null,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Notifier le chauffeur de l'avis reçu
      if (reservation?.assignedDriverId) {
        try {
          const { NotificationService } = await import('@/lib/notificationService');
          await NotificationService.notifyDriverReviewReceived(
            reservation.assignedDriverId,
            reservationId!,
            rating
          );
        } catch (notifError) {
          console.error('Erreur notification chauffeur:', notifError);
        }
      }

      toast({
        title: 'Merci pour votre avis !',
        description: 'Votre évaluation a été enregistrée.',
      });

      setSubmitted(true);
      
      // Rediriger après 2 secondes
      setTimeout(() => {
        router.push('/my-reservations');
      }, 2000);

    } catch (error: any) {
      console.error('Erreur soumission avis:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible d\'enregistrer votre avis.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
        
        <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Merci pour votre avis !</h2>
              <p className="text-muted-foreground mb-6">
                Votre évaluation aide à améliorer notre service.
              </p>
              <div className="flex justify-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-8 w-8 ${
                      star <= rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              {comment && (
                <p className="text-sm text-muted-foreground italic bg-muted/50 p-4 rounded-md">
                  "{comment}"
                </p>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Header />
      </div>
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              Évaluez votre course
            </CardTitle>
            <CardDescription>
              Course #{reservation?.id.slice(-6).toUpperCase()} • {reservation?.pickupAddress} → {reservation?.dropoffAddress}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Note étoilée */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Note globale <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 justify-center py-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-10 w-10 ${
                          star <= (hoveredRating || rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {rating === 0 && 'Cliquez pour noter'}
                  {rating === 1 && 'Très insatisfait'}
                  {rating === 2 && 'Insatisfait'}
                  {rating === 3 && 'Moyen'}
                  {rating === 4 && 'Satisfait'}
                  {rating === 5 && 'Excellent'}
                </p>
              </div>

              {/* Commentaire */}
              <div className="space-y-2">
                <label htmlFor="comment" className="block text-sm font-medium">
                  Commentaire (optionnel)
                </label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Partagez votre expérience avec le chauffeur et le service..."
                  rows={5}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {comment.length}/500 caractères
                </p>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/my-reservations')}
                  disabled={submitting}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={rating === 0 || submitting}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    'Envoyer mon avis'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
