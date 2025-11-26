
"use client";

import * as React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut, Home, Info, Edit } from 'lucide-react'; // Edit icon
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { UserProfile } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export default function ApplicationRejectedPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (user && !authLoading) {
      setIsLoadingProfile(true);
      const fetchUserProfile = async () => {
        try {
          const userProfileRef = doc(firestore, "userProfiles", user.uid);
          const docSnap = await getDoc(userProfileRef);
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            setUserProfile(profile);
            if (profile.role !== 'rejected_driver' && profile.role !== 'rejected_manager') {
              toast({ title: "Statut incorrect", description: "Votre compte n'est pas marqué comme rejeté. Redirection...", variant: "default" });
              router.push('/');
            }
          } else {
            toast({ title: "Profil non trouvé", description: "Votre profil utilisateur n'a pu être chargé.", variant: "destructive" });
            await logout(); 
            router.push('/login'); 
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          toast({ title: "Erreur de chargement", description: "Impossible de charger les détails de votre profil.", variant: "destructive" });
        } finally {
          setIsLoadingProfile(false);
        }
      };
      fetchUserProfile();
    }
  }, [user, authLoading, router, toast, logout]);

  if (authLoading || isLoadingProfile ) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement des informations...</p>
      </div>
    );
  }
  
  if (!userProfile) {
     return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <AlertTriangle className="h-12 w-12 animate-pulse text-destructive" />
        <p className="mt-4 text-muted-foreground">Profil utilisateur non disponible. Redirection...</p>
      </div>
    );
  }

  const rejectedDate = userProfile.rejectedAt 
    ? format(userProfile.rejectedAt instanceof Timestamp ? userProfile.rejectedAt.toDate() : new Date(userProfile.rejectedAt), 'PPP p', { locale: fr })
    : 'Date inconnue';

  const profileEditPath = userProfile.role === 'rejected_driver' ? '/driver/profile' : '/profile'; // Gérants rejetés iraient vers profil client pour l'instant

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
        <div className="w-full max-w-lg text-center mb-6">
          <Header />
        </div>
        <Card className="w-full max-w-lg shadow-lg border-destructive">
          <CardHeader className="items-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <CardTitle className="text-2xl font-headline text-center text-destructive">Demande d'Inscription Rejetée</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Bonjour {userProfile.displayName || userProfile.email || 'utilisateur'},
            </p>
            <p className="text-muted-foreground">
              Malheureusement, votre demande d'inscription pour le rôle de {userProfile.role === 'rejected_driver' ? 'chauffeur' : 'gérant'} a été rejetée le {rejectedDate}.
            </p>
            {userProfile.rejectionReason ? (
              <Card className="bg-secondary/50 p-4 my-4">
                <CardDescription className="text-sm text-foreground font-medium mb-1">Motif du rejet :</CardDescription>
                <p className="text-sm text-muted-foreground text-left whitespace-pre-wrap">{userProfile.rejectionReason}</p>
              </Card>
            ) : (
              <div className="flex items-center justify-center text-sm text-muted-foreground p-3 bg-secondary/30 rounded-md">
                <Info className="h-5 w-5 mr-2 text-primary"/>
                Aucun motif spécifique n'a été fourni pour le rejet.
              </div>
            )}
             <p className="text-sm text-muted-foreground">
              Vous pouvez consulter votre profil pour mettre à jour vos informations et vos documents, puis soumettre à nouveau votre demande pour validation.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-6 justify-center">
              {userProfile.role === 'rejected_driver' && (
                <Button 
                  asChild
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Link href={profileEditPath}>
                    <Edit className="mr-2 h-4 w-4" />
                    Consulter et Corriger ma Demande
                  </Link>
                </Button>
              )}
               {userProfile.role === 'rejected_manager' && (
                 <p className="text-sm text-muted-foreground p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-500 rounded-md">
                    Pour les gérants, veuillez contacter l'administration pour revoir votre demande. La resoumission automatique n'est pas encore disponible pour ce rôle.
                 </p>
               )}
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Page d'accueil
                </Link>
              </Button>
              <Button onClick={logout} variant="secondary" className="w-full sm:w-auto">
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
