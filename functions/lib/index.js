"use strict";
/**
 * Cloud Functions for JAPANDAL
 *
 * Fonctions pour la gestion de la vérification d'identité,
 * custom claims, notifications FCM, paiements Stripe, etc.
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStripeSession = exports.stripeWebhook = exports.createStripeCheckoutSession = exports.generateRidePin = exports.automatedFacialVerification = exports.onVerificationUpdated = exports.onVerificationCreated = exports.notifyUser = exports.verifyUserAndSetRole = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe_1 = require("stripe");
admin.initializeApp();
// Initialiser Stripe avec la clé secrète depuis functions.config() (fallback sur process.env pour dev local)
const stripeSecretKey = ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || process.env.STRIPE_SECRET_KEY || "";
const stripe = new stripe_1.default(stripeSecretKey, {
    apiVersion: "2025-02-24.acacia",
});
/**
 * Fonction pour définir les custom claims après validation manuelle
 *
 * Appelée par un admin pour approuver un utilisateur et définir ses claims.
 *
 * @param {string} uid - UID de l'utilisateur
 * @param {object} claims - Claims à définir (role, phoneVerified, identityStatus, vehicleStatus)
 */
exports.verifyUserAndSetRole = functions.https.onCall(async (data, context) => {
    // Vérifier que l'appelant est admin
    if (!context.auth || !context.auth.token.role ||
        (context.auth.token.role !== "admin" && context.auth.token.role !== "sub_admin")) {
        throw new functions.https.HttpsError("permission-denied", "Seuls les administrateurs peuvent effectuer cette action.");
    }
    const { uid, claims } = data;
    if (!uid || !claims) {
        throw new functions.https.HttpsError("invalid-argument", "L'UID et les claims sont requis.");
    }
    try {
        // Définir les custom claims
        await admin.auth().setCustomUserClaims(uid, claims);
        // Mettre à jour le document Firestore pour cohérence
        const updateData = {};
        if (claims.identityStatus) {
            updateData.identityStatus = claims.identityStatus;
        }
        if (claims.vehicleStatus) {
            updateData.vehicleStatus = claims.vehicleStatus;
        }
        if (claims.phoneVerified !== undefined) {
            updateData.phoneVerified = claims.phoneVerified;
        }
        if (claims.emailVerified !== undefined) {
            updateData.emailVerified = claims.emailVerified;
        }
        if (Object.keys(updateData).length > 0) {
            await admin.firestore().doc(`userProfiles/${uid}`).update(updateData);
        }
        return { success: true, message: "Custom claims définis avec succès." };
    }
    catch (error) {
        console.error("Error setting custom claims:", error);
        throw new functions.https.HttpsError("internal", "Erreur lors de la définition des claims.");
    }
});
/**
 * Fonction pour envoyer une notification FCM à un utilisateur
 *
 * @param {string} uid - UID de l'utilisateur
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
 * @param {object} data - Données additionnelles (optionnel)
 */
exports.notifyUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "L'utilisateur doit être authentifié.");
    }
    const { uid, title, body, notificationData } = data;
    if (!uid || !title || !body) {
        throw new functions.https.HttpsError("invalid-argument", "UID, titre et body sont requis.");
    }
    try {
        // Récupérer le token FCM depuis le profil utilisateur
        const userDoc = await admin.firestore().doc(`userProfiles/${uid}`).get();
        const userData = userDoc.data();
        if (!userData || !userData.fcmToken) {
            return { success: false, message: "Aucun token FCM trouvé pour cet utilisateur." };
        }
        const message = {
            notification: {
                title: title,
                body: body,
            },
            data: notificationData || {},
            token: userData.fcmToken,
        };
        await admin.messaging().send(message);
        return { success: true, message: "Notification envoyée avec succès." };
    }
    catch (error) {
        console.error("Error sending notification:", error);
        throw new functions.https.HttpsError("internal", "Erreur lors de l'envoi de la notification.");
    }
});
/**
 * Fonction déclenchée lors de la création d'une vérification
 * Notifie les admins qu'une nouvelle demande est en attente
 */
