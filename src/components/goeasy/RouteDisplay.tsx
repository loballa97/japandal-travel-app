
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Milestone, Info, CheckCircle2, Zap, CalendarClock, Euro } from "lucide-react";
import type { Route } from '@/types';
import { cn } from '@/lib/utils';

interface RouteDisplayProps {
  routes: Route[];
  selectedRouteId?: string | null;
  onSelectRoute: (route: Route) => void;
  onReserveRoute?: (route: Route) => void; // Optional handler for reserving
  desiredPickupTimeInfo?: string; // Optional info about desired pickup time
}

export default function RouteDisplay({ routes, selectedRouteId, onSelectRoute, onReserveRoute, desiredPickupTimeInfo }: RouteDisplayProps) {
  if (routes.length === 0) {
    // This case should ideally be handled by the parent component, but as a fallback:
    return (
      <Card className="mt-6">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Aucun itinéraire disponible pour cette sélection.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-baseline">
        <h2 className="text-2xl font-headline font-semibold">Itinéraires Disponibles</h2>
        {desiredPickupTimeInfo && (
          <p className="text-xs text-muted-foreground mt-1 sm:mt-0 flex items-center">
            <CalendarClock className="h-3.5 w-3.5 mr-1.5"/> {desiredPickupTimeInfo}
          </p>
        )}
      </div>
      {routes.map((route) => {
        const IconComponent = route.icon;
        const isSelected = route.id === selectedRouteId;
        return (
          <Card 
            key={route.id} 
            className={cn(
                'transition-all cursor-pointer hover:shadow-md hover:border-primary/50',
                isSelected ? 'border-primary shadow-lg ring-2 ring-primary' : ''
            )}
            onClick={() => onSelectRoute(route)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                   <IconComponent className="h-6 w-6 mr-3 text-primary" />
                   <CardTitle className="text-xl font-headline">{route.name}</CardTitle>
                </div>
                {isSelected && <CheckCircle2 className="h-6 w-6 text-green-500" />}
              </div>
              <CardDescription>{route.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>Durée estimée : {route.eta}</span>
              </div>
              {route.distance && (
                <div className="flex items-center">
                  <Milestone className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>Distance: {route.distance}</span>
                </div>
              )}
              {typeof route.cost === 'number' && (
                <div className="flex items-center font-semibold text-base">
                  <Euro className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>Prix estimé : {route.cost.toFixed(2)} €</span>
                </div>
              )}
              {route.details && (
                <div className="flex items-start">
                  <Info className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>{route.details}</span>
                </div>
              )}
            </CardContent>
            {isSelected && onReserveRoute && (
              <CardFooter>
                 <Button 
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={(_e) => {
                      e.stopPropagation(); // Prevent card's onClick from firing
                      onReserveRoute(route);
                  }}
                 >
                  <Zap className="mr-2 h-4 w-4" />
                  Réserver ce trajet
                </Button>
              </CardFooter>
            )}
          </Card>
        );
      })}
    </div>
  );
}
