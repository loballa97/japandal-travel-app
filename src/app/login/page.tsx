
"use client";

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { auth, firestore } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile, UserRole } from '@/types';
import { LogIn, Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';

const loginSchema = z.object({
  email: z.string().email({ message: 'Adresse e-mail invalide.' }),
  password: z.string().min(1, { message: 'Le mot de passe ne peut pas être vide.' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { user, loading: authLoading } = useAuth();

  const form = useForm<LoginFormData>({ 
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    }
  });

  React.useEffect(() => {
    if (!authLoading && user) {
      // Redirection is handled in onSubmit after role check
    }
  }, [user, authLoading, router]);

  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = userCredential.user;
      let actualRole: UserRole = 'customer'; 
      let redirectTo = '/';

      if (firebaseUser) {
        try {
          const userProfileRef = doc(firestore, "userProfiles", firebaseUser.uid);
          const docSnap = await getDoc(userProfileRef);

          if (docSnap.exists()) {
            const userProfile = docSnap.data() as UserProfile;
            actualRole = userProfile.role;
            
            if (actualRole === 'pending_driver' || actualRole === 'pending_manager') {
              toast({
                title: 'Compte en attente',
                description: 'Votre compte est en attente d\'approbation. Redirection...',
                duration: 4000,
              });
              redirectTo = '/pending-approval';
            } else if (actualRole === 'rejected_driver' || actualRole === 'rejected_manager') {
              toast({
                title: 'Demande Rejetée',
                description: 'Votre demande d\'inscription a été rejetée. Redirection...',
                duration: 4000,
              });
              redirectTo = '/application-rejected';
            } else {
              // Logic for approved roles
              switch (actualRole) {
                case 'admin':
                case 'sub_admin':
                  redirectTo = '/admin';
                  break;
                case 'driver':
                  redirectTo = '/driver';
                  break;
                case 'manager':
                  redirectTo = '/manager';
                  break;
                case 'customer':
                default:
                  redirectTo = '/'; 
                  break;
              }
              toast({
                title: 'Connexion réussie !',
                description: `Bienvenue ${userProfile.displayName || userProfile.email}. Vous allez être redirigé vers ${redirectTo}.`,
              });
            }
          } else {
            console.warn("User profile not found for UID:", firebaseUser.uid, "- defaulting to customer role and homepage.");
            redirectTo = '/'; 
            toast({
              title: 'Connexion réussie !',
              description: 'Profil non trouvé, redirection vers la page d\'accueil.',
            });
          }
        } catch (profileError) {
            console.error("Error fetching user profile:", profileError);
            toast({
              variant: 'destructive',
              title: 'Erreur de profil',
              description: 'Impossible de récupérer les informations de votre profil. Redirection par défaut.',
            });
            redirectTo = '/';
        }
      }
      router.push(redirectTo);

    } catch (error: any) {
      console.error("Error signing in:", error);
      toast({
        variant: 'destructive',
        title: 'Erreur de connexion',
        description: error.message?.includes('auth/invalid-credential')  || error.message?.includes('auth/user-not-found') || error.message?.includes('auth/wrong-password')
          ? 'Email ou mot de passe incorrect.' 
          : error.message?.includes('auth/configuration-not-found')
          ? 'Configuration Firebase incorrecte ou manquante. Veuillez vérifier vos variables d\'environnement.'
          : error.message || 'Une erreur est survenue.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading && !isSubmitting) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement...</p>
      </div>
    );
  }
   if (!authLoading && user && !isSubmitting) {
    // This state can occur briefly if user is already logged in and redirected.
    // Let the onSubmit logic handle final redirection based on role after profile fetch.
    // If not already redirecting, show a loading state.
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Vérification de la session...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
       <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 self-start w-full">
             <Header />
          </div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <LogIn className="mr-2 h-6 w-6 text-primary" />
                Se connecter
              </CardTitle>
              <CardDescription>Entrez vos identifiants pour accéder à votre compte.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}> 
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="email">Email</FormLabel>
                        <FormControl>
                          <Input
                            id="email"
                            type="email"
                            placeholder="exemple@domaine.com"
                            {...field}
                            className={form.formState.errors.email ? 'border-destructive' : ''}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="password">Mot de passe</FormLabel>
                        <FormControl>
                          <Input
                            id="password"
                            type="password"
                            placeholder="********"
                            {...field}
                            className={form.formState.errors.password ? 'border-destructive' : ''}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connexion en cours...
                      </>
                    ) : (
                      'Se connecter'
                    )}
                  </Button>
                </form>
              </Form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Pas encore de compte ?{' '}
                <Link href="/signup" className="font-semibold text-primary hover:underline">
                  S'inscrire
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
