
"use client";

import * as React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hourglass, LogOut, Home, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';


export default function PendingApprovalPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast(); // Added toast
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true); // Added for profile loading

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (user && !authLoading) {
      setIsLoadingProfile(true);
      const checkUserStatus = async () => {
        try {
          const userProfileRef = doc(firestore, "userProfiles", user.uid);
          const docSnap = await getDoc(userProfileRef);
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            // If user is no longer pending, redirect them appropriately
            if (profile.role !== 'pending_driver' && profile.role !== 'pending_manager') {
              toast({ title: "Statut Mis à Jour", description: "Votre statut a changé. Redirection...", variant: "default" });
              if (profile.role === 'rejected_driver' || profile.role === 'rejected_manager') {
                router.push('/application-rejected');
              } else {
                router.push('/'); // Or to their specific dashboard
              }
            }
          } else {
            // Profile not found, maybe an error or new user not yet fully processed
            toast({ title: "Profil non trouvé", description: "Impossible de vérifier votre statut actuel.", variant: "destructive" });
            router.push('/login');
          }
        } catch (error) {
          console.error("Error checking user status:", error);
          toast({ title: "Erreur de vérification", description: "Impossible de vérifier votre statut.", variant: "destructive" });
        } finally {
          setIsLoadingProfile(false);
        }
      };
      checkUserStatus();
    }
  }, [user, authLoading, router, toast]);


  if (authLoading || isLoadingProfile) { 
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement...</p>
      </div>
    );
  }
  
  // If user is somehow null after loading, redirect (already handled by first useEffect, but good practice)
  if (!user) {
     return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Redirection...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
        <div className="w-full max-w-lg text-center mb-6">
             <Header />
        </div>
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader className="items-center">
            <Hourglass className="h-12 w-12 text-primary mb-4" />
            <CardTitle className="text-2xl font-headline text-center">Compte en Attente d'Approbation</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Merci pour votre inscription, {user?.displayName || user?.email || 'utilisateur'} !
            </p>
            <p className="text-muted-foreground">
              Votre compte est actuellement en cours de vérification par nos administrateurs.
              Cela peut prendre un peu de temps.
            </p>
            <p className="text-muted-foreground">
              Vous serez notifié(_e) ou pourrez vérifier votre statut en vous reconnectant plus tard.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-6 justify-center">
                <Button variant="outline" asChild className="w-full sm:w-auto">
                    <Link href="/">
                        <Home className="mr-2 h-4 w-4"/>
                        Page d'accueil
                    </Link>
                </Button>
                <Button onClick={logout} variant="secondary" className="w-full sm:w-auto">
                    <LogOut className="mr-2 h-4 w-4"/>
                    Se déconnecter
                </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
