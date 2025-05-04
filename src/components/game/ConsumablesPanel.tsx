import React, { useState } from 'react';
import { useGame } from '@/resources/game/game-hook';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { CharacterConsumable } from '@/resources/game/models/consumable.model';

interface ConsumableItemProps {
  item: CharacterConsumable;
  onUse: (id: string) => void;
  disabled: boolean;
}

const ConsumableItem = ({ item, onUse, disabled }: ConsumableItemProps) => {
  if (!item.consumable) return null;
  
  const getRarityColor = () => {
    if (item.consumable?.type === 'potion') return 'text-red-400';
    if (item.consumable?.type === 'antidote') return 'text-green-400';
    if (item.consumable?.type === 'buff') return 'text-blue-400';
    return 'text-gray-400';
  };

  // Ícones para os diferentes tipos de consumíveis
  const getIcon = () => {
    if (item.consumable?.description.includes('HP') || 
        item.consumable?.description.includes('Vida')) {
      return '🩸';
    }
    if (item.consumable?.description.includes('Mana')) {
      return '💧';
    }
    if (item.consumable?.type === 'antidote') {
      return '💊';
    }
    if (item.consumable?.description.includes('Força') || 
        item.consumable?.description.includes('ataque')) {
      return '💪';
    }
    if (item.consumable?.description.includes('Defesa') || 
        item.consumable?.description.includes('defesa')) {
      return '🛡️';
    }
    return '📦';
  };

  return (
    <div className="flex items-center justify-between p-2 my-1 bg-gray-800 rounded-md">
      <div className="flex items-center">
        <div className="text-2xl mr-2">{getIcon()}</div>
        <div>
          <h3 className={`font-bold ${getRarityColor()}`}>{item.consumable.name}</h3>
          <p className="text-sm text-gray-400">{item.consumable.description}</p>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-gray-400 text-xs">x{item.quantity}</span>
        <Button 
          size="sm" 
          onClick={() => onUse(item.consumable_id)}
          disabled={disabled || item.quantity <= 0}
          variant="outline"
          className="mt-1"
        >
          Usar
        </Button>
      </div>
    </div>
  );
};

export function ConsumablesPanel() {
  const { gameState, performAction, loading } = useGame();
  const [isOpen, setIsOpen] = useState(false);

  const useConsumable = (consumableId: string) => {
    performAction('consumable', undefined, consumableId);
    setIsOpen(false);
  };

  // Filtrar consumíveis com quantidade > 0
  const availableConsumables = gameState.player.consumables?.filter(
    c => c.quantity > 0 && c.consumable
  ) || [];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          className="relative" 
          variant="outline"
          disabled={!gameState.player.isPlayerTurn || loading.performAction}
        >
          Poções
          {availableConsumables.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
              {availableConsumables.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Consumíveis</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {availableConsumables.length > 0 ? (
            availableConsumables.map(item => (
              <ConsumableItem 
                key={item.consumable_id} 
                item={item} 
                onUse={useConsumable} 
                disabled={!gameState.player.isPlayerTurn || loading.performAction}
              />
            ))
          ) : (
            <div className="text-center p-4">
              <p className="text-gray-400">Nenhum consumível disponível</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
} 