"use client";

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function PwaRegistry() {
  const { toast } = useToast();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
log('JAPANDAL ServiceWorker registration successful with scope: ', registration.scope);
            // Vous pourriez ajouter un toast ici pour informer l'utilisateur
            // que l'application peut être installée, ou qu'une mise à jour est disponible.
            // Cela nécessite une logique plus avancée (écouter 'beforeinstallprompt', etc.).
          })
          .catch(err => {
            console.error('JAPANDAL ServiceWorker registration failed: ', err);
            // Ne pas afficher de toast d'erreur ici pour ne pas alarmer l'utilisateur
            // si le SW ne s'enregistre pas (ex: en développement avec des rechargements rapides)
            // Sauf si c'est une erreur critique persistante.
            // toast({
            //   variant: "destructive",
            //   title: "Erreur PWA",
            //   description: "L'enregistrement du Service Worker a échoué. Les fonctionnalités hors ligne pourraient ne pas être disponibles.",
            // });
          });
      });
    }
  }, [toast]); // toast est inclus dans les dépendances si vous décidez de l'utiliser à l'intérieur

  return null; // Ce composant ne rend rien visuellement
}