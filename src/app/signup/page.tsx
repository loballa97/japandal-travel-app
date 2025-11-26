"use client";

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation'; 
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { auth, firestore } from '@/lib/firebase'; 
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { fr } from 'date-fns/locale';
import type { UserProfile, UserRole, Driver, DriverDetails } from '@/types'; 
import { UserPlus, Loader2, Car, Palette, CreditCard, Paperclip } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];


const signupSchema = z.object({
  displayName: z.string().min(2, { message: "Le nom d'affichage doit contenir au moins 2 caractères." }).max(50).optional(),
  email: z.string().email({ message: 'Adresse e-mail invalide.' }),
  phoneNumber: z.string().min(1, { message: 'Le numéro de téléphone est requis.' }), // Added phone number field
  country: z.enum(['France', 'Senegal'], { required_error: "Veuillez sélectionner votre pays." }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères.' }),
  role: z.enum(['customer', 'driver', 'manager'], { required_error: "Veuillez sélectionner un rôle."}).default('customer'),
  dateOfBirth: z.date({ required_error: "Veuillez sélectionner votre date de naissance." }),
  
  carMake: z.string().optional(),
  carColor: z.string().optional(),
  licensePlate: z.string().optional(),

  driverLicensePhoto: z.custom<FileList>().optional(),
  vehicleRegistrationPhoto: z.custom<FileList>().optional(),

}).superRefine((data, ctx) => {
  if (data.role === 'driver') {
    if (!data.carMake || data.carMake.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La marque du véhicule est requise.", path: ['carMake'] });
    }
    if (!data.carColor || data.carColor.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La couleur du véhicule est requise.", path: ['carColor'] });
    }
    if (!data.licensePlate || data.licensePlate.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La plaque d'immatriculation est requise.", path: ['licensePlate'] });
    }

    if (!data.driverLicensePhoto || data.driverLicensePhoto.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La photo du permis est requise.", path: ['driverLicensePhoto'] });
    } else {
      const file = data.driverLicensePhoto[0];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `La taille du fichier permis ne doit pas dépasser ${MAX_FILE_SIZE_MB}MB.`, path: ['driverLicensePhoto'] });
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Type de fichier permis non valide (JPEG, PNG, PDF).", path: ['driverLicensePhoto'] });
      }
    }

    if (!data.vehicleRegistrationPhoto || data.vehicleRegistrationPhoto.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La photo de la carte grise est requise.", path: ['vehicleRegistrationPhoto'] });
    } else {
      const file = data.vehicleRegistrationPhoto[0];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `La taille du fichier carte grise ne doit pas dépasser ${MAX_FILE_SIZE_MB}MB.`, path: ['vehicleRegistrationPhoto'] });
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Type de fichier carte grise non valide (JPEG, PNG, PDF).", path: ['vehicleRegistrationPhoto'] });
      }
    }
  }
});

