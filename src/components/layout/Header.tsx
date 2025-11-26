
"use client";

import * as React from 'react';
import Link from 'next/link';
import { LogIn, UserPlus, LogOut, Loader2, Briefcase, Shield, LayoutDashboard, History, ListChecks, UserCog, Sun, Moon, Laptop, Navigation } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { doc, getDoc } from 'firebase/firestore'; 
import { firestore } from '@/lib/firebase'; 
import type { UserProfile, UserRole } from '@/types';
import { useTheme } from "next-themes";

export default function Header() {
  const { user, loading, logout } = useAuth();
  const { _toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = React.useState<UserRole | null>(null);
  const [displayName, setDisplayName] = React.useState<string | null | undefined>(null);
  const { setTheme } = useTheme();

  React.useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      const fetchUserProfile = async () => {
        const userProfileRef = doc(firestore, "userProfiles", user.uid);
        const docSnap = await getDoc(userProfileRef);
        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          setUserRole(profile.role);
          if (profile.displayName) {
            setDisplayName(profile.displayName);
          }
        } else {
          setUserRole("customer");
        }
      };
      fetchUserProfile();
    } else {
      setUserRole(null);
      setDisplayName(null);
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const userInitial = displayName ? displayName.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : "?");

  const showAuthButtons = !user && !['/login', '/signup'].includes(pathname);

  // Determine the correct home URL depending on the authenticated user and their role.
  // When not authenticated, link to the public landing page (`/`).
  const homeHref = user
    ? (
      userRole === 'driver' ? '/driver' :
      userRole === 'manager' ? '/manager' :
      (userRole === 'admin' || userRole === 'sub_admin') ? '/admin' :
      '/profile'
    )
    : '/';

  return (
    <header className="flex items-center justify-between pb-3 mb-3 sm:pb-4 sm:mb-4 md:pb-6 md:mb-6 border-b">
      <Link href={homeHref} className="flex items-center space-x-2 group">
        <Navigation className="h-7 w-7 sm:h-8 sm:w-8 text-primary group-hover:text-primary/80 transition-colors" /> 
        <h1 className="text-2xl sm:text-3xl font-headline font-semibold text-primary group-hover:text-primary/80 transition-colors">JAPANDAL</h1>
      </Link>

      <nav className="flex items-center space-x-1 sm:space-x-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
              <Sun className="h-[1.1rem] w-[1.1rem] sm:h-[1.2rem] sm:w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.1rem] w-[1.1rem] sm:h-[1.2rem] sm:w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Changer de thème</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />
              Clair
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />
              Sombre
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Laptop className="mr-2 h-4 w-4" />
              Système
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full p-0">
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                  <AvatarImage src={user.photoURL || undefined} alt={displayName || user.email || "User"} />
                  <AvatarFallback>{userInitial}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayName || "Utilisateur"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
               {userRole === 'customer' && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center w-full">
                      <UserCog className="mr-2 h-4 w-4" />
                      Mon Profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/my-reservations" className="flex items-center w-full">
                      <ListChecks className="mr-2 h-4 w-4" />
                      Mes Réservations
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/ride-history" className="flex items-center w-full">
                      <History className="mr-2 h-4 w-4" />
                      Historique des Trajets
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              {userRole === 'driver' && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/driver" className="flex items-center w-full">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Tableau de Bord Chauffeur
                    </Link>
                  </DropdownMenuItem>
                   <DropdownMenuItem asChild>
                    <Link href="/driver/profile" className="flex items-center w-full">
                      <UserCog className="mr-2 h-4 w-4" />
                      Mon Profil Chauffeur
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/driver/history" className="flex items-center w-full">
                      <History className="mr-2 h-4 w-4" />
                      Historique des Courses
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              {userRole === 'manager' && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/manager" className="flex items-center w-full">
                       <Briefcase className="mr-2 h-4 w-4" />
                      Tableau de Bord Gérant
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/manager/history" className="flex items-center w-full">
                      <History className="mr-2 h-4 w-4" />
                      Historique Global Courses
                    </Link>
                  </DropdownMenuItem>
                   <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center w-full">
                      <UserCog className="mr-2 h-4 w-4" />
                      Mon Profil
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              {(userRole === 'admin' || userRole === 'sub_admin') && (
                <>
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center w-full">
                    <Shield className="mr-2 h-4 w-4" />
                    Tableau de Bord Admin
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin?section=profile" className="flex items-center w-full">
                    <UserCog className="mr-2 h-4 w-4" />
                     Mon Profil
                  </Link>
                </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : showAuthButtons ? (
          <>
            <Button variant="ghost" asChild size="sm">
              <Link href="/login">
                <LogIn className="mr-1 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Connexion</span>
                 <span className="sm:hidden">Login</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/signup">
                <UserPlus className="mr-1 h-4 w-4 sm:mr-2" />
                 <span className="hidden sm:inline">Inscription</span>
                 <span className="sm:hidden">S'inscrire</span>
              </Link>
            </Button>
          </>
        ) : null }
      </nav>
    </header>
  );
}
