import { useState, useEffect, useCallback } from 'react';
import { type Equipment, type CharacterEquipment } from '@/resources/equipment/equipment.model';
import {
  type CharacterConsumable,
  type MonsterDrop,
} from '@/resources/consumable/consumable.model';
import { EquipmentService } from '@/resources/equipment/equipment.service';
import { ConsumableService } from '@/resources/consumable/consumable.service';
import { type Character } from '@/resources/character/character.model';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Sparkles, Coins, Heart, Zap, Star, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { EquipmentComparison } from '@/features/equipment/EquipmentComparison';
import { formatConsumableEffect } from '@/utils/consumable-utils';
import { SellItemModal } from '@/components/ui/sell-item-modal';
import { ConsumableImage } from '@/components/ui/consumable-image';
import { EquipmentImage } from '@/components/ui/equipment-image';

interface InventoryModalProps {
  character: Character;
  isOpen: boolean;
  onClose: () => void;
  onItemSold: (newGold: number) => void;
}

interface CharacterDrop {
  id: string;
  drop_id: string;
  quantity: number;
  drop?: MonsterDrop;
}

interface SellModalState {
  isOpen: boolean;
  type: 'equipment' | 'consumable' | 'drop' | null;
  item: CharacterEquipment | CharacterConsumable | CharacterDrop | null;
  sellPrice: {
    canSell: boolean;
    availableQuantity: number;
    unitSellPrice: number;
    originalPrice: number;
  } | null;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  character,
  isOpen,
  onClose,
  onItemSold,
}) => {
  const [equipment, setEquipment] = useState<CharacterEquipment[]>([]);
  const [consumables, setConsumables] = useState<CharacterConsumable[]>([]);
  const [drops, setDrops] = useState<CharacterDrop[]>([]);
  const [loading, setLoading] = useState(false);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [sellModal, setSellModal] = useState<SellModalState>({
    isOpen: false,
    type: null,
    item: null,
    sellPrice: null,
  });

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [equipmentData, consumablesRes, dropsRes] = await Promise.all([
        EquipmentService.getCharacterEquipment(character.id),
        ConsumableService.getCharacterConsumables(character.id),
        ConsumableService.getCharacterDrops(character.id),
      ]);

      setEquipment(equipmentData || []);
      setConsumables(consumablesRes.success ? consumablesRes.data || [] : []);
      setDrops(dropsRes.success ? dropsRes.data || [] : []);
    } catch (error) {
      console.error('Erro ao carregar inventário:', error);
      toast.error('Erro ao carregar inventário');
    } finally {
      setLoading(false);
    }
  }, [character.id]);

  useEffect(() => {
    if (isOpen && character.id) {
      loadInventory();
    }
  }, [isOpen, character.id, loadInventory]);

  const handleEquipmentAction = async (item: CharacterEquipment, action: 'toggle' | 'sell') => {
    if (!item.equipment) return;

    try {
      if (action === 'toggle') {
        const result = await EquipmentService.toggleEquipment(
          character.id,
          item.equipment.id,
          !item.is_equipped
        );

        if (result.success) {
          toast.success(item.is_equipped ? 'Item desequipado!' : 'Item equipado!');
          loadInventory();
        }
      } else if (action === 'sell') {
        const result = await EquipmentService.sellEquipment(character.id, item.equipment.id);

        if (result.success && result.data?.newGold !== undefined) {
          toast.success(`${item.equipment.name} vendido!`);
          onItemSold(result.data.newGold);
          loadInventory();
        } else {
          toast.error(result.error || 'Erro ao vender equipamento');
        }
      }
    } catch (error) {
      console.error('Erro na ação:', error);
      toast.error('Erro ao executar ação');
    }
    setShowActions(null);
  };

  const handleConsumableAction = async (item: CharacterConsumable) => {
    if (!item.consumable) return;

    try {
      const response = await ConsumableService.consumeItem(
        character.id,
        item.consumable_id,
        character
      );

      if (response.success) {
        toast.success('Item usado com sucesso!');
        loadInventory();
        onItemSold(character.gold || 0);
      } else {
        toast.error(response.error || 'Erro ao usar item');
      }
    } catch (error) {
      console.error('Erro ao usar item:', error);
      toast.error('Erro ao usar item');
    }
    setShowActions(null);
  };

  const handleSellConsumable = async (item: CharacterConsumable) => {
    if (!item.consumable) return;

    try {
      // ✅ Calcular preço localmente: 40% do preço de compra
      const unitSellPrice = Math.floor(item.consumable.price * 0.4);

      setSellModal({
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
    } catch (error) {
      console.error('Erro ao calcular preço de venda:', error);
      toast.error('Erro ao calcular preço de venda');
    }
    setShowActions(null);
  };

  const handleSellDrop = async (item: CharacterDrop) => {
    if (!item.drop) return;

    try {
      // ✅ Calcular preço localmente: valor direto do drop
      const unitSellPrice = item.drop.value;

      setSellModal({
        isOpen: true,
        type: 'drop',
        item,
        sellPrice: {
          canSell: true,
          availableQuantity: item.quantity,
          unitSellPrice,
          originalPrice: item.drop.value,
        },
      });
    } catch (error) {
      console.error('Erro ao calcular preço de venda:', error);
      toast.error('Erro ao calcular preço de venda');
    }
    setShowActions(null);
  };

  const handleConfirmSell = async (quantity: number) => {
    if (!sellModal.item || !sellModal.type) return;

    try {
      if (sellModal.type === 'consumable') {
        const item = sellModal.item as CharacterConsumable;
        const result = await ConsumableService.sellConsumablesBatch(character.id, [
          { consumable_id: item.consumable_id, quantity },
        ]);

        if (result.success && result.data) {
          toast.success(
            `Vendido ${quantity}x ${item.consumable?.name} por ${result.data.totalGoldEarned} gold!`
          );
          onItemSold(result.data.newGold);
          loadInventory();
        } else {
          toast.error(result.error || 'Erro ao vender consumível');
        }
      } else if (sellModal.type === 'drop') {
        const item = sellModal.item as CharacterDrop;
        const result = await ConsumableService.sellDropsBatch(character.id, [
          { drop_id: item.drop_id, quantity },
        ]);

        if (result.success && result.data) {
          toast.success(
            `Vendido ${quantity}x ${item.drop?.name} por ${result.data.totalGoldEarned} gold!`
          );
          onItemSold(result.data.newGold);
          loadInventory();
        } else {
          toast.error(result.error || 'Erro ao vender material');
        }
      }
    } catch (error) {
      console.error('Erro ao vender item:', error);
      toast.error('Erro ao vender item');
    }

    setSellModal({ isOpen: false, type: null, item: null, sellPrice: null });
  };

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'text-slate-400',
      uncommon: 'text-emerald-400',
      rare: 'text-blue-400',
      epic: 'text-purple-400',
      legendary: 'text-amber-400',
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const getSellPrice = (item: Equipment) => {
    const rarityMultiplier = {
      common: 0.3,
      uncommon: 0.35,
      rare: 0.4,
      epic: 0.45,
      legendary: 0.5,
    };
    return Math.floor(item.price * rarityMultiplier[item.rarity]);
  };

  const canUseConsumable = (item: CharacterConsumable): boolean => {
    if (!item.consumable) return false;

    if (item.consumable.type === 'potion') {
      if (item.consumable.description.includes('HP') && character.hp >= character.max_hp)
        return false;
      if (item.consumable.description.includes('Mana') && character.mana >= character.max_mana)
        return false;
    }

    return true;
  };

  const renderEquipmentItem = (item: CharacterEquipment) => {
    if (!item.equipment) return null;

    const isActive = showActions === item.id;

    return (
      <div key={item.id} className="relative">
        <div
          className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
            item.is_equipped
              ? 'bg-primary/10 border-primary/30'
              : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-700/30'
          } ${isActive ? 'ring-2 ring-primary/50' : ''}`}
          onClick={() => setShowActions(isActive ? null : item.id)}
        >
          <div className="flex-shrink-0">
            <EquipmentImage equipment={item.equipment} size="sm" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200 truncate">
                {item.equipment.name}
              </span>
              {item.is_equipped && (
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                  Equipado
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className={getRarityColor(item.equipment.rarity)}>{item.equipment.rarity}</span>
              {item.equipment.atk_bonus > 0 && (
                <span className="text-red-400">+{item.equipment.atk_bonus} ATK</span>
              )}
              {item.equipment.def_bonus > 0 && (
                <span className="text-blue-400">+{item.equipment.def_bonus} DEF</span>
              )}
            </div>
          </div>

          <div className="text-xs text-amber-400">
            <Coins className="h-3 w-3 inline mr-1" />
            {getSellPrice(item.equipment)}
          </div>
        </div>

        {isActive && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg space-y-3">
            {!item.is_equipped && (
              <div>
                <h4 className="text-xs font-semibold text-slate-200 mb-2">
                  Comparação se Equipado
                </h4>
                <EquipmentComparison
                  characterId={character.id}
                  newEquipment={item.equipment}
                  slotType={item.equipment.type}
                  showTitle={false}
                  compact={true}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={item.is_equipped ? 'secondary' : 'default'}
                onClick={() => handleEquipmentAction(item, 'toggle')}
                className="flex-1 text-xs"
              >
                {item.is_equipped ? 'Desequipar' : 'Equipar'}
              </Button>
              {!item.is_equipped && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleEquipmentAction(item, 'sell')}
                  className="flex-1 text-xs"
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  Vender
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderConsumableItem = (item: CharacterConsumable) => {
    if (!item.consumable) return null;

    const isActive = showActions === item.id;
    const canUse = canUseConsumable(item);

    return (
      <div key={item.id} className="relative">
        <div
          className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
            canUse
              ? 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-700/30'
              : 'bg-slate-800/20 border-slate-700/20 opacity-60'
          } ${isActive ? 'ring-2 ring-primary/50' : ''}`}
          onClick={() => setShowActions(isActive ? null : item.id)}
        >
          <div className="flex-shrink-0">
            {item.consumable.type === 'potion' && item.consumable.description.includes('HP') ? (
              <Heart className="h-5 w-5 text-red-400" />
            ) : item.consumable.type === 'potion' &&
              item.consumable.description.includes('Mana') ? (
              <Zap className="h-5 w-5 text-blue-400" />
            ) : (
              <Sparkles className="h-5 w-5 text-purple-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200 truncate">
                {item.consumable.name}
              </span>
              <span className="text-xs bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">
                x{item.quantity}
              </span>
            </div>
            <div className="text-xs text-slate-400">{formatConsumableEffect(item.consumable)}</div>
          </div>
        </div>

        {isActive && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-lg">
            <div className="flex gap-2">
              {canUse && (
                <Button
                  size="sm"
                  onClick={() => handleConsumableAction(item)}
                  className="flex-1 text-xs"
                >
                  Usar Agora
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSellConsumable(item)}
                className="flex-1 text-xs border-slate-600 text-slate-300"
              >
                <DollarSign className="h-3 w-3 mr-1" />
                Vender
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDropItem = (item: CharacterDrop) => {
    if (!item.drop) return null;

    const isActive = showActions === item.id;

    return (
      <div key={item.id} className="relative">
        <div
          className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer bg-slate-800/30 border-slate-700/30 hover:bg-slate-700/30 ${
            isActive ? 'ring-2 ring-primary/50' : ''
          }`}
          onClick={() => setShowActions(isActive ? null : item.id)}
        >
          <div className="flex-shrink-0">
            <Star className="h-5 w-5 text-amber-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200 truncate">{item.drop.name}</span>
              <span className="text-xs bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">
                x{item.quantity}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={getRarityColor(item.drop.rarity)}>{item.drop.rarity}</span>
              <span className="text-amber-400">{item.drop.value} gold cada</span>
            </div>
          </div>
        </div>

        {isActive && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-lg">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSellDrop(item)}
              className="w-full text-xs border-slate-600 text-slate-300"
            >
              <DollarSign className="h-3 w-3 mr-1" />
              Vender Material
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderEmptyState = (type: 'equipment' | 'consumables' | 'drops') => {
    const emptyStates = {
      equipment: {
        icon: <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />,
        title: 'Nenhum equipamento',
        description: 'Visite a loja ou derrote monstros para obter equipamentos',
      },
      consumables: {
        icon: <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-40" />,
        title: 'Nenhum consumível',
        description: 'Compre poções na loja para ajudar em suas aventuras',
      },
      drops: {
        icon: <Star className="h-12 w-12 mx-auto mb-3 opacity-40" />,
        title: 'Nenhum material',
        description: 'Derrote monstros para coletar materiais valiosos',
      },
    };

    const state = emptyStates[type];

    return (
      <div className="text-center py-12 text-slate-500">
        {state.icon}
        <p className="font-medium text-slate-400 mb-1">{state.title}</p>
        <p className="text-sm opacity-75">{state.description}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <VisuallyHidden>
            <DialogTitle>Carregando Inventário</DialogTitle>
          </VisuallyHidden>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            <span className="ml-2 text-slate-300">Carregando...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-md max-h-[80vh] bg-slate-900/95 border-slate-700/50"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setShowActions(null);
            }
          }}
        >
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center justify-between text-slate-100">
              <span>Inventário</span>
              <div className="flex items-center gap-2 text-sm">
                <Coins className="h-4 w-4 text-amber-400" />
                <span className="text-amber-300">{(character.gold || 0).toLocaleString()}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="equipment" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
              <TabsTrigger value="equipment" className="text-xs">
                Equipamentos ({equipment.length})
              </TabsTrigger>
              <TabsTrigger value="consumables" className="text-xs">
                Consumíveis ({consumables.filter(item => item.quantity > 0).length})
              </TabsTrigger>
              <TabsTrigger value="drops" className="text-xs">
                Materiais ({drops.filter(item => item.quantity > 0).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="equipment" className="mt-4">
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {equipment.length === 0
                  ? renderEmptyState('equipment')
                  : equipment.map(renderEquipmentItem)}
              </div>
            </TabsContent>

            <TabsContent value="consumables" className="mt-4">
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {consumables.filter(item => item.quantity > 0).length === 0
                  ? renderEmptyState('consumables')
                  : consumables.filter(item => item.quantity > 0).map(renderConsumableItem)}
              </div>
            </TabsContent>

            <TabsContent value="drops" className="mt-4">
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {drops.filter(item => item.quantity > 0).length === 0
                  ? renderEmptyState('drops')
                  : drops.filter(item => item.quantity > 0).map(renderDropItem)}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <SellItemModal
        isOpen={sellModal.isOpen}
        onClose={() => setSellModal({ isOpen: false, type: null, item: null, sellPrice: null })}
        onConfirm={handleConfirmSell}
        itemName={
          sellModal.type === 'consumable'
            ? (sellModal.item as CharacterConsumable)?.consumable?.name || ''
            : sellModal.type === 'drop'
              ? (sellModal.item as CharacterDrop)?.drop?.name || ''
              : ''
        }
        itemIcon={
          sellModal.type === 'consumable' &&
          sellModal.item &&
          (sellModal.item as CharacterConsumable).consumable ? (
            <ConsumableImage
              consumable={(sellModal.item as CharacterConsumable).consumable!}
              size="lg"
            />
          ) : (
            <Star className="h-8 w-8 text-amber-400" />
          )
        }
        itemRarity={
          sellModal.type === 'drop' ? (sellModal.item as CharacterDrop)?.drop?.rarity : undefined
        }
        availableQuantity={sellModal.sellPrice?.availableQuantity || 0}
        unitSellPrice={sellModal.sellPrice?.unitSellPrice || 0}
        originalPrice={sellModal.sellPrice?.originalPrice}
      />
    </>
  );
};
