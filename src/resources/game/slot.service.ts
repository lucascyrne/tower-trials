import { supabase } from '@/lib/supabase';
import { SupabaseAdminGameRepository } from './infrastructure/supabase/supabase-admin-game.repository';
import { ConsumePotionSlotUseCase } from './application/use-cases/consume-potion-slot.use-case';

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

/** Payload JSON retornado por `consume_potion_from_slot` (Postgres). */
type ConsumePotionRpcPayload = {
  success: boolean;
  message?: string;
  error?: string;
  new_hp?: unknown;
  new_mana?: unknown;
};

function parseConsumePotionRpcPayload(raw: unknown): ConsumePotionRpcPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.success !== 'boolean') return null;
  return {
    success: o.success,
    message: typeof o.message === 'string' ? o.message : undefined,
    error: typeof o.error === 'string' ? o.error : undefined,
    new_hp: o.new_hp,
    new_mana: o.new_mana,
  };
}

export class SlotService {
  private static readonly consumePotionSlotUseCase = new ConsumePotionSlotUseCase(
    new SupabaseAdminGameRepository()
  );
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
   * Configurar slot de poção com validação de duplicatas
   */
  static async setPotionSlot(
    characterId: string, 
    slotPosition: number, 
    consumableId: string
  ): Promise<ServiceResponse<null>> {
    try {
      console.log(`[SlotService] Configurando slot ${slotPosition} com consumível ${consumableId}`);
      
      const { data, error } = await supabase
        .rpc('set_potion_slot', {
          p_character_id: characterId,
          p_slot_position: slotPosition,
          p_consumable_id: consumableId
        })
        .single();

      if (error) {
        console.error('[SlotService] Erro no RPC set_potion_slot:', error.message);
        throw error;
      }

      // A função RPC agora retorna JSON com success e error
      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        console.warn(`[SlotService] Operação falhou: ${result.error}`);
        return { 
          data: null, 
          error: result.error || 'Erro ao configurar slot de poção', 
          success: false 
        };
      }

      console.log(`[SlotService] Slot ${slotPosition} configurado com sucesso`);
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
   * Limpar slot de poção
   */
  static async clearPotionSlot(characterId: string, slotPosition: number): Promise<ServiceResponse<null>> {
    try {
      console.log(`[SlotService] Limpando slot ${slotPosition}`);
      
      const { data, error } = await supabase
        .rpc('clear_potion_slot', {
          p_character_id: characterId,
          p_slot_position: slotPosition
        })
        .single();

      if (error) {
        console.error('[SlotService] Erro no RPC clear_potion_slot:', error.message);
        throw error;
      }

      // A função RPC agora retorna JSON com success e error
      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        console.warn(`[SlotService] Falha ao limpar slot: ${result.error}`);
        return { 
          data: null, 
          error: result.error || 'Erro ao limpar slot de poção', 
          success: false 
        };
      }

      console.log(`[SlotService] Slot ${slotPosition} limpo com sucesso`);
      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao limpar slot de poção:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao limpar slot de poção', 
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
   * Consumir poção do slot
   */
  static async consumePotionFromSlot(
    characterId: string, 
    slotPosition: number
  ): Promise<ServiceResponse<PotionUseResult>> {
    try {
      if (!characterId) {
        return { success: false, error: 'ID do personagem é obrigatório', data: null };
      }

      if (slotPosition < 1 || slotPosition > 3) {
        return { success: false, error: 'Posição do slot inválida (1-3)', data: null };
      }

      const raw = await this.consumePotionSlotUseCase.execute({
        characterId,
        slotPosition,
      });

      const payload = parseConsumePotionRpcPayload(raw);
      if (!payload) {
        return {
          success: false,
          error: 'Resposta inválida do servidor',
          data: null,
        };
      }

      if (!payload.success) {
        return {
          success: false,
          error: payload.error || payload.message || 'Não foi possível consumir a poção',
          data: null,
        };
      }

      const newHp = Math.floor(Number(payload.new_hp));
      const newMana = Math.floor(Number(payload.new_mana));
      if (!Number.isFinite(newHp) || !Number.isFinite(newMana)) {
        return {
          success: false,
          error: 'Resposta inválida: HP ou Mana ausentes',
          data: null,
        };
      }

      const result: PotionUseResult = {
        success: true,
        message: payload.message || 'Poção consumida',
        new_hp: newHp,
        new_mana: newMana,
      };

      return {
        success: true,
        error: null,
        data: result,
      };
    } catch (error) {
      console.error('Erro ao consumir poção do slot:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido', 
        data: null 
      };
    }
  }

  /**
   * Limpar slot de spell
   */
  static async clearSpellSlot(characterId: string, slotPosition: number): Promise<ServiceResponse<null>> {
    return this.setSpellSlot(characterId, slotPosition, null);
  }
} 