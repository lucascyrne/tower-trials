import { type Character } from '../models/character.model';

interface CachedCharacter {
  character: Character;
  timestamp: number;
  isValid: boolean;
}

interface CachedUserCharacters {
  characters: Character[];
  timestamp: number;
  isValid: boolean;
}

export class CharacterCacheService {
  private static characterCache: Map<string, CachedCharacter> = new Map();
  private static userCharactersCache: Map<string, CachedUserCharacters> = new Map();
  private static pendingRequests: Map<string, Promise<any>> = new Map();
  private static pendingUserRequests: Map<string, Promise<any>> = new Map();

  // Configurações de cache
  private static readonly CACHE_DURATION = 30000; // 30 segundos
  private static readonly USER_CACHE_DURATION = 15000; // 15 segundos para listas de usuário
  private static readonly MAX_CACHE_SIZE = 100;

  // Sistema de invalidação throttled
  private static invalidationQueue: Set<string> = new Set();
  private static invalidationTimer: NodeJS.Timeout | null = null;
  private static readonly INVALIDATION_DELAY = 500;

  /**
   * Verificar se um personagem está em cache e é válido
   */
  static getCachedCharacter(characterId: string): Character | null {
    const cached = this.characterCache.get(characterId);
    if (!cached) return null;

    const now = Date.now();
    const isExpired = now - cached.timestamp > this.CACHE_DURATION;

    if (isExpired || !cached.isValid) {
      this.characterCache.delete(characterId);
      return null;
    }

    console.log(`[CharacterCacheService] Cache hit para personagem ${characterId}`);
    return cached.character;
  }

  /**
   * Armazenar personagem no cache
   */
  static setCachedCharacter(characterId: string, character: Character): void {
    // Limpar cache se estiver muito grande
    if (this.characterCache.size >= this.MAX_CACHE_SIZE) {
      this.cleanOldEntries();
    }

    this.characterCache.set(characterId, {
      character,
      timestamp: Date.now(),
      isValid: true,
    });

    console.log(`[CharacterCacheService] Personagem ${characterId} adicionado ao cache`);
  }

  /**
   * Verificar se personagens do usuário estão em cache e são válidos
   */
  static getCachedUserCharacters(userId: string): { characters: Character[]; isValid: boolean } {
    const cached = this.userCharactersCache.get(userId);
    if (!cached) {
      return { characters: [], isValid: false };
    }

    const now = Date.now();
    const isExpired = now - cached.timestamp > this.USER_CACHE_DURATION;

    if (isExpired || !cached.isValid) {
      this.userCharactersCache.delete(userId);
      return { characters: [], isValid: false };
    }

    console.log(
      `[CharacterCacheService] Cache hit para usuário ${userId} (${cached.characters.length} personagens)`
    );
    return { characters: cached.characters, isValid: true };
  }

  /**
   * Armazenar personagens do usuário no cache
   */
  static setCachedUserCharacters(userId: string, characters: Character[]): void {
    this.userCharactersCache.set(userId, {
      characters,
      timestamp: Date.now(),
      isValid: true,
    });

    // Também atualizar cache individual dos personagens
    characters.forEach(character => {
      this.setCachedCharacter(character.id, character);
    });

    console.log(
      `[CharacterCacheService] Personagens do usuário ${userId} adicionados ao cache (${characters.length} personagens)`
    );
  }

  /**
   * Verificar se existe uma requisição pendente
   */
  static getPendingRequest(characterId: string): Promise<any> | null {
    return this.pendingRequests.get(characterId) || null;
  }

  /**
   * Armazenar uma requisição pendente
   */
  static setPendingRequest(characterId: string, promise: Promise<any>): void {
    this.pendingRequests.set(characterId, promise);

    // Limpar requisição pendente quando completar
    promise.finally(() => {
      this.pendingRequests.delete(characterId);
    });
  }

  /**
   * Verificar se existe uma requisição de usuário pendente
   */
  static getPendingUserRequest(userId: string): Promise<any> | null {
    return this.pendingUserRequests.get(userId) || null;
  }

  /**
   * Armazenar uma requisição de usuário pendente
   */
  static setPendingUserRequest(userId: string, promise: Promise<any>): void {
    this.pendingUserRequests.set(userId, promise);

    // Limpar requisição pendente quando completar
    promise.finally(() => {
      this.pendingUserRequests.delete(userId);
    });
  }

  /**
   * Invalidar cache de um personagem específico com throttling
   */
  static invalidateCharacterCache(characterId: string): void {
    // Adicionar à fila de invalidação
    this.invalidationQueue.add(characterId);

    // Se já há um timer rodando, cancelar
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }

