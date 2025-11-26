import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sword,
  Shield,
  Gem,
  Coins,
  Package,
  Sparkles,
  Zap,
  Filter,
  ShoppingCart,
  ShoppingBag,
  DollarSign,
  Star,
} from 'lucide-react';
import { type Equipment, type CharacterEquipment } from '@/resources/equipment/equipment.model';
import { type Consumable, type CharacterConsumable } from '@/resources/consumable/consumable.model';
import { type Character } from '@/resources/character/character.model';
import { type CharacterDrop } from '@/resources/monster/monster.model';
import { EquipmentComparison } from '@/features/equipment/EquipmentComparison';
import {
  EquipmentFilters,
  type EquipmentFilterType,
  type SortType,
} from '@/features/equipment/EquipmentFilters';
import { SellItemModal } from '@/components/ui/sell-item-modal';
import { ConsumableImage } from '@/components/ui/consumable-image';
import { EquipmentImage } from '@/components/ui/equipment-image';

interface ShopLayoutProps {
  character: Character;
  availableEquipment: Equipment[];
  availableConsumables: Consumable[];
  onEquipmentPurchase: (equipment: Equipment) => void;
  onConsumablePurchase: (consumable: Consumable, quantity: number) => void;
  onOpenInventory: () => void;
  // Props para aba de venda
  characterEquipment: CharacterEquipment[];
  characterConsumables: CharacterConsumable[];
  characterDrops: CharacterDrop[];
  onSellEquipment: (equipment: CharacterEquipment) => void;
  onSellConsumable: (consumable: CharacterConsumable, quantity: number) => void;
  onSellDrop: (drop: CharacterDrop, quantity: number) => void;
}

type ShopCategory = 'equipment' | 'consumables' | 'sell';
type ConsumableFilter = 'all' | 'potion' | 'antidote' | 'buff';

