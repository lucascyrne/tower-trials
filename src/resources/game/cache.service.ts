/**
 * Serviço central de cache para o sistema de jogo
 */
export class CacheService {
  /**
   * Limpar todos os caches do sistema
   */
  static clearAllGameCaches(): void {
    Promise.all([
      import('./floor.service').then(m => m.FloorService.clearCache()),
      import('./monster.service').then(m => m.MonsterService.clearCache()),
      import('./character-cache.service').then(m => m.CharacterCacheService.clearAllCache()),
    ]).catch(error => {
      console.error('[CacheService] Erro ao limpar caches:', error);
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
   */
  static clearUserCache(userId: string): void {
    import('./character-cache.service')
      .then(m => m.CharacterCacheService.invalidateUserCache(userId))
      .catch(error => console.error('[CacheService] Erro ao limpar cache do usuário:', error));
  }
}
