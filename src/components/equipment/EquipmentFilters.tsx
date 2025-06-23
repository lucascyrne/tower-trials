import { Button } from '@/components/ui/button';
import {
  Sword,
  Shield,
  Shirt,
  Gem,
  Crown,
  Footprints,
  Filter,
  ArrowUpDown,
  Star,
  Hash,
} from 'lucide-react';
import type { EquipmentType } from '@/models/equipment.model';

export type EquipmentFilterType = 'all' | EquipmentType;
export type SortType = 'name' | 'level' | 'rarity' | 'attack' | 'defense';

interface EquipmentFiltersProps {
  filterType: EquipmentFilterType;
  onFilterChange: (filter: EquipmentFilterType) => void;
  sortType: SortType;
  onSortChange: (sort: SortType) => void;
  compact?: boolean;
}

const EQUIPMENT_FILTERS = [
  { value: 'all' as const, label: 'Todos', icon: Filter, color: 'text-slate-400' },
  { value: 'weapon' as const, label: 'Armas', icon: Sword, color: 'text-red-400' },
  { value: 'helmet' as const, label: 'Capacete', icon: Crown, color: 'text-yellow-400' },
  { value: 'chest' as const, label: 'Peitoral', icon: Shirt, color: 'text-green-400' },
  { value: 'legs' as const, label: 'Perneiras', icon: Shield, color: 'text-cyan-400' },
  { value: 'boots' as const, label: 'Botas', icon: Footprints, color: 'text-orange-400' },
  { value: 'armor' as const, label: 'Escudos', icon: Shield, color: 'text-blue-400' },
  { value: 'ring' as const, label: 'Anéis', icon: Gem, color: 'text-purple-400' },
  { value: 'necklace' as const, label: 'Colar', icon: Gem, color: 'text-pink-400' },
  { value: 'amulet' as const, label: 'Amuleto', icon: Gem, color: 'text-indigo-400' },
];

const SORT_OPTIONS = [
  { value: 'name' as const, label: 'Nome', icon: Hash, color: 'text-slate-400' },
  { value: 'level' as const, label: 'Nível', icon: ArrowUpDown, color: 'text-blue-400' },
  { value: 'rarity' as const, label: 'Raridade', icon: Star, color: 'text-amber-400' },
  { value: 'attack' as const, label: 'Ataque', icon: Sword, color: 'text-red-400' },
  { value: 'defense' as const, label: 'Defesa', icon: Shield, color: 'text-blue-400' },
];

export const EquipmentFilters: React.FC<EquipmentFiltersProps> = ({
  filterType,
  onFilterChange,
  sortType,
  onSortChange,
  compact = false,
}) => {
  return (
    <div className="space-y-4">
      {/* Filtros por Tipo */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-400">Tipo</label>
        <div
          className={`grid gap-2 ${
            compact ? 'grid-cols-5 sm:grid-cols-10' : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-10'
          }`}
        >
          {EQUIPMENT_FILTERS.map(filter => {
            const IconComponent = filter.icon;
            const isActive = filterType === filter.value;

            return (
              <Button
                key={filter.value}
                variant="ghost"
                size={compact ? 'sm' : 'default'}
                onClick={() => onFilterChange(filter.value)}
                className={`${
                  isActive
                    ? `bg-slate-800/80 ${filter.color} border border-slate-700`
                    : `text-slate-500 hover:${filter.color} hover:bg-slate-800/50`
                } ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} transition-all duration-200 flex items-center justify-center gap-1.5`}
                title={filter.label}
              >
                <IconComponent className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                {!compact && <span className="text-xs hidden sm:inline">{filter.label}</span>}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Ordenação */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-400">Ordenar por</label>
        <div className={`grid gap-2 ${compact ? 'grid-cols-5' : 'grid-cols-2 sm:grid-cols-5'}`}>
          {SORT_OPTIONS.map(sort => {
            const IconComponent = sort.icon;
            const isActive = sortType === sort.value;

            return (
              <Button
                key={sort.value}
                variant="ghost"
                size={compact ? 'sm' : 'default'}
                onClick={() => onSortChange(sort.value)}
                className={`${
                  isActive
                    ? `bg-slate-800/80 ${sort.color} border border-slate-700`
                    : `text-slate-500 hover:${sort.color} hover:bg-slate-800/50`
                } ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} transition-all duration-200 flex items-center justify-center gap-1.5`}
                title={sort.label}
              >
                <IconComponent className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                <span className={`text-xs ${compact ? 'hidden lg:inline' : 'hidden sm:inline'}`}>
                  {sort.label}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
