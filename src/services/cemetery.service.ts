import { supabase } from '@/lib/supabase';
import {
  type DeadCharacter,
  type CemeteryStats,
  type CemeteryResponse,
  type CemeterySearchParams,
} from '../models/cemetery.model';
import { useGameStateStore } from '../stores/useGameStateStore';
import { useCharacterStore } from '../stores/useCharacterStore';
import { useLogStore } from '../stores/useLogStore';
import { CacheService } from './cache.service';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class CemeteryService {
  /**
   * Mata um personagem permanentemente, movendo-o para o cemitério
   * ATUALIZADO: Usando função simplificada com dead_characters como fonte única
   */
  static async killCharacter(
    characterId?: string,
    deathCause: string = 'Battle defeat',
    killedByMonster?: string
  ): Promise<ServiceResponse<string>> {
    try {
      // Integração com stores
      const characterStore = useCharacterStore.getState();
      const gameStateStore = useGameStateStore.getState();
      const logStore = useLogStore.getState();

      // Usar personagem selecionado se não fornecido ID
      const targetCharacterId = characterId || characterStore.selectedCharacter?.id;

      if (!targetCharacterId) {
        throw new Error('Nenhum personagem especificado para morte');
      }

      const characterName = characterStore.selectedCharacter?.name || 'Personagem';

      console.log(`[CemeteryService] Matando personagem ${targetCharacterId}:`, {
        deathCause,
        killedByMonster,
        characterName,
      });

      // Adicionar log da morte
      logStore.addGameLogMessage(
        `💀 ${characterName} morreu: ${this.formatDeathCause(deathCause, killedByMonster)}`,
        'system'
      );

      // ✅ CORREÇÃO: Usar função simplificada que salva apenas em dead_characters
      const { data, error } = await supabase.rpc('process_character_death_simple', {
        p_character_id: targetCharacterId,
        p_death_cause: deathCause,
        p_killed_by_monster: killedByMonster || null,
      });

      if (error) {
        console.error('[CemeteryService] Erro ao matar personagem:', error);
        throw error;
      }

      console.log(`[CemeteryService] Personagem morto, resultado:`, data);

      // CRÍTICO: Limpar estado das stores após morte
      if (characterStore.selectedCharacter?.id === targetCharacterId) {
        console.log('[CemeteryService] Limpando stores após morte do personagem selecionado');

        // Atualizar estado do jogo para game over
        gameStateStore.updateGameState(draft => {
          draft.mode = 'gameover';
          draft.characterDeleted = true;
          draft.gameMessage = `${characterName} morreu e foi enviado ao cemitério.`;
        });

        // Limpar personagem selecionado após um delay para permitir visualização
        setTimeout(() => {
          characterStore.setSelectedCharacter(null);
          CacheService.clearStoresOnly();
        }, 3000);
      }

      // A função simplificada retorna dados estruturados
      const deathInfo = Array.isArray(data) && data.length > 0 ? data[0] : null;
      const success = deathInfo?.success || false;
      const resultMessage = success ? 'character_moved_to_cemetery' : 'unknown';

      return {
        success: true,
        data: resultMessage,
        error: null,
      };
    } catch (error) {
      console.error('[CemeteryService] Erro crítico:', error);

      // Log do erro
      const logStore = useLogStore.getState();
      logStore.addGameLogMessage(
        `❌ Erro ao processar morte do personagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        'system'
      );

      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao matar personagem',
      };
    }
  }

  /**
   * NOVO: Mata o personagem atualmente selecionado nas stores
   */
  static async killSelectedCharacter(
    deathCause: string = 'Battle defeat',
    killedByMonster?: string
  ): Promise<ServiceResponse<string>> {
    const characterStore = useCharacterStore.getState();
    const selectedCharacter = characterStore.selectedCharacter;

    if (!selectedCharacter) {
      return {
        success: false,
        data: null,
        error: 'Nenhum personagem selecionado para morte',
      };
    }

    return this.killCharacter(selectedCharacter.id, deathCause, killedByMonster);
  }

  /**
   * Busca o cemitério de um usuário com paginação
   * ATUALIZADO: Integrado com stores para logging automático
   */
  static async getUserCemetery(
    userId?: string,
    params: CemeterySearchParams = {}
  ): Promise<ServiceResponse<CemeteryResponse>> {
    try {
      // Integração com stores
      const logStore = useLogStore.getState();

      // Usar usuário da store se não fornecido
      const targetUserId = userId; // TODO: Implementar store de auth se necessário

      if (!targetUserId) {
        throw new Error('ID do usuário é obrigatório para buscar cemitério');
      }

      const { page = 1, limit = 10 } = params;
      const offset = (page - 1) * limit;

      console.log(
        `[CemeteryService] Buscando cemitério do usuário ${targetUserId}, página ${page}`
      );
      logStore.addGameLogMessage(`🪦 Consultando cemitério (página ${page})`, 'system');

      // Buscar personagens mortos
      const { data: charactersData, error: charactersError } = await supabase.rpc(
        'get_user_cemetery',
        {
          p_user_id: targetUserId,
          p_limit: limit,
          p_offset: offset,
        }
      );

      if (charactersError) throw charactersError;

      // Contar total
      const { data: totalData, error: totalError } = await supabase.rpc('count_user_cemetery', {
        p_user_id: targetUserId,
      });

      if (totalError) throw totalError;

      // Buscar estatísticas
      const { data: statsData, error: statsError } = await supabase.rpc('get_cemetery_stats', {
        p_user_id: targetUserId,
      });

      if (statsError) throw statsError;

      const characters = charactersData as DeadCharacter[];
      const total = totalData as number;
      const stats = (statsData?.[0] || {
        total_deaths: 0,
        highest_level_reached: 0,
        highest_floor_reached: 0,
        total_survival_time_hours: 0,
        most_common_death_cause: 'N/A',
        deadliest_monster: 'N/A',
      }) as CemeteryStats;

      const hasMore = offset + characters.length < total;

      // Log do resultado
      logStore.addGameLogMessage(
        `📊 Cemitério carregado: ${characters.length} personagens, ${total} total`,
        'system'
      );

      return {
        success: true,
        data: {
          characters,
          total,
          stats,
          hasMore,
        },
        error: null,
      };
    } catch (error) {
      console.error('[CemeteryService] Erro ao buscar cemitério:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar cemitério',
      };
    }
  }

  /**
   * Busca apenas as estatísticas do cemitério
   */
  static async getCemeteryStats(userId: string): Promise<ServiceResponse<CemeteryStats>> {
    try {
      const { data, error } = await supabase.rpc('get_cemetery_stats', {
        p_user_id: userId,
      });

      if (error) throw error;

      const stats = (data?.[0] || {
        total_deaths: 0,
        highest_level_reached: 0,
        highest_floor_reached: 0,
        total_survival_time_hours: 0,
        most_common_death_cause: 'N/A',
        deadliest_monster: 'N/A',
      }) as CemeteryStats;

      return {
        success: true,
        data: stats,
        error: null,
      };
    } catch (error) {
      console.error('[CemeteryService] Erro ao buscar estatísticas:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar estatísticas',
      };
    }
  }

  /**
   * Verifica se um usuário tem personagens mortos
   */
  static async hasCemetery(userId: string): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase.rpc('count_user_cemetery', {
        p_user_id: userId,
      });

      if (error) throw error;

      return {
        success: true,
        data: (data as number) > 0,
        error: null,
      };
    } catch (error) {
      console.error('[CemeteryService] Erro ao verificar cemitério:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Erro ao verificar cemitério',
      };
    }
  }

  /**
   * Formata o tempo de sobrevivência em texto legível
   */
  static formatSurvivalTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    } else if (minutes < 1440) {
      // menos de 24 horas
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
  }

  /**
   * Formata a causa da morte em texto mais amigável
   */
  static formatDeathCause(cause: string, killedBy?: string): string {
    const causeMap = {
      'Battle defeat': killedBy ? `Morto por ${killedBy}` : 'Morto em batalha',
      'Player quit': 'Abandonou a jornada',
      'System error': 'Erro do sistema',
    };

    return causeMap[cause as keyof typeof causeMap] || cause;
  }

  /**
   * NOVO: Verificar se o personagem selecionado está morto
   */
  static isSelectedCharacterDead(): boolean {
    try {
      const gameStateStore = useGameStateStore.getState();
      return (
        gameStateStore.gameState.mode === 'gameover' &&
        Boolean(gameStateStore.gameState.characterDeleted)
      );
    } catch (error) {
      console.error('[CemeteryService] Erro ao verificar morte do personagem:', error);
      return false;
    }
  }

  /**
   * NOVO: Obter estatísticas rápidas do cemitério para exibição
   */
  static async getQuickCemeteryInfo(userId: string): Promise<{
    totalDeaths: number;
    highestLevel: number;
    deadliestMonster: string;
  }> {
    try {
      const result = await this.getCemeteryStats(userId);

      if (result.success && result.data) {
        return {
          totalDeaths: result.data.total_deaths,
          highestLevel: result.data.highest_level_reached,
          deadliestMonster: result.data.deadliest_monster,
        };
      }

      return {
        totalDeaths: 0,
        highestLevel: 0,
        deadliestMonster: 'N/A',
      };
    } catch (error) {
      console.error('[CemeteryService] Erro ao obter info rápida do cemitério:', error);
      return {
        totalDeaths: 0,
        highestLevel: 0,
        deadliestMonster: 'N/A',
      };
    }
  }
}
