import { useState, useEffect, useCallback } from 'react';
import { SlotService, type PotionSlot } from '@/resources/equipment/slot.service';
import { type CharacterConsumable } from '@/resources/consumable/consumable.model';
import { toast } from 'sonner';

interface UsePotionSlotsProps {
  characterId: string | undefined;
  consumables?: CharacterConsumable[];
}

interface UsePotionSlotsReturn {
  slots: PotionSlot[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setSlot: (slotPosition: number, consumableId: string) => Promise<boolean>;
  clearSlot: (slotPosition: number) => Promise<boolean>;
  consumeSlot: (slotPosition: number) => Promise<{
    success: boolean;
    newHp?: number;
    newMana?: number;
    message?: string;
  }>;
  getAvailablePotions: (currentSlotPosition?: number) => CharacterConsumable[];
}

/**
 * Hook centralizado para gerenciamento de slots de poção
 *
 * ✅ Gerencia cache automaticamente
 * ✅ Sincroniza com consumíveis do personagem
 * ✅ Fornece métodos para todas as operações de slot
 */
export function usePotionSlots({
  characterId,
  consumables = [],
}: UsePotionSlotsProps): UsePotionSlotsReturn {
  const [slots, setSlots] = useState<PotionSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carregar slots do servidor
   */
  const loadSlots = useCallback(async () => {
    if (!characterId) {
      setError('ID do personagem não fornecido');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await SlotService.getCharacterPotionSlots(characterId);

      if (response.success && response.data) {
        setSlots(response.data);
      } else {
        throw new Error(response.error || 'Erro ao carregar slots');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao carregar slots';
      console.error('[usePotionSlots] Erro:', errorMsg);
      setError(errorMsg);

      // Fallback: slots vazios
      setSlots([
        {
          slot_position: 1,
          consumable_id: null,
          consumable_name: null,
          consumable_description: null,
          effect_value: null,
          consumable_type: null,
          available_quantity: 0,
          consumable_price: null,
        },
        {
          slot_position: 2,
          consumable_id: null,
          consumable_name: null,
          consumable_description: null,
          effect_value: null,
          consumable_type: null,
          available_quantity: 0,
          consumable_price: null,
        },
        {
          slot_position: 3,
          consumable_id: null,
          consumable_name: null,
          consumable_description: null,
          effect_value: null,
          consumable_type: null,
          available_quantity: 0,
          consumable_price: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  /**
   * Atribuir poção a um slot
   */
  const setSlot = useCallback(
    async (slotPosition: number, consumableId: string): Promise<boolean> => {
      if (!characterId) return false;

      try {
        const response = await SlotService.setPotionSlot(characterId, slotPosition, consumableId);

        if (response.success) {
          await loadSlots();
          toast.success('Poção atribuída ao slot!');
          return true;
        } else {
          toast.error(response.error || 'Erro ao atribuir poção');
          return false;
        }
      } catch (err) {
        console.error('[usePotionSlots] Erro ao atribuir slot:', err);
        toast.error('Erro ao atribuir poção');
        return false;
      }
    },
    [characterId, loadSlots]
  );

  /**
   * Limpar um slot
   */
  const clearSlot = useCallback(
    async (slotPosition: number): Promise<boolean> => {
      if (!characterId) return false;

      try {
        const response = await SlotService.clearPotionSlot(characterId, slotPosition);

        if (response.success) {
          await loadSlots();
          toast.success('Slot limpo!');
          return true;
        } else {
          toast.error(response.error || 'Erro ao limpar slot');
          return false;
        }
      } catch (err) {
        console.error('[usePotionSlots] Erro ao limpar slot:', err);
        toast.error('Erro ao limpar slot');
        return false;
      }
    },
    [characterId, loadSlots]
  );

  /**
   * Consumir poção de um slot
   */
  const consumeSlot = useCallback(
    async (
      slotPosition: number
    ): Promise<{ success: boolean; newHp?: number; newMana?: number; message?: string }> => {
      if (!characterId) {
        return { success: false, message: 'ID do personagem não fornecido' };
      }

      try {
        const response = await SlotService.consumePotionFromSlot(characterId, slotPosition);

        if (response.success && response.data) {
          // Atualizar slots após consumo
          await loadSlots();

          return {
            success: true,
            newHp: response.data.new_hp,
            newMana: response.data.new_mana,
            message: response.data.message,
          };
        } else {
          return {
            success: false,
            message: response.error || 'Erro ao usar poção',
          };
        }
      } catch (err) {
        console.error('[usePotionSlots] Erro ao consumir slot:', err);
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Erro ao usar poção',
        };
      }
    },
    [characterId, loadSlots]
  );

  /**
   * Obter poções disponíveis (excluindo as já atribuídas a outros slots)
   */
  const getAvailablePotions = useCallback(
    (currentSlotPosition?: number): CharacterConsumable[] => {
      // IDs de consumíveis já ocupados (exceto o slot atual)
      const occupiedIds = slots
        .filter(slot => slot.consumable_id && slot.slot_position !== currentSlotPosition)
        .map(slot => slot.consumable_id);

      // Filtrar consumíveis disponíveis
      return consumables.filter(c => {
        const isPotion = c.consumable && c.consumable.type === 'potion' && c.quantity > 0;
        const isNotOccupied = !occupiedIds.includes(c.consumable_id);
        return isPotion && isNotOccupied;
      });
    },
    [slots, consumables]
  );

  // Carregar slots ao montar ou quando characterId mudar
  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  return {
    slots,
    loading,
    error,
    refresh: loadSlots,
    setSlot,
    clearSlot,
    consumeSlot,
    getAvailablePotions,
  };
}
