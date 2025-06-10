import { type Character } from '../models/character.model';
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
   * OTIMIZADO: Atualizar HP e Mana com validação de limites e throttling
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

      // CRÍTICO: Garantir que os valores sejam sempre inteiros
      const integerHp = hp !== undefined ? Math.floor(Number(hp)) : undefined;
      const integerMana = mana !== undefined ? Math.floor(Number(mana)) : undefined;

      // Validar valores se fornecidos
      if (integerHp !== undefined && (integerHp < 0 || integerHp > 9999)) {
        return { success: false, error: 'Valor de HP inválido', data: null };
      }

      if (integerMana !== undefined && (integerMana < 0 || integerMana > 9999)) {
        return { success: false, error: 'Valor de Mana inválido', data: null };
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

      // OTIMIZADO: Invalidar cache usando sistema com throttling
      CharacterCacheService.invalidateCharacterCache(characterId);

      return { success: true, error: null, data: null };
    } catch (error) {
      console.error('Erro ao atualizar HP/Mana do personagem:', error);
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
    // Se não há last_activity, não curar
    if (!character.last_activity) {
      return { hp: character.hp, mana: character.mana };
    }

    // Se HP e Mana já estão no máximo, não curar
    if (character.hp >= character.max_hp && character.mana >= character.max_mana) {
      return { hp: character.hp, mana: character.mana };
    }

    const lastActivity = new Date(character.last_activity);
    const timeDiffMs = currentTime.getTime() - lastActivity.getTime();
    const timeDiffSeconds = Math.floor(timeDiffMs / 1000);

    // Se passou menos de 1 segundo, não curar
    if (timeDiffSeconds < 1) {
      return { hp: character.hp, mana: character.mana };
    }

    // Configurações de cura - REDUZIDO para 2 horas
    const HEAL_DURATION_HOURS = 2;
    const HEAL_DURATION_SECONDS = HEAL_DURATION_HOURS * 3600; // 7200 segundos
    const MIN_PERCENT = 0.1; // Começa a curar a partir de 0.1%
    const MAX_PERCENT = 100; // Cura até 100%

    // Calcular HP curado
    let newHp = character.hp;
    if (character.hp < character.max_hp) {
      // Se HP está abaixo de 0.1%, ajustar para 0.1% antes de calcular cura
      const adjustedCurrentHp = Math.max(
        character.hp,
        Math.ceil(character.max_hp * (MIN_PERCENT / 100))
      );
      const adjustedCurrentHpPercent = (adjustedCurrentHp / character.max_hp) * 100;

      // Taxa de cura HP: (100% - 0.1%) / 2 horas = 99.9% / 7200s ≈ 0.01387% por segundo
      const healRatePerSecond = (MAX_PERCENT - MIN_PERCENT) / HEAL_DURATION_SECONDS;

      // Calcular HP curado baseado no tempo decorrido
      const healPercentage = Math.min(
        healRatePerSecond * timeDiffSeconds,
        MAX_PERCENT - adjustedCurrentHpPercent
      );

      const healAmount = Math.floor((healPercentage / 100) * character.max_hp);
      newHp = Math.min(character.max_hp, adjustedCurrentHp + healAmount);
    }

    // Calcular Mana curada (mesma lógica que HP)
    let newMana = character.mana;
    if (character.mana < character.max_mana) {
      // Se Mana está abaixo de 0.1%, ajustar para 0.1% antes de calcular cura
      const adjustedCurrentMana = Math.max(
        character.mana,
        Math.ceil(character.max_mana * (MIN_PERCENT / 100))
      );
      const adjustedCurrentManaPercent = (adjustedCurrentMana / character.max_mana) * 100;

      // Taxa de cura Mana: (100% - 0.1%) / 2 horas = 99.9% / 7200s ≈ 0.01387% por segundo
      const healRatePerSecond = (MAX_PERCENT - MIN_PERCENT) / HEAL_DURATION_SECONDS;

      // Calcular Mana curada baseada no tempo decorrido
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
      // Buscar personagem do cache primeiro
      let character = CharacterCacheService.getCachedCharacter(characterId);

      // Se não está em cache, buscar do banco
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
      const { hp, mana } = this.calculateAutoHeal(character, currentTime);

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

      // Atualizar HP e Mana no banco usando função segura
      const updateResult = await this.updateCharacterHpMana(characterId, hp, mana);
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Erro ao atualizar HP/Mana');
      }

      // Atualizar timestamp de atividade
      await this.updateLastActivity(characterId);

      // Invalidar cache do personagem
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

      // Invalidar cache do personagem
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
