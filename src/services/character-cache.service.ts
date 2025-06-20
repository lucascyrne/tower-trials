import { type Character } from '@/models/character.model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

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
  private static pendingRequests: Map<string, Promise<ServiceResponse<Character>>> = new Map();
  private static pendingUserRequests: Map<string, Promise<ServiceResponse<Character[]>>> =
    new Map();

  private static readonly CACHE_DURATION = 30000; // 30 segundos
  private static readonly USER_CACHE_DURATION = 15000; // 15 segundos
  private static readonly MAX_CACHE_SIZE = 100;

  private static invalidationQueue: Set<string> = new Set();
  private static invalidationTimer: NodeJS.Timeout | null = null;
  private static readonly INVALIDATION_DELAY = 500;

  // === CACHE DE PERSONAGEM INDIVIDUAL ===

  static getCachedCharacter(characterId: string): Character | null {
    const cached = this.characterCache.get(characterId);
    if (!cached) return null;

    const now = Date.now();
    const isExpired = now - cached.timestamp > this.CACHE_DURATION;

    if (isExpired || !cached.isValid) {
      this.characterCache.delete(characterId);
      return null;
    }

    // CORRIGIDO: Log de cache apenas em debug mode
    const isDebugMode = typeof window !== 'undefined' && localStorage.getItem('debug') === 'true';
    if (isDebugMode) {
      console.log(`[CharacterCacheService] Cache hit para personagem ${characterId}`);
    }
    return cached.character;
  }

  static setCachedCharacter(characterId: string, character: Character): void {
    if (this.characterCache.size >= this.MAX_CACHE_SIZE) {
      this.cleanOldEntries();
    }

    this.characterCache.set(characterId, {
      character,
      timestamp: Date.now(),
      isValid: true,
    });

    // CORRIGIDO: Log apenas em debug mode
    const isDebugMode = typeof window !== 'undefined' && localStorage.getItem('debug') === 'true';
    if (isDebugMode) {
      console.log(`[CharacterCacheService] Personagem ${characterId} adicionado ao cache`);
    }
  }

  // NOVO: Obter timestamp do cache para verificação de idade
  static getCacheTimestamp(characterId: string): number | null {
    const cached = this.characterCache.get(characterId);
    return cached ? cached.timestamp : null;
  }

  // === CACHE DE USUÁRIO ===

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

    // CORRIGIDO: Log apenas em debug mode
    const isDebugMode = typeof window !== 'undefined' && localStorage.getItem('debug') === 'true';
    if (isDebugMode) {
      console.log(
        `[CharacterCacheService] Cache hit para usuário ${userId} (${cached.characters.length} personagens)`
      );
    }
    return { characters: cached.characters, isValid: true };
  }

  static setCachedUserCharacters(userId: string, characters: Character[]): void {
    this.userCharactersCache.set(userId, {
      characters,
      timestamp: Date.now(),
      isValid: true,
    });

    // Atualizar cache individual dos personagens
    characters.forEach(character => {
      this.setCachedCharacter(character.id, character);
    });

    console.log(
      `[CharacterCacheService] ${characters.length} personagens do usuário ${userId} em cache`
    );
  }

  // === REQUISIÇÕES PENDENTES ===

  static getPendingRequest(characterId: string): Promise<ServiceResponse<Character>> | null {
    return this.pendingRequests.get(characterId) || null;
  }

  static setPendingRequest(
    characterId: string,
    promise: Promise<ServiceResponse<Character>>
  ): void {
    this.pendingRequests.set(characterId, promise);
    promise.finally(() => {
      this.pendingRequests.delete(characterId);
    });
  }

  static getPendingUserRequest(userId: string): Promise<ServiceResponse<Character[]>> | null {
    return this.pendingUserRequests.get(userId) || null;
  }

  static setPendingUserRequest(
    userId: string,
    promise: Promise<ServiceResponse<Character[]>>
  ): void {
    this.pendingUserRequests.set(userId, promise);
    promise.finally(() => {
      this.pendingUserRequests.delete(userId);
    });
  }

  // === INVALIDAÇÃO ===

  static invalidateCharacterCache(characterId: string): void {
    this.invalidationQueue.add(characterId);

    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }

    this.invalidationTimer = setTimeout(() => {
      const idsToInvalidate = Array.from(this.invalidationQueue);
      this.invalidationQueue.clear();
      this.invalidationTimer = null;

      idsToInvalidate.forEach(id => {
        const cached = this.characterCache.get(id);
        if (cached) {
          cached.isValid = false;
        }
      });

      if (idsToInvalidate.length > 0) {
        console.log(
          `[CharacterCacheService] Cache invalidado para ${idsToInvalidate.length} personagens`
        );

        // NOVO: Detectar invalidações excessivas que podem indicar loops
        if (idsToInvalidate.length > 5) {
          console.warn(
            `[CharacterCacheService] ⚠️ MUITAS INVALIDAÇÕES SIMULTÂNEAS - possível loop infinito detectado`
          );
          console.trace('Stack trace da invalidação em massa');
        }
      }
    }, this.INVALIDATION_DELAY);
  }

  static invalidateUserCache(userId: string): void {
    const cached = this.userCharactersCache.get(userId);
    if (cached) {
      cached.isValid = false;
    }

    // Invalidar personagens deste usuário
    const userCharacterIds: string[] = [];
    this.characterCache.forEach((cachedChar, id) => {
      if (cachedChar.character.user_id === userId) {
        userCharacterIds.push(id);
      }
    });

    userCharacterIds.forEach(id => this.invalidateCharacterCache(id));

    console.log(
      `[CharacterCacheService] Cache de usuário ${userId} invalidado (${userCharacterIds.length} personagens)`
    );
  }

  // === LIMPEZA E MANUTENÇÃO ===

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
      console.log(`[CharacterCacheService] ${removedCount} entradas removidas`);
    }
  }

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

  // === UTILITÁRIOS ===

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

  static async preloadCharacter(
    characterId: string,
    fetchFunction: () => Promise<Character>
  ): Promise<Character | null> {
    const cached = this.getCachedCharacter(characterId);
    if (cached) {
      return cached;
    }

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

    try {
      const character = await fetchFunction();
      this.setCachedCharacter(characterId, character);
      return character;
    } catch (error) {
      console.error('[CharacterCacheService] Erro ao pré-carregar personagem:', error);
      return null;
    }
  }

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
