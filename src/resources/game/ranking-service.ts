'use client';

import { supabase } from "@/lib/supabase";

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
  highest_floor: number;
  character_level?: number;
  character_gold?: number;
  character_alive?: boolean;
}

export type RankingMode = 'highest_floor' | 'level' | 'gold';

interface ServiceResponse<T> {
  data: T;
  error: string | null;
}

export class RankingService {
  /**
   * Salvar entrada no ranking
   */
  static async saveScore(data: SaveRankingData): Promise<ServiceResponse<string>> {
    try {
      const { data: result, error } = await supabase
        .rpc('save_ranking_entry', {
          p_user_id: data.user_id,
          p_player_name: data.player_name,
          p_highest_floor: data.highest_floor,
          p_character_level: data.character_level || 1,
          p_character_gold: data.character_gold || 0,
          p_character_alive: data.character_alive ?? true
        });

      if (error) throw error;

      return { data: result, error: null };
    } catch (error) {
      console.error('Erro ao salvar no ranking:', error);
      return { 
        data: '', 
        error: error instanceof Error ? error.message : 'Erro ao salvar no ranking' 
      };
    }
  }

  /**
   * Obter ranking global por modalidade
   */
  static async getGlobalRanking(
    mode: RankingMode = 'highest_floor',
    limit: number = 10,
    statusFilter: 'all' | 'alive' | 'dead' = 'all'
  ): Promise<ServiceResponse<RankingEntry[]>> {
    try {
      let functionName: string;
      
      switch (mode) {
        case 'highest_floor':
          functionName = 'get_ranking_by_highest_floor';
          break;
        case 'level':
          functionName = 'get_ranking_by_level';
          break;
        case 'gold':
          functionName = 'get_ranking_by_gold';
          break;
        default:
          functionName = 'get_ranking_by_highest_floor';
      }

      // Converter statusFilter para parâmetros da função
      let aliveOnly = false;
      let deadOnly = false;
      
      if (statusFilter === 'alive') {
        aliveOnly = true;
      } else if (statusFilter === 'dead') {
        deadOnly = true;
      }

      const { data, error } = await supabase
        .rpc(functionName, {
          p_limit: limit,
          p_alive_only: aliveOnly,
          p_dead_only: deadOnly
        });

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Erro ao buscar ranking global:', error);
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Erro ao buscar ranking' 
      };
    }
  }

  /**
   * Obter histórico de ranking do usuário
   */
  static async getUserRanking(
    userId: string,
    limit: number = 10
  ): Promise<ServiceResponse<RankingEntry[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_ranking_history', {
          p_user_id: userId,
          p_limit: limit
        });

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Erro ao buscar ranking do usuário:', error);
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Erro ao buscar ranking do usuário' 
      };
    }
  }

  /**
   * Obter estatísticas do usuário
   */
  static async getUserStats(userId: string): Promise<ServiceResponse<{
    bestFloor: number;
    bestLevel: number;
    bestGold: number;
    totalRuns: number;
    aliveCharacters: number;
  }>> {
    try {
      const { data, error } = await supabase
        .from('game_rankings')
        .select('highest_floor, character_level, character_gold, character_alive')
        .eq('user_id', userId);

      if (error) throw error;

      const stats = {
        bestFloor: Math.max(...(data?.map(r => r.highest_floor) || [0])),
        bestLevel: Math.max(...(data?.map(r => r.character_level) || [1])),
        bestGold: Math.max(...(data?.map(r => r.character_gold) || [0])),
        totalRuns: data?.length || 0,
        aliveCharacters: data?.filter(r => r.character_alive).length || 0
      };

      return { data: stats, error: null };
    } catch (error) {
      console.error('Erro ao buscar estatísticas do usuário:', error);
      return { 
        data: {
          bestFloor: 0,
          bestLevel: 1,
          bestGold: 0,
          totalRuns: 0,
          aliveCharacters: 0
        }, 
        error: error instanceof Error ? error.message : 'Erro ao buscar estatísticas' 
      };
    }
  }
} 