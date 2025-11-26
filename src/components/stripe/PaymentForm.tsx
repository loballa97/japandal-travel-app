// src/components/stripe/PaymentForm.tsx
"use client";

import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface PaymentFormProps {
  clientSecret: string;
  onPaymentSuccess: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ clientSecret, onPaymentSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (_event: React.FormEvent<HTMLFormElement>) => {
    _event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      // Disable form submission until Stripe.js has loaded.
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        // Make sure to change this to your payment completion page
 return_url: `${window.location.origin}/payment-status`, // Replace with your success/status page URL
      },
    });

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`. For complicated integrations you might want to factor
    // out the error handling into a separate endpoint.
    if (error) {
      if (error.type === "card_error" || error.type === "validation_error") {
        toast({
          variant: "destructive",
          title: "Erreur de paiement",
          description: error.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erreur inattendue",
          description: "Une erreur inattendue est survenue.",
        });
      }
      setIsLoading(false);
    } else {
      // Payment succeeded. The user will be redirected by `return_url`.
      // You might still want to call onPaymentSuccess here for immediate feedback
      // before the redirect, depending on your flow.
      onPaymentSuccess();
    }
  };

  const paymentElementOptions = {
    layout: 'tabs', // or 'accordion', 'embedded', 'seamless'
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      {/* Stripe Payment Element */}
      <PaymentElement id="payment-element" options={paymentElementOptions} />

      {/* Submit button */}
      <Button disabled={isLoading || !stripe || !elements} type="submit" className="w-full mt-4">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Payer maintenant
      </Button>
    </form>
  );
};

export default PaymentForm;