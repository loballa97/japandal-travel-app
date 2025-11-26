// src/lib/notificationService.ts
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import type { NotificationType } from '@/types/notification';

/**
 * Service de gestion des notifications
 */
export class NotificationService {
  
  /**
   * Crée une notification pour un utilisateur
   */
  static async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    reservationId?: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    try {
      await addDoc(collection(firestore, 'notifications'), {
        userId,
        type,
        title,
        message,
        reservationId: reservationId || null,
        isRead: false,
        createdAt: serverTimestamp(),
        readAt: null,
        data: additionalData || null,
      });
    } catch (error) {
      console.error('Erreur création notification:', error);
      throw error;
    }
  }

  /**
   * Notifie le gérant d'une nouvelle réservation
   */
  static async notifyManagerNewReservation(
    managerId: string | null,
    reservationId: string,
    clientEmail: string,
    pickupAddress: string
  ): Promise<void> {
    // Si pas de manager spécifique, notifier tous les managers et admins
    if (!managerId) {
      const managers = await this.getAllManagersAndAdmins();
      for (const manager of managers) {
        await this.createNotification(
          manager.id,
          'new_reservation',
          'Nouvelle réservation',
          `${clientEmail} a réservé un trajet depuis ${pickupAddress}`,
          reservationId
        );
      }
    } else {
      await this.createNotification(
        managerId,
        'new_reservation',
        'Nouvelle réservation',
        `${clientEmail} a réservé un trajet depuis ${pickupAddress}`,
        reservationId
      );
    }
  }

  /**
   * Notifie le client qu'un chauffeur a été attribué
   */
  static async notifyClientDriverAssigned(
    clientId: string,
    reservationId: string,
    driverName: string
  ): Promise<void> {
    await this.createNotification(
      clientId,
      'driver_assigned',
      'Chauffeur attribué',
      `${driverName} a été attribué à votre course. En attente de son acceptation.`,
      reservationId
    );
  }

  /**
   * Notifie le chauffeur qu'une course lui a été attribuée
   */
  static async notifyDriverNewAssignment(
    driverId: string,
    reservationId: string,
    pickupAddress: string,
    dropoffAddress: string
  ): Promise<void> {
    await this.createNotification(
      driverId,
      'driver_assigned',
      'Nouvelle course attribuée',
      `Course: ${pickupAddress} → ${dropoffAddress}. Acceptez ou refusez dans l'application.`,
      reservationId
    );
  }

  /**
   * Notifie le client que le chauffeur a accepté
   */
  static async notifyClientDriverAccepted(
    clientId: string,
    reservationId: string,
    driverName: string
  ): Promise<void> {
    await this.createNotification(
      clientId,
      'driver_accepted',
      'Course confirmée',
      `${driverName} a accepté votre course. Il vous contactera bientôt.`,
      reservationId
    );
  }

  /**
   * Notifie le gérant que le chauffeur a refusé
   */
  static async notifyManagerDriverRefused(
    reservationId: string,
    driverName: string,
    clientEmail: string
  ): Promise<void> {
    const managers = await this.getAllManagersAndAdmins();
    for (const manager of managers) {
      await this.createNotification(
        manager.id,
        'driver_refused',
        'Course refusée par le chauffeur',
        `${driverName} a refusé la course de ${clientEmail}. Réattribution nécessaire.`,
        reservationId
      );
    }
  }

  /**
   * Notifie le client que la course a démarré
   */
  static async notifyClientRideStarted(
    clientId: string,
    reservationId: string,
    driverName: string
  ): Promise<void> {
    await this.createNotification(
      clientId,
      'ride_started',
      'Course démarrée',
      `${driverName} a démarré votre course. Bon voyage !`,
      reservationId
    );
  }

  /**
   * Notifie le client que la course est terminée
   */
  static async notifyClientRideCompleted(
    clientId: string,
    reservationId: string
  ): Promise<void> {
    await this.createNotification(
      clientId,
      'ride_completed',
      'Course terminée',
      `Votre course est terminée. N'oubliez pas de laisser un avis !`,
      reservationId
    );
  }

  /**
   * Notifie le chauffeur qu'il a reçu un avis
   */
  static async notifyDriverReviewReceived(
    driverId: string,
    reservationId: string,
    rating: number
  ): Promise<void> {
    await this.createNotification(
      driverId,
      'review_received',
      'Nouvel avis reçu',
      `Vous avez reçu une note de ${rating}/5 étoiles.`,
      reservationId
    );
  }

  /**
   * Récupère tous les managers et admins
   */
  private static async getAllManagersAndAdmins(): Promise<{ id: string }[]> {
    try {
      const usersRef = collection(firestore, 'userProfiles');
      const q = query(
        usersRef,
        where('role', 'in', ['manager', 'admin', 'sub_admin'])
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id }));
    } catch (error) {
      console.error('Erreur récupération managers:', error);
      return [];
    }
  }

  /**
   * Marque une notification comme lue
   */
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(firestore, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erreur marquage notification:', error);
      throw error;
    }
  }

  /**
   * Marque toutes les notifications d'un utilisateur comme lues
   */
  static async markAllAsRead(userId: string): Promise<void> {
    try {
      const notificationsRef = collection(firestore, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      const snapshot = await getDocs(q);
      
      const updatePromises = snapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          isRead: true,
          readAt: serverTimestamp(),
        })
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Erreur marquage toutes notifications:', error);
      throw error;
    }
  }
}
