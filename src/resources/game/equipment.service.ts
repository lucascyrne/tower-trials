import {
  type Equipment,
  type CharacterEquipment,
  type EquipmentSlots,
  type EquipmentCraftingRecipe,
  type EquipmentType,
  type WeaponSubtype,
  type EquipmentRarity,
  type EquipmentComparison,
} from './models/equipment.model';
import { supabase } from '@/lib/supabase';

interface EquippedSlotRow {
  slot_type: string;
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  weapon_subtype: string | null;
  atk_bonus: number;
  def_bonus: number;
  mana_bonus: number;
  speed_bonus: number;
  hp_bonus: number;
  critical_chance_bonus: number;
  critical_damage_bonus: number;
  double_attack_chance_bonus: number;
  magic_damage_bonus: number;
  rarity: string;
}

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

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

/**
 * Extrair mensagem de erro específica do Supabase/PostgreSQL
 */
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

  /**
   * Buscar equipamentos disponíveis para compra baseado no nível do personagem
   */
  static async getAvailableEquipment(characterLevel: number): Promise<Equipment[]> {
    try {
      const cacheKey = `level_${characterLevel}`;
      const now = Date.now();

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
        .eq('craftable', false) // Apenas equipamentos não craftáveis na loja
        .order('level_requirement', { ascending: true });

      if (error) throw error;

      const equipment = data as Equipment[];
      this.equipmentCache.set(cacheKey, equipment);
      this.lastFetchTimestamp = now;

      return equipment;
    } catch (error) {
      console.error('Erro ao buscar equipamentos:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Buscar receitas de crafting de equipamentos
   */
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

      return { data: data as EquipmentCraftingRecipe[], error: null, success: true };
    } catch (error) {
      console.error(
        'Erro ao buscar receitas de equipamentos:',
        error instanceof Error ? error.message : error
      );
      return { data: null, error: 'Erro ao buscar receitas de equipamentos', success: false };
    }
  }

  /**
   * Verificar se um personagem pode craftar um equipamento
   */
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

      return {
        data: data as { canCraft: boolean; missingIngredients: string[] },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao verificar crafting de equipamento:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao verificar crafting de equipamento'),
        success: false,
      };
    }
  }

  /**
   * Craftar um equipamento
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
      console.error('Erro ao craftar equipamento:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao craftar equipamento'),
        success: false,
      };
    }
  }

  /**
   * Buscar equipamentos do personagem
   */
  static async getCharacterEquipment(characterId: string): Promise<CharacterEquipment[]> {
    try {
      const { data, error } = await supabase
        .from('character_equipment')
        .select(
          `
                    *,
                    equipment:equipment_id (*)
                `
        )
        .eq('character_id', characterId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data as CharacterEquipment[];
    } catch (error) {
      console.error(
        'Erro ao buscar equipamentos do personagem:',
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  /**
   * Buscar equipamentos equipados do personagem
   */
  static async getEquippedItems(characterId: string): Promise<EquipmentSlots> {
    try {
      const { data, error } = await supabase.rpc('get_equipped_slots', {
        p_character_id: characterId,
      });

      if (error) throw error;

      const slots: EquipmentSlots = {};

      if (data && Array.isArray(data)) {
        (data as EquippedSlotRow[]).forEach(row => {
          const equipment: Equipment = {
            id: row.equipment_id,
            name: row.equipment_name,
            description: '',
            type: row.equipment_type as EquipmentType,
            weapon_subtype: row.weapon_subtype as WeaponSubtype,
            rarity: row.rarity as EquipmentRarity,
            level_requirement: 0,
            atk_bonus: row.atk_bonus,
            def_bonus: row.def_bonus,
            mana_bonus: row.mana_bonus,
            speed_bonus: row.speed_bonus,
            hp_bonus: row.hp_bonus,
            critical_chance_bonus: row.critical_chance_bonus,
            critical_damage_bonus: row.critical_damage_bonus,
            double_attack_chance_bonus: row.double_attack_chance_bonus,
            magic_damage_bonus: row.magic_damage_bonus,
            price: 0,
            is_unlocked: true,
            created_at: '',
            updated_at: '',
          };

          slots[row.slot_type as keyof EquipmentSlots] = equipment;
        });
      }

      return slots;
    } catch (error) {
      console.error(
        'Erro ao buscar equipamentos equipados:',
        error instanceof Error ? error.message : error
      );
      return {};
    }
  }

  /**
   * Equipar ou desequipar um item
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
        p_equip: equip,
        p_slot_type: slotType,
      });

      if (error) throw error;

      return {
        data: equip ? 'Item equipado com sucesso!' : 'Item desequipado com sucesso!',
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao equipar/desequipar item:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao equipar/desequipar item'),
        success: false,
      };
    }
  }

  /**
   * Comprar equipamento
   */
  static async buyEquipment(
    characterId: string,
    equipmentId: string
  ): Promise<ServiceResponse<{ newGold: number }>> {
    try {
      // Primeiro, buscar o equipamento para obter o preço
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('equipment')
        .select('price')
        .eq('id', equipmentId)
        .single();

      if (equipmentError) {
        throw new Error(`Erro ao buscar equipamento: ${equipmentError.message}`);
      }

      if (!equipmentData) {
        throw new Error('Equipamento não encontrado');
      }

      // Chamar a função RPC com o preço
      const { data, error } = await supabase.rpc('buy_equipment', {
        p_character_id: characterId,
        p_equipment_id: equipmentId,
        p_price: equipmentData.price,
      });

      if (error) throw error;

      return {
        data: { newGold: data as number },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao comprar equipamento:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao comprar equipamento'),
        success: false,
      };
    }
  }

  /**
   * Vender equipamento
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

      return {
        data: { newGold: data as number },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao vender equipamento:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao vender equipamento'),
        success: false,
      };
    }
  }

  /**
   * Verificar se o personagem pode equipar um item
   */
  static async canEquipItem(
    characterId: string,
    equipmentId: string
  ): Promise<ServiceResponse<{ canEquip: boolean; reason: string }>> {
    try {
      const { data, error } = await supabase.rpc('can_equip_item', {
        p_character_id: characterId,
        p_equipment_id: equipmentId,
      });

      if (error) throw error;

      return {
        data: data as { canEquip: boolean; reason: string },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao verificar se pode equipar item:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao verificar se pode equipar item'),
        success: false,
      };
    }
  }

  /**
   * Buscar TODOS os equipamentos (para resolução de nomes em crafting)
   * Sem filtros de is_unlocked ou craftable
   */
  static async getAllEquipments(): Promise<Equipment[]> {
    try {
      const { data, error } = await supabase.from('equipment').select('*').order('name');

      if (error) throw error;

      return data as Equipment[];
    } catch (error) {
      console.error(
        'Erro ao buscar todos os equipamentos:',
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  /**
   * Limpar cache
   */
  static clearCache(): void {
    this.equipmentCache.clear();
    this.lastFetchTimestamp = 0;
  }

  /**
   * Comparar equipamento com o equipado atualmente
   */
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
        return {
          success: false,
          error: error.message,
          data: null,
        };
      }

      return {
        success: true,
        error: null,
        data: data || [],
      };
    } catch (error) {
      console.error('[EquipmentService] Erro na comparação de equipamentos:', error);
      return {
        success: false,
        error: extractErrorMessage(error, 'Erro ao comparar equipamentos'),
        data: null,
      };
    }
  }

  /**
   * Obter bônus detalhados de equipamentos para um personagem
   */
  static async getEquipmentBonuses(
    characterId: string
  ): Promise<ServiceResponse<EquipmentBonuses>> {
    try {
      const { data, error } = await supabase.rpc('calculate_equipment_bonuses_enhanced', {
        p_character_id: characterId,
      });

      if (error) {
        console.error('[EquipmentService] Erro ao calcular bônus:', error);
        return {
          success: false,
          error: error.message,
          data: null,
        };
      }

      return {
        success: true,
        error: null,
        data: data?.[0] || {
          total_atk_bonus: 0,
          total_def_bonus: 0,
          total_mana_bonus: 0,
          total_speed_bonus: 0,
          total_hp_bonus: 0,
          total_critical_chance_bonus: 0,
          total_critical_damage_bonus: 0,
          total_double_attack_chance_bonus: 0,
          total_magic_damage_bonus: 0,
        },
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
}

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

    // NOVO: Sistema de nerf para off-hand weapons (20% de redução)
    const offHandMultiplier = isOffHand && equipment.type === 'weapon' ? 0.8 : 1.0;

    // NOVO: Escudos mantêm 100% de eficiência mesmo na off-hand
    const actualMultiplier = isOffHand && equipment.type === 'armor' ? 1.0 : offHandMultiplier;

    bonus.hp += Math.floor(equipment.hp_bonus * actualMultiplier);
    bonus.max_hp += Math.floor(equipment.hp_bonus * actualMultiplier);
    bonus.mana += Math.floor(equipment.mana_bonus * actualMultiplier);
    bonus.max_mana += Math.floor(equipment.mana_bonus * actualMultiplier);
    bonus.atk += Math.floor(equipment.atk_bonus * actualMultiplier);
    bonus.def += Math.floor(equipment.def_bonus * actualMultiplier);
    bonus.speed += Math.floor(equipment.speed_bonus * actualMultiplier);
    bonus.critical_chance += equipment.critical_chance_bonus * actualMultiplier;
    bonus.critical_damage += equipment.critical_damage_bonus * actualMultiplier;
    bonus.double_attack_chance += equipment.double_attack_chance_bonus * actualMultiplier;
    bonus.magic_damage += equipment.magic_damage_bonus * actualMultiplier;
  };

  // Arma principal (100% eficiência)
  addEquipmentBonus(slots.main_hand ?? null, false);

  // ATUALIZADO: Arma/escudo secundário (80% para armas, 100% para escudos)
  addEquipmentBonus(slots.off_hand ?? null, true);

  // Armadura e acessórios (100% eficiência)
  addEquipmentBonus(slots.armor ?? null, false);
  addEquipmentBonus(slots.accessory ?? null, false);
  addEquipmentBonus(slots.accessory_2 ?? null, false);

  return bonus;
};
