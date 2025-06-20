import { useGameStateStore } from '../stores/useGameStateStore';
import { useCharacterStore } from '../stores/useCharacterStore';
import { useBattleStore } from '../stores/useBattleStore';
import { useLogStore } from '../stores/useLogStore';

/**
 * Serviço central de cache para o sistema de jogo
 * ATUALIZADO: Integrado com Zustand stores para limpeza coordenada de estado
 */
export class CacheService {
  /**
   * Limpar todos os caches do sistema
   * ATUALIZADO: Inclui limpeza das stores Zustand
   */
  static clearAllGameCaches(): void {
    console.log('[CacheService] Iniciando limpeza completa de caches e stores');

    // Limpar stores Zustand
    try {
      const gameStateStore = useGameStateStore.getState();
      const characterStore = useCharacterStore.getState();
      const battleStore = useBattleStore.getState();
      const logStore = useLogStore.getState();

      // Reset das stores
      gameStateStore.resetGameState();
      characterStore.setSelectedCharacter(null);
      battleStore.resetBattleState();
      logStore.clearAllLogs();

      console.log('[CacheService] Stores Zustand limpos com sucesso');
    } catch (error) {
      console.error('[CacheService] Erro ao limpar stores Zustand:', error);
    }

    // Limpar caches dos serviços
    Promise.all([
      import('./floor.service').then(m => m.FloorService.clearCache()),
      import('./monster.service').then(m => m.MonsterService.clearCache()),
      import('./character-cache.service').then(m => m.CharacterCacheService.clearAllCache()),
    ]).catch(error => {
      console.error('[CacheService] Erro ao limpar caches dos serviços:', error);
    });
  }

  /**
   * Limpar cache de personagem específico
   */
  static clearCharacterCache(characterId: string): void {
    import('./character-cache.service')
      .then(m => m.CharacterCacheService.invalidateCharacterCache(characterId))
      .catch(error => console.error('[CacheService] Erro ao limpar cache do personagem:', error));
  }

  /**
   * Limpar cache de usuário específico
   * ATUALIZADO: Inclui limpeza das stores relacionadas ao usuário
   */
  static clearUserCache(userId: string): void {
    console.log(`[CacheService] Limpando cache do usuário: ${userId}`);

    try {
      const characterStore = useCharacterStore.getState();
      const gameStateStore = useGameStateStore.getState();
      const logStore = useLogStore.getState();

      // Limpar personagem selecionado se pertencer ao usuário
      if (characterStore.selectedCharacter?.user_id === userId) {
        characterStore.setSelectedCharacter(null);
        gameStateStore.resetGameState();
        console.log('[CacheService] Personagem selecionado removido das stores');
      }

      // Limpar logs do usuário
      logStore.clearAllLogs();
    } catch (error) {
      console.error('[CacheService] Erro ao limpar stores do usuário:', error);
    }

    // Limpar cache tradicional
    import('./character-cache.service')
      .then(m => m.CharacterCacheService.invalidateUserCache(userId))
      .catch(error => console.error('[CacheService] Erro ao limpar cache do usuário:', error));
  }

  /**
   * NOVO: Limpar apenas as stores sem afetar caches de serviços
   */
  static clearStoresOnly(): void {
    console.log('[CacheService] Limpando apenas stores Zustand');

    try {
      const gameStateStore = useGameStateStore.getState();
      const characterStore = useCharacterStore.getState();
      const battleStore = useBattleStore.getState();
      const logStore = useLogStore.getState();

      gameStateStore.resetGameState();
      characterStore.setSelectedCharacter(null);
      battleStore.resetBattleState();
      logStore.clearAllLogs();

      console.log('[CacheService] Stores limpos com sucesso');
    } catch (error) {
      console.error('[CacheService] Erro ao limpar stores:', error);
    }
  }

  /**
   * NOVO: Verificar estado das stores para debug
   */
  static getStoresDebugInfo(): {
    gameState: { mode: string; hasPlayer: boolean; hasEnemy: boolean };
    character: { hasSelected: boolean; selectedName?: string };
    battle: { isProcessing: boolean; phase: string };
    logs: { count: number };
  } {
    try {
      const gameStateStore = useGameStateStore.getState();
      const characterStore = useCharacterStore.getState();
      const battleStore = useBattleStore.getState();
      const logStore = useLogStore.getState();

      return {
        gameState: {
          mode: gameStateStore.gameState.mode,
          hasPlayer: Boolean(gameStateStore.gameState.player),
          hasEnemy: Boolean(gameStateStore.gameState.currentEnemy),
        },
        character: {
          hasSelected: Boolean(characterStore.selectedCharacter),
          selectedName: characterStore.selectedCharacter?.name,
        },
        battle: {
          isProcessing: battleStore.isProcessingAction,
          phase: battleStore.battlePhase,
        },
        logs: {
          count: logStore.gameLogs.length,
        },
      };
    } catch (error) {
      console.error('[CacheService] Erro ao obter debug info:', error);
      return {
        gameState: { mode: 'error', hasPlayer: false, hasEnemy: false },
        character: { hasSelected: false },
        battle: { isProcessing: false, phase: 'error' },
        logs: { count: 0 },
      };
    }
  }
}
