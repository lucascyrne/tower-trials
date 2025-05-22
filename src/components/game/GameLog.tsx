import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle } from "lucide-react";

interface GameLogEntry {
  text: string;
  type: 'system' | 'battle' | 'lore';
}

interface GameLogProps {
  gameLog: GameLogEntry[];
}

export function GameLog({ gameLog }: GameLogProps) {
  return (
    <Card className="mt-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Log de Eventos</CardTitle>
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48 rounded border p-2">
          {gameLog.map((log, index) => (
            <div 
              key={index} 
              className={`mb-2 text-sm ${
                log.type === 'system' 
                  ? 'text-blue-500' 
                  : log.type === 'lore' 
                    ? 'text-purple-500 italic' 
                    : 'text-foreground'
              }`}
            >
              {log.text}
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 