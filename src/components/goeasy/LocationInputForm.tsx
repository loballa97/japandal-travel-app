// src/components/goeasy/LocationInputForm.tsx
"use client";

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { MapPin, Search, Clock, AlertTriangle, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent } from '@/components/ui/card';
import { useGoogleMaps } from '@/contexts/GoogleMapsContext';
import { Autocomplete } from '@react-google-maps/api';

const formSchema = z.object({
  startLocation: z.string().min(2, { message: "Start location must be at least 2 characters." }),
  destinationLocation: z.string().min(2, { message: "Destination must be at least 2 characters." }),
  pickupDate: z.date().optional(),
  pickupTime: z.string().optional(),
}).refine(data => {
  if (data.pickupDate && !data.pickupTime) return false;
  if (!data.pickupDate && data.pickupTime) return false;
  return true;
}, {
  message: "Please provide both date and time for pickup, or leave both empty for immediate booking.",
  path: ["pickupTime"],
});


export type LocationFormData = z.infer<typeof formSchema>;

interface LocationInputFormProps {
  onSubmit: (data: LocationFormData) => void;
  isLoading: boolean;
  onAddressSelected: (coords: google.maps.LatLngLiteral) => void;
}

export default function LocationInputForm({ onSubmit, isLoading, onAddressSelected }: LocationInputFormProps) {
  const { isLoaded, loadError } = useGoogleMaps();

  const form = useForm<LocationFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startLocation: "",
      destinationLocation: "",
      pickupDate: undefined,
      pickupTime: "",
    },
  });

  const startAutocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const destinationAutocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);

  const onLoadStart = (autocompleteInstance: google.maps.places.Autocomplete) => {
    startAutocompleteRef.current = autocompleteInstance;
  };

  const onPlaceChangedStart = () => {
    if (startAutocompleteRef.current) {
      const place = startAutocompleteRef.current.getPlace();
      const address = place.formatted_address || (place.name ? `${place.name}${place.vicinity ? `, ${place.vicinity}` : ''}`.trim() : '');
      if (address) {
        form.setValue('startLocation', address, { shouldValidate: true });
        if (place.geometry?.location) {
          onAddressSelected(place.geometry.location.toJSON());
        }
      }
    }
  };

  const onLoadDestination = (autocompleteInstance: google.maps.places.Autocomplete) => {
    destinationAutocompleteRef.current = autocompleteInstance;
  };

  const onPlaceChangedDestination = () => {
    if (destinationAutocompleteRef.current) {
      const place = destinationAutocompleteRef.current.getPlace();
      const address = place.formatted_address || (place.name ? `${place.name}${place.vicinity ? `, ${place.vicinity}` : ''}`.trim() : '');
      if (address) {
        form.setValue('destinationLocation', address, { shouldValidate: true });
        if (place.geometry?.location) {
          onAddressSelected(place.geometry.location.toJSON());
        }
      }
    }
  };

  const handleFormSubmit: SubmitHandler<LocationFormData> = (data) => {
    onSubmit(data);
  };

  const apiKeyMissing = !(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '');

  if (loadError || apiKeyMissing) {
    return (
      <Card className="border-destructive bg-destructive/5 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center text-destructive mb-2">
            <AlertTriangle className="mr-2 h-5 w-5" />
            <p className="font-semibold text-base">Erreur Critique: Configuration Google Maps</p>
          </div>
          <div className="text-xs text-destructive space-y-1.5">
            <p>Le chargement des suggestions d'adresses a échoué. Cela est généralement dû à un problème avec votre clé API Google Maps ou sa configuration.</p>
            <p className="font-bold">ACTIONS PRIORITAIRES À VÉRIFIER DANS L'ORDRE :</p>
            <ol className="list-decimal list-inside space-y-1">
              <li className={apiKeyMissing ? "font-extrabold text-destructive" : ""}>
                <span className="font-bold">Fichier <code>.env</code> :</span> Assurez-vous que votre fichier <code>.env</code> (à la racine du projet) contient bien la ligne :
                <pre className="inline bg-destructive/20 p-0.5 rounded text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=VOTRE_CLÉ_API_ICI</pre>
                Remplacez <code>VOTRE_CLÉ_API_ICI</code> par votre clé.
                {apiKeyMissing && <span className="font-extrabold"> (Cette variable semble manquante ou vide !)</span>}
              </li>
              <li className="font-extrabold text-red-700 dark:text-red-400">
                <span className="underline">TRÈS IMPORTANT : REDÉMARREZ VOTRE SERVEUR</span> de développement (<code>npm run dev</code>) APRÈS TOUTE MODIFICATION du fichier <code>.env</code>.
              </li>
              <li>
                <span className="font-bold">Dans la console Google Cloud :</span>
                  <ul className="list-disc list-inside pl-5 mt-0.5 space-y-0.5">
                      <li>La <span className="font-bold">FACTURATION</span> doit être activée pour votre projet.</li>
                      <li>Les API suivantes doivent être <span className="font-bold">ACTIVÉES</span> : <strong>Maps JavaScript API</strong>, <strong>Places API</strong> et <strong>Routes API</strong>. L'oubli de la "Places API" est la cause la plus fréquente de l'absence de suggestions.</li>
                  </ul>
              </li>
              <li>
                <span className="font-bold">Restrictions de clé API :</span> Si vous avez des restrictions, vérifiez qu'elles autorisent votre domaine de développement (ex: <code>localhost</code>) ET les 3 API listées ci-dessus.
              </li>
            </ol>
            {loadError && <p className="mt-1">Message technique: <code>{loadError.message}</code></p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="startLocation"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center">
                <MapPin className="mr-2 h-4 w-4 text-primary" />
                Lieu de départ
              </FormLabel>
              <FormControl>
                {isLoaded ? (
                  <Autocomplete
                    onLoad={onLoadStart}
                    onPlaceChanged={onPlaceChangedStart}
                    options={{ types: ['geocode', 'establishment'] }}
                    className="w-full"
                  >
                    <Input placeholder="Ex: 123 Rue Principale, Ville" {...field} />
                  </Autocomplete>
                ) : (
                  <Input placeholder="Chargement des suggestions..." {...field} disabled />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="destinationLocation"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center">
                <MapPin className="mr-2 h-4 w-4 text-primary" />
                Destination
              </FormLabel>
              <FormControl>
                {isLoaded ? (
                  <Autocomplete
                    onLoad={onLoadDestination}
                    onPlaceChanged={onPlaceChangedDestination}
                    options={{ types: ['geocode', 'establishment'] }}
                    className="w-full"
                  >
                    <Input placeholder="Ex: Parc Central, Ville" {...field} />
                  </Autocomplete>
                ) : (
                  <Input placeholder="Chargement des suggestions..." {...field} disabled />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="pickupDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center">
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  Date de prise en charge (Optionnel)
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Choisir une date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0,0,0,0))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pickupTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center">
                  <Clock className="mr-2 h-4 w-4 text-primary" />
                  Heure de prise en charge (Optionnel)
                </FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    {...field}
                    className={cn(!form.getValues("pickupDate") && field.value ? "border-destructive" : "")}
                    disabled={!form.watch("pickupDate")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Laissez la date et l'heure vides pour un départ immédiat. Si vous indiquez une date, précisez aussi l'heure.
        </p>

        <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isLoading || !isLoaded}>
          <Search className="mr-2 h-5 w-5" />
          {isLoading ? "Recherche..." : (isLoaded ? "Trouver des itinéraires" : "Services de carte en chargement...")}
        </Button>
      </form>
    </Form>
  );
}
