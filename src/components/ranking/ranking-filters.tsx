import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Trophy,
  TrendingUp,
  Coins,
  Users,
  Heart,
  Skull,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { type RankingMode } from '@/services/ranking.service';

export type CharacterStatusFilter = 'all' | 'alive' | 'dead';

interface RankingFiltersProps {
  activeMode: RankingMode;
  onModeChange: (mode: RankingMode) => void;
  statusFilter: CharacterStatusFilter;
  onStatusFilterChange: (filter: CharacterStatusFilter) => void;
  nameFilter: string;
  onNameFilterChange: (name: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

const RankingFilters: React.FC<RankingFiltersProps> = ({
  activeMode,
  onModeChange,
  statusFilter,
  onStatusFilterChange,
  nameFilter,
  onNameFilterChange,
  currentPage,
  totalPages,
  onPageChange,
  isLoading = false,
}) => {
  const modes = [
    {
      key: 'floor' as RankingMode,
      label: 'Andar Mais Alto',
      icon: Trophy,
      color: 'text-yellow-500',
    },
    {
      key: 'level' as RankingMode,
      label: 'Maior Nível',
      icon: TrendingUp,
      color: 'text-blue-500',
    },
    {
      key: 'gold' as RankingMode,
      label: 'Mais Rico',
      icon: Coins,
      color: 'text-amber-500',
    },
  ];

  const statusOptions = [
    {
      key: 'all' as CharacterStatusFilter,
      label: 'Todos',
      shortLabel: 'Todos',
      icon: Users,
      color: 'text-gray-500',
    },
    {
      key: 'alive' as CharacterStatusFilter,
      label: 'Apenas Vivos',
      shortLabel: 'Vivos',
      icon: Heart,
      color: 'text-green-500',
    },
    {
      key: 'dead' as CharacterStatusFilter,
      label: 'Apenas Mortos',
      shortLabel: 'Mortos',
      icon: Skull,
      color: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filtros de Modalidade */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Modalidade</h3>
        <div className="flex flex-wrap gap-2">
          {modes.map(mode => {
            const Icon = mode.icon;
            const isActive = activeMode === mode.key;

            return (
              <Button
                key={mode.key}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange(mode.key)}
                disabled={isLoading}
                className={`flex items-center gap-2 text-xs ${isActive ? '' : 'hover:bg-muted'}`}
              >
                <Icon className={`h-3 w-3 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                <span className="hidden sm:inline">{mode.label}</span>
                <span className="sm:hidden">
                  {mode.key === 'floor' ? 'Andar' : mode.key === 'level' ? 'Nível' : 'Ouro'}
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
          {statusOptions.map(option => {
            const Icon = option.icon;
            const isActive = statusFilter === option.key;

            return (
              <Button
                key={option.key}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onStatusFilterChange(option.key)}
                disabled={isLoading}
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

      {/* Filtro por Nome */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Buscar Jogador</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Digite o nome do jogador..."
            value={nameFilter}
            onChange={e => onNameFilterChange(e.target.value)}
            disabled={isLoading}
            className="pl-10 text-sm"
          />
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div>
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">Páginas</h3>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="flex items-center gap-2"
            >
              <span className="hidden sm:inline">Próxima</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RankingFilters;
