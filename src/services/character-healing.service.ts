/**
 * Service de cura e gerenciamento de HP/Mana de personagens
 *
 * ✅ REFATORADO (P1): Service puro - não acessa caches ou stores
 * - Recebe dados via parâmetros
 * - Retorna resultados para caller gerenciar
 * - Testável sem mocks
 */

import { type Character } from '@/models/character.model';
import { supabase } from '@/lib/supabase';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

interface HealResult {
  healed: boolean;
  oldHp: number;
  newHp: number;
  character: Character;
}

export class CharacterHealingService {
  /**
   * Atualizar HP e Mana com validação de limites
   *
   * ✅ REFATORADO (P1): Service puro - sem verificações de cache
   * Nota: Verificação de mudança é feita pelo caller (applyAutoHeal)
   */
  static async updateCharacterHpMana(
    characterId: string,
    hp?: number,
    mana?: number
  ): Promise<ServiceResponse<null>> {
    try {
      if (!characterId) {
        return { success: false, error: 'ID do personagem é obrigatório', data: null };
      }

      // Garantir que os valores sejam sempre inteiros
      const integerHp = hp !== undefined ? Math.floor(Number(hp)) : undefined;
      const integerMana = mana !== undefined ? Math.floor(Number(mana)) : undefined;

      // Validar valores
      if (integerHp !== undefined && (integerHp < 0 || integerHp > 9999)) {
        return { success: false, error: 'Valor de HP inválido', data: null };
      }

      if (integerMana !== undefined && (integerMana < 0 || integerMana > 9999)) {
        return { success: false, error: 'Valor de Mana inválido', data: null };
      }

      // Atualizar DB
      const { error } = await supabase.rpc('update_character_stats', {
        p_character_id: characterId,
        p_hp: integerHp,
        p_mana: integerMana,
      });

      if (error) {
        console.error('Erro ao atualizar HP/Mana:', error);
        return { success: false, error: `Erro ao atualizar stats: ${error.message}`, data: null };
      }

      return { success: true, error: null, data: null };
    } catch (error) {
      console.error('Erro ao atualizar HP/Mana:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar HP/Mana',
        data: null,
      };
    }
  }

  /**
   * Calcular cura automática baseada em tempo
   * Cura total em 2 horas (de 0.1% a 100% da vida e mana)
   * ✅ CORREÇÃO: Adicionado parâmetro para forçar cura completa no hub
   */
  static calculateAutoHeal(
    character: Character,
    currentTime: Date,
    forceFullHeal: boolean = false
  ): { hp: number; mana: number } {
    // ✅ CORREÇÃO CRÍTICA: Forçar cura completa no hub (independente de tempo)
    if (forceFullHeal) {
      return {
        hp: character.max_hp,
        mana: character.max_mana,
      };
    }

    if (!character.last_activity) {
      return { hp: character.hp, mana: character.mana };
    }

    if (character.hp >= character.max_hp && character.mana >= character.max_mana) {
      return { hp: character.hp, mana: character.mana };
    }

    const lastActivity = new Date(character.last_activity);
    const timeDiffMs = currentTime.getTime() - lastActivity.getTime();
    const timeDiffSeconds = Math.floor(timeDiffMs / 1000);

    if (timeDiffSeconds < 1) {
      return { hp: character.hp, mana: character.mana };
    }

    // Cura total em 2 horas
    const HEAL_DURATION_SECONDS = 2 * 3600; // 7200 segundos
    const MIN_PERCENT = 0.1;
    const MAX_PERCENT = 100;

    // Calcular HP curado
    let newHp = character.hp;
    if (character.hp < character.max_hp) {
      const adjustedCurrentHp = Math.max(
        character.hp,
        Math.ceil(character.max_hp * (MIN_PERCENT / 100))
      );
      const adjustedCurrentHpPercent = (adjustedCurrentHp / character.max_hp) * 100;

      const healRatePerSecond = (MAX_PERCENT - MIN_PERCENT) / HEAL_DURATION_SECONDS;
      const healPercentage = Math.min(
        healRatePerSecond * timeDiffSeconds,
        MAX_PERCENT - adjustedCurrentHpPercent
      );

      const healAmount = Math.floor((healPercentage / 100) * character.max_hp);
      newHp = Math.min(character.max_hp, adjustedCurrentHp + healAmount);
    }

    // Calcular Mana curada
    let newMana = character.mana;
    if (character.mana < character.max_mana) {
      const adjustedCurrentMana = Math.max(
        character.mana,
        Math.ceil(character.max_mana * (MIN_PERCENT / 100))
      );
      const adjustedCurrentManaPercent = (adjustedCurrentMana / character.max_mana) * 100;

      const healRatePerSecond = (MAX_PERCENT - MIN_PERCENT) / HEAL_DURATION_SECONDS;
      const healPercentage = Math.min(
        healRatePerSecond * timeDiffSeconds,
        MAX_PERCENT - adjustedCurrentManaPercent
      );

      const healAmount = Math.floor((healPercentage / 100) * character.max_mana);
      newMana = Math.min(character.max_mana, adjustedCurrentMana + healAmount);
    }

    return { hp: newHp, mana: newMana };
  }

  /**
   * Aplicar cura automática em um personagem
   *
   * ✅ REFATORADO (P1): Service puro - recebe character via parâmetro
   * Caller é responsável por buscar o personagem e gerenciar cache
   */
  static async applyAutoHeal(
    character: Character,
    forceFullHeal: boolean = false
  ): Promise<ServiceResponse<HealResult>> {
    try {
      const currentTime = new Date();
      const { hp, mana } = CharacterHealingService.calculateAutoHeal(
        character,
        currentTime,
        forceFullHeal
      );

      // Se não houve cura, retornar sem atualizar
      if (hp === character.hp && mana === character.mana) {
        return {
          data: {
            healed: false,
            oldHp: character.hp,
            newHp: character.hp,
            character,
          },
          error: null,
          success: true,
        };
      }

      // Atualizar HP e Mana
      const updateResult = await CharacterHealingService.updateCharacterHpMana(
        character.id,
        hp,
        mana
      );
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Erro ao atualizar HP/Mana');
      }

      // Atualizar timestamp de atividade
      await CharacterHealingService.updateLastActivity(character.id);

      const updatedCharacter = {
        ...character,
        hp,
        mana,
        last_activity: currentTime.toISOString(),
      };

      return {
        data: {
          healed: true,
          oldHp: character.hp,
          newHp: hp,
          character: updatedCharacter,
        },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error(
        'Erro ao aplicar cura automática:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao aplicar cura automática',
        success: false,
      };
    }
  }

  /**
   * Forçar cura completa para o hub (sempre 100% HP/Mana)
   *
   * ✅ REFATORADO (P1): Busca character e chama applyAutoHeal
   */
  static async forceFullHealForHub(characterId: string): Promise<ServiceResponse<HealResult>> {
    console.log(`[CharacterHealingService] Forçando cura completa para o hub: ${characterId}`);

    // Buscar character do DB
    const { data: charData, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (error || !charData) {
      return {
        data: null,
        error: error?.message || 'Personagem não encontrado',
        success: false,
      };
    }

    return await this.applyAutoHeal(charData as Character, true);
  }

  /**
   * Atualizar timestamp de última atividade do personagem
   *
   * ✅ REFATORADO (P1): Service puro - sem invalidação de cache
   */
  static async updateLastActivity(characterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase.rpc('update_character_last_activity', {
        p_character_id: characterId,
      });

      if (error) throw error;

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error(
        'Erro ao atualizar última atividade:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao atualizar última atividade',
        success: false,
      };
    }
  }
}
