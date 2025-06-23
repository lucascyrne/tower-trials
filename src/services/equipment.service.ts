import { useCharacterStore } from '../stores/useCharacterStore';
import { useGameStateStore } from '../stores/useGameStateStore';

import {
  type Equipment,
  type CharacterEquipment,
  type EquipmentSlots,
  type EquipmentCraftingRecipe,
  type EquipmentType,
  type EquipmentComparison,
} from '../models/equipment.model';
import { supabase } from '@/lib/supabase';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// ✅ REMOVIDO: Interface não mais necessária após unificação das funções
// interface EquippedSlotRow { ... }

interface EquipmentBonuses {
  total_atk_bonus: number;
  total_def_bonus: number;
  total_mana_bonus: number;
  total_speed_bonus: number;
  total_hp_bonus: number;
  total_critical_chance_bonus: number;
  total_critical_damage_bonus: number;
  total_double_attack_chance_bonus: number;
  total_magic_damage_bonus: number;
}

function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
  }
  return fallbackMessage;
}

export class EquipmentService {
  private static equipmentCache: Map<string, Equipment[]> = new Map();
  private static lastFetchTimestamp: number = 0;
  private static CACHE_DURATION = 300000; // 5 minutos

  // === MÉTODOS DE BUSCA ===

  /**
   * OTIMIZADO: Buscar equipamentos disponíveis com cache aprimorado
   */
  static async getAvailableEquipment(characterLevel: number): Promise<Equipment[]> {
    try {
      const cacheKey = `level_${characterLevel}`;
      const now = Date.now();

      // Verificar cache
      if (
        now - this.lastFetchTimestamp < this.CACHE_DURATION &&
        this.equipmentCache.has(cacheKey)
      ) {
        console.log(`[EquipmentService] Cache hit para nível ${characterLevel}`);
        return this.equipmentCache.get(cacheKey) || [];
      }

      console.log(`[EquipmentService] Buscando equipamentos para nível ${characterLevel}`);
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .lte('level_requirement', characterLevel)
        .eq('is_unlocked', true)
        .eq('craftable', false)
        .order('level_requirement', { ascending: true });

      if (error) throw error;

      const equipment = data as Equipment[];
      this.equipmentCache.set(cacheKey, equipment);
      this.lastFetchTimestamp = now;

      console.log(
        `[EquipmentService] ${equipment.length} equipamentos carregados para nível ${characterLevel}`
      );
      return equipment;
    } catch (error) {
      console.error(
        '[EquipmentService] Erro ao buscar equipamentos:',
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  static async getAllEquipments(): Promise<Equipment[]> {
    try {
      console.log('[EquipmentService] Buscando todos os equipamentos');
      const { data, error } = await supabase.from('equipment').select('*').order('name');
      if (error) throw error;

      console.log(`[EquipmentService] ${(data as Equipment[]).length} equipamentos carregados`);
      return data as Equipment[];
    } catch (error) {
      console.error(
        '[EquipmentService] Erro ao buscar todos os equipamentos:',
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  /**
   * ✅ UNIFICADO: Buscar equipamentos do personagem (todos + equipados organizados por slot)
   */
  static async getCharacterEquipmentComplete(characterId: string): Promise<{
    allEquipment: CharacterEquipment[];
    equippedSlots: EquipmentSlots;
  }> {
    try {
      console.log(
        `[EquipmentService] Buscando equipamentos completos do personagem: ${characterId}`
      );

      // Single query que busca todos os equipamentos com dados completos
      const { data, error } = await supabase
        .from('character_equipment')
        .select(
          `
          *,
          equipment:equipment_id (
            id,
            name,
            description,
            type,
            weapon_subtype,
            rarity,
            level_requirement,
            atk_bonus,
            def_bonus,
            mana_bonus,
            speed_bonus,
            hp_bonus,
            critical_chance_bonus,
            critical_damage_bonus,
            double_attack_chance_bonus,
            magic_damage_bonus,
            price,
            is_unlocked,
            created_at,
            updated_at,
            craftable
          )
        `
        )
        .eq('character_id', characterId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allEquipment = data as CharacterEquipment[];
      const equippedSlots: EquipmentSlots = {};

      // Processar equipamentos equipados
      allEquipment.forEach(item => {
        if (item.is_equipped && item.equipment && item.slot_type) {
          const slotKey = item.slot_type as keyof EquipmentSlots;
          if (
            [
              'main_hand',
              'off_hand',
              'armor',
              'chest',
              'helmet',
              'legs',
              'boots',
              'ring_1',
              'ring_2',
              'necklace',
              'amulet',
            ].includes(slotKey)
          ) {
            equippedSlots[slotKey] = item.equipment as Equipment;
          }
        }
      });

      console.log(
        `[EquipmentService] ✅ Dados unificados: ${allEquipment.length} equipamentos totais, ${Object.keys(equippedSlots).length} slots equipados`
      );
      console.log(`[EquipmentService] Slots equipados:`, Object.keys(equippedSlots));

      return { allEquipment, equippedSlots };
    } catch (error) {
      console.error(
        '[EquipmentService] Erro ao buscar equipamentos completos:',
        error instanceof Error ? error.message : error
      );
      return { allEquipment: [], equippedSlots: {} };
    }
  }

  /**
   * ✅ WRAPPER: Manter compatibilidade com código existente
   */
  static async getCharacterEquipment(characterId: string): Promise<CharacterEquipment[]> {
    const { allEquipment } = await this.getCharacterEquipmentComplete(characterId);
    return allEquipment;
  }

  /**
   * ✅ WRAPPER: Manter compatibilidade com código existente
   */
  static async getEquippedItems(characterId: string): Promise<EquipmentSlots> {
    const { equippedSlots } = await this.getCharacterEquipmentComplete(characterId);
    return equippedSlots;
  }

  // === MÉTODOS DE AÇÃO COM INTEGRAÇÃO ZUSTAND ===

  /**
   * OTIMIZADO: Equipar/Desequipar equipamento com integração Zustand
   */
  static async toggleEquipment(
    characterId: string,
    equipmentId: string,
    equip: boolean,
    slotType?: string
  ): Promise<ServiceResponse<string>> {
    try {
      console.log(
        `[EquipmentService] ${equip ? 'Equipando' : 'Desequipando'} item: ${equipmentId} para personagem: ${characterId}`
      );

      const { error } = await supabase.rpc('toggle_equipment', {
        p_character_id: characterId,
        p_equipment_id: equipmentId,
        p_equip: equip,
        p_slot_type: slotType,
      });

      if (error) throw error;

      // Invalidar cache do personagem após mudança de equipamento
      await this.invalidateCharacterCaches(characterId);

      // Atualizar store do personagem se for o personagem selecionado
      const characterStore = useCharacterStore.getState();
      if (characterStore.selectedCharacterId === characterId) {
        // Recarregar dados do personagem para refletir mudanças de stats
        characterStore.loadSelectedCharacter(characterId);
      }

      // Atualizar estado do jogo se necessário
      const gameStore = useGameStateStore.getState();
      if (gameStore.gameState.player?.id === characterId) {
        // Forçar recalculo de stats no próximo acesso
        gameStore.updateGameState(draft => {
          // Marcar que os stats precisam ser recalculados
          if (draft.player) {
            draft.player.updated_at = new Date().toISOString();
          }
        });
      }

      const successMessage = equip ? 'Item equipado com sucesso!' : 'Item desequipado com sucesso!';
      console.log(`[EquipmentService] ${successMessage}`);

      return {
        data: successMessage,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('[EquipmentService] Erro ao equipar/desequipar item:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao equipar/desequipar item'),
        success: false,
      };
    }
  }

  /**
   * OTIMIZADO: Comprar equipamento com integração Zustand
   */
  static async buyEquipment(
    characterId: string,
    equipmentId: string
  ): Promise<ServiceResponse<{ newGold: number }>> {
    try {
      console.log(
        `[EquipmentService] Comprando equipamento: ${equipmentId} para personagem: ${characterId}`
      );

      const { data: equipmentData, error: equipmentError } = await supabase
        .from('equipment')
        .select('name, price')
        .eq('id', equipmentId)
        .single();

      if (equipmentError) throw new Error(`Erro ao buscar equipamento: ${equipmentError.message}`);
      if (!equipmentData) throw new Error('Equipamento não encontrado');

      const { data, error } = await supabase.rpc('buy_equipment', {
        p_character_id: characterId,
        p_equipment_id: equipmentId,
        p_price: equipmentData.price,
      });

      if (error) throw error;

      const newGold = data as number;
      console.log(
        `[EquipmentService] Equipamento "${equipmentData.name}" comprado. Novo gold: ${newGold}`
      );

      // Invalidar caches
      this.invalidateCharacterCaches(characterId);

      // Atualizar store do personagem
      const characterStore = useCharacterStore.getState();
      if (characterStore.selectedCharacterId === characterId && characterStore.selectedCharacter) {
        // Atualizar gold na store
        const updatedCharacter = { ...characterStore.selectedCharacter, gold: newGold };
        characterStore.setSelectedCharacter(updatedCharacter);

        // Atualizar também na lista se existir
        const characterIndex = characterStore.characters.findIndex(c => c.id === characterId);
        if (characterIndex !== -1) {
          characterStore.characters[characterIndex] = updatedCharacter;
        }
      }

      // Atualizar estado do jogo se necessário
      const gameStore = useGameStateStore.getState();
      if (gameStore.gameState.player?.id === characterId) {
        gameStore.updatePlayerGold(newGold);
      }

      return {
        data: { newGold },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('[EquipmentService] Erro ao comprar equipamento:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao comprar equipamento'),
        success: false,
      };
    }
  }

  /**
   * OTIMIZADO: Vender equipamento com integração Zustand
   */
  static async sellEquipment(
    characterId: string,
    equipmentId: string
  ): Promise<ServiceResponse<{ newGold: number }>> {
    try {
      console.log(
        `[EquipmentService] Vendendo equipamento: ${equipmentId} para personagem: ${characterId}`
      );

      const { data, error } = await supabase.rpc('sell_equipment', {
        p_character_id: characterId,
        p_equipment_id: equipmentId,
      });

      if (error) throw error;

      const newGold = data as number;
      console.log(`[EquipmentService] Equipamento vendido. Novo gold: ${newGold}`);

      // Invalidar caches
      this.invalidateCharacterCaches(characterId);

      // Atualizar store do personagem
      const characterStore = useCharacterStore.getState();
      if (characterStore.selectedCharacterId === characterId && characterStore.selectedCharacter) {
        // Atualizar gold na store
        const updatedCharacter = { ...characterStore.selectedCharacter, gold: newGold };
        characterStore.setSelectedCharacter(updatedCharacter);

        // Atualizar também na lista se existir
        const characterIndex = characterStore.characters.findIndex(c => c.id === characterId);
        if (characterIndex !== -1) {
          characterStore.characters[characterIndex] = updatedCharacter;
        }
      }

      // Atualizar estado do jogo se necessário
      const gameStore = useGameStateStore.getState();
      if (gameStore.gameState.player?.id === characterId) {
        gameStore.updatePlayerGold(newGold);
      }

      return {
        data: { newGold },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('[EquipmentService] Erro ao vender equipamento:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao vender equipamento'),
        success: false,
      };
    }
  }

  /**
   * ✅ NOVO: Vender equipamentos em lote
   */
  static async sellEquipmentBatch(
    characterId: string,
    equipmentSales: { equipment_id: string; quantity: number }[]
  ): Promise<ServiceResponse<{ totalGoldEarned: number; itemsSold: number; newGold: number }>> {
    try {
      console.log(
        `[EquipmentService] Vendendo ${equipmentSales.length} tipos de equipamentos em lote para: ${characterId}`
      );

      const { data, error } = await supabase
        .rpc('sell_character_equipment_batch', {
          p_character_id: characterId,
          p_equipment_sales: equipmentSales,
        })
        .single();

      if (error) throw error;

      const result = data as {
        total_gold_earned: number;
        items_sold: number;
        new_character_gold: number;
      };

      console.log(
        `[EquipmentService] Venda em lote concluída: ${result.items_sold} itens vendidos por ${result.total_gold_earned} gold`
      );

      // Invalidar caches
      await this.invalidateCharacterCaches(characterId);

      // Atualizar stores
      await this.updateStoresAfterSale(characterId, result.new_character_gold);

      return {
        data: {
          totalGoldEarned: result.total_gold_earned,
          itemsSold: result.items_sold,
          newGold: result.new_character_gold,
        },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('[EquipmentService] Erro ao vender equipamentos em lote:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao vender equipamentos'),
        success: false,
      };
    }
  }

  /**
   * ✅ NOVO: Calcular preço de venda de equipamento
   */
  static async calculateEquipmentSellPrice(
    characterId: string,
    equipmentId: string,
    quantity: number = 1
  ): Promise<
    ServiceResponse<{
      canSell: boolean;
      availableQuantity: number;
      unitSellPrice: number;
      totalSellPrice: number;
      originalPrice: number;
    }>
  > {
    try {
      const { data, error } = await supabase
        .rpc('calculate_sell_prices', {
          p_character_id: characterId,
          p_item_type: 'equipment',
          p_item_id: equipmentId,
          p_quantity: quantity,
        })
        .single();

      if (error) throw error;

      const result = data as {
        can_sell: boolean;
        available_quantity: number;
        unit_sell_price: number;
        total_sell_price: number;
        original_price: number;
      };

      return {
        data: {
          canSell: result.can_sell,
          availableQuantity: result.available_quantity,
          unitSellPrice: result.unit_sell_price,
          totalSellPrice: result.total_sell_price,
          originalPrice: result.original_price,
        },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('[EquipmentService] Erro ao calcular preço de venda:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao calcular preço'),
        success: false,
      };
    }
  }

  // === MÉTODOS DE CRAFTING COM INTEGRAÇÃO ZUSTAND ===

  static async getEquipmentCraftingRecipes(): Promise<ServiceResponse<EquipmentCraftingRecipe[]>> {
    try {
      console.log('[EquipmentService] Buscando receitas de crafting de equipamentos');
      const { data, error } = await supabase
        .from('equipment_crafting_recipes')
        .select(
          `
          *,
          equipment:result_equipment_id (*),
          ingredients:equipment_crafting_ingredients (*)
        `
        )
        .order('name');

      if (error) throw error;

      const recipes = data as EquipmentCraftingRecipe[];
      console.log(`[EquipmentService] ${recipes.length} receitas de crafting carregadas`);

      return { data: recipes, error: null, success: true };
    } catch (error) {
      console.error(
        '[EquipmentService] Erro ao buscar receitas de equipamentos:',
        error instanceof Error ? error.message : error
      );
      return { data: null, error: 'Erro ao buscar receitas de equipamentos', success: false };
    }
  }

  static async canCraftEquipment(
    characterId: string,
    recipeId: string
  ): Promise<ServiceResponse<{ canCraft: boolean; missingIngredients: string[] }>> {
    try {
      console.log(
        `[EquipmentService] Verificando se pode craftar: ${recipeId} para personagem: ${characterId}`
      );
      const { data, error } = await supabase.rpc('check_can_craft_equipment', {
        p_character_id: characterId,
        p_recipe_id: recipeId,
      });

      if (error) throw error;

      const result = data as { canCraft: boolean; missingIngredients: string[] };
      console.log(
        `[EquipmentService] Pode craftar: ${result.canCraft}, Ingredientes faltantes: ${result.missingIngredients.length}`
      );

      return {
        data: result,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('[EquipmentService] Erro ao verificar crafting de equipamento:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao verificar crafting de equipamento'),
        success: false,
      };
    }
  }

  /**
   * OTIMIZADO: Craftar equipamento com integração Zustand
   */
  static async craftEquipment(
    characterId: string,
    recipeId: string
  ): Promise<ServiceResponse<{ message: string }>> {
    try {
      console.log(
        `[EquipmentService] Craftando equipamento: ${recipeId} para personagem: ${characterId}`
      );

      const { error } = await supabase.rpc('craft_equipment', {
        p_character_id: characterId,
        p_recipe_id: recipeId,
      });

      if (error) throw error;

      console.log('[EquipmentService] Equipamento craftado com sucesso');

      // Invalidar caches após crafting
      await this.invalidateCharacterCaches(characterId);

      // Atualizar store do personagem se necessário
      const characterStore = useCharacterStore.getState();
      if (characterStore.selectedCharacterId === characterId) {
        characterStore.loadSelectedCharacter(characterId);
      }

      return {
        data: { message: 'Equipamento criado com sucesso!' },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('[EquipmentService] Erro ao craftar equipamento:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao craftar equipamento'),
        success: false,
      };
    }
  }

  // === MÉTODOS DE ANÁLISE ===

  /**
   * ✅ ATUALIZADO: Verificar se pode equipar um item considerando os novos slots
   */
  static async canEquipItem(
    characterId: string,
    equipmentId: string
  ): Promise<ServiceResponse<{ canEquip: boolean; reason: string; suggestedSlot?: string }>> {
    try {
      console.log(
        `[EquipmentService] Verificando se pode equipar: ${equipmentId} para personagem: ${characterId}`
      );

      // Buscar dados do equipamento
      const { data: equipment, error: equipmentError } = await supabase
        .from('equipment')
        .select('*')
        .eq('id', equipmentId)
        .single();

      if (equipmentError || !equipment) {
        return {
          data: { canEquip: false, reason: 'Equipamento não encontrado' },
          error: null,
          success: true,
        };
      }

      // Buscar slots atuais do personagem
      const currentSlots = await this.getEquippedItems(characterId);

      // Verificar compatibilidade por tipo
      let canEquip = false;
      let reason = '';
      let suggestedSlot = '';

      switch (equipment.type) {
        case 'weapon':
          if (!currentSlots.main_hand) {
            canEquip = true;
            reason = 'Pode equipar na mão principal';
            suggestedSlot = 'main_hand';
          } else if (!currentSlots.off_hand) {
            canEquip = true;
            reason = 'Pode equipar na mão secundária';
            suggestedSlot = 'off_hand';
          } else {
            canEquip = true;
            reason = 'Pode substituir equipamento existente';
            suggestedSlot = 'main_hand';
          }
          break;

        case 'armor':
          if (!currentSlots.armor) {
            canEquip = true;
            reason = 'Pode equipar como escudo na mão secundária';
            suggestedSlot = 'armor';
          } else if (!currentSlots.off_hand) {
            canEquip = true;
            reason = 'Pode equipar como escudo na mão secundária';
            suggestedSlot = 'off_hand';
          } else {
            canEquip = true;
            reason = 'Pode substituir equipamento existente';
            suggestedSlot = 'armor';
          }
          break;

        case 'chest':
          if (!currentSlots.chest) {
            canEquip = true;
            reason = 'Pode equipar como peitoral';
            suggestedSlot = 'chest';
          } else {
            canEquip = true;
            reason = 'Pode substituir peitoral existente';
            suggestedSlot = 'chest';
          }
          break;

        case 'helmet':
          if (!currentSlots.helmet) {
            canEquip = true;
            reason = 'Pode equipar como capacete';
            suggestedSlot = 'helmet';
          } else {
            canEquip = true;
            reason = 'Pode substituir capacete existente';
            suggestedSlot = 'helmet';
          }
          break;

        case 'legs':
          if (!currentSlots.legs) {
            canEquip = true;
            reason = 'Pode equipar como perneiras';
            suggestedSlot = 'legs';
          } else {
            canEquip = true;
            reason = 'Pode substituir perneiras existentes';
            suggestedSlot = 'legs';
          }
          break;

        case 'boots':
          if (!currentSlots.boots) {
            canEquip = true;
            reason = 'Pode equipar como botas';
            suggestedSlot = 'boots';
          } else {
            canEquip = true;
            reason = 'Pode substituir botas existentes';
            suggestedSlot = 'boots';
          }
          break;

        case 'ring':
          if (!currentSlots.ring_1) {
            canEquip = true;
            reason = 'Pode equipar no primeiro slot de anel';
            suggestedSlot = 'ring_1';
          } else if (!currentSlots.ring_2) {
            canEquip = true;
            reason = 'Pode equipar no segundo slot de anel';
            suggestedSlot = 'ring_2';
          } else {
            canEquip = true;
            reason = 'Pode substituir anel existente';
            suggestedSlot = 'ring_1';
          }
          break;

        case 'necklace':
          if (!currentSlots.necklace) {
            canEquip = true;
            reason = 'Pode equipar como colar';
            suggestedSlot = 'necklace';
          } else {
            canEquip = true;
            reason = 'Pode substituir colar existente';
            suggestedSlot = 'necklace';
          }
          break;

        case 'amulet':
          if (!currentSlots.amulet) {
            canEquip = true;
            reason = 'Pode equipar como amuleto';
            suggestedSlot = 'amulet';
          } else {
            canEquip = true;
            reason = 'Pode substituir amuleto existente';
            suggestedSlot = 'amulet';
          }
          break;

        default:
          canEquip = false;
          reason = 'Tipo de equipamento não reconhecido';
      }

      const result = { canEquip, reason, suggestedSlot };
      console.log(
        `[EquipmentService] Pode equipar: ${result.canEquip}, Razão: ${result.reason}, Slot sugerido: ${result.suggestedSlot}`
      );

      return {
        data: result,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('[EquipmentService] Erro ao verificar se pode equipar item:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao verificar se pode equipar item'),
        success: false,
      };
    }
  }

  static async compareEquipmentStats(
    characterId: string,
    newEquipmentId: string,
    slotType?: string
  ): Promise<ServiceResponse<EquipmentComparison[]>> {
    try {
      console.log(`[EquipmentService] Comparando equipamentos para personagem: ${characterId}`);
      const { data, error } = await supabase.rpc('compare_equipment_stats', {
        p_character_id: characterId,
        p_new_equipment_id: newEquipmentId,
        p_slot_type: slotType,
      });

      if (error) {
        console.error('[EquipmentService] Erro ao comparar equipamentos:', error);
        return { success: false, error: error.message, data: null };
      }

      const comparisons = data || [];
      console.log(`[EquipmentService] ${comparisons.length} comparações de stats realizadas`);

      return { success: true, error: null, data: comparisons };
    } catch (error) {
      console.error('[EquipmentService] Erro na comparação de equipamentos:', error);
      return {
        success: false,
        error: extractErrorMessage(error, 'Erro ao comparar equipamentos'),
        data: null,
      };
    }
  }

  static async getEquipmentBonuses(
    characterId: string
  ): Promise<ServiceResponse<EquipmentBonuses>> {
    try {
      console.log(
        `[EquipmentService] Calculando bônus de equipamentos para personagem: ${characterId}`
      );

      // ✅ ATUALIZADO: Usar nova função que suporta os novos slots
      const { data, error } = await supabase.rpc('calculate_equipment_bonuses_enhanced_v2', {
        p_character_id: characterId,
      });

      if (error) {
        console.error('[EquipmentService] Erro ao calcular bônus:', error);
        return { success: false, error: error.message, data: null };
      }

      const bonuses = data?.[0] || {
        total_atk_bonus: 0,
        total_def_bonus: 0,
        total_mana_bonus: 0,
        total_speed_bonus: 0,
        total_hp_bonus: 0,
        total_critical_chance_bonus: 0,
        total_critical_damage_bonus: 0,
        total_double_attack_chance_bonus: 0,
        total_magic_damage_bonus: 0,
      };

      console.log('[EquipmentService] Bônus de equipamentos calculados:', bonuses);

      return {
        success: true,
        error: null,
        data: bonuses,
      };
    } catch (error) {
      console.error('[EquipmentService] Erro ao obter bônus:', error);
      return {
        success: false,
        error: extractErrorMessage(error, 'Erro ao obter bônus de equipamentos'),
        data: null,
      };
    }
  }

  // === MÉTODOS UTILITÁRIOS COM INTEGRAÇÃO ZUSTAND ===

  /**
   * NOVO: Invalidar caches relacionados ao personagem
   */
  private static async invalidateCharacterCaches(characterId: string): Promise<void> {
    try {
      // Importar dinamicamente para evitar ciclos de dependência
      const { CharacterCacheService } = await import('./character-cache.service');
      CharacterCacheService.invalidateCharacterCache(characterId);
      console.log(`[EquipmentService] Caches invalidados para personagem: ${characterId}`);
    } catch (error) {
      console.warn(`[EquipmentService] Erro ao invalidar cache (não crítico):`, error);
    }
  }

  /**
   * ✅ NOVO: Atualizar stores após venda
   */
  private static async updateStoresAfterSale(characterId: string, newGold: number): Promise<void> {
    try {
      // Atualizar store do personagem
      const characterStore = useCharacterStore.getState();
      if (characterStore.selectedCharacterId === characterId && characterStore.selectedCharacter) {
        // Atualizar gold na store
        const updatedCharacter = { ...characterStore.selectedCharacter, gold: newGold };
        characterStore.setSelectedCharacter(updatedCharacter);

        // Atualizar também na lista se existir
        const characterIndex = characterStore.characters.findIndex(c => c.id === characterId);
        if (characterIndex !== -1) {
          characterStore.characters[characterIndex] = updatedCharacter;
        }
      }

      // Atualizar estado do jogo se necessário
      const gameStore = useGameStateStore.getState();
      if (gameStore.gameState.player?.id === characterId) {
        gameStore.updatePlayerGold(newGold);
      }

      console.log(`[EquipmentService] Stores atualizadas com novo gold: ${newGold}`);
    } catch (error) {
      console.warn(`[EquipmentService] Erro ao atualizar stores (não crítico):`, error);
    }
  }

  static clearCache(): void {
    this.equipmentCache.clear();
    this.lastFetchTimestamp = 0;
    console.log('[EquipmentService] Cache de equipamentos limpo');
  }

  /**
   * NOVO: Sincronizar dados de equipamentos com store
   */
  static syncEquipmentWithStore(characterId: string, equipmentSlots: EquipmentSlots): void {
    const characterStore = useCharacterStore.getState();

    if (characterStore.selectedCharacterId === characterId && characterStore.selectedCharacter) {
      const updatedCharacter = {
        ...characterStore.selectedCharacter,
        equipment_slots: equipmentSlots,
        updated_at: new Date().toISOString(),
      };

      characterStore.setSelectedCharacter(updatedCharacter);
      console.log(
        `[EquipmentService] Dados de equipamentos sincronizados com store para: ${characterId}`
      );
    }
  }

  /**
   * NOVO: Obter dados de equipamentos com prioridade da store
   */
  static async getEquipmentWithStoreSync(characterId: string): Promise<EquipmentSlots> {
    // Tentar obter da store primeiro
    const characterStore = useCharacterStore.getState();

    if (
      characterStore.selectedCharacterId === characterId &&
      characterStore.selectedCharacter?.equipment_slots
    ) {
      console.log('[EquipmentService] Usando dados de equipamentos da store');
      return characterStore.selectedCharacter.equipment_slots;
    }

    // Buscar do servidor se não estiver na store
    console.log('[EquipmentService] Buscando dados de equipamentos do servidor');
    const equipmentSlots = await this.getEquippedItems(characterId);

    // Sincronizar com store
    this.syncEquipmentWithStore(characterId, equipmentSlots);

    return equipmentSlots;
  }

  /**
   * ✅ NOVO: Função auxiliar para determinar slot automático baseado no tipo de equipamento
   */
  static determineEquipmentSlot(equipment: Equipment, currentSlots: EquipmentSlots): string | null {
    switch (equipment.type) {
      case 'weapon':
        if (!currentSlots.main_hand) return 'main_hand';
        if (!currentSlots.off_hand) return 'off_hand';
        return 'main_hand'; // Substituir mão principal

      case 'armor':
        if (!currentSlots.armor) return 'armor';
        if (!currentSlots.off_hand) return 'off_hand'; // Como escudo
        return 'armor'; // Substituir escudo

      case 'chest':
        return 'chest';

      case 'helmet':
        return 'helmet';

      case 'legs':
        return 'legs';

      case 'boots':
        return 'boots';

      case 'ring':
        if (!currentSlots.ring_1) return 'ring_1';
        if (!currentSlots.ring_2) return 'ring_2';
        return 'ring_1'; // Substituir primeiro anel

      case 'necklace':
        return 'necklace';

      case 'amulet':
        return 'amulet';

      default:
        return null;
    }
  }

  /**
   * ✅ NOVO: Obter informações sobre slots disponíveis para um tipo de equipamento
   */
  static getAvailableSlotsForType(
    equipmentType: EquipmentType,
    currentSlots: EquipmentSlots
  ): {
    availableSlots: string[];
    occupiedSlots: string[];
    maxSlots: number;
  } {
    switch (equipmentType) {
      case 'weapon':
        return {
          availableSlots: [
            ...(currentSlots.main_hand ? [] : ['main_hand']),
            ...(currentSlots.off_hand ? [] : ['off_hand']),
          ],
          occupiedSlots: [
            ...(currentSlots.main_hand ? ['main_hand'] : []),
            ...(currentSlots.off_hand ? ['off_hand'] : []),
          ],
          maxSlots: 2,
        };

      case 'armor':
        return {
          availableSlots: [
            ...(currentSlots.armor ? [] : ['armor']),
            ...(currentSlots.off_hand ? [] : ['off_hand']), // Como escudo
          ],
          occupiedSlots: [
            ...(currentSlots.armor ? ['armor'] : []),
            ...(currentSlots.off_hand ? ['off_hand'] : []),
          ],
          maxSlots: 2, // Escudo + off-hand
        };

      case 'chest':
        return {
          availableSlots: currentSlots.chest ? [] : ['chest'],
          occupiedSlots: currentSlots.chest ? ['chest'] : [],
          maxSlots: 1,
        };

      case 'helmet':
        return {
          availableSlots: currentSlots.helmet ? [] : ['helmet'],
          occupiedSlots: currentSlots.helmet ? ['helmet'] : [],
          maxSlots: 1,
        };

      case 'legs':
        return {
          availableSlots: currentSlots.legs ? [] : ['legs'],
          occupiedSlots: currentSlots.legs ? ['legs'] : [],
          maxSlots: 1,
        };

      case 'boots':
        return {
          availableSlots: currentSlots.boots ? [] : ['boots'],
          occupiedSlots: currentSlots.boots ? ['boots'] : [],
          maxSlots: 1,
        };

      case 'ring':
        return {
          availableSlots: [
            ...(currentSlots.ring_1 ? [] : ['ring_1']),
            ...(currentSlots.ring_2 ? [] : ['ring_2']),
          ],
          occupiedSlots: [
            ...(currentSlots.ring_1 ? ['ring_1'] : []),
            ...(currentSlots.ring_2 ? ['ring_2'] : []),
          ],
          maxSlots: 2,
        };

      case 'necklace':
        return {
          availableSlots: currentSlots.necklace ? [] : ['necklace'],
          occupiedSlots: currentSlots.necklace ? ['necklace'] : [],
          maxSlots: 1,
        };

      case 'amulet':
        return {
          availableSlots: currentSlots.amulet ? [] : ['amulet'],
          occupiedSlots: currentSlots.amulet ? ['amulet'] : [],
          maxSlots: 1,
        };

      default:
        return {
          availableSlots: [],
          occupiedSlots: [],
          maxSlots: 0,
        };
    }
  }
}

// ✅ ATUALIZADO: Função de cálculo de bônus movida para equipment.model.ts
export const calculateEquipmentBonus = (slots: EquipmentSlots) => {
  const bonus = {
    hp: 0,
    max_hp: 0,
    mana: 0,
    max_mana: 0,
    atk: 0,
    def: 0,
    speed: 0,
    critical_chance: 0,
    critical_damage: 0,
    double_attack_chance: 0,
    magic_damage: 0,
  };

  const addEquipmentBonus = (equipment: Equipment | null, isOffHand: boolean = false) => {
    if (!equipment) return;

    // Sistema de nerf para off-hand weapons (20% de redução)
    const offHandMultiplier = isOffHand && equipment.type === 'weapon' ? 0.8 : 1.0;
    // Escudos mantêm 100% de eficiência mesmo na off-hand
    const actualMultiplier = isOffHand && equipment.type === 'armor' ? 1.0 : offHandMultiplier;

    bonus.hp += Math.floor((equipment.hp_bonus || 0) * actualMultiplier);
    bonus.max_hp += Math.floor((equipment.hp_bonus || 0) * actualMultiplier);
    bonus.mana += Math.floor((equipment.mana_bonus || 0) * actualMultiplier);
    bonus.max_mana += Math.floor((equipment.mana_bonus || 0) * actualMultiplier);
    bonus.atk += Math.floor((equipment.atk_bonus || 0) * actualMultiplier);
    bonus.def += Math.floor((equipment.def_bonus || 0) * actualMultiplier);
    bonus.speed += Math.floor((equipment.speed_bonus || 0) * actualMultiplier);
    bonus.critical_chance += (equipment.critical_chance_bonus || 0) * actualMultiplier;
    bonus.critical_damage += (equipment.critical_damage_bonus || 0) * actualMultiplier;
    bonus.double_attack_chance += (equipment.double_attack_chance_bonus || 0) * actualMultiplier;
    bonus.magic_damage += (equipment.magic_damage_bonus || 0) * actualMultiplier;
  };

  // ✅ ATUALIZADO: Aplicar bônus de todos os novos slots incluindo armaduras
  addEquipmentBonus(slots.main_hand ?? null, false);
  addEquipmentBonus(slots.off_hand ?? null, true);
  addEquipmentBonus(slots.armor ?? null, false); // Escudos
  addEquipmentBonus(slots.chest ?? null, false);
  addEquipmentBonus(slots.helmet ?? null, false);
  addEquipmentBonus(slots.legs ?? null, false);
  addEquipmentBonus(slots.boots ?? null, false);
  addEquipmentBonus(slots.ring_1 ?? null, false);
  addEquipmentBonus(slots.ring_2 ?? null, false);
  addEquipmentBonus(slots.necklace ?? null, false);
  addEquipmentBonus(slots.amulet ?? null, false);

  // ✅ NOVO: Bônus de conjunto para armadura e acessórios
  const ringsCount = (slots.ring_1 ? 1 : 0) + (slots.ring_2 ? 1 : 0);
  const accessoriesCount = ringsCount + (slots.necklace ? 1 : 0) + (slots.amulet ? 1 : 0);
  const armorPiecesCount =
    (slots.chest ? 1 : 0) + (slots.helmet ? 1 : 0) + (slots.legs ? 1 : 0) + (slots.boots ? 1 : 0);

  // Bônus de conjunto para armadura completa (4 peças)
  if (armorPiecesCount >= 4) {
    bonus.def = Math.floor(bonus.def * 1.2); // +20% defesa
    bonus.hp = Math.floor(bonus.hp * 1.15); // +15% HP
    bonus.max_hp = Math.floor(bonus.max_hp * 1.15); // +15% HP máximo
  }
  // Bônus de conjunto para 3+ peças de armadura
  else if (armorPiecesCount >= 3) {
    bonus.def = Math.floor(bonus.def * 1.1); // +10% defesa
  }
  // Bônus de conjunto para 2 peças de armadura
  else if (armorPiecesCount >= 2) {
    bonus.hp = Math.floor(bonus.hp * 1.05); // +5% HP
    bonus.max_hp = Math.floor(bonus.max_hp * 1.05); // +5% HP máximo
  }

  // Bônus de conjunto para acessórios (4 acessórios completos)
  if (accessoriesCount >= 4) {
    bonus.atk = Math.floor(bonus.atk * 1.1); // +10% ataque
    bonus.critical_chance = bonus.critical_chance * 1.15; // +15% chance crítica
  }
  // Bônus de conjunto para 3+ acessórios
  else if (accessoriesCount >= 3) {
    bonus.critical_chance = bonus.critical_chance * 1.1; // +10% chance crítica
    bonus.speed = Math.floor(bonus.speed * 1.05); // +5% velocidade
  }
  // Bônus de conjunto para 2 anéis
  else if (ringsCount >= 2) {
    bonus.critical_damage = bonus.critical_damage * 1.05; // +5% dano crítico
  }

  // Bônus dual-wielding (permanece igual)
  if (slots.main_hand?.type === 'weapon' && slots.off_hand?.type === 'weapon') {
    bonus.atk = Math.floor(bonus.atk * 1.15);
  }

  return bonus;
};