exports.onVerificationCreated = functions.firestore
    .document("verifications/{verificationId}")
    .onCreate(async (snap, context) => {
    const verification = snap.data();
    try {
        // Récupérer tous les admins
        const adminsSnapshot = await admin.firestore()
            .collection("userProfiles")
            .where("role", "in", ["admin", "sub_admin", "manager"])
            .get();
        // Créer des notifications pour chaque admin
        const notificationPromises = adminsSnapshot.docs.map((adminDoc) => {
            return admin.firestore().collection("notifications").add({
                userId: adminDoc.id,
                title: "Nouvelle demande de vérification",
                message: `${verification.userEmail} a soumis une demande de vérification d'identité.`,
                type: "verification_pending",
                isRead: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                relatedEntityId: snap.id,
            });
        });
        await Promise.all(notificationPromises);
        console.log(`Notifications envoyées aux admins pour la vérification ${snap.id}`);
    }
    catch (error) {
        console.error("Error notifying admins:", error);
    }
});
/**
 * Fonction déclenchée lors de la mise à jour d'une vérification
 * Notifie l'utilisateur du résultat (approuvé/rejeté)
 */
exports.onVerificationUpdated = functions.firestore
    .document("verifications/{verificationId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Si le statut a changé de "pending" à "verified" ou "rejected"
    if (before.status === "pending" && (after.status === "verified" || after.status === "rejected")) {
        try {
            const userId = after.userId;
            const isApproved = after.status === "verified";
            // Créer notification pour l'utilisateur
            await admin.firestore().collection("notifications").add({
                userId: userId,
                title: isApproved ? "Vérification approuvée" : "Vérification rejetée",
                message: isApproved
                    ? "Votre identité a été vérifiée avec succès. Vous pouvez maintenant utiliser toutes les fonctionnalités."
                    : `Votre demande de vérification a été rejetée. Raison: ${after.rejectionReason || "Non spécifiée"}`,
                type: isApproved ? "verification_approved" : "verification_rejected",
                isRead: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                relatedEntityId: change.after.id,
            });
            console.log(`Notification envoyée à l'utilisateur ${userId} pour vérification ${change.after.id}`);
        }
        catch (error) {
            console.error("Error notifying user:", error);
        }
    }
});
/**
 * Fonction automatique de vérification faciale (optionnel)
 * Intégration future avec Onfido, Veriff, ou AWS Rekognition
 *
 * À implémenter selon le fournisseur choisi
 */
exports.automatedFacialVerification = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "L'utilisateur doit être authentifié.");
    }
    const { selfieUrl, idFrontUrl } = data;
    if (!selfieUrl || !idFrontUrl) {
        throw new functions.https.HttpsError("invalid-argument", "Les URLs du selfie et de l'ID sont requises.");
    }
    try {
        // TODO: Implémenter l'appel à l'API de reconnaissance faciale
        // Exemple avec Onfido, Veriff, AWS Rekognition, Face++
        // Pour l'instant, simuler une vérification
        const matchScore = 0.95; // Score de correspondance (0-1)
        const threshold = 0.85; // Seuil d'acceptation
        if (matchScore >= threshold) {
            return {
                success: true,
                verified: true,
                score: matchScore,
                message: "Vérification faciale réussie.",
            };
        }
        else {
            return {
                success: true,
                verified: false,
                score: matchScore,
                message: "Vérification faciale échouée. Révision manuelle requise.",
            };
        }
    }
    catch (error) {
        console.error("Error in facial verification:", error);
        throw new functions.https.HttpsError("internal", "Erreur lors de la vérification faciale.");
    }
});
/**
 * Fonction de génération de PIN à 4 chiffres pour démarrage de course
 * Appelée lors de la création d'une réservation
 */
exports.generateRidePin = functions.firestore
    .document("reservations/{reservationId}")
    .onCreate(async (snap, context) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    try {
        await snap.ref.update({
            clientPin4: pin,
        });
        console.log(`PIN généré pour la réservation ${snap.id}: ${pin}`);
    }
    catch (error) {
        console.error("Error generating PIN:", error);
    }
});
/**
 * Créer une session de paiement Stripe Checkout
 *
 * @param {object} reservationData - Données de la réservation
 * @param {string} userId - UID de l'utilisateur
 * @returns {string} sessionId - ID de la session Stripe
 */
