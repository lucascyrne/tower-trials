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
  consumable_type: string | null;
  available_quantity: number;
  consumable_price: number | null;
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
  static async getCharacterPotionSlots(
    characterId: string
  ): Promise<ServiceResponse<PotionSlot[]>> {
    try {
      console.log(`[SlotService] Carregando slots de poção para personagem: ${characterId}`);

      // CORRIGIDO: Timeout aumentado e melhor tratamento de erro
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao carregar slots de poção')), 8000); // Aumentado para 8s
      });

      const rpcPromise = supabase.rpc('get_character_potion_slots', {
        p_character_id: characterId,
      });

      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

      if (error) {
        console.error(`[SlotService] Erro RPC ao carregar slots:`, error);

        // CORRIGIDO: Retornar fallback ao invés de throw em caso de erro RPC
        return this.getFallbackSlots();
      }

      // Garantir que sempre temos 3 slots (mesmo se RPC falhar)
      const slots: PotionSlot[] = [];
      for (let i = 1; i <= 3; i++) {
        const existingSlot = (data as PotionSlot[])?.find(s => s.slot_position === i);
        slots.push(
          existingSlot || {
            slot_position: i,
            consumable_id: null,
            consumable_name: null,
            consumable_description: null,
            effect_value: null,
            consumable_type: null,
            available_quantity: 0,
            consumable_price: null,
          }
        );
      }

      console.log(`[SlotService] Slots carregados com sucesso: ${slots.length} slots`);
      return { data: slots, error: null, success: true };
    } catch (error) {
      console.error(
        '[SlotService] Erro ao buscar slots de poção:',
        error instanceof Error ? error.message : error
      );

      return this.getFallbackSlots();
    }
  }

  private static getFallbackSlots(): ServiceResponse<PotionSlot[]> {
    console.log('[SlotService] Retornando slots vazios como fallback');
    const fallbackSlots: PotionSlot[] = [];
    for (let i = 1; i <= 3; i++) {
      fallbackSlots.push({
        slot_position: i,
        consumable_id: null,
        consumable_name: null,
        consumable_description: null,
        effect_value: null,
        consumable_type: null,
        available_quantity: 0,
        consumable_price: null,
      });
    }

    return {
      data: fallbackSlots,
      error: null, // CORRIGIDO: Não marcar como erro para não quebrar a UI
      success: true,
    };
  }

  /**
   * Obter slots de spell do personagem
   */
  static async getCharacterSpellSlots(characterId: string): Promise<ServiceResponse<SpellSlot[]>> {
    try {
      const { data, error } = await supabase.rpc('get_character_spell_slots', {
        p_character_id: characterId,
      });

      if (error) throw error;

      // Garantir que sempre temos 3 slots
      const slots: SpellSlot[] = [];
      for (let i = 1; i <= 3; i++) {
        const existingSlot = (data as SpellSlot[])?.find(s => s.slot_position === i);
        slots.push(
          existingSlot || {
            slot_position: i,
            spell_id: null,
            spell_name: null,
            spell_description: null,
            mana_cost: null,
            damage: null,
            spell_type: null,
          }
        );
      }

      return { data: slots, error: null, success: true };
    } catch (error) {
      console.error(
        'Erro ao buscar slots de spell:',
        error instanceof Error ? error.message : error
      );
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
          p_consumable_id: consumableId,
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
          success: false,
        };
      }

      console.log(`[SlotService] Slot ${slotPosition} configurado com sucesso`);
      return { data: null, error: null, success: true };
    } catch (error) {
      console.error(
        'Erro ao configurar slot de poção:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao configurar slot de poção',
        success: false,
      };
    }
  }

  /**
   * Limpar slot de poção
   */
  static async clearPotionSlot(
    characterId: string,
    slotPosition: number
  ): Promise<ServiceResponse<null>> {
    try {
      console.log(`[SlotService] Limpando slot ${slotPosition}`);

      const { data, error } = await supabase
        .rpc('clear_potion_slot', {
          p_character_id: characterId,
          p_slot_position: slotPosition,
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
          success: false,
        };
      }

      console.log(`[SlotService] Slot ${slotPosition} limpo com sucesso`);
      return { data: null, error: null, success: true };
    } catch (error) {
      console.error(
        'Erro ao limpar slot de poção:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao limpar slot de poção',
        success: false,
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
      const { error } = await supabase.rpc('set_spell_slot', {
        p_character_id: characterId,
        p_slot_position: slotPosition,
        p_spell_id: spellId,
      });

      if (error) throw error;

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error(
        'Erro ao configurar slot de spell:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao configurar slot de spell',
        success: false,
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
      console.log(
        `[SlotService] Tentando consumir poção do slot ${slotPosition} para personagem ${characterId}`
      );

      if (!characterId) {
        return { success: false, error: 'ID do personagem é obrigatório', data: null };
      }

      if (slotPosition < 1 || slotPosition > 3) {
        return { success: false, error: 'Posição do slot inválida (1-3)', data: null };
      }

      // CORRIGIDO: Usar o cliente admin para chamar a função corrigida
      const { supabaseAdmin } = await import('@/lib/supabase');

      console.log(`[SlotService] Chamando função consume_potion_from_slot via RPC`);

      const { data, error } = await supabaseAdmin.rpc('consume_potion_from_slot', {
        p_character_id: characterId,
        p_slot_position: slotPosition,
      });

      if (error) {
        console.error('[SlotService] Erro RPC ao consumir poção:', error);
        return {
          success: false,
          error: error.message || 'Erro ao usar poção',
          data: null,
        };
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.error('[SlotService] Resposta inválida da função RPC:', data);
        return {
          success: false,
          error: 'Nenhum resultado retornado da função',
          data: null,
        };
      }

      // A função retorna um array, pegar o primeiro elemento
      const resultData = data[0];
      console.log('[SlotService] Resultado da função RPC:', resultData);

      if (!resultData) {
        return {
          success: false,
          error: 'Resultado vazio da função',
          data: null,
        };
      }

      // CRÍTICO: Garantir que os valores sejam sempre inteiros válidos
      const result: PotionUseResult = {
        success: Boolean(resultData.success),
        message: String(resultData.message || 'Poção usada'),
        new_hp: Math.floor(Number(resultData.new_hp) || 0),
        new_mana: Math.floor(Number(resultData.new_mana) || 0),
      };

      // Validação adicional contra NaN
      if (isNaN(result.new_hp) || isNaN(result.new_mana)) {
        console.error('[SlotService] Valores NaN detectados:', { resultData, result });
        return {
          success: false,
          error: 'Erro nos valores de HP/Mana retornados',
          data: null,
        };
      }

      console.log(`[SlotService] Poção consumida com sucesso:`, {
        success: result.success,
        message: result.message,
        newHp: result.new_hp,
        newMana: result.new_mana,
      });

      return {
        success: result.success,
        error: result.success ? null : result.message,
        data: result,
      };
    } catch (error) {
      console.error('[SlotService] Erro crítico ao consumir poção do slot:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null,
      };
    }
  }

  /**
   * Limpar slot de spell
   */
  static async clearSpellSlot(
    characterId: string,
    slotPosition: number
  ): Promise<ServiceResponse<null>> {
    return this.setSpellSlot(characterId, slotPosition, null);
  }
}
