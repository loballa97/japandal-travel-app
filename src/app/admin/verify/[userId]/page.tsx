// src/app/admin/verify/[userId]/page.tsx
"use client";

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc as getFirestoreDoc, updateDoc, serverTimestamp, Timestamp, collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertTriangle, UserCog, CheckCircle, XCircle, ArrowLeft, CarFront, Edit, Info as InfoIcon, Edit2, History, Link as LinkIcon } from 'lucide-react';
import type { UserProfile, UserRole, Driver, DriverDetails, AdminActionLogType, AdminActionLog } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import NextLink from 'next/link';
import Header from '@/components/layout/Header';
import { ROLE_COLORS, ROLE_DISPLAY_NAMES, DEFAULT_ROLE_COLOR } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ALL_ASSIGNABLE_ROLES: UserRole[] = ["customer", "driver", "manager", "sub_admin", "admin", "pending_driver", "pending_manager", "rejected_driver", "rejected_manager"];

const isPdfUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  try {
    const GCS_PDF_CONTENT_TYPE_MARKER = 'application%2Fpdf';
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.pdf') || url.includes(GCS_PDF_CONTENT_TYPE_MARKER);
  } catch (_e) {
    return false;
  }
};

export default function VerifyUserPage() {
  const { userId } = useParams();
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [driverData, setDriverData] = React.useState<DriverDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detailedError, setDetailedError] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [currentAdminProfile, setCurrentAdminProfile] = React.useState<UserProfile | null>(null);


  const [selectedRole, setSelectedRole] = React.useState<UserRole | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState('');

  const [isEditingDriverDetails, setIsEditingDriverDetails] = React.useState(false);
  const [editableDriverDetails, setEditableDriverDetails] = React.useState<Partial<DriverDetails>>({});
  const [isUpdatingDriverDetails, setIsUpdatingDriverDetails] = React.useState(false);

  const [userActionLogs, setUserActionLogs] = React.useState<AdminActionLog[]>([]);
  const [isLoadingUserLogs, setIsLoadingUserLogs] = React.useState(true);
  const [userLogsError, setUserLogsError] = React.useState<string | null>(null);


  const logAdminActionOnVerifyPage = async (actionType: AdminActionLogType, description: string, targetUserId?: string, targetUserEmail?: string) => {
    if (!currentUser || !currentAdminProfile) {
        console.warn("Admin user or profile not available for logging action.");
        return;
    }
    try {
      await addDoc(collection(firestore, "adminActionLogs"), {
        adminId: currentUser.uid,
        adminName: currentAdminProfile.displayName || currentUser.email || "Admin inconnu",
        actionType,
        description,
        targetUserId: targetUserId || null,
        targetUserEmail: targetUserEmail || null,
        targetEntityId: targetUserId || null, 
        timestamp: serverTimestamp(),
      });
      fetchUserSpecificActionLogs(userId as string); 
    } catch (logError) {
      console.error("Error logging admin action on verify page:", logError);
    }
  };

  const fetchUserSpecificActionLogs = React.useCallback(async (uid: string) => {
    if (!uid) return;
    setIsLoadingUserLogs(true);
    setUserLogsError(null);
    try {
      const q = query(
        collection(firestore, "adminActionLogs"),
        where("targetUserId", "==", uid),
        orderBy("timestamp", "desc"),
        limit(10) 
      );
      const querySnapshot = await getDocs(q);
      const fetchedLogs: AdminActionLog[] = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        timestamp: docSnap.data().timestamp instanceof Timestamp ? docSnap.data().timestamp.toDate() : new Date(docSnap.data().timestamp as string),
      } as AdminActionLog));
      setUserActionLogs(fetchedLogs);
    } catch (err) {
      console.error("Error fetching user-specific action logs:", err);
      setUserLogsError("Impossible de charger l'historique des actions pour cet utilisateur.");
    } finally {
      setIsLoadingUserLogs(false);
    }
  }, []);


  React.useEffect(() => {
    const fetchUserData = async () => {
      if (authLoading) return;

      if (!currentUser) {
        toast({ variant: "destructive", title: "Non authentifié", description: "Veuillez vous connecter pour accéder à cette page." });
        router.push('/login');
        return;
      }

      setIsLoading(true);
      const currentUserId = userId as string;

      try {
        const adminProfileRef = doc(firestore, "userProfiles", currentUser.uid);
        const adminProfileSnap = await getFirestoreDoc(adminProfileRef);

        if (adminProfileSnap.exists()) {
          const profile = adminProfileSnap.data() as UserProfile;
          setCurrentAdminProfile(profile); 

          if (profile.role !== 'admin' && profile.role !== 'sub_admin') {
            toast({ variant: "destructive", title: "Accès refusé", description: "Vous n'avez pas les droits nécessaires pour vérifier les utilisateurs." });
            router.push('/');
            return;
          }

          if (currentUserId) {
            const targetUserRef = doc(firestore, "userProfiles", currentUserId);
            const targetDocSnap = await getFirestoreDoc(targetUserRef);

            if (targetDocSnap.exists()) {
              const targetProfileData = targetDocSnap.data();
              const targetProfile: UserProfile = {
                id: targetDocSnap.id,
                ...targetProfileData,
                createdAt: targetProfileData.createdAt instanceof Timestamp ? targetProfileData.createdAt.toDate() : new Date(targetProfileData.createdAt as string),
                updatedAt: targetProfileData.updatedAt instanceof Timestamp ? targetProfileData.updatedAt.toDate() : (targetProfileData.updatedAt ? new Date(targetProfileData.updatedAt as string) : undefined),
                rejectedAt: targetProfileData.rejectedAt instanceof Timestamp ? targetProfileData.rejectedAt.toDate() : (targetProfileData.rejectedAt ? new Date(targetProfileData.rejectedAt as string) : undefined),
                disabledAt: targetProfileData.disabledAt instanceof Timestamp ? targetProfileData.disabledAt.toDate() : (targetProfileData.disabledAt ? new Date(targetProfileData.disabledAt as string): undefined),
                accountStatus: targetProfileData.accountStatus || 'active',
              } as UserProfile;
              setUserProfile(targetProfile);
              setSelectedRole(targetProfile.role);
              fetchUserSpecificActionLogs(currentUserId); 

              if (targetProfile.role.includes('driver') || targetProfile.role.includes('pending_driver') || targetProfile.role.includes('rejected_driver')) {
                const driverDocRef = doc(firestore, "drivers", targetProfile.id);
                const driverSnap = await getFirestoreDoc(driverDocRef);
                if (driverSnap.exists()) {
                  const driverFullData = driverSnap.data() as Driver;
                  setDriverData(driverFullData.details);
                  setEditableDriverDetails(driverFullData.details); 
                }
              }
            } else {
              setError("Profil utilisateur non trouvé.");
              setDetailedError(`Aucun profil trouvé pour l'identifiant : ${currentUserId}`);
            }
          } else {
            setError("Identifiant utilisateur manquant ou invalide.");
            setDetailedError("L'identifiant utilisateur dans l'URL est manquant ou invalide.");
          }
        } else {
          toast({ variant: "destructive", title: "Erreur de profil", description: "Votre profil utilisateur n'a pas été trouvé." });
          router.push('/login');
        }
      } catch (err: any) {
        console.error("Verify User Page: Error fetching user data:", err);
        setError("Impossible de charger les données de l'utilisateur.");
        setDetailedError(err.message || "Une erreur inconnue est survenue.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [userId, currentUser, authLoading, router, toast, fetchUserSpecificActionLogs]);

  const canPerformActionOnTarget = (targetRole: UserRole) => {
    if (!currentAdminProfile) return false;
    if (currentAdminProfile.role === 'admin') return true;
    if (currentAdminProfile.role === 'sub_admin') {
      return !['admin', 'sub_admin'].includes(targetRole);
    }
    return false;
  };

  const handleRoleChange = async () => {
    if (!userProfile || !selectedRole || !currentAdminProfile || !canPerformActionOnTarget(userProfile.role) || (currentAdminProfile.role === 'sub_admin' && (selectedRole === 'admin' || selectedRole === 'sub_admin'))) {
      toast({ variant: "destructive", title: "Action non autorisée", description: "Droits insuffisants ou rôle cible invalide." });
      return;
    }

    setIsProcessing(true);
    const oldRole = userProfile.role;
    try {
      const userDocRef = doc(firestore, 'userProfiles', userProfile.id);
      await updateDoc(userDocRef, {
        role: selectedRole,
        updatedAt: serverTimestamp(),
        rejectedReason: selectedRole.startsWith('rejected_') ? (rejectionReason || "Rôle changé par admin.") : null,
        rejectedAt: selectedRole.startsWith('rejected_') ? serverTimestamp() : null,
      });
      setUserProfile(prev => prev ? { ...prev, role: selectedRole, updatedAt: new Date() } : null);
      
      logAdminActionOnVerifyPage(
        'ROLE_UPDATED',
        `Rôle de ${userProfile.email} changé de ${ROLE_DISPLAY_NAMES[oldRole] || oldRole} à ${ROLE_DISPLAY_NAMES[selectedRole] || selectedRole}. Raison (si rejet): ${rejectionReason || 'N/A'}`,
        userProfile.id,
        userProfile.email
      );

      toast({ title: "Rôle Mis à Jour", description: `Le rôle de ${userProfile.email} est maintenant ${ROLE_DISPLAY_NAMES[selectedRole]}.` });
    } catch (err: any) {
      console.error("Error updating role:", err);
      toast({ variant: "destructive", title: "Erreur de mise à jour", description: err.message || "Impossible de mettre à jour le rôle." });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleApproveUser = async () => {
    if (!userProfile || !selectedRole || !currentAdminProfile || !canPerformActionOnTarget(userProfile.role) || (currentAdminProfile.role === 'sub_admin' && (selectedRole === 'admin' || selectedRole === 'sub_admin'))) {
        toast({ variant: "destructive", title: "Action non autorisée", description: "Droits insuffisants ou rôle d'approbation invalide." });
        return;
    }
    if (selectedRole === 'pending_driver' || selectedRole === 'pending_manager' || selectedRole === 'rejected_driver' || selectedRole === 'rejected_manager') {
        toast({ variant: "destructive", title: "Rôle Invalide", description: "Veuillez sélectionner un rôle actif (ex: Chauffeur, Gérant, Client) pour l'approbation." });
        return;
    }

    setIsProcessing(true);
    try {
      const userDocRef = doc(firestore, 'userProfiles', userProfile.id);
      await updateDoc(userDocRef, {
        role: selectedRole,
        updatedAt: serverTimestamp(),
        rejectionReason: null,
        rejectedAt: null,
      });
      setUserProfile(prev => prev ? { ...prev, role: selectedRole, updatedAt: new Date() } : null);
      
      logAdminActionOnVerifyPage(
        'USER_VERIFIED_APPROVED',
        `Utilisateur ${userProfile.email} approuvé avec le rôle ${ROLE_DISPLAY_NAMES[selectedRole] || selectedRole}.`,
        userProfile.id,
        userProfile.email
      );

      toast({ title: "Utilisateur Approuvé", description: `L'utilisateur ${userProfile.email} a été approuvé avec le rôle ${ROLE_DISPLAY_NAMES[selectedRole]}.` });
    } catch (err: any) {
      console.error("Error approving user:", err);
      toast({ variant: "destructive", title: "Erreur d'approbation", description: err.message || "Impossible d'approuver l'utilisateur." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectUser = async () => {
    if (!userProfile || !currentAdminProfile || !canPerformActionOnTarget(userProfile.role)) {
      toast({ variant: "destructive", title: "Action non autorisée", description: "Droits insuffisants." });
      return;
    }
    if (!rejectionReason.trim()) {
      toast({ variant: "destructive", title: "Raison requise", description: "Veuillez fournir une raison pour le rejet." });
      return;
    }

    setIsProcessing(true);
    const newRejectedRole: UserRole = userProfile.role.includes('driver') || userProfile.role === 'pending_driver' ? 'rejected_driver' :
                                  userProfile.role.includes('manager') || userProfile.role === 'pending_manager' ? 'rejected_manager' :
                                  'rejected_driver'; 
    try {
      const userDocRef = doc(firestore, 'userProfiles', userProfile.id);
      await updateDoc(userDocRef, {
        role: newRejectedRole,
        rejectionReason: rejectionReason.trim(),
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setUserProfile(prev => prev ? { ...prev, role: newRejectedRole, rejectionReason: rejectionReason.trim(), rejectedAt: new Date(), updatedAt: new Date() } : null);
      
      logAdminActionOnVerifyPage(
        'USER_VERIFIED_REJECTED',
        `Utilisateur ${userProfile.email} rejeté. Raison: ${rejectionReason.trim()}`,
        userProfile.id,
        userProfile.email
      );

      toast({ title: "Utilisateur Rejeté", description: `L'utilisateur ${userProfile.email} a été marqué comme rejeté.` });
      setRejectionReason(''); 
    } catch (err: any) {
      console.error("Error rejecting user:", err);
      toast({ variant: "destructive", title: "Erreur de rejet", description: err.message || "Impossible de rejeter l'utilisateur." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDriverDetailChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = _e.target;
    setEditableDriverDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveDriverDetails = async () => {
    if (!userProfile || !driverData) return;
    setIsUpdatingDriverDetails(true);
    try {
      const driverDocRef = doc(firestore, "drivers", userProfile.id);
      await updateDoc(driverDocRef, {
        details: { ...driverData, ...editableDriverDetails }, 
        updatedAt: serverTimestamp(),
      });
      setDriverData(prev => prev ? { ...prev, ...editableDriverDetails } : null);
      toast({ title: "Détails Chauffeur Mis à Jour", description: "Les informations du véhicule/permis ont été enregistrées." });
      setIsEditingDriverDetails(false);
    } catch (err: any) {
      console.error("Error updating driver details:", err);
      toast({ variant: "destructive", title: "Erreur de mise à jour", description: err.message || "Impossible de mettre à jour les détails du chauffeur." });
    } finally {
      setIsUpdatingDriverDetails(false);
    }
  };

  const formatUserDate = (dateValue: any, includeTime = true): string => {
    if (!dateValue) return 'N/A';
    const date = dateValue instanceof Timestamp ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(date.getTime())) return 'Date invalide';
    return format(date, includeTime ? 'Pp' : 'P', { locale: fr });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement des données utilisateur...</p>
      </div>
    );
  }

  if (error || !userProfile) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <Header />
          <div className="flex flex-col items-center text-center py-10 text-destructive">
            <AlertTriangle className="h-16 w-16 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">{error || "Profil utilisateur introuvable"}</h2>
            <p className="text-sm text-muted-foreground">{detailedError || "L'utilisateur demandé n'existe pas ou une erreur est survenue."}</p>
            <Button onClick={() => router.push('/admin')} variant="outline" className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour au Tableau de Bord
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const isPending = userProfile.role === 'pending_driver' || userProfile.role === 'pending_manager';
  const isRejected = userProfile.role === 'rejected_driver' || userProfile.role === 'rejected_manager';
  const isDriverRoleFamily = userProfile.role.includes('driver') || userProfile.role.includes('pending_driver') || userProfile.role.includes('rejected_driver');
  
  const assignableRolesForCurrentUser = ALL_ASSIGNABLE_ROLES.filter(role => {
    if (!currentAdminProfile) return false;
    if (currentAdminProfile.role === 'admin') return true;
    if (currentAdminProfile.role === 'sub_admin') return !['admin', 'sub_admin'].includes(role);
    return false;
  });

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        <Header />
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <UserCog className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-headline font-semibold">Vérification / Détails Utilisateur</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/admin')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour au Tableau de Bord
            </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">{userProfile.displayName || 'Nom non défini'}</CardTitle>
            <CardDescription>ID: {userProfile.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h3 className="text-lg font-semibold mb-3 border-b pb-2 flex items-center"><InfoIcon className="mr-2 h-5 w-5 text-primary"/>Informations Générales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <p><strong className="text-muted-foreground">Email:</strong> {userProfile.email}</p>
                <p><strong className="text-muted-foreground">Nom d'affichage:</strong> {userProfile.displayName || <span className="italic">Non défini</span>}</p>
                <p><strong className="text-muted-foreground">Rôle Actuel:</strong> <Badge variant="outline" className={ROLE_COLORS[userProfile.role] || DEFAULT_ROLE_COLOR}>{ROLE_DISPLAY_NAMES[userProfile.role] || userProfile.role}</Badge></p>
                <p><strong className="text-muted-foreground">Statut Compte:</strong> <Badge variant={userProfile.accountStatus === 'disabled_by_admin' ? "destructive" : "secondary"} className={userProfile.accountStatus === 'disabled_by_admin' ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}>{userProfile.accountStatus === 'disabled_by_admin' ? 'Désactivé' : 'Actif'}</Badge></p>
                <p><strong className="text-muted-foreground">Inscrit le:</strong> {formatUserDate(userProfile.createdAt, false)}</p>
                <p><strong className="text-muted-foreground">Dernière MàJ profil:</strong> {formatUserDate(userProfile.updatedAt, false)}</p>
                {userProfile.accountStatus === 'disabled_by_admin' && userProfile.disabledAt && (
                  <p className="md:col-span-2"><strong className="text-muted-foreground">Désactivé le:</strong> {formatUserDate(userProfile.disabledAt, false)}</p>
                )}
                {isRejected && userProfile.rejectionReason && (
                  <div className="md:col-span-2 mt-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                    <p><strong className="text-destructive">Motif du Rejet:</strong> {userProfile.rejectionReason}</p>
                    <p><strong className="text-destructive">Rejeté le:</strong> {formatUserDate(userProfile.rejectedAt, false)}</p>
                  </div>
                )}
              </div>
            </section>

            {isDriverRoleFamily && driverData && (
              <section>
                <Separator className="my-4"/>
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                    <h3 className="text-lg font-semibold flex items-center"><CarFront className="mr-2 h-5 w-5 text-primary"/>Informations Chauffeur & Véhicule</h3>
                    {!isEditingDriverDetails && canPerformActionOnTarget(userProfile.role) && (
                        <Button variant="outline" size="sm" onClick={() => setIsEditingDriverDetails(true)}>
                            <Edit2 className="mr-2 h-4 w-4"/> Modifier
                        </Button>
                    )}
                </div>
                {isEditingDriverDetails ? (
                    <form className="space-y-4">
                        <div>
                            <Label htmlFor="carMake">Marque Véhicule</Label>
                            <Input id="carMake" name="carMake" value={editableDriverDetails.carMake || ''} onChange={handleDriverDetailChange} disabled={isUpdatingDriverDetails}/>
                        </div>
                        <div>
                            <Label htmlFor="carColor">Couleur</Label>
                            <Input id="carColor" name="carColor" value={editableDriverDetails.carColor || ''} onChange={handleDriverDetailChange} disabled={isUpdatingDriverDetails}/>
                        </div>
                        <div>
                            <Label htmlFor="licensePlate">Plaque Immat.</Label>
                            <Input id="licensePlate" name="licensePlate" value={editableDriverDetails.licensePlate || ''} onChange={handleDriverDetailChange} disabled={isUpdatingDriverDetails}/>
                        </div>
                        <div>
                            <Label htmlFor="driverLicenseNumber">N° Permis</Label>
                            <Input id="driverLicenseNumber" name="driverLicenseNumber" value={editableDriverDetails.driverLicenseNumber || ''} onChange={handleDriverDetailChange} disabled={isUpdatingDriverDetails}/>
                        </div>
                        <div>
                            <Label htmlFor="vehicleRegistrationNumber">N° Carte Grise</Label>
                            <Input id="vehicleRegistrationNumber" name="vehicleRegistrationNumber" value={editableDriverDetails.vehicleRegistrationNumber || ''} onChange={handleDriverDetailChange} disabled={isUpdatingDriverDetails}/>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button onClick={handleSaveDriverDetails} disabled={isUpdatingDriverDetails} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                                {isUpdatingDriverDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Enregistrer
                            </Button>
                            <Button variant="outline" onClick={() => { setIsEditingDriverDetails(false); setEditableDriverDetails(driverData); }} disabled={isUpdatingDriverDetails}>
                                Annuler
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                        <p><strong className="text-muted-foreground">Marque Véhicule:</strong> {driverData.carMake || <span className="italic">N/A</span>}</p>
                        <p><strong className="text-muted-foreground">Couleur:</strong> {driverData.carColor || <span className="italic">N/A</span>}</p>
                        <p><strong className="text-muted-foreground">Plaque Immat.:</strong> {driverData.licensePlate || <span className="italic">N/A</span>}</p>
                        <p><strong className="text-muted-foreground">N° Permis:</strong> {driverData.driverLicenseNumber || <span className="italic">N/A</span>}</p>
                        <p><strong className="text-muted-foreground">N° Carte Grise:</strong> {driverData.vehicleRegistrationNumber || <span className="italic">N/A</span>}</p>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                        <Label className="font-medium text-muted-foreground block mb-1">Photo Permis de Conduire:</Label>
                        {driverData.driverLicensePhotoURL ? (
                            isPdfUrl(driverData.driverLicensePhotoURL) ? (
                                <NextLink href={driverData.driverLicensePhotoURL} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center text-sm text-primary hover:underline">
                                    <LinkIcon className="mr-2 h-4 w-4" /> Voir le PDF du permis
                                </NextLink>
                            ) : (
                                <Image src={driverData.driverLicensePhotoURL} alt="Permis de conduire" width={200} height={120} className="rounded border object-contain" data-ai-hint="license document"/>
                            )
                        ) : (
                            <Image src="https://placehold.co/200x120.png" alt="Placeholder permis" width={200} height={120} className="rounded border object-contain" data-ai-hint="document placeholder"/>
                        )}
                    </div>
                    <div>
                        <Label className="font-medium text-muted-foreground block mb-1">Photo Carte Grise:</Label>
                        {driverData.vehicleRegistrationPhotoURL ? (
                            isPdfUrl(driverData.vehicleRegistrationPhotoURL) ? (
                                <NextLink href={driverData.vehicleRegistrationPhotoURL} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center text-sm text-primary hover:underline">
                                    <LinkIcon className="mr-2 h-4 w-4" /> Voir le PDF de la carte grise
                                </NextLink>
                            ) : (
                                <Image src={driverData.vehicleRegistrationPhotoURL} alt="Carte grise" width={200} height={120} className="rounded border object-contain" data-ai-hint="registration document"/>
                            )
                        ) : (
                             <Image src="https://placehold.co/200x120.png" alt="Placeholder carte grise" width={200} height={120} className="rounded border object-contain" data-ai-hint="document placeholder"/>
                        )}
                    </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-4">Les photos des documents sont gérées par le chauffeur depuis son profil.</p>
              </section>
            )}
            {isDriverRoleFamily && !driverData && (
                 <section>
                    <Separator className="my-4"/>
                    <h3 className="text-lg font-semibold mb-3 border-b pb-2 flex items-center"><CarFront className="mr-2 h-5 w-5 text-primary"/>Informations Chauffeur & Véhicule</h3>
                    <p className="text-sm text-muted-foreground italic">Aucune information de chauffeur ou de véhicule n'a été trouvée pour cet utilisateur dans la base de données des chauffeurs.</p>
                 </section>
            )}


            {canPerformActionOnTarget(userProfile.role) && (
              <section>
                <Separator className="my-6"/>
                <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center"><Edit className="mr-2 h-5 w-5 text-primary"/>Actions Administrateur</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="roleSelect" className="font-medium">Changer le rôle de l'utilisateur :</Label>
                    <Select value={selectedRole || ''} onValueChange={(_value) => setSelectedRole(_value as UserRole)} disabled={isProcessing}>
                      <SelectTrigger id="roleSelect" className="mt-1">
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRolesForCurrentUser.map(roleKey => (
                          <SelectItem key={roleKey} value={roleKey} disabled={roleKey === userProfile.role}>
                            {ROLE_DISPLAY_NAMES[roleKey] || roleKey}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleRoleChange} className="mt-2 w-full sm:w-auto" disabled={isProcessing || !selectedRole || selectedRole === userProfile.role}>
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Appliquer le nouveau rôle
                    </Button>
                  </div>

                  {(isPending || isRejected) && (
                    <Button onClick={handleApproveUser} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white" disabled={isProcessing || !selectedRole || selectedRole === userProfile.role || selectedRole.startsWith('pending_') || selectedRole.startsWith('rejected_')}>
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      Approuver avec le rôle sélectionné
                    </Button>
                  )}
                  
                  <div>
                    <Label htmlFor="rejectionReason" className="font-medium">Raison du rejet/modification vers 'rejeté' :</Label>
                    <Textarea
                      id="rejectionReason"
                      placeholder="Si vous rejetez ou changez le rôle vers 'rejeté', expliquez pourquoi ici."
                      value={rejectionReason}
                      onChange={(_e) => setRejectionReason(_e.target.value)}
                      disabled={isProcessing}
                      className="mt-1"
                    />
                     {(isPending || (selectedRole && (selectedRole === 'rejected_driver' || selectedRole === 'rejected_manager'))) && (
                      <Button onClick={handleRejectUser} variant="destructive" className="mt-2 w-full sm:w-auto" disabled={isProcessing || !rejectionReason.trim()}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                        {isPending ? "Rejeter la demande (avec raison)" : "Marquer comme rejeté (avec raison)"}
                      </Button>
                     )}
                  </div>
                </div>
              </section>
            )}
          </CardContent>
           <CardFooter>
             <Button variant="outline" onClick={() => router.push('/admin')} className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour au Tableau de Bord Admin
            </Button>
           </CardFooter>
        </Card>

        <Card className="shadow-lg mt-6">
          <CardHeader>
              <CardTitle className="text-lg flex items-center"><History className="mr-2 h-5 w-5 text-primary"/>Historique des Actions sur ce Compte</CardTitle>
              <CardDescription>Les dernières actions administratives concernant cet utilisateur.</CardDescription>
          </CardHeader>
          <CardContent>
              {isLoadingUserLogs ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
               userLogsError ? <p className="text-destructive text-center py-3">{userLogsError}</p> :
               userActionLogs.length > 0 ? (
                  <div className="overflow-x-auto">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead className="w-[150px]">Date/Heure</TableHead>
                                  <TableHead>Action</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead>Admin</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {userActionLogs.map(log => (
                                  <TableRow key={log.id}>
                                      <TableCell className="text-xs whitespace-nowrap">{formatUserDate(log.timestamp)}</TableCell>
                                      <TableCell className="text-xs font-medium">{log.actionType.replace(/_/g, ' ')}</TableCell>
                                      <TableCell className="text-xs">{log.description}</TableCell>
                                      <TableCell className="text-xs">{log.adminName}</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
               ) : (
                  <p className="text-muted-foreground text-center py-3">Aucune action administrative enregistrée pour cet utilisateur.</p>
               )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
