
"use client";

import * as React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Edit3, Loader2, AlertTriangle, CarIcon, Trash2, ShieldCheck, FileText, Paperclip, X, Camera, RefreshCw, Link as LinkIcon } from 'lucide-react'; // Added RefreshCw, LinkIcon
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc, Timestamp } from 'firebase/firestore';
import { firestore, auth, storage } from '@/lib/firebase'; 
import { updateProfile as updateFirebaseProfile, deleteUser } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'; 
import type { UserProfile, Driver, DriverDetails } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
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
import { Alert, AlertDescription as AlertDescUI } from "@/components/ui/alert"; 
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import NextLink from 'next/link';

const profileFormSchema = z.object({
  displayName: z.string().min(2, { message: "Le nom d'affichage doit contenir au moins 2 caractères." }).max(50).optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const isPdfUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  try {
    // Check for .pdf in the path or the Firebase Storage content type marker for PDF in the query params
    // Firebase storage URLs for PDFs often include 'application%2Fpdf' in the token or metadata if ContentType was set to application/pdf on upload
    const GCS_PDF_CONTENT_TYPE_MARKER = 'application%2Fpdf';
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.pdf') || url.includes(GCS_PDF_CONTENT_TYPE_MARKER);
  } catch (_e) {
    // Invalid URL
    return false;
  }
};

export default function DriverProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [driverData, setDriverData] = React.useState<DriverDetails | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const [driverLicenseFile, setDriverLicenseFile] = React.useState<File | null>(null);
  const [driverLicensePreview, setDriverLicensePreview] = React.useState<string | null>(null);
  const [vehicleRegistrationFile, setVehicleRegistrationFile] = React.useState<File | null>(null);
  const [vehicleRegistrationPreview, setVehicleRegistrationPreview] = React.useState<string | null>(null);
  const [isUploadingDocs, setIsUploadingDocs] = React.useState(false);

  const [newPhotoFile, setNewPhotoFile] = React.useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = React.useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
  const photoFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isResubmitting, setIsResubmitting] = React.useState(false);


  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
    },
  });

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (user) {
      const fetchProfileAndDriverData = async () => {
        setIsLoadingProfile(true);
        setProfileError(null);
        try {
          const profileDocRef = doc(firestore, 'userProfiles', user.uid);
          const profileSnap = await getDoc(profileDocRef);
          if (profileSnap.exists()) {
            const profileData = profileSnap.data() as UserProfile;
            setUserProfile(profileData);
            form.reset({ displayName: profileData.displayName || '' });
            if (profileData.role !== 'driver' && profileData.role !== 'rejected_driver') {
                setProfileError("Accès non autorisé à cette page de profil.");
                toast({ variant: "destructive", title: "Erreur", description: "Vous n'êtes pas autorisé ici."});
                router.push('/'); 
                return;
            }
          } else {
            setProfileError("Profil utilisateur non trouvé.");
            toast({ variant: "destructive", title: "Erreur", description: "Profil utilisateur non trouvé."});
            return;
          }

          const driverDocRef = doc(firestore, 'drivers', user.uid);
          const driverSnap = await getDoc(driverDocRef);
          if (driverSnap.exists()) {
            const driverFullData = driverSnap.data() as Driver;
            setDriverData(driverFullData.details);
          } else {
            if (userProfile?.role !== 'rejected_driver') {
                console.warn("Driver details not found for UID:", user.uid);
            }
          }

        } catch (error) {
          console.error("Error fetching profile/driver data:", error);
          setProfileError("Impossible de charger les informations.");
          toast({ variant: "destructive", title: "Erreur de chargement", description: "Impossible de charger les informations du profil."});
        } finally {
          setIsLoadingProfile(false);
        }
      };
      fetchProfileAndDriverData();
    }
  }, [user, form, toast, router, userProfile?.role]); 

  const onSubmit: SubmitHandler<ProfileFormData> = async (data) => {
    if (!user || !userProfile) return;
    form.formState.isSubmitting; 
    try {
      if (auth.currentUser && data.displayName && auth.currentUser.displayName !== data.displayName) {
        await updateFirebaseProfile(auth.currentUser, { displayName: data.displayName });
      }
      const profileDocRef = doc(firestore, 'userProfiles', user.uid);
      await updateDoc(profileDocRef, {
        displayName: data.displayName || null,
        updatedAt: serverTimestamp(),
      });
      setUserProfile(prev => prev ? { ...prev, displayName: data.displayName || null, updatedAt: new Date() } : null);
      
      const driverDocRef = doc(firestore, 'drivers', user.uid);
      const driverSnap = await getDoc(driverDocRef);
      if (driverSnap.exists()) { 
        await updateDoc(driverDocRef, {
            name: data.displayName || userProfile.email || 'Chauffeur',
            updatedAt: serverTimestamp(),
        });
      }
      setIsEditing(false);
      toast({ title: "Profil mis à jour", description: "Vos informations ont été enregistrées." });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le profil." });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const driverDocRef = doc(firestore, 'drivers', user.uid);
      const driverSnap = await getDoc(driverDocRef);
      if(driverSnap.exists()) {
        await deleteDoc(driverDocRef);
      }

      const profileDocRef = doc(firestore, 'userProfiles', user.uid);
      await deleteDoc(profileDocRef);

      if (auth.currentUser && auth.currentUser.uid === user.uid) {
        await deleteUser(auth.currentUser);
      } else {
        throw new Error("User mismatch or not signed in for deletion.");
      }
      
      toast({ title: "Compte supprimé", description: "Votre compte chauffeur a été supprimé avec succès." });
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

  const handleFileChange = (_event: React.ChangeEvent<HTMLInputElement>, type: 'license' | 'registration') => {
    const file = _event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        toast({ title: "Fichier trop volumineux", description: `Le document ne doit pas dépasser 5MB.`, variant: "destructive" });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
        toast({ title: "Type de fichier invalide", description: "Veuillez sélectionner un fichier JPEG, PNG, WebP ou PDF.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'license') {
          setDriverLicenseFile(file);
          setDriverLicensePreview(reader.result as string);
        } else {
          setVehicleRegistrationFile(file);
          setVehicleRegistrationPreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else {
      if (type === 'license') {
        setDriverLicenseFile(null);
        setDriverLicensePreview(null);
      } else {
        setVehicleRegistrationFile(null);
        setVehicleRegistrationPreview(null);
      }
    }
  };

  const clearPreview = (type: 'license' | 'registration') => {
    if (type === 'license') {
      setDriverLicenseFile(null);
      setDriverLicensePreview(null);
      const input = document.getElementById('driverLicensePhotoInput') as HTMLInputElement;
      if (input) input.value = '';
    } else {
      setVehicleRegistrationFile(null);
      setVehicleRegistrationPreview(null);
      const input = document.getElementById('vehicleRegistrationPhotoInput') as HTMLInputElement;
      if (input) input.value = '';
    }
  };

  React.useEffect(() => {
    return () => {
      if (driverLicensePreview?.startsWith('blob:')) URL.revokeObjectURL(driverLicensePreview);
      if (vehicleRegistrationPreview?.startsWith('blob:')) URL.revokeObjectURL(vehicleRegistrationPreview);
      if (newPhotoPreview?.startsWith('blob:')) URL.revokeObjectURL(newPhotoPreview);
    };
  }, [driverLicensePreview, vehicleRegistrationPreview, newPhotoPreview]);

  const handleUploadDocuments = async () => {
    if (!user || (!driverLicenseFile && !vehicleRegistrationFile)) {
      toast({ title: "Aucun fichier sélectionné", description: "Veuillez sélectionner au moins un fichier à téléverser."});
      return;
    }
    setIsUploadingDocs(true);
    
    const driverDocRef = doc(firestore, "drivers", user.uid);
    const detailUpdates: Partial<DriverDetails> = {};
    let licenseUploaded = false;
    let registrationUploaded = false;

    try {
      if (driverLicenseFile) {
        const licenseRef = storageRef(storage, `driver-documents/${user.uid}/driver-license/${driverLicenseFile.name}`);
        const uploadResult = await uploadBytes(licenseRef, driverLicenseFile);
        detailUpdates.driverLicensePhotoURL = await getDownloadURL(uploadResult.ref);
        licenseUploaded = true;
      }
      if (vehicleRegistrationFile) {
        const registrationRef = storageRef(storage, `driver-documents/${user.uid}/vehicle-registration/${vehicleRegistrationFile.name}`);
        const uploadResult = await uploadBytes(registrationRef, vehicleRegistrationFile);
        detailUpdates.vehicleRegistrationPhotoURL = await getDownloadURL(uploadResult.ref);
        registrationUploaded = true;
      }
      
      const driverSnap = await getDoc(driverDocRef);
      const currentDriverData = driverSnap.exists() ? (driverSnap.data() as Driver) : null;
      const existingDetails = currentDriverData?.details || {};


      if (Object.keys(detailUpdates).length > 0) {
        await updateDoc(driverDocRef, {
            details: {
                ...existingDetails, 
                ...detailUpdates       
            },
            updatedAt: serverTimestamp()
        }, { merge: true }); 

        setDriverData(prev => {
            const newDetails = { ...(prev || {}), ...detailUpdates };
            return newDetails as DriverDetails;
        });
      }
      
      let successMessage = "Document(s) téléversé(s) avec succès :";
      if (licenseUploaded) successMessage += " Permis";
      if (registrationUploaded) successMessage += (licenseUploaded ? " et " : "") + " Carte Grise";
      successMessage += ".";

      toast({ title: "Téléversement Réussi", description: successMessage });
      
      if (licenseUploaded) clearPreview('license');
      if (registrationUploaded) clearPreview('registration');

    } catch (error) {
        console.error("Error uploading documents:", error);
        toast({ variant: "destructive", title: "Erreur de Téléversement", description: "Impossible de téléverser le(s) document(s)." });
    } finally {
        setIsUploadingDocs(false);
    }
  };

  const handlePhotoFileChange = (_event: React.ChangeEvent<HTMLInputElement>) => {
    const file = _event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { 
        toast({ title: "Fichier trop volumineux", description: "La photo de profil ne doit pas dépasser 2MB.", variant: "destructive" });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast({ title: "Type de fichier invalide", description: "Veuillez sélectionner un fichier JPEG, PNG, ou WebP.", variant: "destructive" });
        return;
      }
      setNewPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setNewPhotoFile(null);
      setNewPhotoPreview(null);
    }
  };

  const handleUploadProfilePhoto = async () => {
    if (!newPhotoFile || !user || !auth.currentUser) {
      toast({ title: "Aucune photo sélectionnée ou utilisateur non connecté", variant: "destructive" });
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const photoRef = storageRef(storage, `profile-pictures/${user.uid}/${newPhotoFile.name}`);
      const uploadResult = await uploadBytes(photoRef, newPhotoFile);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      await updateFirebaseProfile(auth.currentUser, { photoURL: downloadURL });

      const profileDocRef = doc(firestore, 'userProfiles', user.uid);
      await updateDoc(profileDocRef, {
        photoURL: downloadURL,
        updatedAt: serverTimestamp(),
      });
      
      setUserProfile(prev => prev ? { ...prev, photoURL: downloadURL } : null);
      
      toast({ title: "Photo de profil mise à jour !" });
      setNewPhotoFile(null);
      setNewPhotoPreview(null);
    } catch (error) {
      console.error("Error uploading profile photo:", error);
      toast({ title: "Erreur de téléversement", description: "Impossible de mettre à jour la photo.", variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleResubmitForValidation = async () => {
    if (!user || !userProfile || userProfile.role !== 'rejected_driver') return;
    
    const hasLicense = driverData?.driverLicensePhotoURL;
    const hasRegistration = driverData?.vehicleRegistrationPhotoURL;

    if (!hasLicense || !hasRegistration) {
        toast({
            variant: "destructive",
            title: "Documents Manquants",
            description: "Veuillez téléverser une photo de votre permis ET de votre carte grise avant de soumettre à nouveau votre demande."
        });
        return;
    }


    setIsResubmitting(true);
    try {
        const profileDocRef = doc(firestore, 'userProfiles', user.uid);
        await updateDoc(profileDocRef, {
            role: 'pending_driver',
            rejectionReason: null,
            rejectedAt: null,
            updatedAt: serverTimestamp(),
        });
        toast({ title: "Demande Resoumise", description: "Votre demande a été soumise à nouveau pour validation." });
        router.push('/pending-approval');
    } catch (error) {
        console.error("Error resubmitting application:", error);
        toast({ variant: "destructive", title: "Erreur de resoumission", description: "Impossible de soumettre à nouveau votre demande." });
    } finally {
        setIsResubmitting(false);
    }
  };


  if (authLoading || (!user && !authLoading) || isLoadingProfile) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement du profil chauffeur...</p>
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
        <p className="mt-4 text-muted-foreground">Profil chauffeur non trouvé.</p>
         <Button onClick={() => router.push('/')} className="mt-4">Retour à l'accueil</Button>
      </div>
    );
  }

  const renderDetailItem = (icon: React.ReactNode, label: string, value?: string | null) => {
    return (
      <div className="flex items-start py-2 border-b border-border/50 last:border-b-0">
        <div className="flex items-center w-1/3 text-primary">
          {icon}
          <span className="ml-2 text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="w-2/3">
          <p className="text-sm font-medium text-foreground">{value || <span className="italic text-muted-foreground">Non défini</span>}</p>
        </div>
      </div>
    );
  };
  
  const isRejectedDriver = userProfile.role === 'rejected_driver';
  const rejectedDate = userProfile.rejectedAt instanceof Timestamp ? format(userProfile.rejectedAt.toDate(), 'PPP p', { locale: fr }) : (userProfile.rejectedAt ? format(new Date(userProfile.rejectedAt), 'PPP p', { locale: fr }) : 'Date inconnue');


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Header />
        <div className="max-w-2xl mx-auto space-y-6">
          {isRejectedDriver && (
            <Alert variant="destructive" className="border-destructive/70 bg-destructive/10">
              <AlertTriangle className="h-5 w-5 !text-destructive" />
              <AlertDescUI className="!text-destructive">
                <strong className="font-semibold">Votre demande a été rejetée le {rejectedDate}.</strong><br/>
                {userProfile.rejectionReason ? (
                  <>Motif : {userProfile.rejectionReason}<br/></>
                ) : "Aucun motif spécifique fourni."}
                Veuillez vérifier et mettre à jour vos informations et documents ci-dessous, puis soumettez à nouveau votre demande.
              </AlertDescUI>
            </Alert>
          )}

          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="relative flex justify-center mb-4">
                <Avatar className="h-24 w-24 border-2 border-primary">
                  <AvatarImage src={newPhotoPreview || userProfile.photoURL || user?.photoURL || undefined} alt={userProfile.displayName || userProfile.email || 'User'} />
                  <AvatarFallback className="text-3xl bg-primary/20 text-primary">
                    {userProfile.displayName ? userProfile.displayName.charAt(0).toUpperCase() : (userProfile.email ? userProfile.email.charAt(0).toUpperCase() : '?')}
                  </AvatarFallback>
                </Avatar>
                <Button variant="outline" size="icon" className="absolute bottom-0 right-1/2 translate-x-[calc(100%+1rem)] h-8 w-8 rounded-full bg-background" onClick={() => photoFileInputRef.current?.click()}>
                  <Camera className="h-4 w-4" />
                  <span className="sr-only">Changer la photo</span>
                </Button>
                <input type="file" accept="image/jpeg,image/png,image/webp" ref={photoFileInputRef} onChange={handlePhotoFileChange} className="hidden" />
              </div>
              {newPhotoPreview && newPhotoFile && (
                <div className="flex flex-col items-center gap-2 mt-2">
                   <p className="text-xs text-muted-foreground">Aperçu de la nouvelle photo.</p>
                  <Button onClick={handleUploadProfilePhoto} size="sm" disabled={isUploadingPhoto} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    {isUploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    Enregistrer la nouvelle photo
                  </Button>
                </div>
              )}
              <CardTitle className="text-2xl font-headline mt-2">Profil Chauffeur</CardTitle>
              <CardDescription>Gérez vos informations personnelles et de chauffeur.</CardDescription>
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
                  <div className="flex items-center mb-4">
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Email :</span>
                    <span className="ml-2 text-sm text-muted-foreground">{userProfile.email}</span>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => {
                        setIsEditing(false);
                        form.reset({ displayName: userProfile.displayName || '' }); 
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
                  {renderDetailItem(<User className="h-5 w-5" />, "Nom d'affichage", userProfile.displayName)}
                  {renderDetailItem(<Mail className="h-5 w-5" />, "Email", userProfile.email)}
                  <div className="flex items-center py-2">
                     <p className="text-xs text-muted-foreground">Rôle : <span className="font-medium capitalize text-foreground">{userProfile.role}</span></p>
                  </div>

                  {driverData && (
                    <Card className="p-4 bg-secondary/50 rounded-md">
                      <CardTitle className="text-lg mb-3 flex items-center border-b pb-2">
                        <CarIcon className="mr-2 h-5 w-5 text-primary" />
                        Informations Chauffeur & Véhicule
                      </CardTitle>
                      <div className="space-y-1">
                        {renderDetailItem(<CarIcon className="h-4 w-4"/>, "Marque Véhicule", driverData.carMake)}
                        {renderDetailItem(<CarIcon className="h-4 w-4"/>, "Couleur Véhicule", driverData.carColor)}
                        {renderDetailItem(<FileText className="h-4 w-4"/>, "Plaque Immat.", driverData.licensePlate)}
                        {renderDetailItem(<ShieldCheck className="h-4 w-4"/>, "N° Permis", driverData.driverLicenseNumber)}
                        
                        <div className="py-2 border-b border-border/50">
                          <Label className="text-sm font-medium text-muted-foreground">Photo Permis (actuelle) :</Label>
                          {isPdfUrl(driverData.driverLicensePhotoURL) ? (
                            <NextLink href={driverData.driverLicensePhotoURL!} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center text-sm text-primary hover:underline">
                              <LinkIcon className="mr-2 h-4 w-4" /> Voir le PDF du permis
                            </NextLink>
                          ) : (
                            <Image 
                                src={driverData?.driverLicensePhotoURL || "https://placehold.co/150x90.png"} 
                                alt={driverData?.driverLicensePhotoURL ? "Permis de conduire" : "Placeholder permis de conduire"} 
                                width={150} height={90} 
                                className="mt-1 rounded-md border object-contain" 
                                data-ai-hint="license document"
                            />
                          )}
                          {!driverData?.driverLicensePhotoURL && <p className="text-xs text-muted-foreground mt-1 italic">Aucun document téléversé. Image de remplacement.</p>}
                        </div>
                        
                        {renderDetailItem(<FileText className="h-4 w-4"/>, "N° Carte Grise", driverData.vehicleRegistrationNumber)}
                        
                        <div className="py-2">
                          <Label className="text-sm font-medium text-muted-foreground">Photo Carte Grise (actuelle) :</Label>
                          {isPdfUrl(driverData.vehicleRegistrationPhotoURL) ? (
                            <NextLink href={driverData.vehicleRegistrationPhotoURL!} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center text-sm text-primary hover:underline">
                              <LinkIcon className="mr-2 h-4 w-4" /> Voir le PDF de la carte grise
                            </NextLink>
                          ) : (
                            <Image 
                                src={driverData?.vehicleRegistrationPhotoURL || "https://placehold.co/150x90.png"} 
                                alt={driverData?.vehicleRegistrationPhotoURL ? "Carte grise" : "Placeholder carte grise"} 
                                width={150} height={90} 
                                className="mt-1 rounded-md border object-contain" 
                                data-ai-hint="registration document"
                            />
                          )}
                          {!driverData?.vehicleRegistrationPhotoURL && <p className="text-xs text-muted-foreground mt-1 italic">Aucun document téléversé. Image de remplacement.</p>}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">Les informations textuelles (marque, plaque, etc.) sont gérées par votre administrateur. Vous pouvez téléverser ou mettre à jour les photos de vos documents ci-dessous.</p>
                    </Card>
                  )}
                   {(!driverData && !isLoadingProfile && userProfile.role === 'driver') && ( 
                    <Card className="p-4 bg-destructive/10 rounded-md border-destructive">
                        <CardTitle className="text-lg mb-2 flex items-center text-destructive">
                            <AlertTriangle className="mr-2 h-5 w-5" />
                            Informations Véhicule Manquantes
                        </CardTitle>
                        <p className="text-sm text-destructive-foreground">Les informations essentielles du véhicule n'ont pas été trouvées. Veuillez contacter votre administrateur pour compléter ces informations.</p>
                    </Card>
                   )}
                  <Button onClick={() => setIsEditing(true)} className="w-full mt-6">
                    <Edit3 className="mr-2 h-4 w-4" />
                    Modifier le nom d'affichage
                  </Button>
                </div>
              )}
            </CardContent>
            {userProfile.role !== 'admin' && userProfile.role !== 'rejected_driver' && (
              <CardFooter className="border-t pt-6 mt-6 flex-col items-start space-y-3">
                <h3 className="text-lg font-semibold text-destructive flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5" /> Zone de Danger
                </h3>
                <p className="text-sm text-muted-foreground">
                  La suppression de votre compte est irréversible et toutes vos données seront perdues.
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

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <Paperclip className="mr-2 h-5 w-5 text-primary"/>
                Gérer mes Documents
              </CardTitle>
              <CardDescription>Téléversez (ou mettez à jour) des copies de votre permis de conduire et carte grise. Les fichiers acceptés sont les images (JPEG, PNG, WebP) et PDF (max 5MB).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="driverLicensePhotoInput" className="font-medium text-base block mb-2">
                  {driverData?.driverLicensePhotoURL ? "Remplacer la Photo du Permis" : "Permis de Conduire"}
                </Label>
                {driverData?.driverLicensePhotoURL && !driverLicensePreview ? (
                  <div className="mb-3 p-2 border rounded-md bg-secondary/30">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Photo actuelle du permis :</p>
                    {isPdfUrl(driverData.driverLicensePhotoURL) ? (
                        <NextLink href={driverData.driverLicensePhotoURL} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-primary hover:underline">
                            <LinkIcon className="mr-2 h-4 w-4" /> Voir le PDF du permis actuel
                        </NextLink>
                    ) : (
                        <Image src={driverData.driverLicensePhotoURL} alt="Permis de conduire actuel" width={200} height={120} className="rounded border object-contain" data-ai-hint="license document"/>
                    )}
                  </div>
                ) : !driverData?.driverLicensePhotoURL && !driverLicensePreview ? (
                  <div className="mb-3 p-2 border rounded-md bg-secondary/30">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Photo actuelle du permis :</p>
                    <Image src="https://placehold.co/200x120.png" alt="Placeholder permis de conduire" width={200} height={120} className="rounded border object-contain" data-ai-hint="license document"/>
                    <p className="text-xs text-muted-foreground mt-1 italic">Aucun document téléversé.</p>
                  </div>
                ) : null}
                {driverLicensePreview && (
                  <div className="mb-3 p-2 border rounded-md bg-secondary/50 relative">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Aperçu nouveau permis :</p>
                    {isPdfUrl(driverLicensePreview) ? (
                      <div className="flex items-center text-sm text-muted-foreground"> <FileText className="mr-2 h-4 w-4" /> Fichier PDF prêt à être téléversé.</div>
                    ) : (
                      <Image src={driverLicensePreview} alt="Aperçu permis" width={200} height={120} className="rounded border object-contain" data-ai-hint="license document"/>
                    )}
                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => clearPreview('license')} title="Retirer l'aperçu">
                      <X className="h-4 w-4 text-destructive"/>
                    </Button>
                  </div>
                )}
                <Input 
                  id="driverLicensePhotoInput" 
                  type="file" 
                  accept="image/*,.pdf" 
                  onChange={(_e) => handleFileChange(_e, 'license')} 
                  disabled={isUploadingDocs}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                {driverLicenseFile && <p className="text-xs text-muted-foreground mt-1">Fichier sélectionné : {driverLicenseFile.name}</p>}
              </div>

              <div>
                <Label htmlFor="vehicleRegistrationPhotoInput" className="font-medium text-base block mb-2">
                  {driverData?.vehicleRegistrationPhotoURL ? "Remplacer la Photo de la Carte Grise" : "Carte Grise (Certificat d'immatriculation)"}
                </Label>
                {driverData?.vehicleRegistrationPhotoURL && !vehicleRegistrationPreview ? (
                  <div className="mb-3 p-2 border rounded-md bg-secondary/30">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Photo actuelle de la carte grise :</p>
                    {isPdfUrl(driverData.vehicleRegistrationPhotoURL) ? (
                        <NextLink href={driverData.vehicleRegistrationPhotoURL} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-primary hover:underline">
                            <LinkIcon className="mr-2 h-4 w-4" /> Voir le PDF de la carte grise actuelle
                        </NextLink>
                    ) : (
                        <Image src={driverData.vehicleRegistrationPhotoURL} alt="Carte grise actuelle" width={200} height={120} className="rounded border object-contain" data-ai-hint="registration document"/>
                    )}
                  </div>
                ) : !driverData?.vehicleRegistrationPhotoURL && !vehicleRegistrationPreview ? (
                  <div className="mb-3 p-2 border rounded-md bg-secondary/30">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Photo actuelle de la carte grise :</p>
                    <Image src="https://placehold.co/200x120.png" alt="Placeholder carte grise" width={200} height={120} className="rounded border object-contain" data-ai-hint="registration document"/>
                    <p className="text-xs text-muted-foreground mt-1 italic">Aucun document téléversé.</p>
                  </div>
                ) : null}
                 {vehicleRegistrationPreview && (
                  <div className="mb-3 p-2 border rounded-md bg-secondary/50 relative">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Aperçu nouvelle carte grise :</p>
                    {isPdfUrl(vehicleRegistrationPreview) ? (
                        <div className="flex items-center text-sm text-muted-foreground"> <FileText className="mr-2 h-4 w-4" /> Fichier PDF prêt à être téléversé.</div>
                    ) : (
                        <Image src={vehicleRegistrationPreview} alt="Aperçu carte grise" width={200} height={120} className="rounded border object-contain" data-ai-hint="registration document"/>
                    )}
                     <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => clearPreview('registration')} title="Retirer l'aperçu">
                      <X className="h-4 w-4 text-destructive"/>
                    </Button>
                  </div>
                )}
                <Input 
                  id="vehicleRegistrationPhotoInput" 
                  type="file" 
                  accept="image/*,.pdf" 
                  onChange={(_e) => handleFileChange(_e, 'registration')} 
                  disabled={isUploadingDocs}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                {vehicleRegistrationFile && <p className="text-xs text-muted-foreground mt-1">Fichier sélectionné : {vehicleRegistrationFile.name}</p>}
              </div>
              
              <Button onClick={handleUploadDocuments} disabled={isUploadingDocs || (!driverLicenseFile && !vehicleRegistrationFile)} className="w-full mt-4 bg-accent hover:bg-accent/90 text-accent-foreground">
                {isUploadingDocs ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Paperclip className="mr-2 h-4 w-4" />}
                Téléverser les Documents Sélectionnés
              </Button>
            </CardContent>
          </Card>

          {isRejectedDriver && (
            <Card className="shadow-lg border-t-4 border-primary">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center"><RefreshCw className="mr-2 h-5 w-5 text-primary"/>Resoumettre la Demande</CardTitle>
                    <CardDescription>Une fois que vous avez mis à jour vos informations et documents, vous pouvez soumettre à nouveau votre demande pour validation par un administrateur.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isResubmitting}>
                                {isResubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                                Demander une Nouvelle Validation
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmer la resoumission ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Assurez-vous que toutes vos informations et documents sont corrects et à jour. Votre profil sera de nouveau examiné par un administrateur.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isResubmitting}>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResubmitForValidation} disabled={isResubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                    {isResubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Oui, soumettre à nouveau
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
