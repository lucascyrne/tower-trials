import { useEffect, useCallback } from 'react';
import { type CharacterConsumable } from '@/models/consumable.model';
import { type Character } from '@/models/character.model';
import { ConsumableService } from '@/services/consumable.service';
import { toast } from 'sonner';

interface UsePotionShortcutsProps {
  character: Character;
  consumables: CharacterConsumable[];
  onPotionUsed: () => void;
  enabled?: boolean;
}

export function usePotionShortcuts({
  character,
  consumables,
  onPotionUsed,
  enabled = true,
}: UsePotionShortcutsProps) {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignorar se estiver digitando em inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const applyPotion = async (type: 'health' | 'mana') => {
        // Filtrar poções do tipo correto
        const potions = consumables.filter(
          c =>
            c.consumable &&
            c.consumable.type === 'potion' &&
            c.quantity > 0 &&
            (type === 'health'
              ? c.consumable.description.includes('HP') || c.consumable.description.includes('Vida')
              : c.consumable.description.includes('Mana'))
        );

        if (potions.length === 0) {
          toast.info(`Nenhuma poção de ${type === 'health' ? 'vida' : 'mana'} disponível!`);
          return;
        }

        // Verificar se realmente precisa da poção
        if (type === 'health' && character.hp >= character.max_hp) {
          toast.info('HP já está no máximo!');
          return;
        }

        if (type === 'mana' && character.mana >= character.max_mana) {
          toast.info('Mana já está no máximo!');
          return;
        }

        // Pegar a melhor poção (maior effect_value)
        const bestPotion = potions.reduce((best, current) => {
          if (!best.consumable || !current.consumable) return best;
          return current.consumable.effect_value > best.consumable.effect_value ? current : best;
        });

        try {
          const result = await ConsumableService.consumeItem(
            character.id,
            bestPotion.consumable_id,
            character
          );

          if (result.success && result.data) {
            toast.success(result.data.message);
            onPotionUsed();
          } else {
            toast.error('Erro ao usar poção', {
              description: result.error,
            });
          }
        } catch (error) {
          console.error('Erro ao usar poção:', error);
          toast.error('Erro ao usar poção');
        }
      };

      switch (event.key.toLowerCase()) {
        case 'q':
          event.preventDefault();
          applyPotion('health');
          break;
        case 'w':
          event.preventDefault();
          applyPotion('mana');
          break;
      }
    },
    [character, consumables, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [enabled]);
}
