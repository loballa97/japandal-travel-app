import { Timestamp } from 'firebase/firestore';

import { ChauffeurStatus, IdentityStatus, VehicleStatus } from './index';
import { Country } from '../lib/utils';

// Interface pour la sous-collection de documents
export interface DriverDocuments {
  carte_identite: string | null;
  permis: string | null;
  carte_vtc_licence: string | null;
  assurance: string | null;
  carte_grise: string | null;
  photo_profil: string | null;
  [key: string]: string | null; // Permet d'ajouter d'autres documents si nécessaire
}

// Interface pour la structure du document Chauffeur dans Firestore
export interface Chauffeur {
  userId: string;
  status: ChauffeurStatus;
  submittedAt?: Timestamp;
  reviewedAt?: Timestamp;
  missingDocuments?: string[];
  rejectionReason?: string;
  documents: DriverDocuments;
  notesAdmin?: string;
  plateCountry?: Country;
  licensePlate?: string;
  // Ajoutez d'autres champs spécifiques au chauffeur ici si nécessaire
}

// Type de vérification
export type VerificationType = 'identity' | 'vehicle' | 'selfie' | 'document';

// Statut de vérification
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

// Interface pour la collection verifications
export interface Verification {
  id: string; // Document ID
  userId: string; // UID de l'utilisateur
  userEmail?: string | null; // Email pour faciliter la recherche
  userRole?: string | null; // Role pour filtrage
  type: VerificationType; // Type de vérification
  status: VerificationStatus; // Statut de la vérification
  reviewerId?: string | null; // UID de l'admin/manager qui a review
  reviewerName?: string | null; // Nom du reviewer
  createdAt: Timestamp | Date; // Date de création
  reviewedAt?: Timestamp | Date | null; // Date de review
  notes?: string | null; // Notes de l'admin
  rejectionReason?: string | null; // Raison de rejet
  documentUrls?: string[]; // URLs des documents associés
  metadata?: { [key: string]: any }; // Métadonnées additionnelles
}