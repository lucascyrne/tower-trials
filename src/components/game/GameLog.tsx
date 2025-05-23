import React, { useEffect, useRef } from 'react';
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para o final quando novos logs chegarem
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [gameLog]);

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Log de Eventos</CardTitle>
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <ScrollArea ref={scrollAreaRef} className="h-48 rounded border p-2">
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