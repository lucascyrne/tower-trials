import React, { useEffect, useState, useCallback } from 'react';
import { type CharacterConsumable } from '@/models/consumable.model';
import { ConsumableService } from '@/services/consumable.service';
import { type Character } from '@/models/character.model';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Sparkles, Star, Package, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PotionSlotManager } from '@/features/consumable/PotionSlotManager';
import { formatConsumableEffect } from '@/utils/consumable-utils';
import { ConsumableImage } from '@/components/ui/consumable-image';
import { SellItemModal } from '@/components/ui/sell-item-modal';
import type { CharacterDrop } from '@/models/monster.model';

interface InventoryPanelProps {
  character: Character;
  onInventoryChange: () => void;
}

interface SellModalState {
  isOpen: boolean;
  type: 'consumable' | 'drop' | null;
  item: CharacterConsumable | CharacterDrop | null;
  sellPrice: {
    canSell: boolean;
    availableQuantity: number;
    unitSellPrice: number;
    originalPrice: number;
  } | null;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({ character, onInventoryChange }) => {
  const [consumables, setConsumables] = useState<CharacterConsumable[]>([]);
  const [drops, setDrops] = useState<CharacterDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsumable, setSelectedConsumable] = useState<CharacterConsumable | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<CharacterDrop | null>(null);
  const [usingConsumable, setUsingConsumable] = useState<string | null>(null);
  const [sellModal, setSellModal] = useState<SellModalState>({
    isOpen: false,
    type: null,
    item: null,
    sellPrice: null,
  });
  const [currentGold, setCurrentGold] = useState(character.gold);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);

      const [consumablesResponse, dropsResponse] = await Promise.all([
        ConsumableService.getCharacterConsumables(character.id),
        ConsumableService.getCharacterDrops(character.id),
      ]);

      setConsumables(consumablesResponse.success ? consumablesResponse.data || [] : []);
      setDrops(dropsResponse.success ? dropsResponse.data || [] : []);
    } catch (error) {
      console.error('Erro ao carregar inventário:', error);
      toast.error('Erro ao carregar inventário');
      setConsumables([]);
      setDrops([]);
    } finally {
      setLoading(false);
    }
  }, [character.id]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    setCurrentGold(character.gold);
  }, [character.gold]);

  const handleUseConsumable = async (item: CharacterConsumable) => {
    if (!item.consumable || item.quantity <= 0) {
      toast.error('Consumível não disponível');
      return;
    }

    setUsingConsumable(item.consumable_id);

    try {
      const response = await ConsumableService.consumeItem(
        character.id,
        item.consumable_id,
        character
      );

      if (response.success && response.data) {
        await loadInventory();
        onInventoryChange();
        toast.success(response.data.message);
      } else {
        toast.error(response.error || 'Erro ao usar consumível');
      }
    } catch (error) {
      console.error('Erro ao usar consumível:', error);
      toast.error('Erro ao usar consumível');
    } finally {
      setUsingConsumable(null);
    }
  };

  const handleSlotsUpdate = () => {
    loadInventory();
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
          await loadInventory();
          onInventoryChange();
          setCurrentGold(result.data.newGold);
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
          await loadInventory();
          onInventoryChange();
          setCurrentGold(result.data.newGold);
        } else {
          toast.error(result.error || 'Erro ao vender material');
        }
      }
    } catch (error) {
      console.error('Erro ao vender item:', error);
      toast.error('Erro ao vender item');
    }
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

  const getDropIcon = () => <Star className="h-6 w-6 text-amber-400" />;

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'border-slate-600 bg-slate-800/30',
      uncommon: 'border-emerald-600 bg-emerald-900/30',
      rare: 'border-blue-600 bg-blue-900/30',
      epic: 'border-purple-600 bg-purple-900/30',
      legendary: 'border-amber-600 bg-amber-900/30',
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const renderConsumableGrid = () => {
    const validConsumables = consumables.filter(item => item.consumable && item.quantity > 0);

    if (validConsumables.length === 0) {
      return (
        <div className="text-center py-12">
          <Package className="h-16 w-16 mx-auto mb-4 text-slate-600 opacity-50" />
          <p className="text-slate-500">Nenhum consumível disponível</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3">
        {validConsumables.map(item => {
          const isSelected = selectedConsumable?.id === item.id;
          const canUse = canUseConsumable(item);

          return (
            <div
              key={`consumable-${item.id}`}
              className={`relative aspect-square border-2 rounded-lg cursor-pointer transition-all duration-200 hover:scale-105 ${
                isSelected
                  ? 'border-amber-400 bg-amber-900/30 shadow-lg shadow-amber-400/20'
                  : 'border-slate-600 bg-slate-800/30 hover:border-slate-400'
              } ${!canUse ? 'opacity-50' : ''}`}
              onClick={() => {
                setSelectedConsumable(item);
                setSelectedDrop(null);
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center p-1.5">
                <ConsumableImage consumable={item.consumable!} size="xl" />
              </div>

              {item.quantity > 1 && (
                <div className="absolute bottom-1 right-1 bg-slate-900/80 text-slate-200 text-xs px-1 rounded min-w-[16px] text-center">
                  {item.quantity}
                </div>
              )}

              {!canUse && (
                <div className="absolute top-1 left-1 w-2 h-2 bg-red-500 rounded-full"></div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDropGrid = () => {
    const validDrops = drops.filter(item => item.drop && item.quantity > 0);

    if (validDrops.length === 0) {
      return (
        <div className="text-center py-12">
          <Package className="h-16 w-16 mx-auto mb-4 text-slate-600 opacity-50" />
          <p className="text-slate-500">Nenhum material disponível</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3">
        {validDrops.map(item => {
          const isSelected = selectedDrop?.id === item.id;
          const rarity = item.drop?.rarity || 'common';

          return (
            <div
              key={`drop-${item.id}`}
              className={`relative aspect-square border-2 rounded-lg cursor-pointer transition-all duration-200 hover:scale-105 ${
                isSelected
                  ? 'border-amber-400 bg-amber-900/30 shadow-lg shadow-amber-400/20'
                  : `${getRarityColor(rarity)} hover:border-slate-400`
              }`}
              onClick={() => {
                setSelectedDrop(item);
                setSelectedConsumable(null);
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center p-1.5">
                <Star className="h-7 w-7 text-amber-400" />
              </div>

              {item.quantity > 1 && (
                <div className="absolute bottom-1 right-1 bg-slate-900/80 text-slate-200 text-xs px-1 rounded min-w-[16px] text-center">
                  {item.quantity}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderItemDetails = () => {
    if (selectedConsumable?.consumable) {
      const item = selectedConsumable;
      const consumable = item.consumable!;
      const canUse = canUseConsumable(item);

      return (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-4 rounded-lg border-2 border-slate-600 bg-slate-800/30">
              <ConsumableImage consumable={consumable} size="xl" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-100 mb-2">{consumable.name}</h2>
              <div className="flex items-center gap-3">
                <Badge className="bg-slate-700/50 text-slate-200 border-0">{consumable.type}</Badge>
                <span className="text-slate-400">Quantidade: {item.quantity}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
            <p className="text-slate-300 leading-relaxed">{consumable.description}</p>
          </div>

          {consumable.effect_value > 0 && (
            <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-300 font-medium">Efeito</span>
              </div>
              <p className="text-emerald-200">{formatConsumableEffect(consumable)}</p>
            </div>
          )}

          {/* Botões de ação */}
          <div className="space-y-3">
            <Button
              onClick={() => handleUseConsumable(item)}
              disabled={!canUse || usingConsumable === item.consumable_id}
              className={`w-full ${
                canUse
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {usingConsumable === item.consumable_id ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-t border-b border-current"></div>
                  Usando...
                </div>
              ) : canUse ? (
                'Usar Item'
              ) : consumable.type === 'potion' &&
                consumable.description.includes('HP') &&
                character.hp >= character.max_hp ? (
                'HP já está no máximo'
              ) : consumable.type === 'potion' &&
                consumable.description.includes('Mana') &&
                character.mana >= character.max_mana ? (
                'Mana já está no máximo'
              ) : (
                'Não pode ser usado agora'
              )}
            </Button>

            <Button
              onClick={() => handleSellConsumable(item)}
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700/50"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Vender Item
            </Button>
          </div>
        </div>
      );
    }

    if (selectedDrop?.drop) {
      const item = selectedDrop;
      const drop = item.drop!;

      return (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className={`p-4 rounded-lg border-2 ${getRarityColor(drop.rarity)}`}>
              {getDropIcon()}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-100 mb-2">{drop.name}</h2>
              <div className="flex items-center gap-3">
                <Badge className={`${getRarityColor(drop.rarity)} border-0 text-slate-200`}>
                  {drop.rarity}
                </Badge>
                <span className="text-slate-400">Quantidade: {item.quantity}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
            <p className="text-slate-300 leading-relaxed">{drop.description}</p>
          </div>

          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 font-medium">Valor</span>
            </div>
            <p className="text-amber-200">{drop.value} gold por unidade</p>
          </div>

          {/* Botão de venda para materiais */}
          <Button
            onClick={() => handleSellDrop(item)}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700/50"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Vender Material
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Selecione um item</p>
          <p className="text-sm mt-2 opacity-75">Clique em um item para ver os detalhes</p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[70vh]">
        <div className="xl:col-span-2 space-y-6">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 sm:p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-slate-700 rounded w-32"></div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-slate-700 rounded"></div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="xl:col-span-1">
          <Card className="bg-slate-800/50 border-slate-700/50 h-full min-h-[400px]">
            <CardContent className="p-4 sm:p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-slate-700 rounded w-24"></div>
                <div className="h-32 bg-slate-700 rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Coluna esquerda - Grade de itens */}
      <div className="xl:col-span-2 space-y-6">
        {/* Header com Gold sutil */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">Inventário</h2>
          <div className="flex items-center gap-2 text-amber-400 bg-slate-800/30 px-3 py-1 rounded-lg border border-slate-700/50">
            <Coins className="h-4 w-4" />
            <span className="font-medium text-sm sm:text-base">{currentGold.toLocaleString()}</span>
          </div>
        </div>

        {/* Consumíveis com slots integrados */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
              Consumíveis ({consumables.filter(item => item.quantity > 0).length})
            </h3>

            {/* Slots de poções com PotionSlotManager */}
            <div className="mb-6">
              <PotionSlotManager
                characterId={character.id}
                consumables={consumables}
                onSlotsUpdate={handleSlotsUpdate}
              />
            </div>

            {/* Grade de consumíveis */}
            {renderConsumableGrid()}
          </CardContent>
        </Card>

        {/* Materiais */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
              Materiais ({drops.filter(item => item.quantity > 0).length})
            </h3>
            {renderDropGrid()}
          </CardContent>
        </Card>
      </div>

      {/* Coluna direita - Detalhes do item */}
      <div className="xl:col-span-1">
        <Card className="bg-slate-800/50 border-slate-700/50 h-full min-h-[400px]">
          <CardContent className="p-4 sm:p-6 h-full">{renderItemDetails()}</CardContent>
        </Card>
      </div>

      {/* Modal de venda */}
      <SellItemModal
        isOpen={sellModal.isOpen}
        onClose={() => setSellModal({ isOpen: false, type: null, item: null, sellPrice: null })}
        onConfirm={handleConfirmSell}
        itemName={
          sellModal.type === 'consumable'
            ? (sellModal.item as CharacterConsumable)?.consumable?.name || ''
            : (sellModal.item as CharacterDrop)?.drop?.name || ''
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
          sellModal.type === 'consumable'
            ? undefined
            : (sellModal.item as CharacterDrop)?.drop?.rarity
        }
        availableQuantity={sellModal.sellPrice?.availableQuantity || 0}
        unitSellPrice={sellModal.sellPrice?.unitSellPrice || 0}
        originalPrice={sellModal.sellPrice?.originalPrice}
      />
    </div>
  );
};
