import { supabase } from '@/lib/supabase';
import { type DeadCharacter, type CemeteryStats, type CemeteryResponse, type CemeterySearchParams } from './models/cemetery.model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class CemeteryService {
  /**
   * Mata um personagem permanentemente, movendo-o para o cemitério
   */
  static async killCharacter(
    characterId: string,
    deathCause: string = 'Battle defeat',
    killedByMonster?: string
  ): Promise<ServiceResponse<string>> {
    try {
      console.log(`[CemeteryService] Matando personagem ${characterId}:`, { deathCause, killedByMonster });
      
      const { data, error } = await supabase.rpc('kill_character', {
        p_character_id: characterId,
        p_death_cause: deathCause,
        p_killed_by_monster: killedByMonster || null
      });

      if (error) {
        console.error('[CemeteryService] Erro ao matar personagem:', error);
        throw error;
      }

      console.log(`[CemeteryService] Personagem ${characterId} morto com sucesso, ID no cemitério: ${data}`);
      
      return {
        success: true,
        data: data as string, // ID do registro no cemitério
        error: null
      };
    } catch (error) {
      console.error('[CemeteryService] Erro crítico ao matar personagem:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao matar personagem'
      };
    }
  }

  /**
   * Busca o cemitério de um usuário com paginação
   */
  static async getUserCemetery(
    userId: string,
    params: CemeterySearchParams = {}
  ): Promise<ServiceResponse<CemeteryResponse>> {
    try {
      const {
        page = 1,
        limit = 10,
      } = params;

      const offset = (page - 1) * limit;

      // Buscar personagens mortos
      const { data: charactersData, error: charactersError } = await supabase
        .rpc('get_user_cemetery', {
          p_user_id: userId,
          p_limit: limit,
          p_offset: offset
        });

      if (charactersError) throw charactersError;

      // Contar total
      const { data: totalData, error: totalError } = await supabase
        .rpc('count_user_cemetery', {
          p_user_id: userId
        });

      if (totalError) throw totalError;

      // Buscar estatísticas
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_cemetery_stats', {
          p_user_id: userId
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
        deadliest_monster: 'N/A'
      }) as CemeteryStats;

      const hasMore = offset + characters.length < total;

      return {
        success: true,
        data: {
          characters,
          total,
          stats,
          hasMore
        },
        error: null
      };
    } catch (error) {
      console.error('[CemeteryService] Erro ao buscar cemitério:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar cemitério'
      };
    }
  }

  /**
   * Busca apenas as estatísticas do cemitério
   */
  static async getCemeteryStats(userId: string): Promise<ServiceResponse<CemeteryStats>> {
    try {
      const { data, error } = await supabase
        .rpc('get_cemetery_stats', {
          p_user_id: userId
        });

      if (error) throw error;

      const stats = (data?.[0] || {
        total_deaths: 0,
        highest_level_reached: 0,
        highest_floor_reached: 0,
        total_survival_time_hours: 0,
        most_common_death_cause: 'N/A',
        deadliest_monster: 'N/A'
      }) as CemeteryStats;

      return {
        success: true,
        data: stats,
        error: null
      };
    } catch (error) {
      console.error('[CemeteryService] Erro ao buscar estatísticas do cemitério:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar estatísticas'
      };
    }
  }

  /**
   * Verifica se um usuário tem personagens mortos
   */
  static async hasCemetery(userId: string): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .rpc('count_user_cemetery', {
          p_user_id: userId
        });

      if (error) throw error;

      return {
        success: true,
        data: (data as number) > 0,
        error: null
      };
    } catch (error) {
      console.error('[CemeteryService] Erro ao verificar cemitério:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Erro ao verificar cemitério'
      };
    }
  }

  /**
   * Formata o tempo de sobrevivência em texto legível
   */
  static formatSurvivalTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    } else if (minutes < 1440) { // menos de 24 horas
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
    switch (cause) {
      case 'Battle defeat':
        return killedBy ? `Morto por ${killedBy}` : 'Morto em batalha';
      case 'Player quit':
        return 'Abandonou a jornada';
      case 'System error':
        return 'Erro do sistema';
      default:
        return cause;
    }
  }
} 