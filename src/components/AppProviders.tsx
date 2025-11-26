// src/components/AppProviders.tsx
"use client";

import React from 'react';
import { GoogleMapsProvider } from '@/contexts/GoogleMapsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe as StripeType } from '@stripe/stripe-js';
import { ThemeProvider } from 'next-themes';
import PwaRegistry from '@/components/PwaRegistry';
import { Toaster } from "@/components/ui/toaster";

// This is a singleton instance
let stripePromise: Promise<StripeType | null> | null = null;

const getStripe = () => {
    if (!stripePromise) {
        const stripeKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY ?? '');
        if (stripeKey) {
            stripePromise = loadStripe(stripeKey);
        } else {
            console.warn(
                "Stripe public key (NEXT_PUBLIC_STRIPE_PUBLIC_KEY) is missing. Stripe functionality will be disabled."
            );
        }
    }
    return stripePromise;
};

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const stripe = getStripe();

  return (
    <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
    >
      <AuthProvider>
        <GoogleMapsProvider>
          {stripe ? (
            <Elements stripe={stripe}>{children}</Elements>
          ) : (
            <>{children}</>
          )}
          <PwaRegistry />
          <Toaster />
        </GoogleMapsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
