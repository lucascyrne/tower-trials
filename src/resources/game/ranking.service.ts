import { supabase } from '@/lib/supabase';

export interface RankingEntry {
  id: string;
  user_id: string;
  player_name: string;
  highest_floor: number;
  character_level: number;
  character_gold: number;
  character_alive: boolean;
  created_at: string;
}

export interface SaveRankingData {
  user_id: string;
  player_name: string;
  floor: number;
  character_level?: number;
  character_gold?: number;
  character_alive?: boolean;
}

export type RankingMode = 'floor' | 'level' | 'gold';

interface ServiceResponse<T> {
  data: T;
  error: string | null;
}

interface UserStatsResponse {
  best_floor: number;
  best_level: number;
  best_gold: number;
  total_runs: number;
  alive_characters: number;
}

export class RankingService {
  /**
   * Salvar entrada no ranking
   */
  static async saveScore(data: SaveRankingData): Promise<ServiceResponse<string>> {
    try {
      const { data: result, error } = await supabase.rpc('save_ranking_entry', {
        p_user_id: data.user_id,
        p_player_name: data.player_name,
        p_floor: data.floor,
        p_character_level: data.character_level || 1,
        p_character_gold: data.character_gold || 0,
        p_character_alive: data.character_alive ?? true,
      });

      if (error) throw error;

      return { data: result, error: null };
    } catch (error) {
      console.error('Erro ao salvar no ranking:', error);
      return {
        data: '',
        error: error instanceof Error ? error.message : 'Erro ao salvar no ranking',
      };
    }
  }

  /**
   * Obter ranking global por modalidade (dinâmico - inclui personagens vivos e mortos)
   */
  static async getGlobalRanking(
    mode: RankingMode = 'floor',
    limit: number = 10,
    statusFilter: 'all' | 'alive' | 'dead' = 'all',
    nameFilter: string = '',
    page: number = 1
  ): Promise<ServiceResponse<RankingEntry[]>> {
    try {
      const offset = (page - 1) * limit;
      console.log(
        `[RankingService] Ranking global - modo: ${mode}, filtro: ${statusFilter}, página: ${page}`
      );

      const functionMap = {
        floor: 'get_dynamic_ranking_by_highest_floor',
        level: 'get_dynamic_ranking_by_level',
        gold: 'get_dynamic_ranking_by_gold',
      };

      const functionName = functionMap[mode];
      console.log(`[RankingService] Função: ${functionName}`);

      const { data, error } = await supabase.rpc(functionName, {
        p_limit: limit,
        p_status_filter: statusFilter,
        p_name_filter: nameFilter,
        p_offset: offset,
      });

      if (error) {
        console.error(`[RankingService] Erro:`, error);
        throw error;
      }

      console.log(`[RankingService] ${data?.length || 0} entradas recebidas`);
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Erro ao buscar ranking global:', error);
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Erro ao buscar ranking',
      };
    }
  }

  /**
   * Contar total de entradas do ranking
   */
  static async countRankingEntries(
    statusFilter: 'all' | 'alive' | 'dead' = 'all',
    nameFilter: string = ''
  ): Promise<ServiceResponse<number>> {
    try {
      console.log(
        `[RankingService] Contando entradas - filtro: ${statusFilter}, nome: ${nameFilter}`
      );

      const { data, error } = await supabase.rpc('count_ranking_entries', {
        p_status_filter: statusFilter,
        p_name_filter: nameFilter,
      });

      if (error) {
        console.error(`[RankingService] Erro ao contar:`, error);
        throw error;
      }

      console.log(`[RankingService] Total: ${data}`);
      return { data: data || 0, error: null };
    } catch (error) {
      console.error('Erro ao contar entradas do ranking:', error);
      return {
        data: 0,
        error: error instanceof Error ? error.message : 'Erro ao contar entradas',
      };
    }
  }

  /**
   * Obter histórico de ranking do usuário (dinâmico - inclui personagens vivos e mortos)
   */
  static async getUserRanking(
    userId: string,
    limit: number = 10
  ): Promise<ServiceResponse<RankingEntry[]>> {
    try {
      console.log(`[RankingService] Histórico do usuário: ${userId}, limite: ${limit}`);

      const { data, error } = await supabase.rpc('get_dynamic_user_ranking_history', {
        p_user_id: userId,
        p_limit: limit,
      });

      if (error) {
        console.error(`[RankingService] Erro no histórico:`, error);
        throw error;
      }

      console.log(`[RankingService] ${data?.length || 0} entradas do histórico`);
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Erro ao buscar ranking do usuário:', error);
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Erro ao buscar ranking do usuário',
      };
    }
  }

  /**
   * Obter estatísticas do usuário (dinâmico - inclui personagens vivos e mortos)
   */
  static async getUserStats(userId: string): Promise<
    ServiceResponse<{
      bestFloor: number;
      bestLevel: number;
      bestGold: number;
      totalRuns: number;
      aliveCharacters: number;
    }>
  > {
    try {
      console.log(`[RankingService] Estatísticas do usuário: ${userId}`);

      const { data, error } = await supabase
        .rpc('get_dynamic_user_stats', { p_user_id: userId })
        .single();

      if (error) {
        console.error(`[RankingService] Erro nas estatísticas:`, error);
        throw error;
      }

      const statsData = data as UserStatsResponse | null;
      const stats = {
        bestFloor: statsData?.best_floor || 0,
        bestLevel: statsData?.best_level || 1,
        bestGold: statsData?.best_gold || 0,
        totalRuns: statsData?.total_runs || 0,
        aliveCharacters: statsData?.alive_characters || 0,
      };

      console.log(`[RankingService] Estatísticas:`, stats);
      return { data: stats, error: null };
    } catch (error) {
      console.error('Erro ao buscar estatísticas do usuário:', error);
      return {
        data: {
          bestFloor: 0,
          bestLevel: 1,
          bestGold: 0,
          totalRuns: 0,
          aliveCharacters: 0,
        },
        error: error instanceof Error ? error.message : 'Erro ao buscar estatísticas',
      };
    }
  }

  /**
   * Função de teste para verificar se o ranking está funcionando
   */
  static async testRankingSystem(userId?: string): Promise<
    ServiceResponse<
      Array<{
        test_name: string;
        result: string;
        details: string;
      }>
    >
  > {
    try {
      const { data, error } = await supabase.rpc('test_ranking_system', {
        p_user_id: userId || null,
      });

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Erro ao testar sistema de ranking:', error);
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Erro ao testar ranking',
      };
    }
  }

  /**
   * Função para forçar sincronização de todos os rankings
   */
  static async syncAllRankings(): Promise<ServiceResponse<string>> {
    try {
      const { data, error } = await supabase.rpc('refresh_all_rankings');

      if (error) throw error;

      return { data: data || 'Sincronização concluída', error: null };
    } catch (error) {
      console.error('Erro ao sincronizar rankings:', error);
      return {
        data: '',
        error: error instanceof Error ? error.message : 'Erro ao sincronizar rankings',
      };
    }
  }
}
