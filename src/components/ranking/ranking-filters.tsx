'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, Coins, Users, Heart, Skull } from 'lucide-react';
import { RankingMode } from '@/resources/game/ranking.service';

export type CharacterStatusFilter = 'all' | 'alive' | 'dead';

interface RankingFiltersProps {
  activeMode: RankingMode;
  onModeChange: (mode: RankingMode) => void;
  statusFilter: CharacterStatusFilter;
  onStatusFilterChange: (filter: CharacterStatusFilter) => void;
}

const RankingFilters: React.FC<RankingFiltersProps> = ({
  activeMode,
  onModeChange,
  statusFilter,
  onStatusFilterChange
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

  const statusOptions = [
    {
      key: 'all' as CharacterStatusFilter,
      label: 'Todos',
      shortLabel: 'Todos',
      icon: Users,
      color: 'text-gray-500'
    },
    {
      key: 'alive' as CharacterStatusFilter,
      label: 'Apenas Vivos',
      shortLabel: 'Vivos',
      icon: Heart,
      color: 'text-green-500'
    },
    {
      key: 'dead' as CharacterStatusFilter,
      label: 'Apenas Mortos',
      shortLabel: 'Mortos',
      icon: Skull,
      color: 'text-red-500'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Filtros de Modalidade */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Modalidade</h3>
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
                className={`flex items-center gap-2 text-xs ${isActive ? '' : 'hover:bg-muted'}`}
              >
                <Icon className={`h-3 w-3 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
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
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Status</h3>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => {
            const Icon = option.icon;
            const isActive = statusFilter === option.key;
            
            return (
              <Button
                key={option.key}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onStatusFilterChange(option.key)}
                className={`flex items-center gap-2 text-xs ${isActive ? '' : 'hover:bg-muted'}`}
              >
                <Icon className={`h-3 w-3 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                <span className="hidden sm:inline">{option.label}</span>
                <span className="sm:hidden">{option.shortLabel}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RankingFilters; 