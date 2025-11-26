# Guide d'Implémentation - Système de Vérification d'Identité JAPANDAL

## Vue d'ensemble

Ce document décrit l'implémentation complète du système de vérification d'identité et de documents pour l'application JAPANDAL, suivant les spécifications fournies.

---

## 📋 Schéma Firestore

### Collection `userProfiles` (users)

```typescript
{
  id: string;                    // UID Firebase Auth
  email: string;
  phone: string;
  role: "customer" | "driver" | "manager" | "admin";
  
  // Vérifications
  emailVerified: boolean;
  phoneVerified: boolean;
  identityStatus: "none" | "pending" | "verified" | "rejected";
  vehicleStatus: "none" | "pending" | "verified" | "rejected"; // drivers only
  
  // Documents (URLs Storage)
  documents: {
    idFront: string;             // Pièce identité recto
    idBack: string;              // Pièce identité verso
    selfie: string;              // Selfie pour reconnaissance faciale
    registrationDoc: string;     // Carte grise (drivers)
    insuranceDoc: string;        // Assurance (drivers)
    driverLicense: string;       // Permis de conduire (drivers)
    vtcLicense: string;          // Licence VTC (drivers, optionnel)
  };
  
  // Profils spécifiques
  driverProfile: {
    make: string;                // Marque véhicule
    model: string;               // Modèle véhicule
    color: string;               // Couleur
    plate: string;               // Plaque d'immatriculation
    year: number;
    capacity: number;
  };
  
  managerProfile: {
    companyName: string;
    address: string;
    zone: string;                // Zone de gestion
  };
  
  createdAt: Timestamp;
  lastSeen: Timestamp;
}
```

### Collection `reservations` (rides)

```typescript
{
  clientId: string;
  driverId: string | null;
  managerId: string | null;
  pickup: { address: string, lat: number, lng: number };
  dropoff: { address: string, lat: number, lng: number };
  distanceKm: number;
  price: number;
  vehicleType: "economique" | "business" | "first-class";
  status: "pending_assignment" | "driver_assigned" | "driver_accepted" | 
          "driver_refused" | "in_progress" | "completed" | "cancelled" | "awaiting_review";
  clientPin4: string;            // PIN 4 chiffres pour démarrage
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection `verifications`

```typescript
{
  id: string;
  userId: string;                // UID de l'utilisateur
  userEmail: string;             // Email pour faciliter la recherche
  userRole: string;              // Role pour filtrage
  type: "identity" | "vehicle" | "selfie" | "document";
  status: "pending" | "verified" | "rejected";
  reviewerId: string | null;     // UID de l'admin qui a review
  reviewerName: string | null;
  createdAt: Timestamp;
  reviewedAt: Timestamp | null;
  notes: string | null;          // Notes internes admin
  rejectionReason: string | null; // Raison visible par l'utilisateur
  documentUrls: string[];        // URLs des documents
  metadata: {
    hasIdFront: boolean;
    hasIdBack: boolean;
    hasSelfie: boolean;
    hasRegistration: boolean;
    hasInsurance: boolean;
  };
}
```

---

## 🔒 Règles de Sécurité

### Firestore Rules (`firestore.rules`)

**Fonctions helpers implémentées:**

```javascript
// Vérifier statut téléphone
function isPhoneVerified(userId)

// Vérifier identité
function isIdentityVerified(userId)

// Vérifier véhicule (drivers)
function isVehicleVerified(userId)

// Vérifier driver prêt (identité + véhicule + téléphone)
function isDriverReady(userId)
```

**Règles principales:**

- **userProfiles**: Lecture pour propriétaire/admin/manager, écriture pour propriétaire/admin
- **reservations**: 
  - Création uniquement si `phoneVerified == true && identityStatus == 'verified'`
  - Lecture: client propriétaire, driver assigné, managers, admins
  - Update: driver vérifié peut modifier ses courses, managers peuvent assigner
- **verifications**: 
  - Lecture: propriétaire, managers, admins
  - Création: utilisateurs authentifiés
  - Update/Delete: managers, admins uniquement

### Storage Rules (`storage.rules`)

Structure: `documents/{role}/{userId}/{fileName}`

- **Lecture**: propriétaire, managers, admins
- **Écriture**: propriétaire uniquement
- **Dossier public**: lecture tous, écriture admins

---

## 📄 Composants Créés

### 1. `UploadDocument.tsx`

Composant réutilisable pour l'upload de documents vers Firebase Storage.

**Props:**
- `userId`: UID de l'utilisateur
- `userRole`: "clients" | "drivers" | "managers"
- `documentType`: Type de document (idFront, idBack, selfie, etc.)
- `label`: Label affiché
- `accept`: Types de fichiers acceptés (défaut: image/*, application/pdf)
- `currentUrl`: URL actuelle si document déjà uploadé
- `onUploadSuccess`: Callback après upload réussi

**Fonctionnalités:**
- Validation taille max 10MB
- Upload vers Storage avec path sécurisé
- Affichage progress et lien vers le document
- Gestion d'erreurs avec toasts

**Utilisation:**
```tsx
<UploadDocument
  userId={user.uid}
  userRole="drivers"
  documentType="idFront"
  label="Pièce d'identité (Recto)"
  onUploadSuccess={(url) => handleDocumentUpload("idFront", url)}
  required
