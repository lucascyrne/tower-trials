import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from '@/components/ui/button';
import { MessageCircle, Filter, Eye, EyeOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

interface GameLogEntry {
  text: string;
  type: 'system' | 'battle' | 'lore' | 'skill_xp' | 'level_up' | 'equipment';
}

interface GameLogProps {
  gameLog: GameLogEntry[];
}

interface LogFilter {
  system: boolean;
  battle: boolean;
  lore: boolean;
  skill_xp: boolean;
  level_up: boolean;
  equipment: boolean;
}

export function GameLog({ gameLog }: GameLogProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<LogFilter>({
    system: true,
    battle: true,
    lore: true,
    skill_xp: true,
    level_up: true,
    equipment: true,
  });

  // Auto-scroll para o final quando novos logs chegarem
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [gameLog]);

  const handleFilterChange = (filterType: keyof LogFilter, value: boolean) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const toggleAllFilters = (enabled: boolean) => {
    setFilters({
      system: enabled,
      battle: enabled,
      lore: enabled,
      skill_xp: enabled,
      level_up: enabled,
      equipment: enabled,
    });
  };

  const filteredLogs = gameLog.filter(log => filters[log.type]);

  const getLogColor = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'system': return 'text-blue-500';
      case 'battle': return 'text-foreground';
      case 'lore': return 'text-purple-500 italic';
      case 'skill_xp': return 'text-green-600';
      case 'level_up': return 'text-yellow-500 font-semibold';
      case 'equipment': return 'text-orange-500';
      default: return 'text-foreground';
    }
  };

  const getFilterLabel = (type: keyof LogFilter) => {
    switch (type) {
      case 'system': return 'Sistema';
      case 'battle': return 'Batalha';
      case 'lore': return 'História';
      case 'skill_xp': return 'XP de Habilidade';
      case 'level_up': return 'Level Up';
      case 'equipment': return 'Equipamentos';
      default: return type;
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Log de Eventos</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredLogs.length}/{gameLog.length}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filtros do Log</h4>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAllFilters(true)}
                      className="h-6 px-2 text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Todos
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAllFilters(false)}
                      className="h-6 px-2 text-xs"
                    >
                      <EyeOff className="h-3 w-3 mr-1" />
                      Nenhum
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(filters).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={value}
                        onCheckedChange={(checked) => 
                          handleFilterChange(key as keyof LogFilter, !!checked)
                        }
                      />
                      <label
                        htmlFor={key}
                        className={`text-sm font-medium cursor-pointer ${getLogColor(key as GameLogEntry['type'])}`}
                      >
                        {getFilterLabel(key as keyof LogFilter)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea ref={scrollAreaRef} className="h-48 rounded border p-2">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {gameLog.length === 0 ? 'Nenhum evento ainda' : 'Nenhum evento corresponde aos filtros'}
                </p>
              </div>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div 
                key={index} 
                className={`mb-2 text-sm ${getLogColor(log.type)}`}
              >
                {log.text}
              </div>
            ))
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 