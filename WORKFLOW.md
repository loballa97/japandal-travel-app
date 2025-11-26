# 🚗 JAPANDAL - Guide du Workflow Complet

## 📋 Vue d'ensemble

JAPANDAL est une application de réservation de trajets aéroport ↔ domicile avec gestion complète des courses, attribution de chauffeurs, et système de notifications en temps réel.

---

## 🎯 Workflow en 11 Étapes

### **Étape 1-4 : Réservation Client**

**Page : `/booking`**

1. ✅ Le client choisit :
   - Direction (Aéroport → Domicile ou inverse)
   - Adresse de départ (Google Places autocomplete)
   - Adresse d'arrivée (Google Places autocomplete)
   - Date et heure
   - Nombre de passagers
   - Type de véhicule (Économique / Business / First Class)

2. ✅ Calcul automatique :
   - Distance via Google Distance Matrix API
   - Durée estimée
   - Prix selon tarification :
     - **Économique**: 5€ base + 1€/km
     - **Business**: 8€ base + 1.5€/km
     - **First Class**: 12€ base + 2€/km

3. ✅ Paiement Stripe (simulé pour l'instant)

4. ✅ Réservation créée avec statut : `pending_assignment`
   - 🔔 **Notification → Tous les gérants** : "Nouvelle réservation"

---

### **Étape 5-6 : Attribution par le Gérant**

**Page : `/manager/assign`**

5. ✅ Le gérant voit les réservations en attente :
   - Statut : `pending_assignment` ou `driver_refused`
   - Détails : client, adresses, date, prix, véhicule

6. ✅ Le gérant attribue un chauffeur :
   - Sélection dans la liste des chauffeurs disponibles
   - Mise à jour : `driver_assigned`
   - 🔔 **Notification → Chauffeur** : "Nouvelle course attribuée"
   - 🔔 **Notification → Client** : "Chauffeur attribué"

---

### **Étape 7-8 : Acceptation/Refus par le Chauffeur**

**Page : `/driver/courses`**

7. ✅ Le chauffeur voit sa course attribuée :
   - Statut : `driver_assigned`
   - Détails complets de la course
   - Boutons : **Accepter** / **Refuser**

8. ✅ Deux scénarios :

   **A) Chauffeur ACCEPTE** :
   - Statut : `driver_accepted`
   - 🔔 **Notification → Client** : "Course confirmée par le chauffeur"

   **B) Chauffeur REFUSE** :
   - Statut : `driver_refused`
   - 🔔 **Notification → Gérants** : "Course refusée, réattribution nécessaire"
   - → Retour à l'Étape 6 (gérant réattribue)

---

### **Étape 9 : Démarrage de la Course**

**Page : `/driver/courses`**

9. ✅ Quand le chauffeur est prêt :
   - Bouton : **Démarrer la course**
   - Statut : `in_progress`
   - 🔔 **Notification → Client** : "Course démarrée, bon voyage !"

---

### **Étape 10 : Fin de la Course**

**Page : `/driver/courses`**

10. ✅ À l'arrivée à destination :
    - Bouton : **Terminer la course**
    - Statut : `awaiting_review`
    - 🔔 **Notification → Client** : "Course terminée, laissez un avis !"

---

### **Étape 11 : Avis Client**

**Page : `/review?reservation=XXX`**

11. ✅ Le client évalue la course :
    - Note : 1 à 5 étoiles ⭐
    - Commentaire optionnel (500 caractères max)
    - 🔔 **Notification → Chauffeur** : "Nouvel avis reçu : X/5 étoiles"

---

## 👥 Pages par Rôle

### 🟦 **CLIENT**

| Page | URL | Description |
|------|-----|-------------|
| Accueil | `/` | Bouton "Réserver un trajet" |
| Réservation | `/booking` | Formulaire complet avec Google Maps |
| Mes réservations | `/my-reservations` | Historique et statut en temps réel |
| Avis | `/review?reservation=XXX` | Évaluation après course |
| Profil | `/profile` | Informations personnelles |

### 🟩 **CHAUFFEUR**

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/driver` | Vue d'ensemble, statut en ligne/hors ligne |
| Mes courses | `/driver/courses` | **Accepter/Refuser/Démarrer/Terminer** |
| Profil | `/driver/profile` | Documents, véhicule, KYC |
| Historique | `/driver/history` | Courses terminées |

### 🟨 **GÉRANT DE FLOTTE**

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/manager` | Réservations en cours |
| Attribution | `/manager/assign` | **Attribuer chauffeurs aux courses** |
| Historique | `/manager/history` | Toutes les réservations passées |

### 🟥 **ADMIN**

| Page | URL | Description |
|------|-----|-------------|
| Administration | `/admin` | Gestion globale du système |

---

## 📊 Statuts de Réservation

| Statut | Couleur | Description | Qui peut agir |
|--------|---------|-------------|---------------|
| `pending_assignment` | 🟡 Jaune | En attente d'attribution | Gérant |
| `driver_assigned` | 🔵 Bleu | Chauffeur attribué | Chauffeur (accepter/refuser) |
| `driver_accepted` | 🟢 Vert | Chauffeur a accepté | Chauffeur (démarrer) |
| `driver_refused` | 🔴 Rouge | Chauffeur a refusé | Gérant (réattribuer) |
| `in_progress` | 🟣 Violet | Course en cours | Chauffeur (terminer) |
| `awaiting_review` | 🟠 Orange | En attente d'avis | Client (noter) |
| `completed` | ⚪ Gris | Terminée et notée | - |
| `cancelled` | 🔴 Rouge | Annulée | - |

---

## 🔔 Système de Notifications

### Composant UI