/>
```

---

## 📱 Pages Créées

### 1. `/verification` - Page de Vérification Utilisateur

**Fonctionnalités:**

1. **Vérification Email**
   - Envoie email via `sendEmailVerification(user)`
   - Affichage statut vérifié/non vérifié

2. **Vérification Téléphone (OTP)**
   - Utilise `RecaptchaVerifier` + `signInWithPhoneNumber`
   - Saisie numéro de téléphone
   - Réception et validation code SMS
   - Mise à jour `phoneVerified: true` dans Firestore

3. **Upload Documents**
   - ID recto/verso (obligatoire)
   - Selfie (obligatoire)
   - Carte grise (obligatoire pour drivers)
   - Assurance (obligatoire pour drivers)
   - Permis de conduire (optionnel)
   - Licence VTC (optionnel)

4. **Soumission**
   - Validation présence documents requis
   - Mise à jour `identityStatus: "pending"` et `vehicleStatus: "pending"`
   - Création document dans collection `verifications`
   - Redirection vers `/pending-approval`

**Accès:** Utilisateurs authentifiés

---

### 2. `/admin/verifications` - Dashboard Admin

**Fonctionnalités:**

1. **Liste des Vérifications Pending**
   - Query Firestore: `where("status", "==", "pending")`
   - Affichage email, rôle, date soumission
   - Indicateurs de présence des documents

2. **Révision Manuelle**
   - Voir tous les documents uploadés
   - Champs pour notes internes
   - Champ raison de rejet (visible par utilisateur)

3. **Actions Admin**
   - **Approuver:**
     - Met à jour `verifications/{id}`: `status: "verified"`
     - Met à jour `userProfiles/{userId}`: `identityStatus: "verified"`, `vehicleStatus: "verified"` (si driver)
     - Crée notification pour l'utilisateur
   - **Rejeter:**
     - Met à jour `verifications/{id}`: `status: "rejected"`, `rejectionReason`
     - Met à jour `userProfiles/{userId}`: `identityStatus: "rejected"`, `rejectionReason`
     - Crée notification pour l'utilisateur

**Accès:** Admins, Sub-admins, Managers

---

## ☁️ Cloud Functions

### Fichiers: `functions/src/index.ts`

#### 1. `verifyUserAndSetRole` (HTTPS Callable)

Appelée par admin pour définir les custom claims après validation.

**Paramètres:**
```typescript
{
  uid: string;
  claims: {
    role: string;
    phoneVerified: boolean;
    emailVerified: boolean;
    identityStatus: "verified";
    vehicleStatus: "verified";
  }
}
```

**Actions:**
- Vérifie que l'appelant est admin
- Définit custom claims avec `setCustomUserClaims()`
- Met à jour Firestore `userProfiles/{uid}` pour cohérence

**Utilisation:**
```typescript
const functions = getFunctions();
const setRole = httpsCallable(functions, 'verifyUserAndSetRole');
await setRole({ uid: userId, claims: { ... } });
```

---

#### 2. `notifyUser` (HTTPS Callable)

Envoie notification FCM à un utilisateur.

**Paramètres:**
```typescript
{
  uid: string;
  title: string;
  body: string;
  notificationData?: object;
}
```

**Actions:**
- Récupère `fcmToken` depuis `userProfiles/{uid}`
- Envoie notification via Firebase Cloud Messaging

---

#### 3. `onVerificationCreated` (Firestore Trigger)

Déclenché à la création d'un document dans `verifications/`.

**Actions:**
- Query tous les admins/managers
- Crée notifications Firestore pour chaque admin
- Type: `"verification_pending"`

---

#### 4. `onVerificationUpdated` (Firestore Trigger)

Déclenché à la mise à jour d'un document `verifications/`.

**Actions:**
- Détecte changement de statut `pending` → `verified` ou `rejected`
- Crée notification pour l'utilisateur concerné
- Type: `"verification_approved"` ou `"verification_rejected"`

---

#### 5. `automatedFacialVerification` (HTTPS Callable)

**Placeholder** pour intégration future avec API de reconnaissance faciale.

**Fournisseurs suggérés:**
- Onfido
- Veriff
- AWS Rekognition
- Face++

**Paramètres:**
```typescript
{
  selfieUrl: string;
  idFrontUrl: string;
}
```

**Retour:**
```typescript
{
  success: boolean;
  verified: boolean;
  score: number; // 0-1
  message: string;
}
```

---

#### 6. `generateRidePin` (Firestore Trigger)

Déclenché à la création d'une réservation.

**Actions:**
- Génère PIN aléatoire 4 chiffres (1000-9999)
- Met à jour `reservations/{id}` avec `clientPin4`

---

## 🔐 AuthContext Mis à Jour

### Nouvelles Propriétés Exposées

```typescript
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;  // ✨ NOUVEAU
  customClaims: CustomClaims | null; // ✨ NOUVEAU
  loading: boolean;
  logout: () => Promise<void>;
  refreshClaims: () => Promise<void>; // ✨ NOUVEAU
}
```

### CustomClaims Interface

```typescript
interface CustomClaims {
  role?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  identityStatus?: "none" | "pending" | "verified" | "rejected";
  vehicleStatus?: "none" | "pending" | "verified" | "rejected";
}
```

### Implémentation

- **Real-time UserProfile**: `onSnapshot` sur `userProfiles/{uid}`
- **Custom Claims**: Récupérés via `getIdTokenResult()`
- **Refresh Method**: Force refresh des claims avec `getIdTokenResult(true)`

### Utilisation

```tsx
const { user, userProfile, customClaims, refreshClaims } = useAuth();

