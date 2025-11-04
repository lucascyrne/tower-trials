/**
 * Service para gerenciamento de equipamentos
 *
 * ✅ REFATORADO (P1 - Fase 2): Service puro - não acessa stores diretamente
 * - Todos os métodos retornam apenas dados
 * - Hook useEquipmentOperations gerencia stores
 * - Testável sem mocks de stores
 *
 * Progresso: 13/13 ocorrências refatoradas ✅
 */

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
        return this.equipmentCache.get(cacheKey) || [];
      }

      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .lte('level_requirement', characterLevel)
        .eq('is_unlocked', true)
        .order('level_requirement', { ascending: true });

      if (error) throw error;

      const equipment = data as Equipment[];
      this.equipmentCache.set(cacheKey, equipment);
      this.lastFetchTimestamp = now;

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
      const { data, error } = await supabase.from('equipment').select('*').order('name');
      if (error) throw error;

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
            price,
            is_unlocked,
            created_at,
            updated_at
          )
        `
        )
        .eq('character_id', characterId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let allEquipment = data as CharacterEquipment[];
      const equippedSlots: EquipmentSlots = {};

      // ✅ CORRIGIDO: Expandir duplicatas (quantity > 1) para múltiplos itens na UI
      // Se um personagem tem 2x "Machado de Batalha", criar 2 entries na UI
      const expandedEquipment: CharacterEquipment[] = [];
      for (const item of allEquipment) {
        const quantity = (item as any).quantity || 1;
        for (let i = 0; i < quantity; i++) {
          expandedEquipment.push({
            ...item,
            id: `${item.id}-${i}`, // Gerar IDs únicos para cada cópia (mantém original no select)
          });
        }
      }

      allEquipment = expandedEquipment;

      // ✅ CORRIGIDO: Determinar slot baseado em equipment.type (não há slot_type na tabela)
      allEquipment.forEach((item) => {
        if (item.is_equipped && item.equipment) {
          const equipmentType = item.equipment.type;

          // Mapear equipment.type para EquipmentSlots
          let slotKey: keyof EquipmentSlots | null = null;

          switch (equipmentType) {
            case 'weapon':
              // Armas ocupam slots livres (main_hand > off_hand)
              if (!equippedSlots.main_hand) {
                slotKey = 'main_hand';
              } else if (!equippedSlots.off_hand) {
                slotKey = 'off_hand';
              } else {
                // Se ambas as mãos estão ocupadas, substituir main_hand
                slotKey = 'main_hand';
              }
              break;
            case 'armor':
              // Escudos podem ir em armor ou off_hand
              slotKey = !equippedSlots.armor
                ? 'armor'
                : !equippedSlots.off_hand
                  ? 'off_hand'
                  : 'armor';
              break;
            case 'chest':
              slotKey = 'chest';
              break;
            case 'helmet':
              slotKey = 'helmet';
              break;
            case 'legs':
              slotKey = 'legs';
              break;
            case 'boots':
              slotKey = 'boots';
              break;
            case 'ring':
              // Anéis ocupam slots livres
              slotKey = !equippedSlots.ring_1
                ? 'ring_1'
                : !equippedSlots.ring_2
                  ? 'ring_2'
                  : 'ring_1';
              break;
            case 'necklace':
              slotKey = 'necklace';
              break;
            case 'amulet':
              slotKey = 'amulet';
              break;
          }

          if (slotKey) {
            equippedSlots[slotKey] = item.equipment as Equipment;
          }
        }
      });

      return { allEquipment, equippedSlots };
    } catch {
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

  // === MÉTODOS DE AÇÃO ===

  /**
   * Equipar/Desequipar equipamento
   *
   * ✅ REFATORADO (P1): Service puro - não gerencia cache ou stores
   */
  static async toggleEquipment(
    characterId: string,
    equipmentId: string,
    equip: boolean,
    slotType?: string
  ): Promise<ServiceResponse<string>> {
    try {
      const { error } = await supabase.rpc('toggle_equipment', {
        p_character_id: characterId,
        p_equipment_id: equipmentId,
        p_slot_type: slotType || null,
      });

      if (error) throw error;

      const successMessage = equip ? 'Item equipado com sucesso!' : 'Item desequipado com sucesso!';
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
   * Comprar equipamento
   *
   * ✅ REFATORADO (P1): Service puro - não gerencia cache ou stores
   */
  static async buyEquipment(
    characterId: string,
    equipmentId: string
  ): Promise<ServiceResponse<{ newGold: number }>> {
    try {
      const { data, error } = await supabase.rpc('buy_equipment', {
        p_character_id: characterId,
        p_equipment_id: equipmentId,
      });

      if (error) throw error;

      const newGold = data as number;

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
   * Vender equipamento
   *
   * ✅ REFATORADO (P1): Service puro - não gerencia cache ou stores
   */
  static async sellEquipment(
    characterId: string,
    equipmentId: string
  ): Promise<ServiceResponse<{ newGold: number }>> {
    try {
      const { data, error } = await supabase.rpc('sell_equipment', {
        p_character_id: characterId,
        p_equipment_id: equipmentId,
      });

      if (error) throw error;

      const newGold = data as number;
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
   * Vender equipamentos em lote
   *
   * ✅ REFATORADO (P1): Service puro - não gerencia cache ou stores
   */
  static async sellEquipmentBatch(
    characterId: string,
    equipmentSales: { equipment_id: string; quantity: number }[]
  ): Promise<ServiceResponse<{ totalGoldEarned: number; itemsSold: number; newGold: number }>> {
    try {
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

  // === MÉTODOS DE CRAFTING ===

  static async getEquipmentCraftingRecipes(): Promise<ServiceResponse<EquipmentCraftingRecipe[]>> {
    try {
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
      const { data, error } = await supabase.rpc('check_can_craft_equipment', {
        p_character_id: characterId,
        p_recipe_id: recipeId,
      });

      if (error) throw error;

      const result = data as { canCraft: boolean; missingIngredients: string[] };

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
   * Craftar equipamento
   *
   * ✅ REFATORADO (P1): Service puro - não gerencia cache ou stores
   */
  static async craftEquipment(
    characterId: string,
    recipeId: string
  ): Promise<ServiceResponse<{ message: string }>> {
    try {
      const { error } = await supabase.rpc('craft_equipment', {
        p_character_id: characterId,
        p_recipe_id: recipeId,
      });

      if (error) throw error;

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
      // ✅ CORRIGIDO: Usar a função correta que existe no Supabase
      const { data, error } = await supabase.rpc('calculate_equipment_bonuses', {
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
      };

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

  // === MÉTODOS UTILITÁRIOS ===

  static clearCache(): void {
    this.equipmentCache.clear();
    this.lastFetchTimestamp = 0;
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

  /**
   * ✅ HELPER: Extrair equipment_id original do ID expandido
   * IDs expandidos têm formato: "uuid-0", "uuid-1", etc.
   * Esta função retorna o uuid original
   */
  static extractOriginalEquipmentId(expandedId: string): string {
    // Se o ID contém hífen no final (como "uuid-0"), pega tudo antes do último hífen
    const parts = expandedId.split('-');
    if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
      // Último segmento é número, então ID foi expandido
      return parts.slice(0, -1).join('-');
    }
    // Caso contrário, retorna como está (ID normal)
    return expandedId;
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
