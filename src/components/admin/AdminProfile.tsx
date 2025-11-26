// ...existing code...
'use client';

import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ROLE_DISPLAY_NAMES } from '@/lib/roles';
import { formatNullableDate } from '@/lib/dateUtils';

type UserProfile = {
  displayName?: string;
  email?: string;
  photoURL?: string;
  role?: string;
  dateOfBirth?: string | Date | { toDate?: () => Date } | null;
  createdAt?: string | Date | { seconds?: number } | null;
};

const AdminProfile: React.FC = () => {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>(''); // YYYY-MM-DD

  const normalizeDob = (rawDob: any): string => {
    if (!rawDob) return '';
    if (typeof rawDob === 'string') {
      const m = rawDob.match(/\d{4}-\d{2}-\d{2}/);
      return m ? m[0] : rawDob.slice(0, 10);
    }
    if (rawDob instanceof Date) return rawDob.toISOString().slice(0, 10);
    if (typeof rawDob.toDate === 'function') return rawDob.toDate().toISOString().slice(0, 10);
    const s = String(rawDob);
    const m = s.match(/\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : '';
  };

  const normalizeCreatedAt = (raw: any): Date | null => {
    if (!raw) return null;
    if (raw instanceof Date) return raw;
    if (typeof raw === 'string') {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw.toDate === 'function') return raw.toDate();
    if (typeof raw.seconds === 'number') return new Date(raw.seconds * 1000);
    return null;
  };

  useEffect(() => {
    const fetchAdminProfile = async () => {
      if (!currentUser) return;
      setIsLoading(true);
      try {
        const profileRef = doc(firestore, 'userProfiles', currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: "Profil administrateur introuvable.",
          });
          setAdminProfile(null);
          return;
        }
        const data = profileSnap.data() as UserProfile;
        const dobStr = normalizeDob((data as any).dateOfBirth);
        setAdminProfile(data);
        setDisplayName(data.displayName || '');
        setDateOfBirth(dobStr);
      } catch (error) {
        console.error('Error fetching admin profile:', error);
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: "Impossible de charger le profil administrateur.",
        });
        setAdminProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading && currentUser) {
      fetchAdminProfile();
    } else if (!currentUser) {
      setIsLoading(false);
    }
  }, [currentUser, authLoading, toast]);

  const handleSaveProfile = async () => {
    if (!currentUser || !adminProfile) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      toast({ variant: 'destructive', title: 'Date invalide', description: "Date de naissance requise au format YYYY-MM-DD" });
      return;
    }
    setIsSaving(true);
    try {
      const profileRef = doc(firestore, 'userProfiles', currentUser.uid);
      // Enregistrer la date comme string YYYY-MM-DD (ou adapter pour Date si nécessaire)
      await updateDoc(profileRef, {
        displayName,
        dateOfBirth: dateOfBirth as unknown as any,
      });
      setAdminProfile({ ...adminProfile, displayName, dateOfBirth });
      toast({ title: 'Profil mis à jour', description: "Votre profil a été enregistré avec succès." });
    } catch (error) {
      console.error('Error saving admin profile:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: "Impossible d'enregistrer le profil." });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!adminProfile) {
    return <div className="text-center py-8 text-muted-foreground">Profil non disponible.</div>;
  }

  return (
    <Card className="animate-in fade-in-50">
      <CardHeader>
        <CardTitle>Mon Profil Administrateur</CardTitle>
        <CardDescription>Gérez vos informations de profil.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {adminProfile.photoURL ? (
            <img src={adminProfile.photoURL} alt="Profil" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold text-white">
              {(adminProfile.displayName || adminProfile.email || 'A')[0].toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-medium">{adminProfile.displayName || adminProfile.email}</div>
            <div className="text-xs text-muted-foreground">{adminProfile.email}</div>
          </div>
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={adminProfile.email ?? ''} disabled readOnly />
        </div>

        <div>
          <Label htmlFor="role">Rôle</Label>
          <Input
            id="role"
            value={(ROLE_DISPLAY_NAMES as Record<string, string>)[adminProfile.role || ''] || adminProfile.role || ''}
            disabled
            readOnly
          />
        </div>

        <div>
          <Label htmlFor="displayName">Nom d'affichage</Label>
          <Input id="displayName" value={displayName} onChange={(_e) => setDisplayName(_e.target.value)} disabled={isSaving} />
        </div>

        <div>
          <Label htmlFor="dateOfBirth">Date de naissance</Label>
          <Input id="dateOfBirth" type="date" value={dateOfBirth} onChange={(_e) => setDateOfBirth(_e.target.value)} disabled={isSaving} required />
          {!dateOfBirth && <p className="text-xs text-red-600 mt-1">Date de naissance requise</p>}
        </div>

        <div>
          <Label>Compte créé le</Label>
          <p className="text-sm text-muted-foreground">{formatNullableDate(normalizeCreatedAt(adminProfile.createdAt))}</p>
        </div>

        <Button onClick={handleSaveProfile} disabled={isSaving || (displayName === (adminProfile.displayName || '') && dateOfBirth === normalizeDob(adminProfile.dateOfBirth))}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Enregistrer les modifications
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminProfile;
// ...existing code...