    // Processar a fila após o delay
    this.invalidationTimer = setTimeout(() => {
      const idsToInvalidate = Array.from(this.invalidationQueue);
      this.invalidationQueue.clear();
      this.invalidationTimer = null;

      idsToInvalidate.forEach(id => {
        const cached = this.characterCache.get(id);
        if (cached) {
          cached.isValid = false;
          // Não deletar imediatamente - marcar como inválido para permitir fallback
        }
      });

      if (idsToInvalidate.length > 0) {
        console.log(
          `[CharacterCacheService] Cache invalidado para ${idsToInvalidate.length} personagens: ${idsToInvalidate.join(', ')}`
        );
      }
    }, this.INVALIDATION_DELAY);
  }

  /**
   * Invalidar cache de um usuário específico
   */
  static invalidateUserCache(userId: string): void {
    const cached = this.userCharactersCache.get(userId);
    if (cached) {
      cached.isValid = false;
    }

    // Encontrar todos os personagens deste usuário e invalidar
    const userCharacterIds: string[] = [];
    this.characterCache.forEach((cachedChar, id) => {
      if (cachedChar.character.user_id === userId) {
        userCharacterIds.push(id);
      }
    });

    // Usar o sistema de throttling para invalidar todos os personagens do usuário
    userCharacterIds.forEach(id => this.invalidateCharacterCache(id));

    console.log(
      `[CharacterCacheService] Cache de usuário ${userId} invalidado (${userCharacterIds.length} personagens)`
    );
  }

  /**
   * Limpar entradas antigas do cache
   */
  private static cleanOldEntries(): void {
    const now = Date.now();
    let removedCount = 0;

    // Limpar personagens expirados
    for (const [id, cached] of this.characterCache.entries()) {
      if (now - cached.timestamp > this.CACHE_DURATION || !cached.isValid) {
        this.characterCache.delete(id);
        removedCount++;
      }
    }

    // Limpar listas de usuários expiradas
    for (const [userId, cached] of this.userCharactersCache.entries()) {
      if (now - cached.timestamp > this.USER_CACHE_DURATION || !cached.isValid) {
        this.userCharactersCache.delete(userId);
      }
    }

    if (removedCount > 0) {
      console.log(`[CharacterCacheService] Limpeza de cache: ${removedCount} entradas removidas`);
    }
  }

  /**
   * Forçar limpeza completa do cache
   */
  static clearAllCache(): void {
    this.characterCache.clear();
    this.userCharactersCache.clear();
    this.pendingRequests.clear();
    this.pendingUserRequests.clear();

    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
      this.invalidationTimer = null;
    }

    this.invalidationQueue.clear();

    console.log('[CharacterCacheService] Todo o cache foi limpo');
  }

  /**
   * Obter estatísticas do cache para debug
   */
  static getCacheStats(): {
    charactersCount: number;
    userCachesCount: number;
    pendingRequestsCount: number;
    pendingUserRequestsCount: number;
    invalidationQueueSize: number;
  } {
    return {
      charactersCount: this.characterCache.size,
      userCachesCount: this.userCharactersCache.size,
      pendingRequestsCount: this.pendingRequests.size,
      pendingUserRequestsCount: this.pendingUserRequests.size,
      invalidationQueueSize: this.invalidationQueue.size,
    };
  }

  /**
   * Pré-carregar personagem no cache (útil para inicialização de batalha)
   */
  static async preloadCharacter(
    characterId: string,
    fetchFunction: () => Promise<Character>
  ): Promise<Character | null> {
    // Verificar se já está em cache
    const cached = this.getCachedCharacter(characterId);
    if (cached) {
      return cached;
    }

    // Verificar se há requisição pendente
    const pending = this.getPendingRequest(characterId);
    if (pending) {
      try {
        const result = await pending;
        return result.data || null;
      } catch (error) {
        console.error('[CharacterCacheService] Erro na requisição pendente:', error);
        return null;
      }
    }

    // Criar nova requisição
    try {
      const character = await fetchFunction();
      this.setCachedCharacter(characterId, character);
      return character;
    } catch (error) {
      console.error('[CharacterCacheService] Erro ao pré-carregar personagem:', error);
      return null;
    }
  }

  /**
   * Verificar integridade do cache
   */
  static validateCacheIntegrity(): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const now = Date.now();

    // Verificar personagens em cache
    for (const [id, cached] of this.characterCache.entries()) {
      if (!cached.character || !cached.character.id) {
        issues.push(`Personagem ${id} tem dados inválidos`);
      }

      if (cached.character.id !== id) {
        issues.push(`Personagem ${id} tem ID inconsistente: ${cached.character.id}`);
      }

      if (now - cached.timestamp > this.CACHE_DURATION * 2) {
        issues.push(`Personagem ${id} está muito desatualizado`);
      }
    }

    // Verificar listas de usuários
    for (const [userId, cached] of this.userCharactersCache.entries()) {
      if (!Array.isArray(cached.characters)) {
        issues.push(`Lista de personagens do usuário ${userId} não é um array`);
      }

      if (now - cached.timestamp > this.USER_CACHE_DURATION * 2) {
        issues.push(`Lista de personagens do usuário ${userId} está muito desatualizada`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
