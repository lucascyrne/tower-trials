import { supabase } from '@/lib/supabase';
import { AuthService } from '@/resources/auth/auth.service';

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

export interface ServiceResponse<T> {
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

// Cache para rankings
interface RankingCacheEntry<T> {
  data: T;
  timestamp: number;
  params: string; // Para identificar requisições únicas
}

export class RankingService {
  // Cache de rankings por modalidade
  private static rankingCache = new Map<string, RankingCacheEntry<RankingEntry[]>>();
  private static userStatsCache = new Map<string, RankingCacheEntry<UserStatsResponse>>();
  private static userRankingCache = new Map<string, RankingCacheEntry<RankingEntry[]>>();

  // Configurações de cache
  private static readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutos
  private static readonly USER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  /**
   * Verificar se cache é válido
   * @private
   */
  private static isCacheValid<T>(
    entry: RankingCacheEntry<T> | undefined,
    duration: number
  ): boolean {
    if (!entry) return false;
    const now = Date.now();
    return now - entry.timestamp < duration;
  }

  /**
   * Gerar chave de cache baseada nos parâmetros
   * @private
   */
  private static generateCacheKey(
    mode: RankingMode,
    limit: number,
    statusFilter: string,
    nameFilter: string,
    page: number
  ): string {
    return `${mode}-${limit}-${statusFilter}-${nameFilter}-${page}`;
  }

