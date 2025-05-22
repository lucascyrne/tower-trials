'use client';

import { supabase } from "@/lib/supabase";

export interface RankingEntry {
  id?: string;
  player_name: string;
  highest_floor: number;
  user_id?: string;
  created_at?: string;
}

export class RankingService {
  /**
   * Salva uma nova pontuação no ranking
   * @param entry Dados da pontuação
   * @returns Resultado da operação
   */
  static async saveScore(entry: Omit<RankingEntry, 'id' | 'created_at'>): Promise<{ success: boolean; error?: string }> {
    try {
      // Obter o usuário atual para validação
      const { data: { user } } = await supabase.auth.getUser();
      
      // Validar se o user_id corresponde ao usuário autenticado
      if (entry.user_id && user && entry.user_id !== user.id) {
        return { success: false, error: 'Não é possível salvar pontuação para outro usuário' };
      }

      const { error } = await supabase
        .from('game_rankings')
        .insert({
          player_name: entry.player_name,
          highest_floor: entry.highest_floor,
          user_id: entry.user_id || (user?.id || null), // Usar o ID do usuário atual se disponível
        });

      if (error) throw error;
      return { success: true };
    } catch (error: unknown) {
      console.error('Erro ao salvar pontuação:', error instanceof Error ? error.message : 'Erro desconhecido');
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  /**
   * Busca o ranking global ordenado pela maior pontuação
   * @param limit Limite de resultados (padrão: 10)
   * @returns Lista de pontuações
   */
  static async getGlobalRanking(limit: number = 10): Promise<{ data: RankingEntry[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('game_rankings')
        .select('*')
        .order('highest_floor', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { data: data || [] };
    } catch (error: unknown) {
      console.error('Erro ao buscar ranking:', error instanceof Error ? error.message : 'Erro desconhecido');
      return { data: [], error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  /**
   * Busca o ranking pessoal de um usuário
   * @param userId ID do usuário
   * @param limit Limite de resultados (padrão: 5)
   * @returns Lista de pontuações do usuário
   */
  static async getUserRanking(userId: string, limit: number = 5): Promise<{ data: RankingEntry[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('game_rankings')
        .select('*')
        .eq('user_id', userId)
        .order('highest_floor', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { data: data || [] };
    } catch (error: unknown) {
      console.error('Erro ao buscar ranking do usuário:', error instanceof Error ? error.message : 'Erro desconhecido');
      return { data: [], error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }
} 