# JAPANDAL - Application de Réservation de Transport

Application intelligente de réservation de transport avec gestion multi-rôles (client, chauffeur, manager, admin), vérification d'identité, paiements Stripe et suivi en temps réel.

## 🚀 Stack Technique

- **Frontend**: Next.js 14.2.33 (App Router), React 18, TypeScript, TailwindCSS
- **Backend**: Firebase (Auth, Firestore, Cloud Functions, Storage)
- **Paiements**: Stripe Checkout + Webhooks
- **Maps**: Google Maps API (Places & Routes)
- **UI**: Radix UI + shadcn/ui
- **Validation**: React Hook Form + Zod

## 📁 Structure du Projet

```
japandal/
├── src/
│   ├── app/                    # Pages Next.js (App Router)
│   │   ├── layout.tsx          # Layout principal avec providers
│   │   ├── page.tsx            # Page d'accueil
│   │   ├── signup/             # Inscription multi-rôles
│   │   ├── login/              # Connexion
│   │   ├── booking/            # Réservation de trajets
│   │   ├── payment-status/     # Confirmation de paiement
│   │   ├── verification/       # Vérification d'identité
│   │   ├── admin/              # Dashboard admin
│   │   ├── driver/             # Interface chauffeur
│   │   └── manager/            # Interface gérant
│   ├── components/
│   │   ├── CSRWrapper.tsx      # Wrapper Suspense pour useSearchParams
│   │   ├── verification/       # Composants de vérification
│   │   ├── booking/            # Composants de réservation
│   │   ├── admin/              # Composants admin
│   │   ├── layout/             # Header, Footer
│   │   └── ui/                 # Composants UI (shadcn/ui)
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Contexte d'authentification
│   │   └── GoogleMapsContext.tsx
│   ├── lib/
│   │   ├── firebase.ts         # Configuration Firebase (v9 modular)
│   │   ├── logger.ts           # Logger centralisé
│   │   ├── roles.ts            # Gestion des rôles
│   │   └── utils.ts            # Utilitaires
│   └── types/
│       ├── firestore.ts        # Types Firestore
│       └── index.ts            # Types généraux
├── functions/                  # Cloud Functions Firebase
│   ├── src/
│   │   └── index.ts            # Fonctions (Stripe, vérification, notifications)
│   ├── package.json
│   └── .env                    # Variables d'environnement (gitignored)
├── public/
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service Worker
├── firestore.rules             # Règles de sécurité Firestore
├── storage.rules               # Règles de sécurité Storage
├── firebase.json               # Configuration Firebase
├── .env.example                # Template des variables d'environnement
├── .env.local                  # Variables d'environnement locales (gitignored)
└── package.json
```

## 🔧 Installation et Configuration

### 1. Prérequis

- Node.js 20+
- npm ou yarn
- Compte Firebase (avec facturation activée)
- Clés API Google Maps
- Compte Stripe (mode test ou production)

### 2. Installation

```bash
# Cloner le projet
git clone https://github.com/loballa97/japandal-travel-app.git
cd japandal-travel-app

# Installer les dépendances
npm install

# Installer les dépendances des Cloud Functions
cd functions
npm install
cd ..
```

### 3. Configuration des Variables d'Environnement

Copier `.env.example` vers `.env.local` et remplir les valeurs :

```env
# Firebase (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key

# Stripe (Client)
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...

# Environment
NEXT_PUBLIC_ENV=development
```

**Pour Cloud Functions**, créer `functions/.env` :

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=http://localhost:3000
```

### 4. Déployer les Règles de Sécurité

```bash
firebase login
firebase use your_project_id
firebase deploy --only firestore:rules,storage:rules
```

### 5. Déployer les Cloud Functions

```bash
npm run deploy:functions
```

### 6. Configurer le Webhook Stripe

1. Aller sur https://dashboard.stripe.com/test/webhooks
2. Ajouter un endpoint : `https://us-central1-your_project_id.cloudfunctions.net/stripeWebhook`
3. Sélectionner l'événement : `checkout.session.completed`
4. Copier le secret du webhook et l'ajouter dans `functions/.env`
5. Redéployer les fonctions

