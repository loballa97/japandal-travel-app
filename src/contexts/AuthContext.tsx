"use client";

import type { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types/index';

interface CustomClaims {
  role?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  identityStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  vehicleStatus?: 'none' | 'pending' | 'verified' | 'rejected';
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  customClaims: CustomClaims | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [customClaims, setCustomClaims] = React.useState<CustomClaims | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  // Fonction pour récupérer les custom claims
  const refreshClaims = React.useCallback(async () => {
    if (!auth.currentUser) {
      setCustomClaims(null);
      return;
    }
    
    try {
      const idTokenResult = await auth.currentUser.getIdTokenResult(true); // force refresh
      setCustomClaims(idTokenResult.claims as CustomClaims);
    } catch (error) {
      console.error("Error getting custom claims:", error);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Récupérer les custom claims
        try {
          const idTokenResult = await currentUser.getIdTokenResult();
          setCustomClaims(idTokenResult.claims as CustomClaims);
        } catch (error) {
          console.error("Error getting custom claims:", error);
        }

        // S'abonner au profil utilisateur Firestore en temps réel
        const unsubscribeProfile = onSnapshot(
          doc(db, 'userProfiles', currentUser.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
            } else {
              setUserProfile(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Error fetching user profile:", error);
            setUserProfile(null);
            setLoading(false);
          }
        );

        // Cleanup profile listener
        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
        setCustomClaims(null);
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setCustomClaims(null);
      toast({
        title: "Déconnexion réussie",
        description: "Vous avez été déconnecté.",
      });
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({
        variant: "destructive",
        title: "Erreur de déconnexion",
        description: (error instanceof Error ? error.message : "Une erreur est survenue."),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, customClaims, loading, logout, refreshClaims }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
