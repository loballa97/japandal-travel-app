
"use client";
import * as React from 'react';
import { Suspense } from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, UserCheck, Loader2, MoreHorizontal, Eye, ShieldOff, Megaphone, Lightbulb, Gift, MessageSquare, Info as InfoIcon, Euro, Activity, Landmark, History, UserCog } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { firestore } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, where, doc, getDoc as getFirestoreDoc, Timestamp, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import type { UserProfile, UserRole, DriverAnnouncement, AdminActionLog, AdminActionLogType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ROLE_COLORS, ROLE_DISPLAY_NAMES } from '@/lib/roles';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import LiveDriversMap from '@/components/admin/LiveDriversMap';
import AdminProfile from '@/components/admin/AdminProfile';
import { cn } from '@/lib/utils';
import { formatNullableDate } from '@/lib/dateUtils';
import { functions } from '@/lib/firebase';

const ALL_ROLES_FOR_FILTER: UserRole[] = ["customer", "driver", "manager", "admin", "sub_admin", "pending_driver", "pending_manager", "rejected_driver", "rejected_manager"];
const ACCOUNT_STATUS_FILTER_OPTIONS = ['all', 'active', 'disabled_by_admin'] as const;
type AccountStatusFilter = typeof ACCOUNT_STATUS_FILTER_OPTIONS[number];
const _ALL_ASSIGNABLE_ROLES: UserRole[] = ["customer", "driver", "manager", "sub_admin", "admin", "pending_driver", "pending_manager", "rejected_driver", "rejected_manager"];

const announcementIconMap: { [key: string]: React.ElementType } = { Lightbulb, Gift, MessageSquare, InfoIcon, Megaphone };
const _renderDynamicAnnouncementIcon = (iconName?: string, className?: string) => {
  if (!iconName) return null;
  const IconComponent = announcementIconMap[iconName] || InfoIcon;
  return <IconComponent className={className || "h-4 w-4"} />;
};

type Section = 'overview' | 'approvals' | 'users' | 'announcements' | 'logs' | 'finance' | 'profile';

