import React, { useEffect, useState, useCallback } from 'react';
import { type CharacterConsumable } from '@/resources/game/models/consumable.model';
import { ConsumableService } from '@/resources/game/consumable.service';
import { type Character } from '@/resources/game/models/character.model';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Heart, Zap, Sparkles, Star, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { type CharacterDrop } from './types';
import { PotionSlotManager } from './PotionSlotManager';
import { formatConsumableEffect } from '@/utils/consumable-utils';

interface InventoryPanelProps {
  character: Character;
  onInventoryChange: () => void;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({ character, onInventoryChange }) => {
  const [consumables, setConsumables] = useState<CharacterConsumable[]>([]);
  const [drops, setDrops] = useState<CharacterDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsumable, setSelectedConsumable] = useState<CharacterConsumable | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<CharacterDrop | null>(null);
  const [usingConsumable, setUsingConsumable] = useState<string | null>(null);

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

  const getConsumableIcon = (item: CharacterConsumable) => {
    if (!item.consumable) return <Package className="h-6 w-6 text-slate-400" />;

    if (item.consumable.type === 'potion') {
      if (item.consumable.description.includes('HP'))
        return <Heart className="h-6 w-6 text-red-400" />;
      if (item.consumable.description.includes('Mana'))
        return <Zap className="h-6 w-6 text-blue-400" />;
    }
    return <Sparkles className="h-6 w-6 text-purple-400" />;
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
      <div className="grid grid-cols-8 gap-2">
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
              <div className="absolute inset-0 flex items-center justify-center p-2">
                {getConsumableIcon(item)}
              </div>

              {item.quantity > 1 && (
                <div className="absolute bottom-1 right-1 bg-slate-900/80 text-slate-200 text-xs px-1 rounded">
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
      <div className="grid grid-cols-8 gap-2">
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
              <div className="absolute inset-0 flex items-center justify-center p-2">
                {getDropIcon()}
              </div>

              {item.quantity > 1 && (
                <div className="absolute bottom-1 right-1 bg-slate-900/80 text-slate-200 text-xs px-1 rounded">
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
              {getConsumableIcon(item)}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-slate-700 rounded w-32"></div>
                <div className="grid grid-cols-8 gap-2">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-slate-700 rounded"></div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card className="bg-slate-800/50 border-slate-700/50 h-full">
            <CardContent className="p-6">
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Coluna esquerda - Grade de itens */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header com Gold sutil */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-100">Inventário</h2>
          <div className="flex items-center gap-2 text-amber-400 bg-slate-800/30 px-3 py-1 rounded-lg border border-slate-700/50">
            <Coins className="h-4 w-4" />
            <span className="font-medium">{character.gold.toLocaleString()}</span>
          </div>
        </div>

        {/* Consumíveis com slots integrados */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
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
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              Materiais ({drops.filter(item => item.quantity > 0).length})
            </h3>
            {renderDropGrid()}
          </CardContent>
        </Card>
      </div>

      {/* Coluna direita - Detalhes do item */}
      <div className="lg:col-span-1">
        <Card className="bg-slate-800/50 border-slate-700/50 h-full">
          <CardContent className="p-6 h-full">{renderItemDetails()}</CardContent>
        </Card>
      </div>
    </div>
  );
};
