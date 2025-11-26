/**
 * Cloud Functions for JAPANDAL
 * 
 * Fonctions pour la gestion de la vérification d'identité,
 * custom claims, notifications FCM, etc.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Fonction pour définir les custom claims après validation manuelle
 * 
 * Appelée par un admin pour approuver un utilisateur et définir ses claims.
 * 
 * @param {string} uid - UID de l'utilisateur
 * @param {object} claims - Claims à définir (role, phoneVerified, identityStatus, vehicleStatus)
 */
export const verifyUserAndSetRole = functions.https.onCall(async (data, context) => {
  // Vérifier que l'appelant est admin
  if (!context.auth || !context.auth.token.role || 
      (context.auth.token.role !== "admin" && context.auth.token.role !== "sub_admin")) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Seuls les administrateurs peuvent effectuer cette action."
    );
  }

  const { uid, claims } = data;

  if (!uid || !claims) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "L'UID et les claims sont requis."
    );
  }

  try {
    // Définir les custom claims
    await admin.auth().setCustomUserClaims(uid, claims);

    // Mettre à jour le document Firestore pour cohérence
    const updateData: any = {};
    
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
  } catch (error) {
    console.error("Error setting custom claims:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Erreur lors de la définition des claims."
    );
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
export const notifyUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "L'utilisateur doit être authentifié."
    );
  }

  const { uid, title, body, notificationData } = data;

  if (!uid || !title || !body) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "UID, titre et body sont requis."
    );
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
  } catch (error) {
    console.error("Error sending notification:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Erreur lors de l'envoi de la notification."
    );
  }
});

/**
 * Fonction déclenchée lors de la création d'une vérification
 * Notifie les admins qu'une nouvelle demande est en attente
 */
export const onVerificationCreated = functions.firestore
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
    } catch (error) {
      console.error("Error notifying admins:", error);
    }
  });

/**
 * Fonction déclenchée lors de la mise à jour d'une vérification
 * Notifie l'utilisateur du résultat (approuvé/rejeté)
 */
export const onVerificationUpdated = functions.firestore
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
      } catch (error) {
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
export const automatedFacialVerification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "L'utilisateur doit être authentifié."
    );
  }

  const { selfieUrl, idFrontUrl } = data;

  if (!selfieUrl || !idFrontUrl) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Les URLs du selfie et de l'ID sont requises."
    );
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
    } else {
      return {
        success: true,
        verified: false,
        score: matchScore,
        message: "Vérification faciale échouée. Révision manuelle requise.",
      };
    }
  } catch (error) {
    console.error("Error in facial verification:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Erreur lors de la vérification faciale."
    );
  }
});

/**
 * Fonction de génération de PIN à 4 chiffres pour démarrage de course
 * Appelée lors de la création d'une réservation
 */
export const generateRidePin = functions.firestore
  .document("reservations/{reservationId}")
  .onCreate(async (snap, context) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    
    try {
      await snap.ref.update({
        clientPin4: pin,
      });
      
      console.log(`PIN généré pour la réservation ${snap.id}: ${pin}`);
    } catch (error) {
      console.error("Error generating PIN:", error);
    }
  });
