import { Timestamp } from 'firebase/firestore';

import { ChauffeurStatus } from './index';
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