- **Cloche dans le Header** avec badge de compteur
- Dropdown avec 10 dernières notifications
- Écoute en temps réel (Firebase `onSnapshot`)
- Marquage automatique comme "lu" au clic

### Types de Notifications

```typescript
new_reservation      → Gérant : Nouvelle réservation créée
driver_assigned      → Client + Chauffeur : Attribution
driver_accepted      → Client : Confirmation
driver_refused       → Gérant : Refus nécessitant réattribution
ride_started         → Client : Démarrage
ride_completed       → Client : Fin de course
review_received      → Chauffeur : Avis reçu
```

### API du Service

```typescript
import { NotificationService } from '@/lib/notificationService';

// Notifier les managers
await NotificationService.notifyManagerNewReservation(null, reservationId, clientEmail, address);

// Notifier le chauffeur
await NotificationService.notifyDriverNewAssignment(driverId, reservationId, from, to);

// Notifier le client
await NotificationService.notifyClientDriverAssigned(clientId, reservationId, driverName);

// Marquer comme lu
await NotificationService.markAsRead(notificationId);
await NotificationService.markAllAsRead(userId);
```

---

## 🗄️ Collections Firestore

### `reservations`
```typescript
{
  userId: string,
  userEmail: string,
  tripDirection: 'airport-to-home' | 'home-to-airport',
  pickupAddress: string,
  dropoffAddress: string,
  date: string,
  time: string,
  passengers: number,
  vehicleType: 'economique' | 'business' | 'first-class',
  estimatedDistance: number,
  estimatedDuration: number,
  estimatedPrice: number,
  status: ReservationStatus,
  paymentStatus: 'paid' | 'pending',
  assignedDriverId?: string,
  assignedByManagerId?: string,
  rating?: number,
  comment?: string,
  createdAt: Timestamp,
  acceptedAt?: Timestamp,
  refusedAt?: Timestamp,
  startedAt?: Timestamp,
  completedAt?: Timestamp,
  reviewedAt?: Timestamp
}
```

### `notifications`
```typescript
{
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  reservationId?: string,
  isRead: boolean,
  createdAt: Timestamp,
  readAt?: Timestamp
}
```

### `userProfiles`
```typescript
{
  email: string,
  displayName: string,
  role: 'customer' | 'driver' | 'manager' | 'admin' | 'sub_admin',
  createdAt: Timestamp
}
```

### `drivers`
```typescript
{
  userId: string,
  name: string,
  details: {
    carMake: string,
    carColor: string,
    licensePlate: string
  },
  isOnline: boolean
}
```

---

## 🛡️ Règles de Sécurité Firestore

```javascript
// Réservations
- Lecture : Client propriétaire, Chauffeur assigné, Manager, Admin
- Création : Client uniquement (propre userId)
- Modification : Client (annulation), Chauffeur assigné, Manager, Admin

// Notifications
- Lecture : Utilisateur propriétaire uniquement
- Création : Manager, Admin, Système
- Modification : Utilisateur propriétaire (marquer lu)

// Drivers
- Lecture : Tous les utilisateurs connectés
- Écriture : Chauffeur propriétaire ou Admin
```

---

## 🚀 Utilisation

### Démarrer l'application
```bash
npm install
npm run dev
```

### Variables d'environnement requises
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=...
```

### Tester le workflow complet

1. **Créer un compte client** → `/signup` avec role "customer"
2. **Réserver un trajet** → `/booking`
3. **Créer un compte gérant** → `/signup` avec role "manager"
4. **Attribuer le chauffeur** → `/manager/assign`
5. **Créer un compte chauffeur** → `/signup` avec role "driver"
6. **Accepter la course** → `/driver/courses`
7. **Démarrer puis terminer** → `/driver/courses`
8. **Laisser un avis** → `/review?reservation=XXX`

---

## 📦 Fichiers Clés

| Fichier | Description |
|---------|-------------|
| `src/lib/reservationUtils.ts` | Logique workflow, labels, couleurs, actions |
| `src/lib/notificationService.ts` | Gestion complète des notifications |
| `src/types/index.ts` | Types ReservationStatus (8 statuts) |
| `src/types/notification.ts` | Types NotificationType |
| `src/app/booking/page.tsx` | Formulaire de réservation avec Maps |
| `src/app/manager/assign/page.tsx` | Attribution des chauffeurs |
| `src/app/driver/courses/page.tsx` | Interface chauffeur complète |
| `src/app/review/page.tsx` | Système d'avis client |
| `src/components/layout/NotificationBell.tsx` | Cloche de notifications |
| `firestore.rules` | Règles de sécurité |

---

## ✅ Fonctionnalités Implémentées

- ✅ Workflow en 11 étapes complet
- ✅ 8 statuts de réservation
- ✅ Tarification selon spécifications
- ✅ Google Maps (Places, Distance Matrix, Directions)
- ✅ Attribution de chauffeurs par gérant
- ✅ Acceptation/refus par chauffeur
- ✅ Démarrage/fin de course
- ✅ Système d'avis client
- ✅ Notifications temps réel (Firestore)
- ✅ Protection par rôles (Firestore Rules)
- ✅ UI responsive avec TailwindCSS
- ✅ Dark mode
- ✅ Redirection automatique selon rôle

---

## 🔮 Améliorations Futures

- ⏳ Intégration Stripe réelle (paiement)
- ⏳ Firebase Cloud Messaging (notifications push mobile)
- ⏳ Suivi GPS en temps réel
- ⏳ Chat client-chauffeur
- ⏳ Gestion de flotte (véhicules, maintenance)
- ⏳ Statistiques et analytics
- ⏳ Export des factures PDF

---

## 📄 Licence

Propriétaire - JAPANDAL © 2025
