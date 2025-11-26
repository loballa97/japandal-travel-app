
"use client";

import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, RefreshCw, AlertTriangle, CheckCircle2, Timer, ShieldAlert, Ban, Info } from "lucide-react";
import { getRealTimeUpdates, type RealTimeUpdatesInput, type RealTimeUpdatesOutput } from '@/ai/flows/real-time-update';
import type { Route, TransportMode } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface IntelligentUpdatesPanelProps {
  route: Route | null;
  startLocation: string;
  destinationLocation: string;
}

const statusIcons: Record<RealTimeUpdatesOutput['overallStatus'], React.ElementType> = {
  smooth: CheckCircle2,
  minor_delays: Timer,
  significant_delays: ShieldAlert,
  disrupted: Ban,
};

const statusColors: Record<RealTimeUpdatesOutput['overallStatus'], string> = {
  smooth: "text-green-600 bg-green-50 border-green-200",
  minor_delays: "text-yellow-600 bg-yellow-50 border-yellow-200",
  significant_delays: "text-orange-600 bg-orange-50 border-orange-200",
  disrupted: "text-red-600 bg-red-50 border-red-200",
};

const statusTexts: Record<RealTimeUpdatesOutput['overallStatus'], string> = {
  smooth: "Smooth Sailing",
  minor_delays: "Minor Delays",
  significant_delays: "Significant Delays",
  disrupted: "Route Disrupted",
};

const getRouteModeText = (mode: TransportMode) => {
  switch (mode) {
    case 'economy': return 'Economy';
    case 'business': return 'Business';
    case 'first_class': return '1ère Classe';
    default: return mode;
  }
};

export default function IntelligentUpdatesPanel({ route, startLocation, destinationLocation }: IntelligentUpdatesPanelProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [updateData, setUpdateData] = React.useState<RealTimeUpdatesOutput | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const { toast } = useToast();

  const handleGetUpdates = async () => {
    if (!route) return;

    setIsLoading(true);
    setUpdateData(null);
    setErrorMessage(null);

    const input: RealTimeUpdatesInput = {
      routeDescription: `Route from ${startLocation} to ${destinationLocation} using ${getRouteModeText(route.mode)} (${route.name}: ${route.description}).`,
    };

    try {
      const result = await getRealTimeUpdates(input);
      setUpdateData(result);
    } catch (error) {
      console.error("Error fetching real-time updates:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setErrorMessage(`Failed to get updates: ${message}`);
      toast({
        variant: "destructive",
        title: "Update Error",
        description: `Could not fetch real-time updates. ${message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    setUpdateData(null);
    setErrorMessage(null);
  }, [route]);

  if (!route) {
    return null; 
  }

  const StatusIcon = updateData ? statusIcons[updateData.overallStatus] : null;

  return (
    <Card className="mt-6 bg-card border">
      <CardHeader>
        <div className="flex items-center">
          <Lightbulb className="h-6 w-6 mr-3 text-primary" />
          <CardTitle className="text-xl font-headline text-primary">Intelligent Updates</CardTitle>
        </div>
        <CardDescription>Get AI-powered real-time information about your selected route.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
        {errorMessage && !isLoading && (
          <div className="flex items-start p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/30">
            <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}
        {updateData && !isLoading && (
          <div className={cn("space-y-3 p-4 rounded-lg border", statusColors[updateData.overallStatus])}>
            <div className="flex items-center">
              {StatusIcon && <StatusIcon className="h-6 w-6 mr-3 flex-shrink-0" />}
              <div className='flex flex-col'>
                <p className="font-semibold text-base">{statusTexts[updateData.overallStatus]}</p>
                <p className="text-sm">{updateData.statusMessage}</p>
              </div>
            </div>
            {updateData.estimatedDelay && (
              <div className="flex items-center text-sm pl-9"> 
                <Timer className="h-4 w-4 mr-2 flex-shrink-0" />
                <div>
                  <span className="font-medium">Estimated Delay: </span>{updateData.estimatedDelay}
                </div>
              </div>
            )}
            {updateData.suggestedAction && (
              <div className="flex items-start text-sm pl-9">
                <Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Suggestion: </span>{updateData.suggestedAction}
                </div>
              </div>
            )}
          </div>
        )}
        <Button onClick={handleGetUpdates} disabled={isLoading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? "Getting Updates..." : "Get Live Updates"}
        </Button>
      </CardContent>
    </Card>
  );
}

