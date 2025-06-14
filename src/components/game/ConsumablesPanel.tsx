import { useState } from 'react';
import { useGame } from '@/resources/game/game-hook';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { type CharacterConsumable } from '@/resources/game/consumable.model';
import { toast } from 'sonner';

interface ConsumableItemProps {
  item: CharacterConsumable;
  onUse: (id: string) => void;
  disabled: boolean;
  isUsing?: boolean;
  isPotionDisabled?: boolean;
}

const ConsumableItem = ({
  item,
  onUse,
  disabled,
  isUsing = false,
  isPotionDisabled = false,
}: ConsumableItemProps) => {
  if (!item.consumable) return null;

  const getRarityColor = () => {
    if (item.consumable?.type === 'potion') return 'text-red-400';
    if (item.consumable?.type === 'antidote') return 'text-green-400';
    if (item.consumable?.type === 'buff') return 'text-blue-400';
    return 'text-gray-400';
  };

  // Ícones para os diferentes tipos de consumíveis
  const getIcon = () => {
    if (
      item.consumable?.description.includes('HP') ||
      item.consumable?.description.includes('Vida')
    ) {
      return '🩸';
    }
    if (item.consumable?.description.includes('Mana')) {
      return '💧';
    }
    if (item.consumable?.type === 'antidote') {
      return '💊';
    }
    if (
      item.consumable?.description.includes('Força') ||
      item.consumable?.description.includes('ataque')
    ) {
      return '💪';
    }
    if (
      item.consumable?.description.includes('Defesa') ||
      item.consumable?.description.includes('defesa')
    ) {
      return '🛡️';
    }
    return '📦';
  };

  return (
    <div
      className={`flex items-center justify-between p-2 my-1 rounded-md transition-all duration-200 ${
        isPotionDisabled
          ? 'bg-orange-500/10 border border-orange-500/20 opacity-60'
          : item.quantity === 0
            ? 'bg-red-500/10 border border-red-500/20 opacity-60'
            : 'bg-gray-800 hover:bg-gray-700'
      }`}
    >
      <div className="flex items-center">
        <div className="text-2xl mr-2 relative">
          {getIcon()}
          {(isPotionDisabled || item.quantity === 0) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-0.5 bg-red-500 rotate-45 absolute"></div>
              <div className="w-4 h-0.5 bg-red-500 -rotate-45 absolute"></div>
            </div>
          )}
        </div>
        <div>
          <h3 className={`font-bold ${getRarityColor()}`}>{item.consumable.name}</h3>
          <p
            className={`text-sm ${
              isPotionDisabled
                ? 'text-orange-400'
                : item.quantity === 0
                  ? 'text-red-400'
                  : 'text-gray-400'
            }`}
          >
            {isPotionDisabled
              ? 'Poção já usada neste turno'
              : item.quantity === 0
                ? 'Sem unidades disponíveis'
                : item.consumable.description}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span
          className={`text-xs font-semibold ${
            item.quantity === 0
              ? 'text-red-400'
              : item.quantity < 5
                ? 'text-orange-400'
                : 'text-gray-400'
          }`}
        >
          x{item.quantity}
        </span>
        <Button
          size="sm"
          onClick={() => onUse(item.consumable_id)}
          disabled={disabled || item.quantity <= 0 || isUsing || isPotionDisabled}
          variant="outline"
          className={`mt-1 relative ${
            isPotionDisabled
              ? 'border-orange-500/30 text-orange-400'
              : item.quantity === 0
                ? 'border-red-500/30 text-red-400'
                : ''
          }`}
        >
          {isUsing ? (
            <div className="flex items-center gap-1">
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-primary border-t-transparent" />
              Usando...
            </div>
          ) : item.quantity === 0 ? (
            'Sem estoque'
          ) : isPotionDisabled ? (
            'Já usada'
          ) : (
            'Usar'
          )}
        </Button>
      </div>
    </div>
  );
};

export function ConsumablesPanel() {
  const { gameState, performAction, loading } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const [usingConsumable, setUsingConsumable] = useState<string | null>(null);

  const potionUsedThisTurn = gameState.player.potionUsedThisTurn || false;

  const useConsumable = async (consumableId: string) => {
    // Verificar se já foi usada uma poção neste turno
    if (potionUsedThisTurn) {
      toast.error('Você já usou uma poção neste turno!', {
        description: 'Aguarde o próximo turno para usar outra poção',
        duration: 3000,
      });
      return;
    }

    setUsingConsumable(consumableId);

    try {
      await performAction('consumable', undefined, consumableId);

      // NOTA: A atualização dos consumáveis deve ser feita através do performAction
      // que já dispara as atualizações necessárias no provider

      setIsOpen(false);
    } catch (error) {
      console.error('Erro ao usar consumível:', error);
    } finally {
      setUsingConsumable(null);
    }
  };

  // Filtrar consumíveis com quantidade > 0
  const availableConsumables =
    gameState.player.consumables?.filter(c => c.quantity > 0 && c.consumable) || [];

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
          {potionUsedThisTurn && (
            <span className="absolute -bottom-1 -left-1 bg-orange-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center border border-background">
              ✗
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Consumíveis
            {potionUsedThisTurn && (
              <span className="text-orange-400 text-sm">• Poção usada neste turno</span>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {potionUsedThisTurn && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-orange-400 text-sm">
                <span>⚠️</span>
                <span>Você já usou uma poção neste turno</span>
              </div>
              <div className="text-xs text-orange-300 mt-1">
                Aguarde o próximo turno para usar outra poção
              </div>
            </div>
          )}

          {availableConsumables.length > 0 ? (
            availableConsumables.map(item => (
              <ConsumableItem
                key={item.consumable_id}
                item={item}
                onUse={useConsumable}
                disabled={
                  !gameState.player.isPlayerTurn ||
                  loading.performAction ||
                  usingConsumable !== null
                }
                isUsing={usingConsumable === item.consumable_id}
                isPotionDisabled={potionUsedThisTurn && item.consumable?.type === 'potion'}
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
