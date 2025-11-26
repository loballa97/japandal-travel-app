"use client";

import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Importation de l'instance auth initialisée
import { onAuthStateChanged, signOut } from 'firebase/auth'; // Fonctions SDK importées directement
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth); // Utilisation de la fonction signOut importée
      setUser(null);
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
    <AuthContext.Provider value={{ user, loading, logout }}>
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
