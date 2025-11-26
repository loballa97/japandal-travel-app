
"use client";

import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LogoutPage() {
  const { logout, user, loading: authLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    // Assurez-vous que l'état d'authentification est résolu avant d'agir
    if (!authLoading) {
      if (user) {
        // Si l'utilisateur est connecté, exécutez la déconnexion
        logout().then(() => {
          // Après la déconnexion réussie (gérée dans AuthContext), redirigez
          router.replace('/login');
        }).catch(error => {
          // Gérer les erreurs de déconnexion si nécessaire, bien que AuthContext le fasse déjà
          console.error("Erreur lors de la tentative de déconnexion depuis la page logout:", error);
          router.replace('/login'); // Rediriger même en cas d'erreur pour éviter une boucle
        });
      } else {
        // Si l'utilisateur est déjà déconnecté, redirigez simplement
        router.replace('/login');
      }
    }
  }, [logout, user, authLoading, router]);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-lg text-muted-foreground">Déconnexion en cours...</p>
    </div>
  );
}