exports.createStripeCheckoutSession = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    // Vérifier l'authentification
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Vous devez être connecté pour créer une session de paiement.");
    }
    const { reservationData, successUrl, cancelUrl, } = data;
    if (!reservationData || !reservationData.estimatedPrice) {
        throw new functions.https.HttpsError("invalid-argument", "Les données de réservation et le prix sont requis.");
    }
    try {
        // Créer une session Stripe Checkout
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "eur",
                        product_data: {
                            name: `Trajet ${reservationData.tripDirection === "airport-to-home" ? "Aéroport → Domicile" : "Domicile → Aéroport"}`,
                            description: `${reservationData.pickupAddress} → ${reservationData.dropoffAddress}`,
                            metadata: {
                                vehicleType: reservationData.vehicleType,
                                distance: ((_a = reservationData.estimatedDistance) === null || _a === void 0 ? void 0 : _a.toString()) || "N/A",
                            },
                        },
                        unit_amount: Math.round(reservationData.estimatedPrice * 100), // Convertir en centimes
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            success_url: successUrl || `${((_b = functions.config().app) === null || _b === void 0 ? void 0 : _b.url) || process.env.APP_URL || "http://localhost:3000"}/payment-status?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${((_c = functions.config().app) === null || _c === void 0 ? void 0 : _c.url) || process.env.APP_URL || "http://localhost:3000"}/booking?canceled=true`,
            client_reference_id: context.auth.uid,
            metadata: {
                userId: context.auth.uid,
                reservationData: JSON.stringify(reservationData),
            },
        });
        return {
            sessionId: session.id,
            url: session.url,
        };
    }
    catch (error) {
        console.error("Error creating Stripe session:", error);
        throw new functions.https.HttpsError("internal", "Impossible de créer la session de paiement: " + error.message);
    }
});
/**
 * Webhook Stripe pour traiter les événements de paiement
 *
 * Appelé automatiquement par Stripe lors d'événements (paiement réussi, échoué, etc.)
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c;
    const sig = req.headers["stripe-signature"];
    if (!sig) {
        res.status(400).send("Missing stripe-signature header");
        return;
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.webhook_secret) || process.env.STRIPE_WEBHOOK_SECRET || "");
    }
    catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Traiter les événements
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            console.log("Payment succeeded for session:", session.id);
            try {
                // Récupérer les données de réservation depuis les metadata
                const userId = session.client_reference_id || ((_b = session.metadata) === null || _b === void 0 ? void 0 : _b.userId);
                const reservationDataString = (_c = session.metadata) === null || _c === void 0 ? void 0 : _c.reservationData;
                if (!userId || !reservationDataString) {
                    console.error("Missing userId or reservationData in session metadata");
                    break;
                }
                const reservationData = JSON.parse(reservationDataString);
                // Créer la réservation dans Firestore
                const reservationRef = await admin.firestore().collection("reservations").add(Object.assign(Object.assign({}, reservationData), { userId, status: "pending_assignment", paymentStatus: "paid", stripeSessionId: session.id, stripePaymentIntentId: session.payment_intent, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
                console.log("Reservation created:", reservationRef.id);
                // Notifier les managers de la nouvelle réservation
                const managersSnapshot = await admin.firestore()
                    .collection("userProfiles")
                    .where("role", "in", ["manager", "admin", "sub_admin"])
                    .get();
                const notificationPromises = managersSnapshot.docs.map((managerDoc) => {
                    return admin.firestore().collection("notifications").add({
                        userId: managerDoc.id,
                        type: "new_reservation",
                        title: "Nouvelle réservation",
                        message: `Une nouvelle réservation a été créée par ${reservationData.userEmail || "un client"}.`,
                        reservationId: reservationRef.id,
                        read: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                });
                await Promise.all(notificationPromises);
            }
            catch (error) {
                console.error("Error processing checkout.session.completed:", error);
            }
            break;
        }
        case "checkout.session.expired": {
            const session = event.data.object;
            console.log("Payment session expired:", session.id);
            // Optionnel: notifier l'utilisateur que la session a expiré
            break;
        }
        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object;
            console.log("Payment failed:", paymentIntent.id);
            // Optionnel: créer une notification d'échec de paiement
            break;
        }
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }
    res.json({ received: true });
});
/**
 * Récupérer les détails d'une session Stripe
 *
 * Utilisé sur la page de confirmation de paiement
 */
exports.getStripeSession = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    const { sessionId } = data;
    if (!sessionId) {
        throw new functions.https.HttpsError("invalid-argument", "L'ID de session est requis.");
    }
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        // Vérifier que l'utilisateur est bien le propriétaire de cette session
        if (session.client_reference_id !== context.auth.uid && ((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.userId) !== context.auth.uid) {
            throw new functions.https.HttpsError("permission-denied", "Vous n'avez pas accès à cette session.");
        }
        return {
            id: session.id,
            status: session.payment_status,
            customerEmail: session.customer_email,
            amountTotal: session.amount_total,
            currency: session.currency,
            metadata: session.metadata,
        };
    }
    catch (error) {
        console.error("Error retrieving Stripe session:", error);
        throw new functions.https.HttpsError("internal", "Impossible de récupérer la session: " + error.message);
    }
});
//# sourceMappingURL=index.js.map