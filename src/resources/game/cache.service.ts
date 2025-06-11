/**
 * Serviço centralizado de cache para todo o sistema de jogo
 * Elimina redundâncias entre FloorService, MonsterService e CharacterCacheService
 */
export class CacheService {
  private static lastGlobalClearTime = 0;
  private static readonly MIN_GLOBAL_CLEAR_INTERVAL = 1000; // Mínimo 1 segundo entre clears globais

  /**
   * Limpar todos os caches do sistema de jogo de forma coordenada
   */
  static clearAllGameCaches(): void {
    const now = Date.now();
    if (now - this.lastGlobalClearTime < this.MIN_GLOBAL_CLEAR_INTERVAL) {
      console.log(
        `[CacheService] Cache clear global throttled - última limpeza há ${now - this.lastGlobalClearTime}ms`
      );
      return;
    }

    console.log('[CacheService] === LIMPEZA GLOBAL DE CACHES ===');

    // Importações dinâmicas para evitar dependências circulares
    Promise.all([
      import('./floor.service').then(module => module.FloorService.clearCache()),
      import('./monster.service').then(module => module.MonsterService.clearCache()),
      import('./character/character-cache.service').then(module =>
        module.CharacterCacheService.clearAllCache()
      ),
    ])
      .then(() => {
        console.log('[CacheService] Todos os caches foram limpos com sucesso');
      })
      .catch(error => {
        console.error('[CacheService] Erro ao limpar alguns caches:', error);
      });

    this.lastGlobalClearTime = now;
  }

  /**
   * Limpar caches relacionados a um andar específico
   */
  static clearFloorRelatedCaches(floor: number): void {
    console.log(`[CacheService] Limpando caches relacionados ao andar ${floor}`);

    // Limpar cache específico do andar
    import('./floor.service').then(module => {
      const FloorService = module.FloorService;
      // Se houver método específico para limpar um andar, usar aqui
      FloorService.clearCache();
    });

    // Limpar cache do monstro do andar
    import('./monster.service').then(module => {
      const MonsterService = module.MonsterService;
      // Se houver método específico para limpar um andar, usar aqui
      MonsterService.clearCache();
    });
  }

  /**
   * Limpar caches relacionados a um personagem específico
   */
  static clearCharacterRelatedCaches(characterId: string): void {
    console.log(`[CacheService] Limpando caches relacionados ao personagem ${characterId}`);

    import('./character/character-cache.service').then(module => {
      module.CharacterCacheService.invalidateCharacterCache(characterId);
    });
  }

  /**
   * Limpar caches relacionados a um usuário específico
   */
  static clearUserRelatedCaches(userId: string): void {
    console.log(`[CacheService] Limpando caches relacionados ao usuário ${userId}`);

    import('./character/character-cache.service').then(module => {
      module.CharacterCacheService.invalidateUserCache(userId);
    });
  }

  /**
   * Obter estatísticas consolidadas de todos os caches
   */
  static async getAllCacheStats(): Promise<{
    characters: any;
    floors: any;
    monsters: any;
  }> {
    try {
      const [characterStats, floorStats, monsterStats] = await Promise.all([
        import('./character/character-cache.service').then(module =>
          module.CharacterCacheService.getCacheStats()
        ),
        // FloorService e MonsterService não têm getCacheStats ainda
        // mas podemos adicionar se necessário
        Promise.resolve({ message: 'Stats não implementados ainda' }),
        Promise.resolve({ message: 'Stats não implementados ainda' }),
      ]);

      return {
        characters: characterStats,
        floors: floorStats,
        monsters: monsterStats,
      };
    } catch (error) {
      console.error('[CacheService] Erro ao obter estatísticas de cache:', error);
      return {
        characters: { error: 'Falha ao obter stats' },
        floors: { error: 'Falha ao obter stats' },
        monsters: { error: 'Falha ao obter stats' },
      };
    }
  }
}
