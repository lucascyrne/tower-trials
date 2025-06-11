import {
  type Character,
  type SkillType,
  type SkillXpResult,
  type CharacterProgressionInfo,
  type CharacterLimitInfo,
} from '../models/character.model';
import { supabase } from '@/lib/supabase';
import { CharacterCacheService } from './character-cache.service';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class CharacterProgressionService {
  /**
   * Buscar informações de progressão do usuário
   */
  static async getUserCharacterProgression(
    userId: string
  ): Promise<ServiceResponse<CharacterProgressionInfo>> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_character_progression', {
          p_user_id: userId,
        })
        .single();

      if (error) throw error;

      return {
        data: data as CharacterProgressionInfo,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error(
        'Erro ao buscar progressão de personagens:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar progressão',
        success: false,
      };
    }
  }

  /**
   * Verificar limite de personagens do usuário
   */
  static async checkCharacterLimit(userId: string): Promise<ServiceResponse<CharacterLimitInfo>> {
    try {
      const { data, error } = await supabase
        .rpc('check_character_limit', {
          p_user_id: userId,
        })
        .single();

      if (error) throw error;

      return {
        data: data as CharacterLimitInfo,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error(
        'Erro ao verificar limite de personagens:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao verificar limite',
        success: false,
      };
    }
  }

  /**
   * FUNÇÃO SEGURA: Conceder XP com validações anti-cheat
   */
  static async grantSecureXP(
    characterId: string,
    xpAmount: number,
    source: string = 'combat'
  ): Promise<
    ServiceResponse<{
      leveled_up: boolean;
      new_level: number;
      new_xp: number;
      new_xp_next_level: number;
      slots_unlocked: boolean;
      new_available_slots: number;
    }>
  > {
    try {
      // Importar o cliente admin apenas quando necessário
      const { supabaseAdmin } = await import('@/lib/supabase');

      const { data, error } = await supabaseAdmin
        .rpc('secure_grant_xp', {
          p_character_id: characterId,
          p_xp_amount: xpAmount,
          p_source: source,
        })
        .single();

      if (error) throw error;

      // Invalidar cache do personagem específico
      CharacterCacheService.invalidateCharacterCache(characterId);

      // Se houve level up ou slots desbloqueados, invalidar cache do usuário
      const result = data as {
        leveled_up: boolean;
        new_level: number;
        new_xp: number;
        new_xp_next_level: number;
        slots_unlocked: boolean;
        new_available_slots: number;
      };
      if (result.leveled_up || result.slots_unlocked) {
        const character = await this.getCharacterById(characterId);
        if (character.success && character.data) {
          CharacterCacheService.invalidateUserCache(character.data.user_id);
        }
      }

      return {
        data: result,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao conceder XP:', error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao conceder XP',
        success: false,
      };
    }
  }

  /**
   * FUNÇÃO SEGURA: Conceder gold com validações anti-cheat
   */
  static async grantSecureGold(
    characterId: string,
    goldAmount: number,
    source: string = 'combat'
  ): Promise<ServiceResponse<number>> {
    try {
      // Importar o cliente admin apenas quando necessário
      const { supabaseAdmin } = await import('@/lib/supabase');

      const { data, error } = await supabaseAdmin
        .rpc('secure_grant_gold', {
          p_character_id: characterId,
          p_gold_amount: goldAmount,
          p_source: source,
        })
        .single();

      if (error) throw error;

      // Invalidar cache do personagem específico
      CharacterCacheService.invalidateCharacterCache(characterId);

      return {
        data: data as number,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao conceder gold:', error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao conceder gold',
        success: false,
      };
    }
  }

  /**
   * Adicionar XP a uma habilidade específica
   */
  static async addSkillXp(
    characterId: string,
    skillType: SkillType,
    xpAmount: number
  ): Promise<ServiceResponse<SkillXpResult>> {
    try {
      const { data, error } = await supabase
        .rpc('add_skill_xp', {
          p_character_id: characterId,
          p_skill_type: skillType,
          p_xp_amount: xpAmount,
        })
        .single();

      if (error) throw error;

      // Invalidar cache do personagem se a habilidade subiu de nível
      if (data && (data as SkillXpResult).skill_leveled_up) {
        CharacterCacheService.invalidateCharacterCache(characterId);
      }

      return {
        data: data as SkillXpResult,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error(
        'Erro ao adicionar XP de habilidade:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao adicionar XP',
        success: false,
      };
    }
  }

  /**
   * Atualizar gold do personagem
   */
  static async updateGold(characterId: string, amount: number): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('characters')
        .update({ gold: amount })
        .eq('id', characterId);

      if (error) throw error;

      // Invalidar cache do personagem
      CharacterCacheService.invalidateCharacterCache(characterId);

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao atualizar gold:', error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao atualizar gold',
        success: false,
      };
    }
  }

  /**
   * Buscar personagem por ID (helper interno)
   */
  private static async getCharacterById(characterId: string): Promise<ServiceResponse<Character>> {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .single();

      if (error) throw error;

      return {
        data: data as Character,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao buscar personagem:', error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar personagem',
        success: false,
      };
    }
  }
}
