import { type Character } from '../models/character.model';

export class CharacterCacheService {
  private static characterCache: Map<string, Character> = new Map();
  private static lastFetchTimestamp: Map<string, number> = new Map();
  private static pendingRequests: Map<
    string,
    Promise<{ data: Character | null; error: string | null; success: boolean }>
  > = new Map();

  // OTIMIZADO: Cache mais duradouro para reduzir requisições
  private static CACHE_DURATION = 60000; // 60 segundos de cache (aumentado de 30s)

  // OTIMIZADO: Sistema mais eficiente de throttling
  private static cacheInvalidationQueue: Set<string> = new Set();
  private static cacheInvalidationTimer: NodeJS.Timeout | null = null;
  private static CACHE_INVALIDATION_DELAY = 250; // 250ms de delay (reduzido de 500ms)

  /**
   * Obter personagem do cache se disponível e válido
   */
  static getCachedCharacter(characterId: string): Character | null {
    const cachedCharacter = this.characterCache.get(characterId);
    const now = Date.now();
    const lastFetch = this.lastFetchTimestamp.get(characterId) || 0;

    if (cachedCharacter && now - lastFetch < this.CACHE_DURATION) {
      console.log(
        `[CharacterCacheService] Cache hit: ${cachedCharacter.name} (andar: ${cachedCharacter.floor})`
      );
      return cachedCharacter;
    }

    return null;
  }

  /**
   * Verificar se há requisição pendente para um personagem
   */
  static getPendingRequest(
    characterId: string
  ): Promise<{ data: Character | null; error: string | null; success: boolean }> | null {
    return this.pendingRequests.get(characterId) || null;
  }

  /**
   * Definir requisição pendente
   */
  static setPendingRequest(
    characterId: string,
    request: Promise<{ data: Character | null; error: string | null; success: boolean }>
  ): void {
    this.pendingRequests.set(characterId, request);

    // Remover do mapa quando concluído
    request.finally(() => {
      this.pendingRequests.delete(characterId);
    });
  }

  /**
   * Armazenar personagem no cache
   */
  static setCachedCharacter(characterId: string, character: Character): void {
    console.log(`[CharacterCacheService] Cache set: ${character.name} (andar: ${character.floor})`);
    this.characterCache.set(characterId, character);
    this.lastFetchTimestamp.set(characterId, Date.now());
  }

  /**
   * OTIMIZADO: Atualizar dados específicos do cache sem invalidar completamente
   */
  static updateCachedCharacterStats(characterId: string, updates: Partial<Character>): boolean {
    const cachedCharacter = this.characterCache.get(characterId);

    if (cachedCharacter) {
      // Atualizar apenas os campos fornecidos
      const updatedCharacter = { ...cachedCharacter, ...updates };
      this.characterCache.set(characterId, updatedCharacter);

      console.log(
        `[CharacterCacheService] Cache updated: ${cachedCharacter.name} - ${Object.keys(updates).join(', ')}`
      );
      return true;
    }

    return false;
  }

  /**
   * Obter lista de personagens em cache para um usuário
   */
  static getCachedUserCharacters(userId: string): { characters: Character[]; isValid: boolean } {
    const now = Date.now();
    const userCacheKey = `user_${userId}`;
    const lastFetch = this.lastFetchTimestamp.get(userCacheKey) || 0;

    if (now - lastFetch < this.CACHE_DURATION) {
      const cachedCharacters = Array.from(this.characterCache.values()).filter(
        char => char.user_id === userId
      );
      if (cachedCharacters.length > 0) {
        console.log(
          `[CharacterCacheService] User cache hit: ${cachedCharacters.length} personagens para usuário ${userId}`
        );
        return { characters: cachedCharacters, isValid: true };
      }
    }

    return { characters: [], isValid: false };
  }

  /**
   * Armazenar lista de personagens do usuário no cache
   */
  static setCachedUserCharacters(userId: string, characters: Character[]): void {
    const now = Date.now();
    const userCacheKey = `user_${userId}`;

    // OTIMIZADO: Não limpar todo o cache, apenas atualizar/adicionar
    characters.forEach(char => {
      this.characterCache.set(char.id, char);
    });

    this.lastFetchTimestamp.set(userCacheKey, now);
    console.log(
      `[CharacterCacheService] User cache set: ${characters.length} personagens para usuário ${userId}`
    );
  }