export const ShopLayout: React.FC<ShopLayoutProps> = ({
  character,
  availableEquipment,
  availableConsumables,
  onEquipmentPurchase,
  onConsumablePurchase,
  onOpenInventory,
  characterEquipment,
  characterConsumables,
  characterDrops,
  onSellEquipment,
  onSellConsumable,
  onSellDrop,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ShopCategory>('equipment');
  const [selectedItem, setSelectedItem] = useState<
    Equipment | Consumable | CharacterEquipment | CharacterConsumable | CharacterDrop | null
  >(null);
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilterType>('all');
  const [equipmentSort, setEquipmentSort] = useState<SortType>('name');
  const [consumableFilter, setConsumableFilter] = useState<ConsumableFilter>('all');

  // Estado para o modal de venda
  const [sellModalState, setSellModalState] = useState<{
    isOpen: boolean;
    type: 'consumable' | 'drop' | null;
    item: CharacterConsumable | CharacterDrop | null;
    sellPrice: {
      canSell: boolean;
      availableQuantity: number;
      unitSellPrice: number;
      originalPrice: number;
    } | null;
  }>({
    isOpen: false,
    type: null,
    item: null,
    sellPrice: null,
  });

  // Limpar item selecionado quando o inventário é atualizado (dados ficam desatualizados)
  useEffect(() => {
    if (!selectedItem) return;

    // Verificar se o item selecionado ainda existe com a quantidade correta
    if ('consumable' in selectedItem) {
      const charConsumable = selectedItem as CharacterConsumable;
      const stillExists = characterConsumables.some(item => item.id === charConsumable.id);
      if (!stillExists) {
        setSelectedItem(null);
      }
    } else if ('drop' in selectedItem) {
      const charDrop = selectedItem as CharacterDrop;
      const stillExists = characterDrops.some(item => item.id === charDrop.id);
      if (!stillExists) {
        setSelectedItem(null);
      }
    }
  }, [characterConsumables, characterDrops, selectedItem]);

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

  // Função para abrir modal de venda de consumível
  const handleOpenSellConsumableModal = (item: CharacterConsumable) => {
    if (!item.consumable) return;

    // Consumíveis vendem por 40% do preço de compra
    const unitSellPrice = Math.floor(item.consumable.price * 0.4);

    setSellModalState({
      isOpen: true,
      type: 'consumable',
      item,
      sellPrice: {
        canSell: true,
        availableQuantity: item.quantity,
        unitSellPrice,
        originalPrice: item.consumable.price,
      },
    });
  };

  // Função para abrir modal de venda de drop
  const handleOpenSellDropModal = (item: CharacterDrop) => {
    if (!item.drop) return;

    setSellModalState({
      isOpen: true,
      type: 'drop',
      item,
      sellPrice: {
        canSell: true,
        availableQuantity: item.quantity,
        unitSellPrice: item.drop.value,
        originalPrice: item.drop.value,
      },
    });
  };

  // Função para confirmar venda no modal
  const handleConfirmSell = async (quantity: number) => {
    if (!sellModalState.item || !sellModalState.type) return;

    if (sellModalState.type === 'consumable') {
      await onSellConsumable(sellModalState.item as CharacterConsumable, quantity);
    } else if (sellModalState.type === 'drop') {
      await onSellDrop(sellModalState.item as CharacterDrop, quantity);
    }

    // Limpar item selecionado para evitar mostrar dados obsoletos
    setSelectedItem(null);
    setSellModalState({ isOpen: false, type: null, item: null, sellPrice: null });
  };

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
              <EquipmentImage equipment={equipment} size="xl" />
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
              <ConsumableImage consumable={consumable} size="md" />
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

  // Função auxiliar para calcular preço de venda de equipamentos
  const getEquipmentSellPrice = (equipment: Equipment): number => {
    const rarityMultiplier = {
      common: 0.3,
      uncommon: 0.35,
      rare: 0.4,
      epic: 0.45,
      legendary: 0.5,
    };
    return Math.floor(equipment.price * rarityMultiplier[equipment.rarity]);
  };

  // Renderizar card de equipamento para venda
  const renderSellEquipmentCard = (item: CharacterEquipment) => {
    if (!item.equipment) return null;

    const sellPrice = getEquipmentSellPrice(item.equipment);
    const isSelected = selectedItem?.id === item.id;
    const canSell = !item.is_equipped;

    return (
      <Card
        key={item.id}
        className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-amber/20 border-slate-700/50 bg-slate-800/50 backdrop-blur-sm ${
          isSelected ? 'ring-2 ring-amber-500/60 shadow-lg shadow-amber-500/30' : ''
        } ${!canSell ? 'opacity-60 grayscale' : 'hover:bg-slate-800/70'}`}
        onClick={() => canSell && setSelectedItem(item)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-lg bg-slate-700/50">
              <EquipmentImage equipment={item.equipment} size="xl" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate text-slate-100">{item.equipment.name}</h3>
              <Badge
                variant="outline"
                className={`text-xs border ${getRarityColor(item.equipment.rarity)} mt-1`}
              >
                {item.equipment.rarity}
              </Badge>
              {item.is_equipped ? (
                <div className="text-xs text-slate-500 mt-1">Equipado (não pode vender)</div>
              ) : (
                <div className="flex items-center gap-1 mt-2">
                  <Coins className="h-3 w-3 text-amber-400" />
                  <span className="text-xs font-medium text-amber-300">{sellPrice}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Renderizar card de consumível para venda
  const renderSellConsumableCard = (item: CharacterConsumable) => {
    if (!item.consumable) return null;

    const isSelected = selectedItem?.id === item.id;

    return (
      <Card
        key={item.id}
        className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-amber/20 border-slate-700/50 bg-slate-800/50 backdrop-blur-sm ${
          isSelected ? 'ring-2 ring-amber-500/60 shadow-lg shadow-amber-500/30' : ''
        } hover:bg-slate-800/70`}
        onClick={() => setSelectedItem(item)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-lg bg-slate-700/50">
              <ConsumableImage consumable={item.consumable} size="md" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate text-slate-100">
                {item.consumable.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">
                  x{item.quantity}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Renderizar card de drop para venda
  const renderSellDropCard = (item: CharacterDrop) => {
    if (!item.drop) return null;

    const isSelected = selectedItem?.id === item.id;

    return (
      <Card
        key={item.id}
        className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-amber/20 border-slate-700/50 bg-slate-800/50 backdrop-blur-sm ${
          isSelected ? 'ring-2 ring-amber-500/60 shadow-lg shadow-amber-500/30' : ''
        } hover:bg-slate-800/70`}
        onClick={() => setSelectedItem(item)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-lg bg-slate-700/50">
              <Star className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate text-slate-100">{item.drop.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs ${getRarityColor(item.drop.rarity)}`}>
                  {item.drop.rarity}
                </span>
                <span className="text-xs bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">
                  x{item.quantity}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Coins className="h-3 w-3 text-amber-400" />
                <span className="text-xs font-medium text-amber-300">{item.drop.value} cada</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Renderizar tab de venda
  const renderSellTab = () => {
    const sellableEquipment = characterEquipment.filter(item => !item.is_equipped);
    const sellableConsumables = characterConsumables.filter(item => item.quantity > 0);
    const sellableDrops = characterDrops.filter(item => item.quantity > 0);

    const hasItems =
      sellableEquipment.length > 0 || sellableConsumables.length > 0 || sellableDrops.length > 0;

    if (!hasItems) {
      return (
        <div className="text-center py-12 text-slate-500">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium text-slate-400 mb-1">Nenhum item para vender</p>
          <p className="text-sm opacity-75">
            Derrote monstros e obtenha equipamentos para vender na loja
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Equipamentos */}
        {sellableEquipment.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
              <Sword className="h-4 w-4" />
              Equipamentos ({sellableEquipment.length})
            </h3>
            <div className="space-y-2">{sellableEquipment.map(renderSellEquipmentCard)}</div>
          </div>
        )}

        {/* Consumíveis */}
        {sellableConsumables.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Consumíveis ({sellableConsumables.length})
            </h3>
            <div className="space-y-2">{sellableConsumables.map(renderSellConsumableCard)}</div>
          </div>
        )}

        {/* Drops */}
        {sellableDrops.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Materiais ({sellableDrops.length})
            </h3>
            <div className="space-y-2">{sellableDrops.map(renderSellDropCard)}</div>
          </div>
        )}
      </div>
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

    // Verificar se é um item de venda (CharacterEquipment, CharacterConsumable ou CharacterDrop)
    if (selectedCategory === 'sell') {
      // CharacterEquipment para venda
      if ('equipment' in selectedItem && selectedItem.equipment) {
        const charEquipment = selectedItem as CharacterEquipment;
        const equipment = charEquipment.equipment!;
        const sellPrice = getEquipmentSellPrice(equipment);
        const canSell = !charEquipment.is_equipped;

        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600/50">
                  <EquipmentImage equipment={equipment} size="xl" />
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
                    <span className="text-sm text-blue-300 font-medium">
                      +{equipment.def_bonus}
                    </span>
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
              <h3 className="font-semibold mb-2 text-slate-200">Preço de Venda</h3>
              <div className="flex items-center gap-2 p-3 bg-amber-900/30 rounded-lg border border-amber-800/50">
                <Coins className="h-4 w-4 text-amber-400" />
                <span className="font-medium text-amber-300">{sellPrice} gold</span>
              </div>
            </div>

            <Button
              onClick={() => onSellEquipment(charEquipment)}
              disabled={!canSell}
              className={`w-full font-semibold ${
                canSell
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 shadow-lg shadow-amber-600/25'
                  : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
              }`}
            >
              {!canSell ? 'Item Equipado (não pode vender)' : `Vender por ${sellPrice} gold`}
            </Button>
          </div>
        );
      }

      // CharacterConsumable para venda
      if ('consumable' in selectedItem && selectedItem.consumable) {
        const charConsumable = selectedItem as CharacterConsumable;
        const consumable = charConsumable.consumable!;

        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600/50">
                  <ConsumableImage consumable={consumable} size="xl" />
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
              <h3 className="font-semibold mb-2 text-slate-200">Quantidade Disponível</h3>
              <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                <span className="text-lg font-bold text-slate-200">{charConsumable.quantity}x</span>
              </div>
            </div>

            <Button
              onClick={() => handleOpenSellConsumableModal(charConsumable)}
              className="w-full font-semibold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 shadow-lg shadow-amber-600/25"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Vender
            </Button>
          </div>
        );
      }

      // CharacterDrop para venda
      if ('drop' in selectedItem && selectedItem.drop) {
        const charDrop = selectedItem as CharacterDrop;
        const drop = charDrop.drop!;

        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600/50">
                  <Star className="h-5 w-5 text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-100">{drop.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`border ${getRarityColor(drop.rarity)}`}>{drop.rarity}</Badge>
                <span className="text-sm text-slate-400">Material</span>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 text-slate-200">Descrição</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{drop.description}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-slate-200">Quantidade Disponível</h3>
              <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                <span className="text-lg font-bold text-slate-200">{charDrop.quantity}x</span>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-slate-200">Preço de Venda</h3>
              <div className="flex items-center gap-2 p-3 bg-amber-900/30 rounded-lg border border-amber-800/50">
                <Coins className="h-4 w-4 text-amber-400" />
                <span className="font-medium text-amber-300">{drop.value} gold cada</span>
              </div>
            </div>

            <Button
              onClick={() => handleOpenSellDropModal(charDrop)}
              className="w-full font-semibold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 shadow-lg shadow-amber-600/25"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Vender
            </Button>
          </div>
        );
      }
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
                <EquipmentImage equipment={equipment} size="xl" />
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
                <ConsumableImage consumable={consumable} size="md" />
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
          <Button
            variant={selectedCategory === 'sell' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setSelectedCategory('sell');
              setSelectedItem(null);
            }}
            className={`flex-1 ${
              selectedCategory === 'sell'
                ? 'bg-slate-700/50 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            <DollarSign className="h-4 w-4" />
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
          ) : selectedCategory === 'consumables' ? (
            filteredConsumables.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum consumível encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">{filteredConsumables.map(renderConsumableCard)}</div>
            )
          ) : (
            renderSellTab()
          )}
        </div>
      </div>

      {/* Coluna Direita - Detalhes do Item */}
      <div className="lg:col-span-2">
        <Card className="h-full border-slate-700/50 bg-slate-800/30">
          <CardContent className="p-4 h-full">{renderItemDetails()}</CardContent>
        </Card>
      </div>

      {/* Modal de venda */}
      <SellItemModal
        isOpen={sellModalState.isOpen}
        onClose={() =>
          setSellModalState({ isOpen: false, type: null, item: null, sellPrice: null })
        }
        onConfirm={handleConfirmSell}
        itemName={
          sellModalState.type === 'consumable'
            ? (sellModalState.item as CharacterConsumable)?.consumable?.name || ''
            : sellModalState.type === 'drop'
              ? (sellModalState.item as CharacterDrop)?.drop?.name || ''
              : ''
        }
        itemIcon={
          sellModalState.type === 'consumable' &&
          sellModalState.item &&
          (sellModalState.item as CharacterConsumable).consumable ? (
            <ConsumableImage
              consumable={(sellModalState.item as CharacterConsumable).consumable!}
              size="lg"
            />
          ) : (
            <Star className="h-8 w-8 text-amber-400" />
          )
        }
        itemRarity={
          sellModalState.type === 'drop'
            ? (sellModalState.item as CharacterDrop)?.drop?.rarity
            : undefined
        }
        availableQuantity={sellModalState.sellPrice?.availableQuantity || 0}
        unitSellPrice={sellModalState.sellPrice?.unitSellPrice || 0}
        originalPrice={sellModalState.sellPrice?.originalPrice}
      />
    </div>
  );
};
