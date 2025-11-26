// src/types/notification.ts
import { Timestamp } from 'firebase/firestore';

export type NotificationType = 
  | 'new_reservation'           // Nouvelle réservation pour le gérant
  | 'driver_assigned'           // Chauffeur attribué (pour le client)
  | 'driver_accepted'           // Chauffeur a accepté (pour le client)
  | 'driver_refused'            // Chauffeur a refusé (pour le gérant)
  | 'ride_started'              // Course démarrée (pour le client)
  | 'ride_completed'            // Course terminée (pour le client et chauffeur)
  | 'review_received'           // Avis reçu (pour le chauffeur)
  | 'ride_cancelled';           // Course annulée

export interface Notification {
  id: string;
  userId: string;                // Destinataire de la notification
  type: NotificationType;
  title: string;
  message: string;
  reservationId?: string;        // ID de la réservation concernée
  isRead: boolean;
  createdAt: Timestamp | Date;
  readAt?: Timestamp | Date | null;
  data?: Record<string, any>;    // Données supplémentaires
}
