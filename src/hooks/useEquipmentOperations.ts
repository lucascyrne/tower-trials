import { useCallback } from 'react';
import { EquipmentService } from '@/services/equipment.service';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useGameStateStore } from '@/stores/useGameStateStore';
import { toast } from 'sonner';

/**
 * Hook para operações de equipamento
 *
 * ✅ REFATORADO (P1): Hook de orquestração que gerencia stores
 * - Lê dados das stores
 * - Chama services puros
 * - Atualiza stores com resultados
 */
export function useEquipmentOperations() {
  const selectedCharacter = useCharacterStore(state => state.selectedCharacter);
  const selectedCharacterId = useCharacterStore(state => state.selectedCharacterId);
  const setSelectedCharacter = useCharacterStore(state => state.setSelectedCharacter);
  const invalidateCharacterCache = useCharacterStore(state => state.invalidateCharacterCache);
  const loadSelectedCharacter = useCharacterStore(state => state.loadSelectedCharacter);
  const characters = useCharacterStore(state => state.characters);

  const gameState = useGameStateStore(state => state.gameState);
  const updateGameState = useGameStateStore(state => state.updateGameState);
  const updatePlayerGold = useGameStateStore(state => state.updatePlayerGold);

  /**
   * Atualizar gold nas stores após operação
   */
  const updateGoldInStores = useCallback(
    (characterId: string, newGold: number) => {
      // Atualizar store do personagem se for o selecionado
      if (selectedCharacterId === characterId && selectedCharacter) {
        const updatedCharacter = { ...selectedCharacter, gold: newGold };
        setSelectedCharacter(updatedCharacter);

        // Atualizar também na lista se existir
        const characterIndex = characters.findIndex(c => c.id === characterId);
        if (characterIndex !== -1) {
          characters[characterIndex] = updatedCharacter;
        }
      }

      // Atualizar estado do jogo se necessário
      if (gameState.player?.id === characterId) {
        updatePlayerGold(newGold);
      }
    },
    [
      selectedCharacterId,
      selectedCharacter,
      gameState.player,
      setSelectedCharacter,
      updatePlayerGold,
      characters,
    ]
  );

  /**
   * Equipar/Desequipar equipamento
   */
  const toggleEquipment = useCallback(
    async (equipmentId: string, equip: boolean) => {
      if (!selectedCharacterId) {
        toast.error('Nenhum personagem selecionado');
        return { success: false, error: 'Nenhum personagem selecionado' };
      }

      try {
        // Chamar service puro
        const result = await EquipmentService.toggleEquipment(
          selectedCharacterId,
          equipmentId,
          equip
        );

        if (!result.success) {
          toast.error('Erro', { description: result.error || 'Erro ao equipar/desequipar item' });
          return result;
        }

        // Invalidar cache do personagem
        invalidateCharacterCache(selectedCharacterId);

        // Recarregar dados do personagem para refletir mudanças de stats
        if (selectedCharacterId) {
          await loadSelectedCharacter(selectedCharacterId);
        }

        // Atualizar estado do jogo se necessário
        if (gameState.player?.id === selectedCharacterId) {
          updateGameState(draft => {
            if (draft.player) {
              draft.player.updated_at = new Date().toISOString();
            }
          });
        }

        const successMessage = equip
          ? 'Item equipado com sucesso!'
          : 'Item desequipado com sucesso!';
        toast.success(successMessage);

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erro ao equipar/desequipar item';
        toast.error('Erro', { description: errorMessage });
        return { success: false, error: errorMessage, data: null };
      }
    },
    [
      selectedCharacterId,
      invalidateCharacterCache,
      loadSelectedCharacter,
      gameState.player,
      updateGameState,
    ]
  );

  /**
   * Comprar equipamento
   */
  const buyEquipment = useCallback(
    async (equipmentId: string) => {
      if (!selectedCharacterId) {
        toast.error('Nenhum personagem selecionado');
        return { success: false, error: 'Nenhum personagem selecionado' };
      }

      try {
        // Chamar service puro
        const result = await EquipmentService.buyEquipment(selectedCharacterId, equipmentId);

        if (!result.success || !result.data) {
          toast.error('Erro', { description: result.error || 'Erro ao comprar equipamento' });
          return result;
        }

        // Invalidar cache e atualizar gold
        invalidateCharacterCache(selectedCharacterId);
        updateGoldInStores(selectedCharacterId, result.data.newGold);

        toast.success('Equipamento comprado com sucesso!');
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao comprar equipamento';
        toast.error('Erro', { description: errorMessage });
        return { success: false, error: errorMessage, data: null };
      }
    },
    [selectedCharacterId, invalidateCharacterCache, updateGoldInStores]
  );

  /**
   * Vender equipamento
   */
  const sellEquipment = useCallback(
    async (equipmentId: string) => {
      if (!selectedCharacterId) {
        toast.error('Nenhum personagem selecionado');
        return { success: false, error: 'Nenhum personagem selecionado' };
      }

      try {
        // Chamar service puro
        const result = await EquipmentService.sellEquipment(selectedCharacterId, equipmentId);

        if (!result.success || !result.data) {
          toast.error('Erro', { description: result.error || 'Erro ao vender equipamento' });
          return result;
        }

        // Invalidar cache e atualizar gold
        invalidateCharacterCache(selectedCharacterId);
        updateGoldInStores(selectedCharacterId, result.data.newGold);

        toast.success('Equipamento vendido com sucesso!');
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao vender equipamento';
        toast.error('Erro', { description: errorMessage });
        return { success: false, error: errorMessage, data: null };
      }
    },
    [selectedCharacterId, invalidateCharacterCache, updateGoldInStores]
  );

  /**
   * Vender equipamentos em lote
   */
  const sellEquipmentBatch = useCallback(
    async (equipmentSales: { equipment_id: string; quantity: number }[]) => {
      if (!selectedCharacterId) {
        toast.error('Nenhum personagem selecionado');
        return { success: false, error: 'Nenhum personagem selecionado' };
      }

      try {
        // Chamar service puro
        const result = await EquipmentService.sellEquipmentBatch(
          selectedCharacterId,
          equipmentSales
        );

        if (!result.success || !result.data) {
          toast.error('Erro', { description: result.error || 'Erro ao vender equipamentos' });
          return result;
        }

        // Invalidar cache e atualizar gold
        invalidateCharacterCache(selectedCharacterId);
        updateGoldInStores(selectedCharacterId, result.data.newGold);

        toast.success(
          `${result.data.itemsSold} itens vendidos por ${result.data.totalGoldEarned} gold!`
        );
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao vender equipamentos';
        toast.error('Erro', { description: errorMessage });
        return { success: false, error: errorMessage, data: null };
      }
    },
    [selectedCharacterId, invalidateCharacterCache, updateGoldInStores]
  );

  /**
   * Craftar equipamento
   */
  const craftEquipment = useCallback(
    async (recipeId: string) => {
      if (!selectedCharacterId) {
        toast.error('Nenhum personagem selecionado');
        return { success: false, error: 'Nenhum personagem selecionado' };
      }

      try {
        // Chamar service puro
        const result = await EquipmentService.craftEquipment(selectedCharacterId, recipeId);

        if (!result.success) {
          toast.error('Erro', { description: result.error || 'Erro ao craftar equipamento' });
          return result;
        }

        // Invalidar cache e recarregar personagem
        invalidateCharacterCache(selectedCharacterId);
        if (selectedCharacterId) {
          await loadSelectedCharacter(selectedCharacterId);
        }

        toast.success('Equipamento craftado com sucesso!');
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao craftar equipamento';
        toast.error('Erro', { description: errorMessage });
        return { success: false, error: errorMessage, data: null };
      }
    },
    [selectedCharacterId, invalidateCharacterCache, loadSelectedCharacter]
  );

  return {
    toggleEquipment,
    buyEquipment,
    sellEquipment,
    sellEquipmentBatch,
    craftEquipment,
  };
}
