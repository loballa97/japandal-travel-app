// src/lib/roles.ts
import type { UserRole } from '@/types';

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  customer: 'Client',
  driver: 'Chauffeur',
  manager: 'Gérant',
  admin: 'Admin',
  sub_admin: 'Sous-Admin',
  pending_driver: 'Chauffeur en attente',
  pending_manager: 'Gérant en attente',
  rejected_driver: 'Chauffeur Rejeté',
  rejected_manager: 'Gérant Rejeté',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  customer: 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200',
  driver: 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200',
  manager: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200',
  admin: 'bg-pink-100 text-pink-700 dark:bg-pink-800 dark:text-pink-200',
  sub_admin: 'bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200',
  pending_driver: 'bg-orange-100 text-orange-700 dark:bg-orange-800 dark:text-orange-200',
  pending_manager: 'bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200',
  rejected_driver: 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200',
  rejected_manager: 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200',
};

// Optionnel: une couleur par défaut si le rôle n'est pas trouvé
export const DEFAULT_ROLE_COLOR = 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200';

// Optionnel: un nom par défaut si le rôle n'est pas trouvé
export const DEFAULT_ROLE_DISPLAY_NAME = 'Rôle inconnu';
