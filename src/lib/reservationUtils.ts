// src/lib/reservationUtils.ts
import type { ReservationStatus } from '@/types';

/**
 * Labels en français pour chaque statut de réservation
 */
export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending_assignment: 'En attente d\'attribution',
  driver_assigned: 'Chauffeur attribué',
  driver_accepted: 'Acceptée par le chauffeur',
  driver_refused: 'Refusée par le chauffeur',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
  awaiting_review: 'En attente d\'avis',
};

/**
 * Couleurs badge pour chaque statut
 */
export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  pending_assignment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  driver_assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  driver_accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  driver_refused: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  awaiting_review: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

/**
 * Description détaillée pour chaque statut
 */
export const RESERVATION_STATUS_DESCRIPTIONS: Record<ReservationStatus, string> = {
  pending_assignment: 'Votre réservation est en attente d\'attribution à un chauffeur par notre équipe.',
  driver_assigned: 'Un chauffeur a été attribué à votre course. En attente de son acceptation.',
  driver_accepted: 'Le chauffeur a accepté votre course. Il vous contactera bientôt.',
  driver_refused: 'Le chauffeur a refusé la course. Notre équipe vous attribuera un nouveau chauffeur.',
  in_progress: 'Votre course est en cours. Bon voyage !',
  completed: 'Votre course est terminée. Merci d\'avoir utilisé JAPANDAL !',
  cancelled: 'Cette réservation a été annulée.',
  awaiting_review: 'Course terminée. Partagez votre expérience en laissant un avis.',
};

/**
 * Workflow: transitions autorisées entre statuts
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending_assignment: ['driver_assigned', 'cancelled'],
  driver_assigned: ['driver_accepted', 'driver_refused', 'cancelled'],
  driver_refused: ['driver_assigned', 'cancelled'],
  driver_accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['awaiting_review'],
  awaiting_review: [],
  cancelled: [],
};

/**
 * Vérifie si une transition de statut est autorisée
 */
export function canTransitionTo(currentStatus: ReservationStatus, newStatus: ReservationStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Retourne les actions disponibles pour un rôle et un statut donnés
 */
export function getAvailableActions(
  status: ReservationStatus,
  role: 'customer' | 'driver' | 'manager' | 'admin'
): { label: string; action: string; newStatus: ReservationStatus }[] {
  const actions: { label: string; action: string; newStatus: ReservationStatus }[] = [];

  switch (role) {
    case 'manager':
    case 'admin':
      if (status === 'pending_assignment') {
        actions.push({ label: 'Attribuer un chauffeur', action: 'assign_driver', newStatus: 'driver_assigned' });
      }
      if (status === 'driver_refused') {
        actions.push({ label: 'Réattribuer un chauffeur', action: 'reassign_driver', newStatus: 'driver_assigned' });
      }
      actions.push({ label: 'Annuler', action: 'cancel', newStatus: 'cancelled' });
      break;

    case 'driver':
      if (status === 'driver_assigned') {
        actions.push({ label: 'Accepter', action: 'accept', newStatus: 'driver_accepted' });
        actions.push({ label: 'Refuser', action: 'refuse', newStatus: 'driver_refused' });
      }
      if (status === 'driver_accepted') {
        actions.push({ label: 'Démarrer la course', action: 'start', newStatus: 'in_progress' });
      }
      if (status === 'in_progress') {
        actions.push({ label: 'Terminer la course', action: 'complete', newStatus: 'completed' });
      }
      break;

    case 'customer':
      if (status === 'pending_assignment' || status === 'driver_assigned') {
        actions.push({ label: 'Annuler', action: 'cancel', newStatus: 'cancelled' });
      }
      if (status === 'awaiting_review') {
        actions.push({ label: 'Laisser un avis', action: 'review', newStatus: 'awaiting_review' });
      }
      break;
  }

  return actions;
}

/**
 * Calcule le prix d'une réservation selon la grille tarifaire
 */
export function calculatePrice(
  distance: number,
  vehicleType: 'economique' | 'business' | 'first-class'
): number {
  const PRICING = {
    economique: { base: 5, perKm: 1 },
    business: { base: 8, perKm: 1.5 },
    'first-class': { base: 12, perKm: 2 },
  };

  const pricing = PRICING[vehicleType];
  return pricing.base + (distance * pricing.perKm);
}
