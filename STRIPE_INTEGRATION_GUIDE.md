# Configuration Stripe pour JAPANDAL

## 🎯 Vue d'ensemble

L'application utilise **Stripe Checkout** pour les paiements sécurisés. Les réservations ne sont créées dans Firestore qu'**après confirmation du paiement** via webhook.

---

## 📋 Étapes de Configuration

### 1. Récupérer vos clés Stripe

1. Connectez-vous à [dashboard.stripe.com](https://dashboard.stripe.com)
2. Mode **Test** (recommandé pour développement) :
   - Clé publique : `pk_test_...`
   - Clé secrète : `sk_test_...`
3. Mode **Production** (après tests) :
   - Clé publique : `pk_live_...`
   - Clé secrète : `sk_live_...`

### 2. Configuration Environnement Frontend

Fichier `.env.local` (racine du projet) :

```bash
# Déjà configuré
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_S1j0QKkNZsvmQXCLZMqL6FBqFMQUz8CK0nQ5QgzzrMn3z9LioKrWSHjPeozjUjrA98W4c8E

# ... autres variables Firebase
```

### 3. Configuration Environnement Cloud Functions

Fichier `functions/.env` (créé automatiquement) :

```bash
# À COMPLÉTER avec vos vraies clés
STRIPE_SECRET_KEY=sk_test_VOTRE_CLE_SECRETE_ICI
STRIPE_WEBHOOK_SECRET=whsec_VOTRE_WEBHOOK_SECRET_ICI
APP_URL=http://localhost:3000
```

**⚠️ IMPORTANT**: Ce fichier ne doit JAMAIS être commité (déjà dans `.gitignore`)

### 4. Installer les Dépendances Functions

```bash
cd functions
npm install
cd ..
```

### 5. Déployer les Cloud Functions

```bash
# Déployer uniquement les functions
firebase deploy --only functions

# OU déployer tout (rules + functions)
firebase deploy
```

---

## 🔄 Flux de Paiement Implémenté

```
1. Client remplit formulaire réservation → /booking
   ↓
2. Clic "Réserver" → Appel Cloud Function createStripeCheckoutSession
   ↓
3. Function crée session Stripe → Retourne URL checkout
   ↓
4. Redirection vers Stripe Checkout (paiement sécurisé)
   ↓
5. Client paie avec carte bancaire sur Stripe
   ↓
6. Stripe envoie webhook → stripeWebhook Function
   ↓
7. Function crée réservation dans Firestore + notifie managers
   ↓
8. Redirection vers /payment-status?session_id=XXX (succès)
```

---

## 🎪 Configuration Webhook Stripe

### En Développement (Local)

1. Installer Stripe CLI :
   ```bash
   # Windows (Scoop)
   scoop install stripe
   
   # Mac (Homebrew)
   brew install stripe/stripe-cli/stripe
   ```

2. Connecter Stripe CLI :
   ```bash
   stripe login
   ```

3. Écouter les webhooks localement :
   ```bash
   stripe listen --forward-to http://localhost:5001/test-ia-firestudio/us-central1/stripeWebhook
   ```

4. Copier le **webhook signing secret** affiché (commence par `whsec_`) et l'ajouter dans `functions/.env`

### En Production

1. Aller dans **Stripe Dashboard** → Developers → Webhooks
2. Cliquer **Add endpoint**
3. URL : `https://us-central1-test-ia-firestudio.cloudfunctions.net/stripeWebhook`
4. Événements à écouter :
   - `checkout.session.completed` ✅
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
5. Copier le **Signing secret** et mettre à jour `functions/.env`
6. Redéployer les functions : `firebase deploy --only functions`

---

## 🧪 Tester en Mode Test

### Cartes de test Stripe

| Carte | Résultat |
|-------|----------|
| `4242 4242 4242 4242` | ✅ Paiement réussi |
| `4000 0025 0000 3155` | ⚠️ Requiert authentification 3D Secure |
| `4000 0000 0000 9995` | ❌ Carte insuffisamment approvisionnée |
| `4000 0000 0000 0002` | ❌ Carte déclinée |

- **Date d'expiration** : N'importe quelle date future (ex: `12/34`)
- **CVC** : N'importe quel 3 chiffres (ex: `123`)
- **Code postal** : N'importe lequel (ex: `75001`)

### Workflow de test complet

1. Aller sur http://localhost:3000/booking
2. Remplir formulaire de réservation
3. Cliquer "Réserver"
4. Page Stripe Checkout s'ouvre
5. Utiliser carte test `4242 4242 4242 4242`
6. Valider le paiement
7. Vérifier redirection vers `/payment-status?session_id=...`
8. Vérifier notification "Paiement réussi"
9. Vérifier dans **Firestore** : collection `reservations` → nouveau document créé
10. Vérifier dans **Firestore** : collection `notifications` → notifications managers créées

---

## 📦 Cloud Functions Créées

### 1. `createStripeCheckoutSession`

**Type**: HTTPS Callable  
**Appelée par**: Page `/booking`  
**Paramètres**:
```typescript
{
  reservationData: {
    userId, userEmail, tripDirection, 
    pickupAddress, dropoffAddress,
    vehicleType, estimatedPrice, ...
  },
  successUrl: string,
  cancelUrl: string
}
```
**Retour**:
```typescript
{
  sessionId: string,
  url: string  // URL de redirection Stripe Checkout
}
```

### 2. `stripeWebhook`

**Type**: HTTPS Request (POST)  
**Appelée par**: Stripe (automatique)  
**Événements traités**:
- `checkout.session.completed` → Crée réservation + notifie managers
- `checkout.session.expired` → Log session expirée
- `payment_intent.payment_failed` → Log échec paiement

**Sécurité**: Vérifie signature webhook avec `STRIPE_WEBHOOK_SECRET`

### 3. `getStripeSession`

**Type**: HTTPS Callable  
**Appelée par**: Page `/payment-status`  
**Paramètres**:
```typescript
{ sessionId: string }
```
**Retour**:
```typescript
{
  id, status, customerEmail, 
  amountTotal, currency, metadata
}
```

---

## 🔒 Sécurité

### Variables Secrètes

**Ne JAMAIS exposer** ces variables côté client :
- ❌ `STRIPE_SECRET_KEY` (sk_test_... ou sk_live_...)
- ❌ `STRIPE_WEBHOOK_SECRET` (whsec_...)

**Peuvent être publiques** (côté client) :
- ✅ `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` (pk_test_... ou pk_live_...)

### Vérifications Implémentées

1. **Authentication** : Toutes les functions vérifient `context.auth`
2. **Webhook Signature** : `stripe.webhooks.constructEvent()` valide l'origine Stripe
3. **User Ownership** : `getStripeSession` vérifie que l'utilisateur est propriétaire
4. **Firestore Rules** : Création réservation uniquement si `phoneVerified && identityStatus === 'verified'`

---

## 🐛 Troubleshooting

### Erreur: "STRIPE_SECRET_KEY is not set"

**Solution**: Ajouter la clé dans `functions/.env` et redéployer :
```bash
cd functions
echo "STRIPE_SECRET_KEY=sk_test_..." >> .env
cd ..
firebase deploy --only functions
```

### Erreur: "Webhook signature verification failed"

**Solution**: 
1. Vérifier que `STRIPE_WEBHOOK_SECRET` est correct dans `functions/.env`
2. Redéployer : `firebase deploy --only functions`
3. Tester avec Stripe CLI : `stripe trigger checkout.session.completed`

### Réservation non créée après paiement

**Causes possibles**:
1. Webhook non configuré → Vérifier Stripe Dashboard → Webhooks
2. Webhook URL incorrecte → Doit pointer vers la Cloud Function
3. Erreur dans webhook → Vérifier logs : `firebase functions:log`

**Vérification**:
```bash
# Voir logs en temps réel
firebase functions:log --only stripeWebhook

# Ou dans Firebase Console
https://console.firebase.google.com/project/test-ia-firestudio/functions/logs
```

### Redirection échoue après paiement

**Solution**: Vérifier les URLs dans `createStripeCheckoutSession` :
- `successUrl` doit contenir `{CHECKOUT_SESSION_ID}` (placeholder Stripe)
- `cancelUrl` doit pointer vers une page valide

---

## 🚀 Passage en Production

### Checklist

- [ ] Récupérer clés **production** (pk_live_... et sk_live_...)
- [ ] Mettre à jour `.env.local` avec `pk_live_...`
- [ ] Mettre à jour `functions/.env` avec `sk_live_...`
- [ ] Configurer webhook production dans Stripe Dashboard
- [ ] Mettre à jour `APP_URL` dans `functions/.env` (URL de production)
- [ ] Redéployer functions : `firebase deploy --only functions`
- [ ] Tester avec vraie carte bancaire (montant faible)
- [ ] Activer alertes Stripe Dashboard pour surveiller transactions

### Variables Production

```bash
# .env.local
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_VOTRE_CLE_PUBLIQUE

# functions/.env
STRIPE_SECRET_KEY=sk_live_VOTRE_CLE_SECRETE
STRIPE_WEBHOOK_SECRET=whsec_VOTRE_SECRET_WEBHOOK_PROD
APP_URL=https://votre-domaine.com
```

---

## 📊 Monitoring

### Dashboard Stripe

- **Paiements** : https://dashboard.stripe.com/payments
- **Webhooks** : https://dashboard.stripe.com/webhooks
- **Logs** : https://dashboard.stripe.com/logs

### Firebase Console

- **Functions Logs** : https://console.firebase.google.com/project/test-ia-firestudio/functions/logs
- **Firestore Data** : https://console.firebase.google.com/project/test-ia-firestudio/firestore

### Métriques à surveiller

- Taux de réussite paiements (>95%)
- Temps réponse webhook (<2s)
- Erreurs functions (<1%)
- Sessions expirées (<10%)

---

## 📚 Ressources

- [Stripe Checkout Docs](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)

---

**Version:** 1.0.0  
**Date:** 27 novembre 2025  
**Projet:** JAPANDAL Travel App
