'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, Coins, Users } from 'lucide-react';
import { RankingMode } from '@/resources/game/ranking-service';

interface RankingFiltersProps {
  activeMode: RankingMode;
  onModeChange: (mode: RankingMode) => void;
  aliveOnly: boolean;
  onAliveFilterChange: (aliveOnly: boolean) => void;
}

const RankingFilters: React.FC<RankingFiltersProps> = ({
  activeMode,
  onModeChange,
  aliveOnly,
  onAliveFilterChange
}) => {
  const modes = [
    {
      key: 'highest_floor' as RankingMode,
      label: 'Andar Mais Alto',
      icon: Trophy,
      color: 'text-yellow-500'
    },
    {
      key: 'level' as RankingMode,
      label: 'Maior Nível',
      icon: TrendingUp,
      color: 'text-blue-500'
    },
    {
      key: 'gold' as RankingMode,
      label: 'Mais Rico',
      icon: Coins,
      color: 'text-amber-500'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Filtros de Modalidade */}
      <div>
        <h3 className="text-sm font-medium mb-2">Modalidade</h3>
        <div className="flex flex-wrap gap-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = activeMode === mode.key;
            
            return (
              <Button
                key={mode.key}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange(mode.key)}
                className={`flex items-center gap-2 ${isActive ? '' : 'hover:bg-muted'}`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : mode.color}`} />
                <span className="hidden sm:inline">{mode.label}</span>
                <span className="sm:hidden">
                  {mode.key === 'highest_floor' ? 'Andar' : 
                   mode.key === 'level' ? 'Nível' : 'Ouro'}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Filtro de Status */}
      <div>
        <h3 className="text-sm font-medium mb-2">Status dos Personagens</h3>
        <div className="flex gap-2">
          <Button
            variant={!aliveOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => onAliveFilterChange(false)}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Todos
          </Button>
          <Button
            variant={aliveOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => onAliveFilterChange(true)}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4 text-green-500" />
            <span className="hidden sm:inline">Apenas Vivos</span>
            <span className="sm:hidden">Vivos</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RankingFilters; 