"use client";

import React, { useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGoogleMaps } from '@/contexts/GoogleMapsContext';
import { MapPin } from 'lucide-react';

interface LocationInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string, placeDetails?: google.maps.places.PlaceResult) => void;
  required?: boolean;
}

export default function LocationInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  required = false,
}: LocationInputProps) {
  const { isLoaded } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    // Initialiser l'autocomplete Google Places
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'name', 'place_id'],
      componentRestrictions: { country: ['fr', 'sn'] }, // France et Sénégal
      types: ['address'], // Seulement les adresses
    });

    // Écouter la sélection d'un lieu
    const listener = autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (place && place.formatted_address) {
        onChange(place.formatted_address, place);
      }
    });

    return () => {
      if (listener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [isLoaded, onChange]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        <MapPin className="inline h-4 w-4 mr-1" />
        {label}
      </Label>
      <Input
        ref={inputRef}
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete="off"
      />
      {!isLoaded && (
        <p className="text-xs text-muted-foreground">
          Chargement de l'autocomplétion...
        </p>
      )}
    </div>
  );
}