## 🚀 Développement Local

```bash
# Démarrer le serveur de développement
npm run dev

# Ouvrir http://localhost:3000
```

## 🏗️ Build et Production

```bash
# Build de production
npm run build

# Démarrer le serveur de production
npm start

# Ou avec variable PORT personnalisée
PORT=8080 npm start
```

## 📦 Déploiement sur Hostinger

### Option 1: Node.js App (Recommandé pour SSR)

1. **Créer une Node.js App** dans hPanel Hostinger
2. **Configurer Git** :
   ```bash
   git remote add hostinger ssh://user@server/path/to/repo.git
   git push hostinger main
   ```
3. **Installer les dépendances** sur le serveur :
   ```bash
   npm ci --production
   ```
4. **Configurer les variables d'environnement** dans hPanel
5. **Démarrer l'application** :
   - Script de démarrage : `npm start`
   - Port : automatique via `$PORT`

### Option 2: Static Export (Si pas besoin de SSR)

```bash
# Build static
npm run build

# Upload le dossier .next/static ou out/ vers public_html
```

## 🔐 Sécurité

### Règles Firestore

Les règles de sécurité sont définies dans `firestore.rules` :

- **Clients** : peuvent créer des réservations seulement si vérifiés (phone + identité)
- **Chauffeurs** : peuvent voir et modifier leurs courses assignées
- **Managers** : accès à toutes les réservations et chauffeurs
- **Admins** : accès complet

### Règles Storage

Les règles de sécurité sont dans `storage.rules` :

- Documents organisés par : `documents/{role}/{userId}/{fileName}`
- Lecture : propriétaire, managers, admins
- Écriture : propriétaire seulement

## 🧪 Tests

```bash
# Lancer les tests
npm test

# Tests en mode watch
npm run test:watch

# Linting
npm run lint

# Formatting
npm run format
```

## 📚 Guides Complémentaires

- **[VERIFICATION_GUIDE.md](./VERIFICATION_GUIDE.md)** : Système de vérification d'identité complet
- **[STRIPE_INTEGRATION_GUIDE.md](./STRIPE_INTEGRATION_GUIDE.md)** : Intégration Stripe Checkout
- **[WORKFLOW.md](./WORKFLOW.md)** : Workflow complet des réservations

## 🔑 Cloud Functions Disponibles

- `verifyUserAndSetRole` : Définir les custom claims après vérification
- `notifyUser` : Envoyer des notifications FCM
- `onVerificationCreated` : Notification admins quand nouvelle vérification
- `onVerificationUpdated` : Notification utilisateur quand vérification traitée
- `automatedFacialVerification` : Vérification faciale (placeholder)
- `generateRidePin` : Générer un PIN pour chaque trajet
- `createStripeCheckoutSession` : Créer une session de paiement Stripe
- `stripeWebhook` : Traiter les événements Stripe (paiement confirmé)
- `getStripeSession` : Récupérer les détails d'une session de paiement

## 🛠️ Scripts Disponibles

```bash
npm run dev              # Développement local (port 3000)
npm run build            # Build production
npm start                # Serveur production
npm run lint             # Vérifier le code
npm run lint:fix         # Corriger automatiquement
npm run format           # Formater le code
npm test                 # Lancer les tests
npm run deploy:functions # Déployer les Cloud Functions
npm run deploy:rules     # Déployer les règles Firestore/Storage
npm run deploy:all       # Déploiement complet
```

## 📞 Support

Pour toute question ou problème :
- Email : reseaujapandal@gmail.com
- GitHub Issues : https://github.com/loballa97/japandal-travel-app/issues

## 📄 Licence

Propriétaire - JAPANDAL © 2025

---

**Version**: 1.0.0  
**Dernière mise à jour**: 27 novembre 2025