  /**
   * Salvar entrada no ranking
   * @param data - Dados do ranking. Se não fornecido, retorna erro (use hook para obter do store)
   */
  static async saveScore(data: SaveRankingData): Promise<ServiceResponse<string>> {
    try {
      const scoreData = data;

      if (!scoreData || !scoreData.user_id || !scoreData.player_name) {
        return {
          data: '',
          error: 'Dados do ranking são obrigatórios',
        };
      }

      console.log('[RankingService] Salvando no ranking:', scoreData);

      const { data: result, error } = await supabase.rpc('save_ranking_entry', {
        p_user_id: scoreData.user_id,
        p_player_name: scoreData.player_name,
        p_highest_floor: scoreData.floor,
        p_character_level: scoreData.character_level || 1,
        p_character_gold: scoreData.character_gold || 0,
        p_character_alive: scoreData.character_alive ?? true,
      });

      if (error) throw error;

      // Invalidar caches relacionados
      this.invalidateUserCaches(scoreData.user_id);
      this.invalidateGlobalCaches();

      console.log('[RankingService] Score salvo com sucesso');
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
   * Obter ranking global por modalidade com cache
   */
  static async getGlobalRanking(
    mode: RankingMode = 'floor',
    limit: number = 10,
    statusFilter: 'all' | 'alive' | 'dead' = 'all',
    nameFilter: string = '',
    page: number = 1
  ): Promise<ServiceResponse<RankingEntry[]>> {
    try {
      const cacheKey = this.generateCacheKey(mode, limit, statusFilter, nameFilter, page);

      // Verificar cache primeiro
      const cachedEntry = this.rankingCache.get(cacheKey);
      if (this.isCacheValid(cachedEntry, this.CACHE_DURATION)) {
        console.log(`[RankingService] Cache hit para ranking: ${cacheKey}`);
        return { data: cachedEntry!.data, error: null };
      }

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

      const rankingData = data || [];

      // Atualizar cache
      this.rankingCache.set(cacheKey, {
        data: rankingData,
        timestamp: Date.now(),
        params: cacheKey,
      });

      console.log(`[RankingService] ${rankingData.length} entradas recebidas`);
      return { data: rankingData, error: null };
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
   * Obter histórico de ranking do usuário com cache
   */
  static async getUserRanking(
    userId?: string,
    limit: number = 10
  ): Promise<ServiceResponse<RankingEntry[]>> {
    try {
      // Se não fornecido, obter do AuthService
      let targetUserId = userId;
      if (!targetUserId) {
        const user = await AuthService.getCurrentUser();
        if (!user?.id) {
          return {
            data: [],
            error: 'Usuário não encontrado para buscar ranking',
          };
        }
        targetUserId = user.id;
      }

      const cacheKey = `user-${targetUserId}-${limit}`;

      // Verificar cache primeiro
      const cachedEntry = this.userRankingCache.get(cacheKey);
      if (this.isCacheValid(cachedEntry, this.USER_CACHE_DURATION)) {
        console.log(`[RankingService] Cache hit para ranking do usuário: ${targetUserId}`);
        return { data: cachedEntry!.data, error: null };
      }

      console.log(`[RankingService] Histórico do usuário: ${targetUserId}, limite: ${limit}`);

      const { data, error } = await supabase.rpc('get_dynamic_user_ranking_history', {
        p_user_id: targetUserId,
        p_limit: limit,
      });

      if (error) {
        console.error(`[RankingService] Erro no histórico:`, error);
        throw error;
      }

      const historyData = data || [];

      // Atualizar cache
      this.userRankingCache.set(cacheKey, {
        data: historyData,
        timestamp: Date.now(),
        params: cacheKey,
      });

      console.log(`[RankingService] ${historyData.length} entradas do histórico`);
      return { data: historyData, error: null };
    } catch (error) {
      console.error('Erro ao buscar ranking do usuário:', error);
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Erro ao buscar ranking do usuário',
      };
    }
  }

  /**
   * Obter estatísticas do usuário com cache
   */
  static async getUserStats(userId?: string): Promise<
    ServiceResponse<{
      bestFloor: number;
      bestLevel: number;
      bestGold: number;
      totalRuns: number;
      aliveCharacters: number;
    }>
  > {
    try {
      // Se não fornecido, obter do AuthService
      let targetUserId = userId;
      if (!targetUserId) {
        const user = await AuthService.getCurrentUser();
        if (!user?.id) {
          return {
            data: {
              bestFloor: 0,
              bestLevel: 1,
              bestGold: 0,
              totalRuns: 0,
              aliveCharacters: 0,
            },
            error: 'Usuário não encontrado para buscar estatísticas',
          };
        }
        targetUserId = user.id;
      }

      if (!targetUserId) {
        return {
          data: {
            bestFloor: 0,
            bestLevel: 1,
            bestGold: 0,
            totalRuns: 0,
            aliveCharacters: 0,
          },
          error: 'ID do usuário é obrigatório',
        };
      }

      // Verificar cache primeiro
      const cachedEntry = this.userStatsCache.get(targetUserId);
      if (this.isCacheValid(cachedEntry, this.USER_CACHE_DURATION)) {
        console.log(`[RankingService] Cache hit para stats do usuário: ${targetUserId}`);
        const cachedStats = cachedEntry!.data;
        return {
          data: {
            bestFloor: cachedStats.best_floor,
            bestLevel: cachedStats.best_level,
            bestGold: cachedStats.best_gold,
            totalRuns: cachedStats.total_runs,
            aliveCharacters: cachedStats.alive_characters,
          },
          error: null,
        };
      }

      console.log(`[RankingService] Estatísticas do usuário: ${targetUserId}`);

      const { data, error } = await supabase
        .rpc('get_dynamic_user_stats', { p_user_id: targetUserId })
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

      // Atualizar cache
      if (statsData) {
        this.userStatsCache.set(targetUserId, {
          data: statsData,
          timestamp: Date.now(),
          params: targetUserId,
        });
      }

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

      // Limpar todos os caches após sincronização
      this.clearAllCaches();

      return { data: data || 'Sincronização concluída', error: null };
    } catch (error) {
      console.error('Erro ao sincronizar rankings:', error);
      return {
        data: '',
        error: error instanceof Error ? error.message : 'Erro ao sincronizar rankings',
      };
    }
  }

  /**
   * Invalidar caches do usuário
   * @private
   */
  private static invalidateUserCaches(userId: string): void {
    console.log(`[RankingService] Invalidando caches do usuário: ${userId}`);

    // Remover cache de stats do usuário
    this.userStatsCache.delete(userId);

    // Remover cache de ranking do usuário
    for (const [key] of this.userRankingCache) {
      if (key.startsWith(`user-${userId}-`)) {
        this.userRankingCache.delete(key);
      }
    }
  }

  /**
   * Invalidar caches globais
   * @private
   */
  private static invalidateGlobalCaches(): void {
    console.log('[RankingService] Invalidando caches globais');
    this.rankingCache.clear();
  }

  /**
   * Limpar todos os caches
   */
  static clearAllCaches(): void {
    console.log('[RankingService] Limpando todos os caches');
    this.rankingCache.clear();
    this.userStatsCache.clear();
    this.userRankingCache.clear();
  }

  /**
   * Obter posição do jogador no ranking
   * @param userId - ID do usuário
   * @param playerName - Nome do personagem
   * @param mode - Modo do ranking ('floor' ou 'gold')
   */
  static async getPlayerRankingPosition(
    userId: string,
    playerName: string,
    mode: RankingMode = 'floor'
  ): Promise<number> {
    if (!userId || !playerName) {
      console.warn('[RankingService] userId e playerName são obrigatórios');
      return 0;
    }

    try {
      // Buscar ranking completo (pode ser otimizado com RPC específica)
      const ranking = await this.getGlobalRanking(mode, 100);
      if (ranking.error || !ranking.data) {
        return 0;
      }

      const position = ranking.data.findIndex(
        entry => entry.user_id === userId && entry.player_name === playerName
      );

      return position >= 0 ? position + 1 : 0;
    } catch (error) {
      console.error('[RankingService] Erro ao obter posição no ranking:', error);
      return 0;
    }
  }
}
