// src/app/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, userProfile, loading } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Header />
      </div>
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-lg text-center p-8 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h1 className="text-4xl font-headline font-bold text-primary">
              Bienvenue sur JAPANDAL
            </h1>
            <p className="text-lg text-muted-foreground pt-2">
              Votre compagnon de voyage intelligent.
            </p>
          </div>
          <div className="p-6 pt-0 space-y-6">
            {!isClient || loading ? (
              <div className="flex justify-center items-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <p>Chargement...</p>
              </div>
            ) : user ? (
              <div className="space-y-4">
                <p className="mb-4">Bonjour, {user.displayName || user.email}!</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {/* Bouton réservation uniquement pour les clients */}
                  {userProfile?.role === 'customer' && (
                    <Link href="/booking">
                      <Button size="lg" className="bg-primary hover:bg-primary/90">
                        Réserver un trajet
                      </Button>
                    </Link>
                  )}
                  {/* Bouton dashboard pour chauffeurs, managers et admins */}
                  {userProfile?.role === 'driver' && (
                    <Link href="/driver">
                      <Button size="lg" className="bg-primary hover:bg-primary/90">
                        Mon tableau de bord
                      </Button>
                    </Link>
                  )}
                  {userProfile?.role === 'manager' && (
                    <Link href="/manager">
                      <Button size="lg" className="bg-primary hover:bg-primary/90">
                        Gestion
                      </Button>
                    </Link>
                  )}
                  {(userProfile?.role === 'admin' || userProfile?.role === 'sub-admin') && (
                    <Link href="/admin">
                      <Button size="lg" className="bg-primary hover:bg-primary/90">
                        Administration
                      </Button>
                    </Link>
                  )}
                  <Link href="/profile">
                    <Button variant="outline" size="lg">
                      Voir mon profil
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p>Réservez facilement vos trajets aéroport ↔ domicile</p>
                <Link href="/signup">
                  <Button size="lg" className="bg-primary hover:bg-primary/90">
                    Commencer maintenant
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