// Vérifier si driver est prêt
const isDriverReady = 
  userProfile?.phoneVerified === true &&
  userProfile?.identityStatus === 'verified' &&
  userProfile?.vehicleStatus === 'verified';

// Forcer refresh après validation admin
await refreshClaims();
```

---

## 🛡️ Protection des Routes

### Pages Protégées

#### 1. `/booking` - Création Réservation

**Condition:**
```typescript
const canCreateReservation = 
  userProfile?.phoneVerified === true &&
  userProfile?.identityStatus === 'verified';
```

**Comportement:**
- Affiche banner jaune si non vérifié
- Bouton "Compléter la vérification" → `/verification`
- Bloque soumission formulaire avec toast + redirection

---

#### 2. `/driver/courses` - Gestion Courses Chauffeur

**Condition:**
```typescript
const isDriverVerified =
  userProfile?.phoneVerified === true &&
  userProfile?.identityStatus === 'verified' &&
  userProfile?.vehicleStatus === 'verified';
```

**Comportement:**
- Redirection automatique vers `/verification` si non vérifié
- Toast explicatif

---

#### 3. `/manager/assign` - Attribution Courses Manager

**Condition:**
```typescript
const isManagerVerified =
  userProfile?.phoneVerified === true &&
  userProfile?.identityStatus === 'verified';
```

**Comportement:**
- Redirection automatique vers `/verification` si non vérifié
- Toast explicatif

---

## 🚀 Déploiement

### 1. Variables d'Environnement

Fichier `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=...
```

### 2. Déployer Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 3. Déployer Storage Rules

```bash
firebase deploy --only storage:rules
```

### 4. Installer et Déployer Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 5. Déployer Frontend

**Vercel:**
```bash
vercel --prod
```

**Firebase Hosting:**
```bash
npm run build
firebase deploy --only hosting
```

---

## 🧪 Tests Recommandés

### 1. Test Email Verification

- Créer compte
- Cliquer "Envoyer email"
- Vérifier réception
- Cliquer lien
- Vérifier `emailVerified: true` dans Firestore

### 2. Test Phone Verification

- Entrer numéro valide (+33...)
- Vérifier réception SMS
- Entrer code
- Vérifier `phoneVerified: true` dans Firestore

### 3. Test Upload Documents

- Upload ID recto/verso
- Upload selfie
- (Driver) Upload carte grise + assurance
- Vérifier URLs dans Storage
- Vérifier `documents` dans Firestore

### 4. Test Workflow Admin

- Soumettre vérification
- Vérifier création doc `verifications/`
- Vérifier notification admin
- Ouvrir `/admin/verifications`
- Approuver demande
- Vérifier `identityStatus: "verified"` dans user profile
- Vérifier notification utilisateur

### 5. Test Protection Routes

- Créer compte client non vérifié
- Aller sur `/booking`
- Vérifier banner d'avertissement
- Tenter soumettre → doit bloquer
- Compléter vérification
- Retenter → doit fonctionner

### 6. Test Custom Claims (après Functions déployées)

```typescript
const idTokenResult = await user.getIdTokenResult();
console.log(idTokenResult.claims);
// Devrait afficher: { role, phoneVerified, identityStatus, ... }
```

---

## 📊 Flux Complet Utilisateur

### Pour un Client:

1. **Inscription** → `/signup`
2. **Connexion** → `/login`
3. **Vérification** → `/verification`
   - Envoyer email vérification
   - Vérifier téléphone (OTP)
   - Upload ID recto/verso + selfie
   - Soumettre
4. **Attente** → `/pending-approval` (page à créer)
5. **Admin approuve** → Notification reçue
6. **Réservation** → `/booking` (maintenant autorisé)

### Pour un Driver:

1-5. Mêmes étapes que client
6. **Vérification véhicule** → `/verification`
   - Upload carte grise
   - Upload assurance
   - Upload permis de conduire
   - (Optionnel) Upload licence VTC
7. **Admin approuve** → `vehicleStatus: "verified"`
8. **Accepter courses** → `/driver/courses` (maintenant autorisé)

### Pour un Manager:

1-4. Mêmes étapes que client (sans documents véhicule)
5. **Admin approuve** → `identityStatus: "verified"`
6. **Assigner courses** → `/manager/assign` (maintenant autorisé)

---

## 🔄 Intégration Future

### 1. Reconnaissance Faciale Automatique

Modifier `automatedFacialVerification` pour appeler une vraie API:

**Exemple avec Onfido:**

```typescript
import { Onfido } from '@onfido/api';