type SignupFormData = z.infer<typeof signupSchema>;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { user, loading: authLoading } = useAuth();

  const roleToReapplyParam = searchParams.get('roleToReapply');
  const validRolesForReapply: ('customer' | 'driver' | 'manager')[] = ['customer', 'driver', 'manager'];
  const initialRole = roleToReapplyParam && validRolesForReapply.includes(roleToReapplyParam as any) 
                      ? roleToReapplyParam as 'customer' | 'driver' | 'manager' 
                      : 'customer';


  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: '',
      email: '',
      phoneNumber: '', // Add default value for phone number
      password: '',
      country: undefined, // Add default value for country
      role: initialRole, 
      dateOfBirth: undefined,
      carMake: '',
      carColor: '',
      licensePlate: '',
      driverLicensePhoto: undefined,
      vehicleRegistrationPhoto: undefined,
    },
  });

  const selectedRole = form.watch('role');

  React.useEffect(() => {
    if (!authLoading && user && !searchParams.get('roleToReapply')) {
      router.push('/'); 
    }
  }, [user, authLoading, router, searchParams]);

  const onSubmit: SubmitHandler<SignupFormData> = async (data) => {
    setIsSubmitting(true);
    let finalRole: UserRole = data.role;
    let toastMessage = 'Inscription réussie ! Vous allez être redirigé.';
    let driverDocsMessage = "";

    if (data.role === 'driver') {
      finalRole = 'pending_driver';
      toastMessage = 'Demande d\'inscription chauffeur enregistrée. Votre compte est en attente d\'approbation.';
      if (data.driverLicensePhoto?.[0] && data.vehicleRegistrationPhoto?.[0]) {
        driverDocsMessage = "Les photos des documents seront traitées après approbation. Vous pourrez les gérer depuis votre profil chauffeur.";
      }
    } else if (data.role === 'manager') {
      finalRole = 'pending_manager';
      toastMessage = 'Demande d\'inscription gérant enregistrée. Votre compte est en attente d\'approbation.';
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        if (data.displayName) {
          await updateProfile(firebaseUser, { displayName: data.displayName });
        }

        const userProfileRef = doc(firestore, "userProfiles", firebaseUser.uid);
        const newUserProfile: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: data.displayName || firebaseUser.displayName || null,
          role: finalRole,
          createdAt: serverTimestamp() as any,
          updatedAt: serverTimestamp() as any,
          phoneNumber: data.phoneNumber, // Save the phone number
          country: data.country, // Save the selected country
          dateOfBirth: data.dateOfBirth,
          rejectionReason: null, 
          rejectedAt: null,      
        };
        await setDoc(userProfileRef, newUserProfile);

        if (finalRole === 'pending_driver') {
          const driverDocRef = doc(firestore, "drivers", firebaseUser.uid);
          const driverDetails: DriverDetails = {
            carMake: data.carMake!,
            carColor: data.carColor!,
            licensePlate: data.licensePlate!,
            // URLs will be set by admin or driver later
            driverLicensePhotoURL: null, 
            vehicleRegistrationPhotoURL: null,
          };
          const newDriverData: Driver = {
            id: firebaseUser.uid,
            name: data.displayName || firebaseUser.displayName || firebaseUser.email || 'Chauffeur Anonyme',
            details: driverDetails,
            isOnline: true, // Default to online
            updatedAt: serverTimestamp() as any,
          };
          await setDoc(driverDocRef, newDriverData);
        }
      }

      toast({
        title: 'Statut d\'inscription',
        description: `${toastMessage} ${driverDocsMessage}`.trim(),
        duration: 8000,
      });
      
      if(finalRole === 'pending_driver' || finalRole === 'pending_manager') {
        router.push('/pending-approval');
      } else {
        router.push('/'); 
      }

    } catch (error: any) {
      console.error("Error signing up:", error);
      let errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Cette adresse e-mail est déjà utilisée.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'Erreur d\'inscription',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (authLoading || (!authLoading && user && !searchParams.get('roleToReapply'))) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement...</p>
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
                <UserPlus className="mr-2 h-6 w-6 text-primary" />
                Créer un compte
              </CardTitle>
              <CardDescription>Entrez vos informations pour vous inscrire.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="displayName">Nom d'affichage (Optionnel)</FormLabel>
                        <FormControl>
                          <Input
                            id="displayName"
                            type="text"
                            placeholder="Votre nom ou pseudo"
                            {...field}
                            className={form.formState.errors.displayName ? 'border-destructive' : ''}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
 name="phoneNumber"
 render={({ field }) => (
 <FormItem>
 <FormLabel htmlFor="phoneNumber">Numéro de Téléphone</FormLabel>
 <FormControl>
 <Input
 id="phoneNumber"
 type="tel" // Use type="tel" for phone number input
 placeholder="Votre numéro de téléphone"
 {...field}
 className={form.formState.errors.phoneNumber ? 'border-destructive' : ''}
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
                   <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date de Naissance</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                                form.formState.errors.dateOfBirth ? "border-destructive" : ""
                              )}
                              disabled={isSubmitting}
                            >
                              {field.value ? format(field.value, "PPP", { locale: fr }) : <span>Sélectionnez une date</span>}
                              <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar 
                              mode="single" 
                              selected={field.value} 
                              onSelect={field.onChange} 
                              disabled={(date: Date) => date > new Date() || date < new Date("1900-01-01") || isSubmitting}
                              initialFocus 
                              locale={fr}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="country">Pays</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                          <FormControl>
                            <SelectTrigger id="country" className={form.formState.errors.country ? 'border-destructive' : ''}>
                              <SelectValue placeholder="Sélectionner un pays" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <SelectItem value="France">France</SelectItem>
                              <SelectItem value="Senegal">Sénégal</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="role">S'inscrire en tant que</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                          <FormControl>
                            <SelectTrigger id="role" className={form.formState.errors.role ? 'border-destructive' : ''}>
                              <SelectValue placeholder="Sélectionner un rôle" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="customer">Client</SelectItem>
                            <SelectItem value="driver">Chauffeur (en attente d'approbation)</SelectItem>
                            <SelectItem value="manager">Gérant (en attente d'approbation)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedRole === 'driver' && (
                    <>
                      <FormField
                        control={form.control}
                        name="carMake"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="carMake" className="flex items-center">
                                <Car className="mr-2 h-4 w-4 text-muted-foreground" /> Marque du Véhicule
                            </FormLabel>
                            <FormControl>
                              <Input id="carMake" placeholder="Ex: Peugeot" {...field} value={field.value ?? ""} disabled={isSubmitting} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="carColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="carColor" className="flex items-center">
                                <Palette className="mr-2 h-4 w-4 text-muted-foreground" /> Couleur du Véhicule
                            </FormLabel>
                            <FormControl>
                              <Input id="carColor" placeholder="Ex: Noire" {...field} value={field.value ?? ""} disabled={isSubmitting} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="licensePlate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="licensePlate" className="flex items-center">
                                <CreditCard className="mr-2 h-4 w-4 text-muted-foreground" /> Plaque d'Immatriculation
                            </FormLabel>
                            <FormControl>
                              <Input id="licensePlate" placeholder="Ex: AB-123-CD" {...field} value={field.value ?? ""} disabled={isSubmitting} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                        <FormField
                        control={form.control}
                        name="driverLicensePhoto"
                        render={({ field: { onChange, value, ...restField } }) => (
                          <FormItem>
                            <FormLabel htmlFor="driverLicensePhoto" className="flex items-center">
                                <Paperclip className="mr-2 h-4 w-4 text-muted-foreground" /> Photo du Permis de Conduire
                            </FormLabel>
                            <FormControl>
                               <Input 
                                id="driverLicensePhoto" 
                                type="file" 
                                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => onChange(ev.target.files)}
                                {...restField} 
                                disabled={isSubmitting}
                                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                               />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vehicleRegistrationPhoto"
                        render={({ field: { onChange, value, ...restField } }) => (
                          <FormItem>
                            <FormLabel htmlFor="vehicleRegistrationPhoto" className="flex items-center">
                                <Paperclip className="mr-2 h-4 w-4 text-muted-foreground" /> Photo de la Carte Grise
                            </FormLabel>
                            <FormControl>
                               <Input 
                                id="vehicleRegistrationPhoto" 
                                type="file" 
                                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => onChange(ev.target.files)}
                                {...restField}
                                disabled={isSubmitting}
                                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                               />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        Note: Les photos de vos documents seront vérifiées par un administrateur. Vous pourrez les gérer depuis votre profil une fois approuvé. Max ${MAX_FILE_SIZE_MB}MB par fichier (JPEG, PNG, PDF).
                      </p>
                    </>
                  )}

                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Inscription en cours...
                      </>
                    ) : (
                      'S\'inscrire'
                    )}
                  </Button>
                </form>
              </Form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Déjà un compte ?{' '}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Se connecter
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement...</p>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}