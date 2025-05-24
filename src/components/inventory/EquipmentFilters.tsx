import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X, Search } from 'lucide-react';

type EquipmentFilter = 'all' | 'weapon' | 'armor' | 'accessory';
type WeaponSubtypeFilter = 'all' | 'sword' | 'axe' | 'blunt' | 'staff' | 'dagger';
type RarityFilter = 'all' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

interface EquipmentFiltersProps {
  equipmentFilter: EquipmentFilter;
  weaponSubtypeFilter: WeaponSubtypeFilter;
  rarityFilter: RarityFilter;
  searchTerm: string;
  onEquipmentFilterChange: (filter: EquipmentFilter) => void;
  onWeaponSubtypeFilterChange: (filter: WeaponSubtypeFilter) => void;
  onRarityFilterChange: (filter: RarityFilter) => void;
  onSearchTermChange: (term: string) => void;
  onClearFilters: () => void;
}

export const EquipmentFilters: React.FC<EquipmentFiltersProps> = ({
  equipmentFilter,
  weaponSubtypeFilter,
  rarityFilter,
  searchTerm,
  onEquipmentFilterChange,
  onWeaponSubtypeFilterChange,
  onRarityFilterChange,
  onSearchTermChange,
  onClearFilters
}) => {
  const hasActiveFilters = equipmentFilter !== 'all' || 
                          weaponSubtypeFilter !== 'all' || 
                          rarityFilter !== 'all' || 
                          searchTerm !== '';

  return (
    <Card className="p-4 bg-card/60">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        
        <Select value={equipmentFilter} onValueChange={onEquipmentFilterChange}>
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="weapon">Armas</SelectItem>
            <SelectItem value="armor">Armaduras</SelectItem>
            <SelectItem value="accessory">Acessórios</SelectItem>
          </SelectContent>
        </Select>

        {equipmentFilter === 'weapon' && (
          <Select value={weaponSubtypeFilter} onValueChange={onWeaponSubtypeFilterChange}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="sword">Espadas</SelectItem>
              <SelectItem value="axe">Machados</SelectItem>
              <SelectItem value="blunt">Maças</SelectItem>
              <SelectItem value="staff">Cajados</SelectItem>
              <SelectItem value="dagger">Adagas</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={rarityFilter} onValueChange={onRarityFilterChange}>
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="common">Comum</SelectItem>
            <SelectItem value="uncommon">Incomum</SelectItem>
            <SelectItem value="rare">Raro</SelectItem>
            <SelectItem value="epic">Épico</SelectItem>
            <SelectItem value="legendary">Lendário</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button size="sm" variant="outline" onClick={onClearFilters} className="h-8">
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar equipamentos..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 h-8 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
    </Card>
  );
}; 