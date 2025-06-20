import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageCircle, Filter, Eye, EyeOff, Sword, Shield, Zap, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

interface GameLogEntry {
  text: string;
  type:
    | 'system'
    | 'battle'
    | 'lore'
    | 'skill_xp'
    | 'level_up'
    | 'equipment'
    | 'enemy_action'
    | 'player_action'
    | 'damage'
    | 'healing';
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
  enemy_action: boolean;
  player_action: boolean;
  damage: boolean;
  healing: boolean;
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
    enemy_action: true,
    player_action: true,
    damage: true,
    healing: true,
  });

  // Auto-scroll para o final quando novos logs chegarem
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
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
      enemy_action: enabled,
      player_action: enabled,
      damage: enabled,
      healing: enabled,
    });
  };

  const filteredLogs = gameLog.filter(log => filters[log.type]);

  const getLogColor = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'system':
        return 'text-blue-400';
      case 'battle':
        return 'text-foreground';
      case 'lore':
        return 'text-purple-400 italic';
      case 'skill_xp':
        return 'text-green-400';
      case 'level_up':
        return 'text-yellow-400 font-semibold';
      case 'equipment':
        return 'text-orange-400';
      case 'enemy_action':
        return 'text-red-400';
      case 'player_action':
        return 'text-blue-400';
      case 'damage':
        return 'text-red-300';
      case 'healing':
        return 'text-green-300';
      default:
        return 'text-foreground';
    }
  };

  const getLogIcon = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'enemy_action':
        return <Sword className="h-3 w-3 text-red-400 mr-2" />;
      case 'player_action':
        return <Shield className="h-3 w-3 text-blue-400 mr-2" />;
      case 'damage':
        return <Zap className="h-3 w-3 text-red-300 mr-2" />;
      case 'healing':
        return <Sparkles className="h-3 w-3 text-green-300 mr-2" />;
      case 'level_up':
        return <span className="mr-2">🌟</span>;
      case 'equipment':
        return <span className="mr-2">⚔️</span>;
      case 'skill_xp':
        return <span className="mr-2">📈</span>;
      case 'lore':
        return <span className="mr-2">📜</span>;
      default:
        return null;
    }
  };

  const getFilterLabel = (type: keyof LogFilter) => {
    switch (type) {
      case 'system':
        return 'Sistema';
      case 'battle':
        return 'Batalha';
      case 'lore':
        return 'História';
      case 'skill_xp':
        return 'XP de Habilidade';
      case 'level_up':
        return 'Level Up';
      case 'equipment':
        return 'Equipamentos';
      case 'enemy_action':
        return 'Ações do Inimigo';
      case 'player_action':
        return 'Ações do Jogador';
      case 'damage':
        return 'Dano';
      case 'healing':
        return 'Cura';
      default:
        return type;
    }
  };

  const formatLogMessage = (log: GameLogEntry) => {
    // Melhorar a formatação de mensagens de batalha
    let message = log.text;

    // Detectar e formatar danos
    if (message.includes('causou') && message.includes('de dano')) {
      const damageMatch = message.match(/(\d+)\s+de dano/);
      if (damageMatch) {
        const damage = damageMatch[1];
        message = message.replace(`${damage} de dano`, `**${damage}** de dano`);
      }
    }

    // Detectar e formatar cura
    if (message.includes('recuperou') && message.includes('HP')) {
      const healMatch = message.match(/(\d+)\s+HP/);
      if (healMatch) {
        const heal = healMatch[1];
        message = message.replace(`${heal} HP`, `**${heal}** HP`);
      }
    }

    return message;
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Log de Batalha
        </CardTitle>
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
            <PopoverContent className="w-80" align="end">
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
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(filters).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={value}
                        onCheckedChange={checked =>
                          handleFilterChange(key as keyof LogFilter, !!checked)
                        }
                      />
                      <label
                        htmlFor={key}
                        className={`text-xs font-medium cursor-pointer ${getLogColor(key as GameLogEntry['type'])}`}
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
        <ScrollArea
          ref={scrollAreaRef}
          className="h-56 rounded border p-3 bg-card/50 backdrop-blur-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {gameLog.length === 0
                    ? 'Nenhum evento ainda'
                    : 'Nenhum evento corresponde aos filtros'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, index) => (
                <div
                  key={`${index}-${log.text.substring(0, 20)}`}
                  className={`flex items-start text-sm leading-relaxed ${getLogColor(log.type)} transition-all duration-200 hover:bg-muted/20 rounded p-2 -m-2`}
                >
                  {getLogIcon(log.type)}
                  <span
                    className="flex-1"
                    dangerouslySetInnerHTML={{
                      __html: formatLogMessage(log).replace(
                        /\*\*(.+?)\*\*/g,
                        '<strong class="text-yellow-300">$1</strong>'
                      ),
                    }}
                  />
                  <span className="text-xs text-muted-foreground/60 ml-2 flex-shrink-0">
                    {new Date().toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
