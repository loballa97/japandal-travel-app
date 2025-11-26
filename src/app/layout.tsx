
// src/app/layout.tsx
// NO "use client" here

import type { Metadata } from 'next';
import './globals.css';
import React from 'react';
import AppProviders from '@/components/AppProviders'; // Import the new provider wrapper

export const metadata: Metadata = {
  title: 'JAPANDAL - Votre Voyage Simplifié',
  description: 'Planifiez vos trajets avec JAPANDAL, votre compagnon de voyage simple et intelligent.',
  manifest: '/manifest.json'
};

export const viewport = {
  themeColor: '#4ECDC4',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-body antialiased">
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
