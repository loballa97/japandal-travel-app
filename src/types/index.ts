
// src/types/index.ts

import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore'; // Assurez-vous que Timestamp est importé

export enum ChauffeurStatus {
  PENDING = "pending", // Demande en attente
  APPROVED = "approved", // Accepté
  REJECTED = "rejected", // Refusé (dossier incomplet ou invalide)
  NEEDS_CORRECTION = "needs_correction" // Documents à corriger ou fournir
}

export type TransportMode = "economy" | "business" | "first_class";

export interface Route {
  id: string;
  mode: TransportMode;
  icon: LucideIcon;
  name: string;
  eta: string; // Estimated Time of Arrival, e.g., "15 min"
  cost?: number; // Cost is now a number
  description: string;
  details?: string;
  coordinates?: { lat: number; lng: number }[];
  distance?: string; // Optional: e.g., "10 km"
}

export type ReservationStatus =
  | 'Pending'             // Client a fait une demande
  | 'Assigned'            // Manager a assigné un chauffeur
  | 'DriverEnRouteToPickup'// Chauffeur a commencé le trajet vers le client
  | 'DriverAtPickup'      // Chauffeur est arrivé au lieu de prise en charge
  | 'PassengerOnBoard'    // Client est dans le véhicule
  | 'Completed'           // Trajet terminé
  | 'Cancelled';          // Trajet annulé (par client, manager ou chauffeur)

export interface DriverDetails {
  name?: string; // Nom du chauffeur
  carMake: string;
  carColor: string;
  licensePlate: string; // Plaque d'immatriculation
  driverLicenseNumber?: string; // Numéro de permis de conduire
  vehicleRegistrationNumber?: string; // Numéro de carte grise (certificat d'immatriculation)
  driverLicensePhotoURL?: string | null; // URL de la photo du permis
  vehicleRegistrationPhotoURL?: string | null; // URL de la photo de la carte grise
}

export interface Driver {
  id: string; // Firestore document ID
  name: string; // Nom du chauffeur (peut être différent du displayName du userProfile)
  details: DriverDetails;
  isOnline?: boolean; // Statut en ligne/hors ligne du chauffeur
  updatedAt?: Timestamp | Date; // Date de dernière mise à jour du document chauffeur
  driverLocation?: { lat: number; lng: number; } | null;
}

export interface Reservation {
  id: string; // Firestore document ID
  passengerName: string;
  pickupLocation: string;
  dropoffLocation: string;
  routeMode: TransportMode;
  routeName: string;
  status: ReservationStatus;
  cost?: number; // Changed to number
  desiredPickupTime?: Timestamp | Date | null; // Date et heure souhaitées pour la prise en charge
  assignedDriverId?: string | null;
  driverDetails?: DriverDetails | null;
  userId?: string | null;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  routeCoordinates?: { lat: number; lng: number }[] | null;
  rating?: number | null; // Note de 1 à 5 (client rating driver)
  comment?: string | null; // Commentaire du client (about driver)
  clientRatingByDriver?: number | null; // Note de 1 à 5 (driver rating client)
  clientCommentByDriver?: string | null; // Commentaire du chauffeur (about client)
  assignedByManagerId?: string | null;
  assignedByManagerName?: string | null;
  // Champ pour la localisation du client
  customerLocation?: { lat: number; lng: number; } | null;
  // Champ pour la localisation du chauffeur
  driverLocation?: { lat: number; lng: number; } | null;
}


// Définir UserRole une seule fois
export type UserRole =
  | "customer"
  | "driver"
  | "manager"
  | "admin"
  | "sub_admin"
  | "pending_driver"
  | "pending_manager"
  | "rejected_driver"
  | "rejected_manager";

export interface UserProfile {
  id: string; // Correspond à l'UID Firebase Auth
  email: string | null;
  displayName?: string | null;
  profilePictureUrl?: string | null;
  role: UserRole;
  photoURL?: string | null;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  rejectionReason?: string | null;
  rejectedAt?: Timestamp | Date | null;
  dateOfBirth?: Date | null;
  accountStatus?: 'active' | 'disabled_by_admin'; // Added for admin control
  disabledAt?: Timestamp | Date | null; // Timestamp when account was disabled
  phoneNumber?: string;
  country?: 'France' | 'Senegal';
  carDetails?: {
    make?: string;
    model?: string;
    color?: string;
    licensePlate?: string;
    year?: number;
    capacity?: number;
  } | null;
  driverLicense?: {
    number?: string;
    expiryDate?: Timestamp | Date | null;
    categories?: string[] | null;
  } | null;
}

export interface DriverAnnouncement {
  id: string;
  title: string;
  message: string;
  iconName?: string;
  isActive: boolean;
  createdAt: Timestamp | Date;
}

// Types for Admin Action Logging
export type AdminActionLogType =
  | 'ROLE_UPDATED'
  | 'ACCOUNT_STATUS_TOGGLED'
  | 'ANNOUNCEMENT_CREATED'
  | 'ANNOUNCEMENT_DELETED'
  | 'ANNOUNCEMENT_STATUS_TOGGLED'
  | 'RESERVATION_CANCELLED_BY_ADMIN'
  | 'USER_VERIFIED_APPROVED'
  | 'USER_VERIFIED_REJECTED'
  | 'MANAGER_PAYOUT';

export interface AdminActionLog {
  id: string; // Firestore document ID
  adminId: string;
  adminName: string; // Display name or email of the admin who performed the action
  actionType: AdminActionLogType;
  targetUserId?: string | null; // UID of the user affected
  targetUserEmail?: string | null; // Email of the user affected (for easier readability in logs)
  targetEntityId?: string | null; // e.g., announcement ID, reservation ID, or can be same as targetUserId
  description: string; // Human-readable description of the action
  timestamp: Timestamp | Date;
}