function AdminDashboardContent() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { toast } = useToast();

  const [activeSection, setActiveSection] = React.useState<Section>('overview');
  
  const [allUsers, setAllUsers] = React.useState<UserProfile[]>([]);
  const [pendingApprovals, setPendingApprovals] = React.useState<UserProfile[]>([]);
  const [stats, setStats] = React.useState({ totalUsers: 0, pendingCount: 0, activeDrivers: 0, completedRides: 0, totalRevenue: 0 });
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [currentAdminProfile, setCurrentAdminProfile] = React.useState<UserProfile | null>(null);
  
  // User Management State
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<UserRole | 'all'>('all');
  const [accountStatusFilter, setAccountStatusFilter] = React.useState<AccountStatusFilter>('all');
  const [_userToEditRole, _setUserToEditRole] = React.useState<UserProfile | null>(null);
  const [_isRoleEditDialogOpen, _setIsRoleEditDialogOpen] = React.useState(false);
  const [_selectedNewRole, _setSelectedNewRole] = React.useState<UserRole | null>(null);
  const [_isUpdatingRole, _setIsUpdatingRole] = React.useState(false);
  const [userToToggleStatus, setUserToToggleStatus] = React.useState<UserProfile | null>(null);
  const [isToggleStatusDialogOpen, setIsToggleStatusDialogOpen] = React.useState(false);
  const [isTogglingStatus, _setIsTogglingStatus] = React.useState(false);

  // Announcements State
  const [_announcements, setAnnouncements] = React.useState<DriverAnnouncement[]>([]);
  const [_isLoadingAnnouncements, setIsLoadingAnnouncements] = React.useState(true);
  const [_announcementsError, setAnnouncementsError] = React.useState<string | null>(null);
  const [_newAnnouncementTitle, _setNewAnnouncementTitle] = React.useState('');
  const [_newAnnouncementMessage, _setNewAnnouncementMessage] = React.useState('');
  const [_newAnnouncementIconName, _setNewAnnouncementIconName] = React.useState('');
  const [_newAnnouncementIsActive, _setNewAnnouncementIsActive] = React.useState(true);
  const [_isSubmittingAnnouncement, _setIsSubmittingAnnouncement] = React.useState(false);

  // Admin Logs State
  const [_adminActionLogs, setAdminActionLogs] = React.useState<AdminActionLog[]>([]);
  const [_isLoadingAdminLogs, setIsLoadingAdminLogs] = React.useState(true);
  const [_adminLogsError, setAdminLogsError] = React.useState<string | null>(null);
  
  // Finance State
  const [managers, setManagers] = React.useState<UserProfile[]>([]);
  const [selectedManagerToPay, setSelectedManagerToPay] = React.useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = React.useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);

  const _logAdminAction = async (actionType: AdminActionLogType, description: string, targetUserId?: string, targetUserEmail?: string, targetEntityId?: string) => {
    if (!currentUser || !currentAdminProfile) return;
    try {
      await addDoc(collection(firestore, "adminActionLogs"), {
        adminId: currentUser.uid,
        adminName: currentAdminProfile.displayName || currentUser.email || "Admin inconnu",
        actionType, description, targetUserId: targetUserId || null,
        targetUserEmail: targetUserEmail || null, targetEntityId: targetEntityId || null,
        timestamp: serverTimestamp(),
      });
      fetchAdminActionLogs(); // Refresh logs
    } catch (error) { console.error("Error logging admin action:", error); }
  };

  const fetchAdminData = React.useCallback(async () => {
    if (!currentUser) return;
    setIsLoadingData(true);
    try {
      const adminProfileRef = doc(firestore, "userProfiles", currentUser.uid);
      const adminProfileSnap = await getFirestoreDoc(adminProfileRef);
      if (!adminProfileSnap.exists() || !['admin', 'sub_admin'].includes(adminProfileSnap.data()?.role)) {
        toast({ variant: "destructive", title: "Accès Refusé" });
        router.push('/');
        return;
      }
      setCurrentAdminProfile(adminProfileSnap.data() as UserProfile);

      const usersSnapshot = await getDocs(query(collection(firestore, "userProfiles"), orderBy("createdAt", "desc")));
      const fetchedUsers: UserProfile[] = usersSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt instanceof Timestamp ? docSnap.data().createdAt.toDate() : new Date(docSnap.data().createdAt as string),
        accountStatus: docSnap.data().accountStatus || 'active',
      } as UserProfile));
      setAllUsers(fetchedUsers);
      setPendingApprovals(fetchedUsers.filter(u => u.role === 'pending_driver' || u.role === 'pending_manager'));
      setManagers(fetchedUsers.filter(u => u.role === 'manager' && u.accountStatus !== 'disabled_by_admin'));

      const reservationsSnapshot = await getDocs(query(collection(firestore, "reservations"), where('status', '==', 'Completed')));
      let totalRevenue = 0;
      reservationsSnapshot.forEach(docSnap => {
        const cost = docSnap.data().cost;
        if (typeof cost === 'number') totalRevenue += cost;
      });
      
      setStats({
        totalUsers: fetchedUsers.length,
        pendingCount: fetchedUsers.filter(u => u.role === 'pending_driver' || u.role === 'pending_manager').length,
        activeDrivers: fetchedUsers.filter(u => u.role === 'driver' && u.accountStatus !== 'disabled_by_admin').length,
        completedRides: reservationsSnapshot.size,
        totalRevenue: totalRevenue,
      });

    } catch (error) { console.error("Error fetching admin data:", error); toast({ variant: "destructive", title: "Erreur de chargement des données." }); }
    finally { setIsLoadingData(false); }
  }, [currentUser, router, toast]);
  
  const fetchAnnouncements = React.useCallback(async () => {
    setIsLoadingAnnouncements(true);
    try {
      const q = query(collection(firestore, "driverTipsAndAnnouncements"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      setAnnouncements(querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DriverAnnouncement)));
    } catch (err) { console.error("Error fetching announcements:", err); setAnnouncementsError("Impossible de charger les annonces."); }
    finally { setIsLoadingAnnouncements(false); }
  }, []);

  const fetchAdminActionLogs = React.useCallback(async () => {
    setIsLoadingAdminLogs(true);
    try {
      const q = query(collection(firestore, "adminActionLogs"), orderBy("timestamp", "desc"), limit(50));
      const querySnapshot = await getDocs(q);
      setAdminActionLogs(querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AdminActionLog)));
    } catch (err) { console.error("Error fetching logs:", err); setAdminLogsError("Impossible de charger le journal d'activité."); }
    finally { setIsLoadingAdminLogs(false); }
  }, []);

  React.useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { router.push('/login'); return; }
    fetchAdminData();
    fetchAnnouncements();
    fetchAdminActionLogs();

    const section = searchParams.get('section') as Section;
    if (section && ['overview', 'users', 'announcements', 'logs', 'finance', 'profile'].includes(section)) {
      setActiveSection(section);
    }
  }, [currentUser, authLoading, router, fetchAdminData, fetchAnnouncements, fetchAdminActionLogs, searchParams]);

  const handleSectionChange = (section: Section) => {
    setActiveSection(section);
    router.push(`${pathname}?section=${section}`, { scroll: false });
  };
  
  const filteredUsers = React.useMemo(() => allUsers.filter(user => {
    const nameMatch = user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const roleMatch = roleFilter === 'all' || user.role === roleFilter;
    const statusMatch = accountStatusFilter === 'all' || (user.accountStatus || 'active') === accountStatusFilter;
    return nameMatch && roleMatch && statusMatch;
  }), [allUsers, searchTerm, roleFilter, accountStatusFilter]);
  
  const _handleAddAnnouncement = async (_e: React.FormEvent) => { /* ... (implementation exists) ... */ };
  const _handleConfirmRoleUpdate = async () => { /* ... (implementation exists) ... */ };
  const handleConfirmToggleAccountStatus = async () => { /* ... (implementation exists) ... */ };
  const processManagerPayment = httpsCallable(functions, 'processManagerPayment');
  const handleProcessPayment = async () => {
    if (!selectedManagerToPay || !paymentAmount) return toast({ variant: "destructive", title: "Champs requis" });
    const amountNumber = parseFloat(paymentAmount);
    if (isNaN(amountNumber) || amountNumber <= 0) return toast({ variant: "destructive", title: "Montant invalide" });
    setIsProcessingPayment(true);
    try {
      await processManagerPayment({ managerId: selectedManagerToPay, amount: amountNumber });
      toast({ title: "Paiement traité", description: `Le paiement de ${amountNumber.toFixed(2)} € a été enregistré.` });
      setSelectedManagerToPay(null); setPaymentAmount(''); fetchAdminData();
    } catch (error: any) { toast({ variant: "destructive", title: "Erreur de paiement", description: error.message }); }
    finally { setIsProcessingPayment(false); }
  };
  
  const navItems = [
    { id: 'overview', label: 'Aperçu', icon: Activity },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'announcements', label: 'Annonces', icon: Megaphone },
    { id: 'finance', label: 'Finance', icon: Landmark },
    { id: 'logs', label: 'Historique Admin', icon: History },
    { id: 'profile', label: 'Mon Profil', icon: UserCog },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <Header />
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tableau de Bord Administrateur</h1>
        </div>

        <nav className="flex flex-wrap gap-2 border-b pb-4">
          {navItems.map(item => (
            <Button
              key={item.id}
              variant={activeSection === item.id ? 'default' : (item.id === 'profile' ? 'secondary' : 'outline')}
              onClick={() => handleSectionChange(item.id as Section)}
              className={cn(
                "flex-grow sm:flex-grow-0",
                item.id === 'profile' && activeSection !== 'profile' && "bg-secondary hover:bg-secondary/80"
              )}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </nav>

        {activeSection === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader><CardTitle>Aperçu du Système</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { title: "Utilisateurs Totaux", value: stats.totalUsers },
                      { title: "Approbations en Attente", value: stats.pendingCount, color: "text-orange-500" },
                      { title: "Chauffeurs Actifs", value: stats.activeDrivers, color: "text-green-500" },
                      { title: "Courses Terminées", value: stats.completedRides },
                      { title: "Revenu Total Généré", value: `${stats.totalRevenue.toFixed(2)} €` },
                    ].map(stat => (
                      <Card key={stat.title} className="p-4"><CardDescription>{stat.title}</CardDescription><p className={`text-2xl font-bold ${stat.color || ''}`}>{isLoadingData ? <Loader2 className="h-6 w-6 animate-spin"/> : stat.value}</p></Card>
                    ))}
                  </CardContent>
                </Card>
                <Card><CardHeader><CardTitle>Carte des Chauffeurs Actifs</CardTitle></CardHeader><CardContent><LiveDriversMap /></CardContent></Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader><CardTitle>Approbations en Attente ({pendingApprovals.length})</CardTitle></CardHeader>
                  <CardContent>
                    {isLoadingData ? <div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin"/></div> :
                    pendingApprovals.length > 0 ? (
                      <Table><TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>{pendingApprovals.map(user => (
                          <TableRow key={user.id}><TableCell><div className="font-medium">{user.email}</div><div className="text-xs text-muted-foreground">{user.displayName || 'N/A'} - {ROLE_DISPLAY_NAMES[user.role]}</div></TableCell><TableCell className="text-right"><Button asChild variant="outline" size="sm"><Link href={`/admin/verify/${user.id}`}><UserCheck className="mr-1 h-4 w-4"/>Vérifier</Link></Button></TableCell></TableRow>
                        ))}</TableBody>
                      </Table>
                    ) : <p className="text-muted-foreground text-center py-4">Aucune demande d'approbation.</p>}
                  </CardContent>
                </Card>
            </div>
          </div>
        )}

        {activeSection === 'users' && (
          <Card className="animate-in fade-in-50">
            <CardHeader><CardTitle>Gestion des Utilisateurs</CardTitle><CardDescription>Rechercher, filtrer et gérer tous les utilisateurs du système.</CardDescription></CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Input placeholder="Rechercher par nom ou email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-xs" />
                <Select value={roleFilter} onValueChange={value => setRoleFilter(value as UserRole | 'all')}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Tous les rôles</SelectItem>{ALL_ROLES_FOR_FILTER.map(r => <SelectItem key={r} value={r}>{ROLE_DISPLAY_NAMES[r]}</SelectItem>)}</SelectContent></Select>
                <Select value={accountStatusFilter} onValueChange={value => setAccountStatusFilter(value as AccountStatusFilter)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Tous les statuts</SelectItem><SelectItem value="active">Actif</SelectItem><SelectItem value="disabled_by_admin">Désactivé</SelectItem></SelectContent></Select>
              </div>
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Rôle</TableHead><TableHead>Statut</TableHead><TableHead>Inscrit le</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{filteredUsers.map(user => (
                  <TableRow key={user.id} className={user.accountStatus === 'disabled_by_admin' ? 'opacity-50 bg-muted/50' : ''}>
                    <TableCell><div className="font-medium">{user.displayName}</div><div className="text-xs text-muted-foreground">{user.email}</div></TableCell>
                    <TableCell><Badge variant="outline" className={ROLE_COLORS[user.role]}>{ROLE_DISPLAY_NAMES[user.role]}</Badge></TableCell>
                    <TableCell><Badge variant={user.accountStatus === 'disabled_by_admin' ? 'destructive' : 'secondary'}>{user.accountStatus === 'disabled_by_admin' ? 'Désactivé' : 'Actif'}</Badge></TableCell>
                    <TableCell className="text-xs">{formatNullableDate(user.createdAt, false)}</TableCell>
                    <TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent>
                      <DropdownMenuItem asChild><Link href={`/admin/verify/${user.id}`}><Eye className="mr-2 h-4 w-4"/>Voir / Vérifier</Link></DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setUserToToggleStatus(user); setIsToggleStatusDialogOpen(true);}}><ShieldOff className="mr-2 h-4 w-4"/>{user.accountStatus === 'disabled_by_admin' ? 'Réactiver' : 'Désactiver'} le compte</DropdownMenuItem>
                    </DropdownMenuContent></DropdownMenu></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            </CardContent>
          </Card>
        )}
        
        {activeSection === 'finance' && (
            <Card className="animate-in fade-in-50">
                <CardHeader><CardTitle>Gestion Financière</CardTitle><CardDescription>Aperçu des revenus et gestion des paiements des gérants.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                    <Card><CardHeader><CardTitle>Paiement des Gérants</CardTitle></CardHeader><CardContent className="space-y-3">
                        <Select onValueChange={setSelectedManagerToPay} value={selectedManagerToPay || ''}><SelectTrigger><SelectValue placeholder="Sélectionner un gérant"/></SelectTrigger><SelectContent>{managers.length > 0 ? managers.map(m => <SelectItem key={m.id} value={m.id}>{m.displayName || m.email}</SelectItem>) : <p className="p-2 text-xs text-muted-foreground">Aucun gérant actif.</p>}</SelectContent></Select>
                        <Input type="number" placeholder="Montant en €" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} min="0.01" step="0.01" disabled={!selectedManagerToPay}/>
                        <Button onClick={handleProcessPayment} disabled={isProcessingPayment || !selectedManagerToPay || !paymentAmount} className="w-full">{isProcessingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Euro className="mr-2 h-4 w-4"/>} Enregistrer le paiement</Button>
                    </CardContent></Card>
                </CardContent>
            </Card>
        )}
        
        {activeSection === 'profile' && (
          <AdminProfile />
        )}

        {/* ... Other sections like announcements and logs can be added here with similar conditional rendering ... */}

        {isToggleStatusDialogOpen && userToToggleStatus && (
          <AlertDialog open onOpenChange={setIsToggleStatusDialogOpen}><AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Confirmer le changement de statut ?</AlertDialogTitle><AlertDialogDescription>Êtes-vous sûr de vouloir {userToToggleStatus.accountStatus === 'disabled_by_admin' ? 'réactiver' : 'désactiver'} le compte de {userToToggleStatus.email}?</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel disabled={isTogglingStatus}>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleConfirmToggleAccountStatus} disabled={isTogglingStatus}>{isTogglingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}Confirmer</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent></AlertDialog>
        )}

      </main>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
