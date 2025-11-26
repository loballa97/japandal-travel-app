
"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Edit3, Loader2, AlertTriangle, Trash2, Settings2, ShieldQuestion, LayoutDashboard, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc, Timestamp } from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';
import { updateProfile as updateFirebaseProfile, deleteUser } from 'firebase/auth';
import type { UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import * as z from 'zod';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const profileFormSchema = z.object({
  displayName: z.string().min(2, { message: "Le nom d'affichage doit contenir au moins 2 caractères." }).max(50).optional(),
  dateOfBirth: z.date().nullable().optional(),
});
type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
      dateOfBirth: null,
    },
  });

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        setIsLoadingProfile(true);
        setProfileError(null);
        try {
          const profileDocRef = doc(firestore, 'userProfiles', user.uid);
          const docSnap = await getDoc(profileDocRef);
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            setUserProfile(profileData);

            const initialDateOfBirth = profileData.dateOfBirth instanceof Timestamp
              ? profileData.dateOfBirth.toDate()
              : (profileData.dateOfBirth instanceof Date ? profileData.dateOfBirth : null);

            form.reset({ displayName: profileData.displayName || '', dateOfBirth: initialDateOfBirth });

            if (profileData.role !== 'customer' && profileData.role !== 'admin' && profileData.role !== 'sub_admin') {
                if (profileData.role === 'driver') router.replace('/driver/profile');
                else if (profileData.role === 'manager') router.replace('/manager');
                else router.replace('/');
                if (window.location.pathname === '/profile') {
                    toast({ variant: "default", title: "Redirection", description: "Accès à votre page de profil spécifique." });
                }
            }
          } else {
            setProfileError("Profil utilisateur non trouvé. Veuillez contacter le support.");
            toast({ variant: "destructive", title: "Erreur", description: "Profil utilisateur non trouvé."});
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
          setProfileError("Impossible de charger le profil.");
          toast({ variant: "destructive", title: "Erreur de chargement", description: "Impossible de charger le profil."});
        } finally {
          setIsLoadingProfile(false);
        }
      };
      fetchProfile();
    }
  }, [user, form, toast, router]);

  const onSubmit: SubmitHandler<ProfileFormData> = async (data) => {
    if (!user) {
      toast({ variant: "destructive", title: "Erreur", description: "Utilisateur non connecté." });
      return;
    }

    const dateOfBirthToSave = data.dateOfBirth instanceof Date && !isNaN(data.dateOfBirth.getTime())
      ? data.dateOfBirth
      : null;

    form.formState.isSubmitting;
    try {
      if (auth.currentUser && data.displayName && auth.currentUser.displayName !== data.displayName) {
        await updateFirebaseProfile(auth.currentUser, { displayName: data.displayName });
      }

      const profileDocRef = doc(firestore, 'userProfiles', user.uid);
      await updateDoc(profileDocRef, {
        displayName: data.displayName || null,
        updatedAt: serverTimestamp(),
        dateOfBirth: dateOfBirthToSave,
      });

      setUserProfile(prev => prev ? { ...prev, displayName: data.displayName || null, dateOfBirth: dateOfBirthToSave, updatedAt: new Date() } : null);

      setIsEditing(false);
      toast({ title: "Profil mis à jour", description: "Vos informations ont été enregistrées." });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le profil." });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !userProfile) return;

    if (userProfile.role === 'admin' || userProfile.role === 'sub_admin') {
      toast({ variant: "destructive", title: "Action non autorisée", description: "Les administrateurs ne peuvent pas supprimer leur compte depuis cette page." });
      return;
    }

    setIsDeleting(true);
    try {
      const profileDocRef = doc(firestore, 'userProfiles', user.uid);
      await deleteDoc(profileDocRef);

      if (auth.currentUser && auth.currentUser.uid === user.uid) {
        await deleteUser(auth.currentUser);
      } else {
        throw new Error("User mismatch or not signed in for deletion.");
      }

      toast({ title: "Compte supprimé", description: "Votre compte a été supprimé avec succès." });
      await logout();
    } catch (error: any) {
      console.error("Error deleting account:", error);
      let description = "Impossible de supprimer le compte. Veuillez réessayer.";
      if (error.code === 'auth/requires-recent-login') {
        description = "Cette opération nécessite une connexion récente. Veuillez vous déconnecter et vous reconnecter avant de réessayer.";
      } else if (error.message) {
        description = error.message;
      }
      toast({ variant: "destructive", title: "Erreur de suppression", description });
    } finally {
      setIsDeleting(false);
    }
  };


  if (authLoading || (!user && !authLoading) || isLoadingProfile) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement du profil...</p>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
          <Header />
          <div className="flex flex-col items-center text-center py-10 text-destructive">
            <AlertTriangle className="h-12 w-12 mb-3" />
            <p className="font-semibold">Erreur de profil</p>
            <p className="text-sm">{profileError}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-muted-foreground">Profil non trouvé.</p>
         <Button onClick={() => router.push('/')} className="mt-4">Retour à l'accueil</Button>
      </div>
    );
  }

  const roleDisplayNames: Record<UserProfile['role'], string> = {
    customer: "Client",
    driver: "Chauffeur",
    manager: "Gérant",
    admin: "Administrateur",
    sub_admin: "Sous-Administrateur",
    pending_driver: "Chauffeur en attente",
    pending_manager: "Gérant en attente",
    rejected_driver: "Chauffeur rejeté",
    rejected_manager: "Gérant rejeté",
  };


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Header />
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Avatar className="h-24 w-24 border-2 border-primary">
                  <AvatarImage src={user?.photoURL || undefined} alt={userProfile.displayName || userProfile.email || 'User'} />
                  <AvatarFallback className="text-3xl bg-primary/20 text-primary">
                    {userProfile.displayName ? userProfile.displayName.charAt(0).toUpperCase() : (userProfile.email ? userProfile.email.charAt(0).toUpperCase() : '?')}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-2xl font-headline">Mon Profil</CardTitle>
              <CardDescription>Gérez vos informations personnelles et préférences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isEditing ? (
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="displayName" className="flex items-center mb-1">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      Nom d'affichage
                    </Label>
                    <Input
                      id="displayName"
                      {...form.register('displayName')}
                      placeholder="Votre nom ou pseudo"
                      className={form.formState.errors.displayName ? 'border-destructive' : ''}
                      disabled={form.formState.isSubmitting}
                    />
                    {form.formState.errors.displayName && (
                      <p className="text-sm text-destructive mt-1">{form.formState.errors.displayName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="dateOfBirth" className="flex items-center mb-1">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      Date de Naissance (Optionnel)
                    </Label>
                     <Popover>
                        <PopoverTrigger asChild>
                           <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !form.watch("dateOfBirth") && "text-muted-foreground",
                                form.formState.errors.dateOfBirth && "border-destructive"
                              )}
                            >
                              {form.watch("dateOfBirth") ? format(form.watch("dateOfBirth") as Date, "dd MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                         <PopoverContent className="w-auto p-0">
                           <Calendar
                              mode="single"
                              selected={form.watch("dateOfBirth") || undefined}
                              onSelect={(date) => form.setValue("dateOfBirth", date || null, {shouldDirty: true, shouldValidate: true})}
                              disabled={(date) => date > new Date() || date < new Date("1900-01-01") || form.formState.isSubmitting}
                              initialFocus
                            />
                         </PopoverContent>
                     </Popover>
                     {form.formState.errors.dateOfBirth && (
                      <p className="text-sm text-destructive mt-1">{form.formState.errors.dateOfBirth.message}</p>
                    )}
                  </div>
                  <div className="flex items-center py-2 text-sm">
                    <Mail className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground mr-1">Email (non modifiable):</span>
                    <span className="font-medium">{userProfile.email}</span>
                  </div>
                   <div className="flex items-center py-2 text-sm">
                    <ShieldQuestion className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground mr-1">Mon Rôle:</span>
                    <span className="font-medium capitalize">{roleDisplayNames[userProfile.role] || userProfile.role}</span>
                  </div>
                  <div className="flex gap-2 justify-end pt-4">
                    <Button type="button" variant="outline" onClick={() => {
                        setIsEditing(false);
                        const currentBirthDate = userProfile.dateOfBirth instanceof Timestamp
                          ? userProfile.dateOfBirth.toDate()
                          : (userProfile.dateOfBirth instanceof Date ? userProfile.dateOfBirth : null);
                        form.reset({ displayName: userProfile.displayName || '', dateOfBirth: currentBirthDate });
                    }} disabled={form.formState.isSubmitting}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enregistrer
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <Card className="p-4 sm:p-6">
                    <div className="space-y-5">
                      <div className="flex items-start">
                        <User className="mr-3 h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Nom d'affichage</p>
                          <p className="font-medium text-lg">{userProfile.displayName || <span className="italic">Non défini</span>}</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <Mail className="mr-3 h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="font-medium text-lg">{userProfile.email}</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <ShieldQuestion className="mr-3 h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Mon Rôle</p>
                          <p className="font-medium text-lg capitalize">{roleDisplayNames[userProfile.role] || userProfile.role}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 sm:p-6">
                     <div className="flex items-start">
                        <CalendarIcon className="mr-3 h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Date de Naissance</p>
                          <p className="font-medium text-lg">
                            {userProfile.dateOfBirth && (userProfile.dateOfBirth instanceof Date || userProfile.dateOfBirth instanceof Timestamp)
                              ? format(userProfile.dateOfBirth instanceof Timestamp ? userProfile.dateOfBirth.toDate() : userProfile.dateOfBirth, 'dd MMMM yyyy', { locale: fr })
                              : <span className="italic">Non définie</span>}
                          </p>
                        </div>
                      </div>
                  </Card>

                  <Button onClick={() => {
                    const currentBirthDate = userProfile.dateOfBirth instanceof Timestamp
                      ? userProfile.dateOfBirth.toDate()
                      : (userProfile.dateOfBirth instanceof Date ? userProfile.dateOfBirth : null);
                    form.reset({ displayName: userProfile.displayName || '', dateOfBirth: currentBirthDate });
                    setIsEditing(true);
                    }} className="w-full mt-4">
                    <Edit3 className="mr-2 h-4 w-4" />
                    Modifier le Profil
                  </Button>

                  {(userProfile.role === 'admin' || userProfile.role === 'sub_admin') && (
                     <Button asChild className="w-full mt-2" variant="outline">
                        <Link href="/admin">
                            <LayoutDashboard className="mr-2 h-4 w-4"/>
                            Accéder au Tableau de Bord Admin
                        </Link>
                     </Button>
                  )}
                </div>
              )}

            <Card className="mt-6">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                        <Settings2 className="mr-2 h-5 w-5 text-primary" /> Mes Préférences
                    </CardTitle>
                    <CardDescription className="text-xs">Personnalisez votre expérience (fonctionnalité à venir).</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground italic">
                        Les options de préférences seront bientôt disponibles ici.
                    </p>
                </CardContent>
            </Card>

            </CardContent>
            {(userProfile.role !== 'admin' && userProfile.role !== 'sub_admin') && (
            <CardFooter className="border-t pt-6 mt-6 flex-col items-start space-y-3">
                <h3 className="text-lg font-semibold text-destructive flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5" /> Zone de Danger
                </h3>
                <p className="text-sm text-muted-foreground">
                  La suppression de votre compte est irréversible et toutes vos données seront perdues.
                  Si vous êtes chauffeur, cela supprimera également vos informations de chauffeur.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto" disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Supprimer mon compte
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Toutes les données associées à votre compte (profil, informations chauffeur, etc.)
                        seront définitivement supprimées.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      >
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Oui, supprimer mon compte
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
