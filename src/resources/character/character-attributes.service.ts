import {
  type AttributeDistribution,
  type AttributeDistributionResult,
} from '@/resources/character/character.model';
import { supabase } from '@/lib/supabase';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

/**
 * Service para gerenciamento de atributos de personagens
 *
 * ✅ REFATORADO (P1): Service puro - não acessa stores ou caches diretamente
 * - Retorna dados e deixa o caller (hook/component) gerenciar cache
 * - Testável sem mocks de stores
 */
export class CharacterAttributesService {
  /**
   * Distribuir pontos de atributo
   *
   * ✅ REFATORADO: Não invalida cache - retorna indicador para o caller fazer isso
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

      console.log('[CharacterAttributesService] Pontos distribuídos com sucesso:', {
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
   *
   * ✅ REFATORADO: Não invalida cache - retorna indicador para o caller fazer isso
   */
  static async recalculateCharacterStats(characterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase.rpc('recalculate_character_stats', {
        p_character_id: characterId,
      });

      if (error) throw error;

      console.log('[CharacterAttributesService] Stats recalculados:', { characterId });

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
