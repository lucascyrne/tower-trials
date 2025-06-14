import { type Character } from './character.model';
import { supabase } from '@/lib/supabase';
import { CharacterCacheService } from './character-cache.service';

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
   * OTIMIZADO: Atualizar HP e Mana com validação de limites e cache inteligente
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

      // Verificar se realmente houve mudança
      const cachedCharacter = CharacterCacheService.getCachedCharacter(characterId);
      if (cachedCharacter) {
        const hpChanged = integerHp !== undefined && integerHp !== cachedCharacter.hp;
        const manaChanged = integerMana !== undefined && integerMana !== cachedCharacter.mana;

        if (!hpChanged && !manaChanged) {
          console.log(`[CharacterHealingService] Stats inalterados para ${cachedCharacter.name}`);
          return { success: true, error: null, data: null };
        }
      }

      const { error } = await supabase.rpc('internal_update_character_hp_mana', {
        p_character_id: characterId,
        p_hp: integerHp,
        p_mana: integerMana,
      });

      if (error) {
        console.error('Erro ao atualizar HP/Mana:', error);
        return { success: false, error: `Erro ao atualizar stats: ${error.message}`, data: null };
      }

      // Atualizar cache ao invés de invalidar
      if (cachedCharacter && (integerHp !== undefined || integerMana !== undefined)) {
        const updatedCharacter = { ...cachedCharacter };
        if (integerHp !== undefined) updatedCharacter.hp = integerHp;
        if (integerMana !== undefined) updatedCharacter.mana = integerMana;

        CharacterCacheService.setCachedCharacter(characterId, updatedCharacter);
      } else {
        CharacterCacheService.invalidateCharacterCache(characterId);
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
   */
  static calculateAutoHeal(character: Character, currentTime: Date): { hp: number; mana: number } {
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

    // Log apenas se houve cura significativa
    if (newHp > character.hp || newMana > character.mana) {
      console.log(
        `[AutoHeal] ${character.name}: HP ${character.hp} -> ${newHp} (+${newHp - character.hp}), Mana ${character.mana} -> ${newMana} (+${newMana - character.mana}) após ${Math.floor(timeDiffSeconds / 60)}min`
      );
    }

    return { hp: newHp, mana: newMana };
  }

  /**
   * Aplicar cura automática em um personagem
   */
  static async applyAutoHeal(characterId: string): Promise<ServiceResponse<HealResult>> {
    try {
      let character = CharacterCacheService.getCachedCharacter(characterId);

      if (!character) {
        const { data: charData, error } = await supabase
          .from('characters')
          .select('*')
          .eq('id', characterId)
          .single();

        if (error) throw error;
        character = charData as Character;
      }

      if (!character) {
        return { data: null, error: 'Personagem não encontrado', success: false };
      }

      const currentTime = new Date();
      const { hp, mana } = CharacterHealingService.calculateAutoHeal(character, currentTime);

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
        characterId,
        hp,
        mana
      );
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Erro ao atualizar HP/Mana');
      }

      // Atualizar timestamp de atividade
      await CharacterHealingService.updateLastActivity(characterId);

      CharacterCacheService.invalidateCharacterCache(characterId);

      const updatedCharacter = {
        ...character,
        hp: hp,
        mana: mana,
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
   * Atualizar timestamp de última atividade do personagem
   */
  static async updateLastActivity(characterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase.rpc('update_character_activity', {
        p_character_id: characterId,
      });

      if (error) throw error;

      CharacterCacheService.invalidateCharacterCache(characterId);

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
