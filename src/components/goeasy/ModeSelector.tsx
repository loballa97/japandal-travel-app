
"use client";

import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarIcon, Briefcase, Award } from "lucide-react"; // Updated icons
import { cn } from '@/lib/utils';
import type { TransportMode } from '@/types'; // Updated import

interface ModeSelectorProps {
  selectedMode: TransportMode;
  onSelectMode: (mode: TransportMode) => void;
}

const modes: { id: TransportMode; label: string; icon: React.ReactNode }[] = [
  { id: "economy", label: "Economy", icon: <CarIcon className="mr-2 h-5 w-5" /> },
  { id: "business", label: "Business", icon: <Briefcase className="mr-2 h-5 w-5" /> },
  { id: "first_class", label: "1ère Classe", icon: <Award className="mr-2 h-5 w-5" /> },
];

export default function ModeSelector({ selectedMode, onSelectMode }: ModeSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-headline">Choisir la Gamme</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {modes.map((mode) => (
            <Button
              key={mode.id}
              variant={selectedMode === mode.id ? "default" : "outline"}
              onClick={() => onSelectMode(mode.id)}
              className={cn(
                "flex flex-col h-auto p-3 items-center justify-center text-center",
                selectedMode === mode.id ? "bg-primary text-primary-foreground" : "border-primary text-primary hover:bg-primary/10"
              )}
            >
              {mode.icon}
              <span className="mt-1 text-xs">{mode.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