  /**
   * OTIMIZADO: Invalidação seletiva - apenas quando realmente necessário
   */
  static invalidateCharacterCache(characterId: string, reason: string = 'unknown'): void {
    // Verificar se realmente precisa invalidar
    const cachedCharacter = this.characterCache.get(characterId);
    if (!cachedCharacter) {
      console.log(
        `[CharacterCacheService] Skip invalidation: personagem ${characterId} não está em cache`
      );
      return;
    }

    // Adicionar à fila de invalidação com throttling
    this.cacheInvalidationQueue.add(characterId);

    // Se já há um timer rodando, cancelar
    if (this.cacheInvalidationTimer) {
      clearTimeout(this.cacheInvalidationTimer);
    }

    // Processar a fila após o delay
    this.cacheInvalidationTimer = setTimeout(() => {
      const idsToInvalidate = Array.from(this.cacheInvalidationQueue);
      this.cacheInvalidationQueue.clear();
      this.cacheInvalidationTimer = null;

      idsToInvalidate.forEach(id => {
        const character = this.characterCache.get(id);
        this.characterCache.delete(id);
        this.lastFetchTimestamp.delete(id);

        if (character) {
          console.log(
            `[CharacterCacheService] Cache invalidated: ${character.name} (reason: ${reason})`
          );
        }
      });
    }, this.CACHE_INVALIDATION_DELAY);
  }

  /**
   * OTIMIZADO: Invalidação de usuário mais inteligente
   */
  static invalidateUserCache(userId: string, reason: string = 'unknown'): void {
    const userCacheKey = `user_${userId}`;
    this.lastFetchTimestamp.delete(userCacheKey);

    // OTIMIZADO: Invalidar apenas personagens que realmente mudaram
    const userCharacterIds: string[] = [];
    Array.from(this.characterCache.entries()).forEach(([id, character]) => {
      if (character.user_id === userId) {
        userCharacterIds.push(id);
      }
    });

    if (userCharacterIds.length > 0) {
      userCharacterIds.forEach(id => this.invalidateCharacterCache(id, reason));
      console.log(
        `[CharacterCacheService] User cache invalidated: usuário ${userId} (${userCharacterIds.length} personagens, reason: ${reason})`
      );
    }
  }

  /**
   * NOVO: Invalidação específica para stats (HP/Mana) sem afetar outros dados
   */
  static invalidateCharacterStatsOnly(characterId: string): void {
    const cachedCharacter = this.characterCache.get(characterId);

    if (cachedCharacter) {
      // Apenas marcar timestamp como expirado para forçar reload na próxima consulta
      const now = Date.now();
      const currentTimestamp = this.lastFetchTimestamp.get(characterId) || 0;

      // Se o cache ainda é "novo" (menos de 10 segundos), mantê-lo mais um pouco
      if (now - currentTimestamp < 10000) {
        console.log(
          `[CharacterCacheService] Stats cache refresh delayed: ${cachedCharacter.name} (cache still fresh)`
        );
        return;
      }

      // Marcar como expirado para forçar reload
      this.lastFetchTimestamp.set(characterId, 0);
      console.log(`[CharacterCacheService] Stats cache expired: ${cachedCharacter.name}`);
    }
  }

  /**
   * Limpar todo o cache
   */
  static clearAllCache(): void {
    this.characterCache.clear();
    this.lastFetchTimestamp.clear();
    this.pendingRequests.clear();

    if (this.cacheInvalidationTimer) {
      clearTimeout(this.cacheInvalidationTimer);
      this.cacheInvalidationTimer = null;
    }

    this.cacheInvalidationQueue.clear();
    console.log('[CharacterCacheService] Todo o cache foi limpo');
  }

  /**
   * Obter estatísticas do cache
   */
  static getCacheStats(): {
    totalCharacters: number;
    pendingRequests: number;
    oldestEntry: string | null;
    newestEntry: string | null;
    cacheHitRate: number;
  } {
    const timestamps = Array.from(this.lastFetchTimestamp.entries());
    const sortedTimestamps = timestamps.sort((a, b) => a[1] - b[1]);

    return {
      totalCharacters: this.characterCache.size,
      pendingRequests: this.pendingRequests.size,
      oldestEntry: sortedTimestamps[0]?.[0] || null,
      newestEntry: sortedTimestamps[sortedTimestamps.length - 1]?.[0] || null,
      cacheHitRate: 0, // Poderia ser implementado com contadores
    };
  }
}
