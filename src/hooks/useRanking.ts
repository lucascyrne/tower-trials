import { useCallback } from 'react';
import { useGameStateStore } from '@/stores/useGameStateStore';
import {
  RankingService,
  type SaveRankingData,
  type RankingMode,
  type ServiceResponse,
} from '@/services/ranking.service';
import { AuthService } from '@/resources/auth/auth.service';

/**
 * Hook de orquestração para operações de ranking
 * Faz a ponte entre stores e RankingService (mantendo services puros)
 */
export function useRanking() {
  const gameState = useGameStateStore(state => state.gameState);

  /**
   * Salvar pontuação do jogador atual no ranking
   */
  const saveCurrentPlayerScore = useCallback(async (): Promise<ServiceResponse<string>> => {
    const user = await AuthService.getCurrentUser();

    if (!gameState.player || !user?.id) {
      return {
        data: '',
        error: 'Jogador ou usuário não encontrado para salvar ranking',
      };
    }

    const scoreData: SaveRankingData = {
      user_id: user.id,
      player_name: gameState.player.name,
      floor: gameState.player.floor,
      character_level: gameState.player.level,
      character_gold: gameState.player.gold,
      character_alive: gameState.player.hp > 0,
    };

    return RankingService.saveScore(scoreData);
  }, [gameState.player]);

  /**
   * Obter posição do jogador atual no ranking
   */
  const getCurrentPlayerRankingPosition = useCallback(
    async (mode: RankingMode = 'floor'): Promise<number> => {
      const user = await AuthService.getCurrentUser();

      if (!gameState.player || !user?.id) {
        return 0;
      }

      return RankingService.getPlayerRankingPosition(user.id, gameState.player.name, mode);
    },
    [gameState.player]
  );

  return {
    saveCurrentPlayerScore,
    getCurrentPlayerRankingPosition,
    // Expor métodos do service que não dependem de stores
    getGlobalRanking: RankingService.getGlobalRanking,
    getUserRanking: RankingService.getUserRanking,
    getUserStats: RankingService.getUserStats,
  };
}
