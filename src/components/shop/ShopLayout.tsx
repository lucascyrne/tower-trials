import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sword,
  Shield,
  Shirt,
  Gem,
  Coins,
  Package,
  Sparkles,
  Zap,
  Filter,
  ShoppingCart,
  ShoppingBag,
  Crown,
  Footprints,
} from 'lucide-react';
import { type Equipment } from '@/models/equipment.model';
import { type Consumable } from '@/models/consumable.model';
import { type Character } from '@/models/character.model';
import { EquipmentComparison } from '@/features/equipment/EquipmentComparison';
import {
  EquipmentFilters,
  type EquipmentFilterType,
  type SortType,
} from '@/components/equipment/EquipmentFilters';

interface ShopLayoutProps {
  character: Character;
  availableEquipment: Equipment[];
  availableConsumables: Consumable[];
  onEquipmentPurchase: (equipment: Equipment) => void;
  onConsumablePurchase: (consumable: Consumable, quantity: number) => void;
  onOpenInventory: () => void;
}

type ShopCategory = 'equipment' | 'consumables';
type ConsumableFilter = 'all' | 'potion' | 'antidote' | 'buff';

export const ShopLayout: React.FC<ShopLayoutProps> = ({
  character,
  availableEquipment,
  availableConsumables,
  onEquipmentPurchase,
  onConsumablePurchase,
  onOpenInventory,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ShopCategory>('equipment');
  const [selectedItem, setSelectedItem] = useState<Equipment | Consumable | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilterType>('all');
  const [equipmentSort, setEquipmentSort] = useState<SortType>('name');
  const [consumableFilter, setConsumableFilter] = useState<ConsumableFilter>('all');

  // Filtrar e ordenar equipamentos
  const filteredEquipment = availableEquipment
    .filter(item => {
      if (equipmentFilter === 'all') return true;
      return item.type === equipmentFilter;
    })
    .sort((a, b) => {
      switch (equipmentSort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'level':
          return (b.level_requirement || 0) - (a.level_requirement || 0);
        case 'rarity': {
          const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
          return (
            (rarityOrder[b.rarity as keyof typeof rarityOrder] || 0) -
            (rarityOrder[a.rarity as keyof typeof rarityOrder] || 0)
          );
        }
        case 'attack':
          return b.atk_bonus - a.atk_bonus;
        case 'defense':
          return b.def_bonus - a.def_bonus;
        default:
          return 0;
      }
    });

  // Filtrar consumíveis
  const filteredConsumables = availableConsumables.filter(item => {
    if (consumableFilter === 'all') return true;
    return item.type === consumableFilter;
  });

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'bg-slate-800/80 text-slate-300 border-slate-600',
      uncommon: 'bg-emerald-900/80 text-emerald-300 border-emerald-600',
      rare: 'bg-blue-900/80 text-blue-300 border-blue-600',
      epic: 'bg-purple-900/80 text-purple-300 border-purple-600',
      legendary: 'bg-amber-900/80 text-amber-300 border-amber-600',
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const getEquipmentTypeIcon = (type: string) => {
    switch (type) {
      case 'weapon':
        return <Sword className="h-4 w-4 text-red-400" />;
      case 'armor':
        return <Shield className="h-4 w-4 text-blue-400" />;
      case 'chest':
        return <Shirt className="h-4 w-4 text-green-400" />;
      case 'helmet':
        return <Crown className="h-4 w-4 text-yellow-400" />;
      case 'legs':
        return <Shield className="h-4 w-4 text-cyan-400" />;
      case 'boots':
        return <Footprints className="h-4 w-4 text-orange-400" />;
      case 'ring':
        return <Gem className="h-4 w-4 text-purple-400" />;
      case 'necklace':
        return <Gem className="h-4 w-4 text-pink-400" />;
      case 'amulet':
        return <Gem className="h-4 w-4 text-indigo-400" />;
      default:
        return <Package className="h-4 w-4 text-slate-400" />;
    }
  };

  const getConsumableTypeIcon = (type: string) => {
    switch (type) {
      case 'potion':
        return <Sparkles className="h-4 w-4 text-blue-500" />;
      case 'antidote':
        return <Shield className="h-4 w-4 text-green-500" />;
      case 'buff':
        return <Zap className="h-4 w-4 text-purple-500" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const renderEquipmentCard = (equipment: Equipment) => {
    const canAfford = character.gold >= equipment.price;
    const hasLevel = character.level >= equipment.level_requirement;
    const canBuy = canAfford && hasLevel && equipment.is_unlocked;
    const isSelected = selectedItem?.id === equipment.id;

    return (
      <Card
        key={equipment.id}
        className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 border-slate-700/50 bg-slate-800/50 backdrop-blur-sm ${
          isSelected ? 'ring-2 ring-primary/60 shadow-lg shadow-primary/30' : ''
        } ${!canBuy ? 'opacity-60 grayscale' : 'hover:bg-slate-800/70'}`}
        onClick={() => setSelectedItem(equipment)}
      >
        <CardContent className="p-1.5">
          <div className="flex flex-col items-center text-center gap-1">
            <div className="p-1.5 rounded bg-slate-700/50">
              {getEquipmentTypeIcon(equipment.type)}
            </div>
            <div className="w-full">
              <h3 className="font-medium text-xs truncate text-slate-100" title={equipment.name}>
                {equipment.name.length > 10
                  ? `${equipment.name.substring(0, 10)}...`
                  : equipment.name}
              </h3>
              <Badge
                variant="outline"
                className={`text-xs border ${getRarityColor(equipment.rarity)} mt-1`}
              >
                {equipment.rarity}
              </Badge>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Coins className="h-3 w-3 text-amber-400" />
                <span className="text-xs font-medium text-amber-300">{equipment.price}</span>
              </div>
              {/* Stat principal mais relevante */}
              {equipment.atk_bonus > 0 ? (
                <div className="text-xs text-red-400 mt-1">+{equipment.atk_bonus} ATK</div>
              ) : equipment.def_bonus > 0 ? (
                <div className="text-xs text-blue-400 mt-1">+{equipment.def_bonus} DEF</div>
              ) : equipment.mana_bonus > 0 ? (
                <div className="text-xs text-purple-400 mt-1">+{equipment.mana_bonus} MP</div>
              ) : equipment.speed_bonus > 0 ? (
                <div className="text-xs text-green-400 mt-1">+{equipment.speed_bonus} SPD</div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderConsumableCard = (consumable: Consumable) => {
    const canAfford = character.gold >= consumable.price;
    const hasLevel = character.level >= (consumable.level_requirement || 1);
    const canBuy = canAfford && hasLevel;
    const isSelected = selectedItem?.id === consumable.id;

    return (
      <Card
        key={consumable.id}
        className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 border-slate-700/50 bg-slate-800/50 backdrop-blur-sm ${
          isSelected ? 'ring-2 ring-primary/60 shadow-lg shadow-primary/30' : ''
        } ${!canBuy ? 'opacity-60 grayscale' : 'hover:bg-slate-800/70'}`}
        onClick={() => setSelectedItem(consumable)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-lg bg-slate-700/50">
              {getConsumableTypeIcon(consumable.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate text-slate-100">{consumable.name}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {consumable.type === 'potion'
                  ? `+${consumable.effect_value}`
                  : consumable.type === 'antidote'
                    ? 'Remove debuffs'
                    : `+${consumable.effect_value} por 3 turnos`}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <Coins className="h-3 w-3 text-amber-400" />
                <span className="text-xs font-medium text-amber-300">{consumable.price}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderItemDetails = () => {
    if (!selectedItem) {
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Selecione um item para ver os detalhes</p>
            <p className="text-sm mt-2 opacity-75">
              Clique em qualquer item da lista para visualizar suas informações completas
            </p>
          </div>
        </div>
      );
    }

    const isEquipment = 'atk_bonus' in selectedItem;
    const item = selectedItem as Equipment | Consumable;

    if (isEquipment) {
      const equipment = item as Equipment;
      const canAfford = character.gold >= equipment.price;
      const hasLevel = character.level >= equipment.level_requirement;
      const canBuy = canAfford && hasLevel && equipment.is_unlocked;

      return (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600/50">
                {getEquipmentTypeIcon(equipment.type)}
              </div>
              <h2 className="text-xl font-bold text-slate-100">{equipment.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`border ${getRarityColor(equipment.rarity)}`}>
                {equipment.rarity}
              </Badge>
              <span className="text-sm text-slate-400">
                {equipment.type === 'weapon'
                  ? 'Arma'
                  : equipment.type === 'armor'
                    ? 'Armadura'
                    : 'Acessório'}
              </span>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-2 text-slate-200">Descrição</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{equipment.description}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-slate-200">Atributos</h3>
            <div className="grid grid-cols-2 gap-3">
              {equipment.atk_bonus > 0 && (
                <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800/50 rounded-lg backdrop-blur-sm">
                  <Sword className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-red-300 font-medium">+{equipment.atk_bonus}</span>
                </div>
              )}
              {equipment.def_bonus > 0 && (
                <div className="flex items-center gap-2 p-3 bg-blue-900/30 border border-blue-800/50 rounded-lg backdrop-blur-sm">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-blue-300 font-medium">+{equipment.def_bonus}</span>
                </div>
              )}
              {equipment.mana_bonus > 0 && (
                <div className="flex items-center gap-2 p-3 bg-purple-900/30 border border-purple-800/50 rounded-lg backdrop-blur-sm">
                  <Gem className="h-4 w-4 text-purple-400" />
                  <span className="text-sm text-purple-300 font-medium">
                    +{equipment.mana_bonus}
                  </span>
                </div>
              )}
              {equipment.speed_bonus > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-900/30 border border-amber-800/50 rounded-lg backdrop-blur-sm">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-amber-300 font-medium">
                    +{equipment.speed_bonus}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-slate-200">Comparação com Equipamento Atual</h3>
            <EquipmentComparison
              characterId={character.id}
              newEquipment={equipment}
              slotType={equipment.type}
              showTitle={false}
              compact={true}
            />
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-slate-200">Requisitos</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-slate-700/30 rounded border border-slate-600/30">
                <span className="text-sm text-slate-300">Nível:</span>
                <span
                  className={`text-sm font-medium ${hasLevel ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {equipment.level_requirement}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-700/30 rounded border border-slate-600/30">
                <span className="text-sm text-slate-300">Preço:</span>
                <div className="flex items-center gap-1">
                  <Coins className="h-3 w-3 text-amber-400" />
                  <span
                    className={`text-sm font-medium ${canAfford ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {equipment.price}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={() => onEquipmentPurchase(equipment)}
            disabled={!canBuy}
            className={`w-full font-semibold ${
              canBuy
                ? 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25'
                : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
            }`}
          >
            {!equipment.is_unlocked
              ? 'Item Bloqueado'
              : !hasLevel
                ? `Requer Nível ${equipment.level_requirement}`
                : !canAfford
                  ? 'Gold Insuficiente'
                  : 'Comprar'}
          </Button>
        </div>
      );
    } else {
      const consumable = item as Consumable;
      const canAfford = character.gold >= consumable.price;
      const hasLevel = character.level >= (consumable.level_requirement || 1);
      const canBuy = canAfford && hasLevel;

      return (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600/50">
                {getConsumableTypeIcon(consumable.type)}
              </div>
              <h2 className="text-xl font-bold text-slate-100">{consumable.name}</h2>
            </div>
            <span className="text-sm text-slate-400">
              {consumable.type === 'potion'
                ? 'Poção'
                : consumable.type === 'antidote'
                  ? 'Antídoto'
                  : 'Fortalecimento'}
            </span>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-2 text-slate-200">Descrição</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{consumable.description}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-slate-200">Efeito</h3>
            <div className="p-3 bg-emerald-900/30 border border-emerald-800/50 rounded-lg backdrop-blur-sm">
              <span className="text-sm text-emerald-300">
                {consumable.type === 'potion'
                  ? `Restaura ${consumable.effect_value} pontos`
                  : consumable.type === 'antidote'
                    ? 'Remove todos os efeitos negativos'
                    : `Aumenta atributo em ${consumable.effect_value} por 3 turnos`}
              </span>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-slate-200">Preço</h3>
            <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className={`font-medium ${canAfford ? 'text-emerald-400' : 'text-red-400'}`}>
                {consumable.price} gold cada
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-200">Comprar</h3>
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => onConsumablePurchase(consumable, 1)}
                disabled={!canBuy}
                size="sm"
                className={`${
                  canBuy
                    ? 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md shadow-primary/20'
                    : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
                }`}
              >
                1x
              </Button>
              <Button
                onClick={() => onConsumablePurchase(consumable, 5)}
                disabled={!canBuy || character.gold < consumable.price * 5}
                size="sm"
                variant="outline"
                className={`border-slate-600 ${
                  !canBuy || character.gold < consumable.price * 5
                    ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-slate-700'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                }`}
              >
                5x
              </Button>
              <Button
                onClick={() => onConsumablePurchase(consumable, 10)}
                disabled={!canBuy || character.gold < consumable.price * 10}
                size="sm"
                variant="outline"
                className={`border-slate-600 ${
                  !canBuy || character.gold < consumable.price * 10
                    ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-slate-700'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                }`}
              >
                10x
              </Button>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Coluna Esquerda - Lista de Itens */}
      <div className="lg:col-span-1 space-y-4">
        {/* Header com Gold e Inventário */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 px-3 py-1.5 rounded-lg">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="font-medium text-amber-300">{character.gold}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenInventory}
            className="border-slate-700 bg-slate-800/30 hover:bg-slate-700/50"
          >
            <Package className="h-4 w-4 mr-2" />
            Inventário
          </Button>
        </div>

        {/* Filtros de Categoria */}
        <div className="flex gap-2 p-1 bg-slate-800/30 rounded-lg border border-slate-700/30">
          <Button
            variant={selectedCategory === 'equipment' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setSelectedCategory('equipment');
              setSelectedItem(null);
            }}
            className={`flex-1 ${
              selectedCategory === 'equipment'
                ? 'bg-slate-700/50 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedCategory === 'consumables' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setSelectedCategory('consumables');
              setSelectedItem(null);
            }}
            className={`flex-1 ${
              selectedCategory === 'consumables'
                ? 'bg-slate-700/50 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
          </Button>
        </div>

        {/* Filtros de Equipamento */}
        {selectedCategory === 'equipment' && (
          <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/30">
            <EquipmentFilters
              filterType={equipmentFilter}
              onFilterChange={setEquipmentFilter}
              sortType={equipmentSort}
              onSortChange={setEquipmentSort}
              compact={true}
            />
          </div>
        )}

        {selectedCategory === 'consumables' && (
          <div className="flex gap-1 p-1 bg-slate-800/30 rounded-lg border border-slate-700/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConsumableFilter('all')}
              className={`${
                consumableFilter === 'all'
                  ? 'bg-slate-700/50 text-slate-200'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/30'
              }`}
            >
              <Filter className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConsumableFilter('potion')}
              className={`${
                consumableFilter === 'potion'
                  ? 'bg-blue-900/30 text-blue-400 border border-blue-800/50'
                  : 'text-slate-500 hover:text-blue-400 hover:bg-blue-900/20'
              }`}
            >
              <Sparkles className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConsumableFilter('antidote')}
              className={`${
                consumableFilter === 'antidote'
                  ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
                  : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-900/20'
              }`}
            >
              <Shield className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConsumableFilter('buff')}
              className={`${
                consumableFilter === 'buff'
                  ? 'bg-purple-900/30 text-purple-400 border border-purple-800/50'
                  : 'text-slate-500 hover:text-purple-400 hover:bg-purple-900/20'
              }`}
            >
              <Zap className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Lista de Itens */}
        <div className="max-h-[60vh] overflow-y-auto">
          {selectedCategory === 'equipment' ? (
            filteredEquipment.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum equipamento encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                {filteredEquipment.map(renderEquipmentCard)}
              </div>
            )
          ) : filteredConsumables.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum consumível encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">{filteredConsumables.map(renderConsumableCard)}</div>
          )}
        </div>
      </div>

      {/* Coluna Direita - Detalhes do Item */}
      <div className="lg:col-span-2">
        <Card className="h-full border-slate-700/50 bg-slate-800/30">
          <CardContent className="p-4 h-full">{renderItemDetails()}</CardContent>
        </Card>
      </div>
    </div>
  );
};
