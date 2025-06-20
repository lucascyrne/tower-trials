import {
  type AttributeDistribution,
  type AttributeDistributionResult,
} from '@/models/character.model';
import { supabase } from '@/lib/supabase';
import { CharacterCacheService } from './character-cache.service';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class CharacterAttributesService {
  /**
   * Distribuir pontos de atributo
   */
  static async distributeAttributePoints(
    characterId: string,
    distribution: AttributeDistribution
  ): Promise<ServiceResponse<AttributeDistributionResult>> {
    try {
      const { data, error } = await supabase
        .rpc('distribute_attribute_points', {
          p_character_id: characterId,
          p_strength: distribution.strength,
          p_dexterity: distribution.dexterity,
          p_intelligence: distribution.intelligence,
          p_wisdom: distribution.wisdom,
          p_vitality: distribution.vitality,
          p_luck: distribution.luck,
        })
        .single();

      if (error) throw error;

      // ✅ CORREÇÃO: Invalidação mais robusta do cache
      CharacterCacheService.invalidateCharacterCache(characterId);

      // Forçar limpeza do cache de usuários que possam ter este personagem
      const cachedCharacter = CharacterCacheService.getCachedCharacter(characterId);
      if (cachedCharacter) {
        CharacterCacheService.invalidateUserCache(cachedCharacter.user_id);
      }

      console.log('[CharacterAttributesService] Pontos distribuídos e cache invalidado:', {
        characterId,
        distribution,
        success: !!data,
      });

      return {
        data: data as AttributeDistributionResult,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error(
        'Erro ao distribuir pontos de atributo:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao distribuir pontos',
        success: false,
      };
    }
  }

  /**
   * Recalcular todos os stats de um personagem
   */
  static async recalculateCharacterStats(characterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase.rpc('recalculate_character_stats', {
        p_character_id: characterId,
      });

      if (error) throw error;

      // Invalidar cache do personagem
      CharacterCacheService.invalidateCharacterCache(characterId);

      return {
        data: null,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao recalcular stats:', error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao recalcular stats',
        success: false,
      };
    }
  }
}