const onfido = new Onfido({ apiToken: process.env.ONFIDO_API_KEY });

const check = await onfido.check.create({
  applicantId: userId,
  reportNames: ['facial_similarity_photo'],
});

if (check.result === 'consider') {
  // Auto-approve
  await updateIdentityStatus(userId, 'verified');
} else {
  // Flagged for manual review
  await updateIdentityStatus(userId, 'pending');
}
```

### 2. Firebase Cloud Messaging (FCM)

**Ajouter dans `userProfiles`:**
```typescript
{
  fcmToken: string; // Token FCM du device
}
```

**Enregistrer token côté client:**
```typescript
import { getMessaging, getToken } from "firebase/messaging";

const messaging = getMessaging();
const token = await getToken(messaging, { 
  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY 
});

await updateDoc(doc(db, 'userProfiles', user.uid), {
  fcmToken: token
});
```

**Envoyer via Cloud Function:**
```typescript
await admin.messaging().send({
  token: userFcmToken,
  notification: { title, body },
  data: { ... }
});
```

### 3. Middleware Next.js

Créer `middleware.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Vérifier custom claims côté serveur
  // Si non vérifié et path protégé → redirect
  
  const session = request.cookies.get('__session');
  
  if (!session && request.nextUrl.pathname.startsWith('/booking')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/booking', '/driver/:path*', '/manager/:path*', '/admin/:path*']
};
```

---

## 📝 Checklist de Production

- [ ] Toutes variables d'environnement définies
- [ ] Firestore Rules déployées
- [ ] Storage Rules déployées
- [ ] Cloud Functions déployées et testées
- [ ] Indexes Firestore créés (si requêtes composites)
- [ ] Monitoring activé (Firebase Console)
- [ ] Logs Functions vérifiés
- [ ] Tests E2E complets
- [ ] Documentation utilisateur créée
- [ ] Formation admin sur dashboard verifications
- [ ] Processus escalation défini (rejets, disputes)
- [ ] RGPD: Politique confidentialité mise à jour
- [ ] Backup Firestore configuré

---

## 🆘 Support & Troubleshooting

### Erreur: "Impossible de télécharger le fichier"

**Cause:** Storage Rules trop restrictives ou pas de token auth

**Solution:**
- Vérifier que `request.auth != null` dans Storage Rules
- Vérifier que l'utilisateur est connecté
- Check logs Firebase Console → Storage

### Erreur: "Permission denied" lors création réservation

**Cause:** `phoneVerified !== true` ou `identityStatus !== 'verified'`

**Solution:**
- Vérifier Firestore Rules helpers
- Vérifier que le profil user a bien ces champs
- Utiliser émulateur pour debugger: `firebase emulators:start`

### Custom Claims non synchronisés

**Cause:** Token pas refresh après validation admin

**Solution:**
```typescript
await user.getIdToken(true); // Force refresh
// OU
await refreshClaims(); // Utiliser méthode du context
```

### Documents non visibles dans admin dashboard

**Cause:** Storage Rules bloquent lecture ou URLs expirées

**Solution:**
- Vérifier Storage Rules permettent lecture pour managers
- Régénérer URLs avec `getDownloadURL()`
- Vérifier `documentUrls` dans collection `verifications`

---

## 📚 Ressources

- [Firebase Auth Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Storage Security Rules](https://firebase.google.com/docs/storage/security)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

---

**Version:** 1.0.0  
**Date:** 27 novembre 2025  
**Auteur:** GitHub Copilot  
**Projet:** JAPANDAL Travel App
