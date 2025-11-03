/**
 * Service de gerenciamento de checkpoints e progressão de andar
 *
 * ✅ REFATORADO (P1): Service puro - não acessa caches
 * - Sempre busca do banco (fonte da verdade)
 * - Gerencia checkpoints (1, 5, 11, 21, 31, etc.)
 * - Cura personagens ao trocar checkpoint
 * - Testável sem mocks
 */

import { supabase } from '@/lib/supabase';
import { CharacterHealingService } from '@/services/character-healing.service';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

interface Checkpoint {
  floor: number;
  description: string;
}

export class CharacterCheckpointService {
  /**
   * OTIMIZADO: Avançar andar do personagem com validação e throttling
   */
  static async updateCharacterFloor(
    characterId: string,
    newFloor: number
  ): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase.rpc('update_character_floor', {
        p_character_id: characterId,
        p_floor: newFloor,
      });

      if (error) {
        console.error(
          '[CharacterCheckpointService] Erro na função update_character_floor:',
          error.message
        );
        throw error;
      }

      return { data: null, error: null, success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[CharacterCheckpointService] Erro ao atualizar andar:', errorMsg);
      return {
        data: null,
        error: errorMsg,
        success: false,
      };
    }
  }

  /**
   * Obter checkpoints desbloqueados pelo personagem
   */
  static async getUnlockedCheckpoints(characterId: string): Promise<ServiceResponse<Checkpoint[]>> {
    try {
      // Buscar sempre do banco (fonte da verdade)
      const { data: character, error } = await supabase
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .single();

      if (error) throw error;

      if (!character) {
        return { data: null, error: 'Personagem não encontrado', success: false };
      }

      // Usar highest_floor se disponível
      const highestFloor = Math.max(
        character.floor,
        ('highest_floor' in character
          ? (character as unknown as { highest_floor: number }).highest_floor
          : character.floor) || character.floor
      );

      // ✅ CORRIGIDO: Gerar checkpoints usando nova lógica padronizada
      const checkpoints: Checkpoint[] = [];

      // Sempre incluir o andar 1
      checkpoints.push({ floor: 1, description: 'Andar 1 - Início da Torre' });

      // ✅ NOVO: Checkpoint especial no andar 5 (se alcançado)
      if (highestFloor >= 5) {
        checkpoints.push({ floor: 5, description: 'Andar 5 - Primeiro Desafio' });
      }

      // ✅ CORRIGIDO: Checkpoints pós-boss até andar 1000: 11, 21, 31, 41, 51, etc.
      for (let i = 1; i <= 100; i++) {
        // Até 100 bosses = andar 1000 máximo
        const bossFloor = i * 10;
        const checkpointFloor = bossFloor + 1;

        if (highestFloor >= checkpointFloor && checkpointFloor <= 1001) {
          // Limite de 1001 (checkpoint após boss 1000)
          checkpoints.push({
            floor: checkpointFloor,
            description: `Andar ${checkpointFloor} - Checkpoint Pós-Boss`,
          });
        } else {
          break;
        }
      }

      return { data: checkpoints, error: null, success: true };
    } catch (error) {
      console.error('Erro ao obter checkpoints:', error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao obter checkpoints',
        success: false,
      };
    }
  }

  /**
   * Iniciar personagem em um checkpoint específico
   */
  static async startFromCheckpoint(
    characterId: string,
    checkpointFloor: number
  ): Promise<ServiceResponse<null>> {
    try {
      // ✅ CORRIGIDO: Verificar se o checkpoint é válido usando nova lógica
      const isValidCheckpoint =
        checkpointFloor === 1 ||
        checkpointFloor === 5 ||
        (checkpointFloor > 10 && (checkpointFloor - 1) % 10 === 0);

      if (!isValidCheckpoint) {
        return { data: null, error: 'Checkpoint inválido', success: false };
      }

      // Verificar se o personagem pode acessar este checkpoint
      const checkpointsResponse = await this.getUnlockedCheckpoints(characterId);
      if (!checkpointsResponse.success || !checkpointsResponse.data) {
        return { data: null, error: 'Erro ao verificar checkpoints', success: false };
      }

      const hasAccess = checkpointsResponse.data.some(cp => cp.floor === checkpointFloor);
      if (!hasAccess) {
        return { data: null, error: 'Checkpoint não desbloqueado', success: false };
      }

      // Atualizar o andar do personagem
      const updateResponse = await this.updateCharacterFloor(characterId, checkpointFloor);
      if (!updateResponse.success) {
        return updateResponse;
      }

      // Buscar character do banco para obter stats de cura
      const { data: character, error: charError } = await supabase
        .from('characters')
        .select('max_hp, max_mana')
        .eq('id', characterId)
        .single();

      if (charError) throw charError;

      // Curar personagem ao máximo
      await CharacterHealingService.updateCharacterHpMana(
        characterId,
        character.max_hp,
        character.max_mana
      );

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error(
        'Erro ao iniciar do checkpoint:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao iniciar do checkpoint',
        success: false,
      };
    }
  }

  /**
   * Resetar progresso do personagem na torre (volta para andar 1)
   */
  static async resetCharacterProgress(characterId: string): Promise<ServiceResponse<null>> {
    try {
      // Resetar para andar 1
      const result = await this.updateCharacterFloor(characterId, 1);
      if (!result.success) {
        return result;
      }

      // Buscar character do banco para obter stats de cura
      const { data: character, error: charError } = await supabase
        .from('characters')
        .select('max_hp, max_mana')
        .eq('id', characterId)
        .single();

      if (charError) throw charError;

      // Curar personagem ao máximo
      await CharacterHealingService.updateCharacterHpMana(
        characterId,
        character.max_hp,
        character.max_mana
      );

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao resetar progresso:', error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao resetar progresso',
        success: false,
      };
    }
  }
}
