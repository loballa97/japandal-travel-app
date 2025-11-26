
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
  | 'pending_assignment'     // Étape 5: Réservation créée, en attente d'attribution par le gérant
  | 'driver_assigned'        // Étape 7: Gérant a attribué un chauffeur
  | 'driver_accepted'        // Étape 8: Chauffeur a accepté la course
  | 'driver_refused'         // Étape 8: Chauffeur a refusé (retourne au gérant)
  | 'in_progress'            // Étape 9: Chauffeur a démarré la course
  | 'completed'              // Étape 10: Course terminée
  | 'cancelled'              // Course annulée (par client, manager ou admin)
  | 'awaiting_review';       // Étape 11: En attente d'avis client

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
  userId?: string | null; // Client ID
  managerId?: string | null; // Manager ID qui a assigné
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  routeCoordinates?: { lat: number; lng: number }[] | null;
  distanceKm?: number | null; // Distance en kilomètres
  clientPin4?: string | null; // PIN 4 chiffres pour démarrage course
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

export type IdentityStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type VehicleStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface UserDocuments {
  idFront?: string | null; // URL Storage pour pièce d'identité recto
  idBack?: string | null; // URL Storage pour pièce d'identité verso
  selfie?: string | null; // URL selfie pour reconnaissance faciale
  registrationDoc?: string | null; // Carte grise (drivers only)
  insuranceDoc?: string | null; // Assurance (drivers only)
  driverLicense?: string | null; // Permis de conduire (drivers only)
  vtcLicense?: string | null; // Licence VTC (drivers only)
  [key: string]: string | null | undefined; // Autres documents
}

export interface DriverProfileData {
  make?: string; // Marque du véhicule
  model?: string; // Modèle du véhicule
  color?: string; // Couleur du véhicule
  plate?: string; // Plaque d'immatriculation
  year?: number; // Année du véhicule
  capacity?: number; // Capacité passagers
  registrationDocUrl?: string | null; // URL carte grise
  insuranceUrl?: string | null; // URL assurance
  vtcLicenseUrl?: string | null; // URL licence VTC
}

export interface ManagerProfileData {
  companyName?: string | null; // Nom de la compagnie
  address?: string | null; // Adresse
  zone?: string | null; // Zone de gestion
}

export interface UserProfile {
  id: string; // Correspond à l'UID Firebase Auth
  email: string | null;
  displayName?: string | null;
  profilePictureUrl?: string | null;
  role: UserRole;
  photoURL?: string | null;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  lastSeen?: Timestamp | Date | null;
  rejectionReason?: string | null;
  rejectedAt?: Timestamp | Date | null;
  dateOfBirth?: Date | null;
  accountStatus?: 'active' | 'disabled_by_admin'; // Added for admin control
  disabledAt?: Timestamp | Date | null; // Timestamp when account was disabled
  phoneNumber?: string;
  country?: 'France' | 'Senegal';
  
  // Champs de vérification
  emailVerified?: boolean;
  phoneVerified?: boolean;
  identityStatus?: IdentityStatus; // Statut de vérification d'identité
  vehicleStatus?: VehicleStatus; // Statut de vérification véhicule (drivers only)
  
  // Documents
  documents?: UserDocuments;
  
  // Profils spécifiques
  driverProfile?: DriverProfileData | null;
  managerProfile?: ManagerProfileData | null;
  
  // Legacy fields (à migrer progressivement)
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
