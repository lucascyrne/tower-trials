import { supabase } from '@/lib/supabase';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PotionSlot {
  slot_position: number;
  consumable_id: string | null;
  consumable_name: string | null;
  consumable_description: string | null;
  effect_value: number | null;
}

export interface SpellSlot {
  slot_position: number;
  spell_id: string | null;
  spell_name: string | null;
  spell_description: string | null;
  mana_cost: number | null;
  damage: number | null;
  spell_type: string | null;
}

export interface PotionUseResult {
  success: boolean;
  message: string;
  new_hp: number;
  new_mana: number;
}

export class SlotService {
  /**
   * Obter slots de poção do personagem
   */
  static async getCharacterPotionSlots(characterId: string): Promise<ServiceResponse<PotionSlot[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_character_potion_slots', {
          p_character_id: characterId
        });

      if (error) throw error;

      // Garantir que sempre temos 3 slots
      const slots: PotionSlot[] = [];
      for (let i = 1; i <= 3; i++) {
        const existingSlot = (data as PotionSlot[])?.find(s => s.slot_position === i);
        slots.push(existingSlot || {
          slot_position: i,
          consumable_id: null,
          consumable_name: null,
          consumable_description: null,
          effect_value: null
        });
      }

      return { data: slots, error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar slots de poção:', error instanceof Error ? error.message : error);
      return { data: null, error: 'Erro ao buscar slots de poção', success: false };
    }
  }

  /**
   * Obter slots de spell do personagem
   */
  static async getCharacterSpellSlots(characterId: string): Promise<ServiceResponse<SpellSlot[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_character_spell_slots', {
          p_character_id: characterId
        });

      if (error) throw error;

      // Garantir que sempre temos 3 slots
      const slots: SpellSlot[] = [];
      for (let i = 1; i <= 3; i++) {
        const existingSlot = (data as SpellSlot[])?.find(s => s.slot_position === i);
        slots.push(existingSlot || {
          slot_position: i,
          spell_id: null,
          spell_name: null,
          spell_description: null,
          mana_cost: null,
          damage: null,
          spell_type: null
        });
      }

      return { data: slots, error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar slots de spell:', error instanceof Error ? error.message : error);
      return { data: null, error: 'Erro ao buscar slots de spell', success: false };
    }
  }

  /**
   * Configurar slot de poção
   */
  static async setPotionSlot(
    characterId: string, 
    slotPosition: number, 
    consumableId: string | null
  ): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .rpc('set_potion_slot', {
          p_character_id: characterId,
          p_slot_position: slotPosition,
          p_consumable_id: consumableId
        });

      if (error) throw error;

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao configurar slot de poção:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao configurar slot de poção', 
        success: false 
      };
    }
  }

  /**
   * Configurar slot de spell
   */
  static async setSpellSlot(
    characterId: string, 
    slotPosition: number, 
    spellId: string | null
  ): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .rpc('set_spell_slot', {
          p_character_id: characterId,
          p_slot_position: slotPosition,
          p_spell_id: spellId
        });

      if (error) throw error;

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao configurar slot de spell:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao configurar slot de spell', 
        success: false 
      };
    }
  }

  /**
   * Usar poção de um slot específico
   */
  static async consumePotionFromSlot(
    characterId: string, 
    slotPosition: number
  ): Promise<ServiceResponse<PotionUseResult>> {
    try {
      const { data, error } = await supabase
        .rpc('use_potion_from_slot', {
          p_character_id: characterId,
          p_slot_position: slotPosition
        })
        .single();

      if (error) throw error;

      return { data: data as PotionUseResult, error: null, success: true };
    } catch (error) {
      console.error('Erro ao usar poção do slot:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao usar poção', 
        success: false 
      };
    }
  }

  /**
   * Limpar slot de poção
   */
  static async clearPotionSlot(characterId: string, slotPosition: number): Promise<ServiceResponse<null>> {
    return this.setPotionSlot(characterId, slotPosition, null);
  }

  /**
   * Limpar slot de spell
   */
  static async clearSpellSlot(characterId: string, slotPosition: number): Promise<ServiceResponse<null>> {
    return this.setSpellSlot(characterId, slotPosition, null);
  }
} 