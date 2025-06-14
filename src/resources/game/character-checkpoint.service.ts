import { supabase } from '@/lib/supabase';
import { CharacterCacheService } from './character-cache.service';
import { CharacterHealingService } from './character-healing.service';

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
      console.log(
        `[CharacterCheckpointService] Atualizando andar - ID: ${characterId}, Andar: ${newFloor}`
      );

      const { supabaseAdmin } = await import('@/lib/supabase');

      const { error } = await supabaseAdmin.rpc('secure_advance_floor', {
        p_character_id: characterId,
        p_new_floor: newFloor,
      });

      if (error) {
        console.error(
          '[CharacterCheckpointService] Erro na função secure_advance_floor:',
          error.message
        );
        throw error;
      }

      CharacterCacheService.invalidateCharacterCache(characterId);
      console.log(`[CharacterCheckpointService] Andar atualizado para ${newFloor}`);

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
      console.log(`[CharacterCheckpointService] Obtendo checkpoints para ${characterId}`);

      try {
        // Tentar usar a nova função RPC específica
        const { data, error } = await supabase.rpc('get_character_unlocked_checkpoints', {
          p_character_id: characterId,
        });

        if (!error && data) {
          const checkpoints = data.map((row: { floor_number: number; description: string }) => ({
            floor: row.floor_number,
            description: row.description,
          }));

          console.log(`[CharacterCheckpointService] Checkpoints obtidos:`, checkpoints);
          return { data: checkpoints, error: null, success: true };
        } else if (error) {
          console.warn(`[CharacterCheckpointService] Erro na RPC:`, error);
        }
      } catch (rpcError) {
        console.warn(
          '[CharacterCheckpointService] Função RPC não disponível, usando fallback:',
          rpcError
        );
      }

      // Fallback: calcular checkpoints manualmente
      console.log(`[CharacterCheckpointService] Usando fallback`);

      let character = CharacterCacheService.getCachedCharacter(characterId);

      if (!character) {
        const { data: charData, error } = await supabase
          .from('characters')
          .select('*')
          .eq('id', characterId)
          .single();

        if (error) throw error;
        character = charData;
      }

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

      console.log(
        `[CharacterCheckpointService] Andar atual: ${character.floor}, Highest: ${highestFloor}`
      );

      // Gerar checkpoints
      const checkpoints: Checkpoint[] = [];

      // Sempre incluir o andar 1
      checkpoints.push({ floor: 1, description: 'Andar 1 - Início da Torre' });

      // Checkpoints pós-boss: 11, 21, 31, 41, 51, etc.
      for (let i = 1; i <= 100; i++) {
        const bossFloor = i * 10;
        const checkpointFloor = bossFloor + 1;

        if (highestFloor >= checkpointFloor) {
          checkpoints.push({
            floor: checkpointFloor,
            description: `Andar ${checkpointFloor} - Checkpoint Pós-Boss`,
          });
          console.log(`[CharacterCheckpointService] Checkpoint ${checkpointFloor} desbloqueado`);
        } else {
          break;
        }
      }

      console.log(`[CharacterCheckpointService] Checkpoints calculados:`, checkpoints);
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
      // Verificar se o checkpoint é válido
      const isValidCheckpoint =
        checkpointFloor === 1 || (checkpointFloor > 10 && (checkpointFloor - 1) % 10 === 0);

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

      // Curar personagem ao máximo
      const character = CharacterCacheService.getCachedCharacter(characterId);
      if (character) {
        await CharacterHealingService.updateCharacterHpMana(
          characterId,
          character.max_hp,
          character.max_mana
        );
      }

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

      // Curar personagem ao máximo
      const character = CharacterCacheService.getCachedCharacter(characterId);
      if (character) {
        await CharacterHealingService.updateCharacterHpMana(
          characterId,
          character.max_hp,
          character.max_mana
        );
      }

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
