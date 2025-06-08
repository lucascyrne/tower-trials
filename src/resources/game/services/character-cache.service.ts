import { type Character } from '../models/character.model';

export class CharacterCacheService {
  private static characterCache: Map<string, Character> = new Map();
  private static lastFetchTimestamp: Map<string, number> = new Map();
  private static pendingRequests: Map<string, Promise<{ data: Character | null; error: string | null; success: boolean }>> = new Map();
  private static CACHE_DURATION = 30000; // 30 segundos de cache
  
  // OTIMIZADO: Throttling para invalidação de cache
  private static cacheInvalidationQueue: Set<string> = new Set();
  private static cacheInvalidationTimer: NodeJS.Timeout | null = null;
  private static CACHE_INVALIDATION_DELAY = 100; // 100ms de delay para agrupar invalidações

  /**
   * Obter personagem do cache se disponível e válido
   */
  static getCachedCharacter(characterId: string): Character | null {
    const cachedCharacter = this.characterCache.get(characterId);
    const now = Date.now();
    const lastFetch = this.lastFetchTimestamp.get(characterId) || 0;
    
    if (cachedCharacter && now - lastFetch < this.CACHE_DURATION) {
      console.log(`[CharacterCacheService] Usando personagem em cache: ${cachedCharacter.name} (andar: ${cachedCharacter.floor})`);
      return cachedCharacter;
    }
    
    return null;
  }

  /**
   * Verificar se há requisição pendente para um personagem
   */
  static getPendingRequest(characterId: string): Promise<{ data: Character | null; error: string | null; success: boolean }> | null {
    return this.pendingRequests.get(characterId) || null;
  }

  /**
   * Definir requisição pendente
   */
  static setPendingRequest(characterId: string, request: Promise<{ data: Character | null; error: string | null; success: boolean }>): void {
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
    console.log(`[CharacterCacheService] Personagem armazenado no cache: ${character.name} (andar: ${character.floor})`);
    this.characterCache.set(characterId, character);
    this.lastFetchTimestamp.set(characterId, Date.now());
  }

  /**
   * Obter lista de personagens em cache para um usuário
   */
  static getCachedUserCharacters(userId: string): { characters: Character[]; isValid: boolean } {
    const now = Date.now();
    const userCacheKey = `user_${userId}`;
    const lastFetch = this.lastFetchTimestamp.get(userCacheKey) || 0;
    
    if (now - lastFetch < this.CACHE_DURATION) {
      const cachedCharacters = Array.from(this.characterCache.values()).filter(char => char.user_id === userId);
      if (cachedCharacters.length > 0) {
        console.log(`[CharacterCacheService] Usando lista de personagens em cache para usuário ${userId}`);
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
    
    // Limpar cache antigo e adicionar novos personagens
    this.characterCache.clear();
    characters.forEach(char => {
      this.characterCache.set(char.id, char);
    });
    this.lastFetchTimestamp.set(userCacheKey, now);
  }

  /**
   * OTIMIZADO: Invalidar cache de um personagem específico com throttling
   */
  static invalidateCharacterCache(characterId: string): void {
    // Adicionar à fila de invalidação
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
        this.characterCache.delete(id);
        this.lastFetchTimestamp.delete(id);
      });
      
      if (idsToInvalidate.length > 0) {
        console.log(`[CharacterCacheService] Cache invalidado para ${idsToInvalidate.length} personagens: ${idsToInvalidate.join(', ')}`);
      }
    }, this.CACHE_INVALIDATION_DELAY);
  }

  /**
   * OTIMIZADO: Invalidar cache de um usuário específico com throttling
   */
  static invalidateUserCache(userId: string): void {
    const userCacheKey = `user_${userId}`;
    this.lastFetchTimestamp.delete(userCacheKey);
    
    // Encontrar todos os personagens deste usuário e invalidar de forma agrupada
    const userCharacterIds: string[] = [];
    Array.from(this.characterCache.entries()).forEach(([id, character]) => {
      if (character.user_id === userId) {
        userCharacterIds.push(id);
      }
    });
    
    // Usar o sistema de throttling para invalidar todos os personagens do usuário
    userCharacterIds.forEach(id => this.invalidateCharacterCache(id));
    
    console.log(`[CharacterCacheService] Cache de usuário ${userId} invalidado (${userCharacterIds.length} personagens)`);
  }

  /**
   * Limpar todo o cache
   */
  static clearAllCache(): void {
    this.characterCache.clear();
    this.lastFetchTimestamp.clear();
    this.pendingRequests.clear();
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
  } {
    const timestamps = Array.from(this.lastFetchTimestamp.entries());
    const sortedTimestamps = timestamps.sort((a, b) => a[1] - b[1]);
    
    return {
      totalCharacters: this.characterCache.size,
      pendingRequests: this.pendingRequests.size,
      oldestEntry: sortedTimestamps[0]?.[0] || null,
      newestEntry: sortedTimestamps[sortedTimestamps.length - 1]?.[0] || null
    };
  }
} 