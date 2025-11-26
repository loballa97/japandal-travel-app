// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions } from "firebase/functions";

// Firebase configuration from environment variables
// See .env.local.example for required variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || undefined,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

// Basic validation to help during local setup
if (typeof window !== "undefined") {
  const missing = Object.entries({
    NEXT_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
    NEXT_PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    console.warn(
      `Firebase env vars manquantes: ${missing.join(", ")}. ` +
        "Mettez à jour votre fichier .env.local (voir .env.local.example) puis redémarrez le serveur."
    );
  }
}

// Initialize Firebase
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Analytics (optional, client-side only)
if (typeof window !== "undefined") {
  import("firebase/analytics")
    .then(({ getAnalytics }) => {
      try {
        getAnalytics(app);
      } catch (_) {
        // Analytics already initialized or not available
      }
    })
    .catch(() => {
      // Ignore analytics initialization errors
    });
}

// Initialize services
export const auth: Auth = getAuth(app);
export const firestore: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

export default app;