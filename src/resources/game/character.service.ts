import { 
  Character, 
  CreateCharacterDTO, 
  CharacterProgressionInfo, 
  CharacterLimitInfo, 
  UpdateCharacterStatsResult,
  AttributeDistribution,
  AttributeDistributionResult,
  CharacterStats,
  SkillType,
  SkillXpResult
} from './models/character.model';
import { EquipmentService } from './equipment.service';
import { NameValidationService } from './name-validation.service';
import { supabase } from '@/lib/supabase';
import { GamePlayer } from './game-model';
import { SupabaseAdminGameRepository } from './infrastructure/supabase/supabase-admin-game.repository';
import { GrantSecureXpUseCase } from './application/use-cases/grant-secure-xp.use-case';
import { GrantSecureGoldUseCase } from './application/use-cases/grant-secure-gold.use-case';
import { AdvanceFloorUseCase } from './application/use-cases/advance-floor.use-case';

/** Stats base persistidos em `characters` (sem bônus de equipamento). */
export interface PersistedCombatDerivedStats {
  hp: number;
  max_hp: number;
  mana: number;
  max_mana: number;
  atk: number;
  def: number;
  speed: number;
  magic_attack: number;
  critical_chance: number;
  critical_damage: number;
  magic_damage_bonus: number;
  double_attack_chance: number;
}

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Atualizar a interface UpdateCharacterStatsDTO para incluir floor
export interface UpdateCharacterStatsDTO {
  xp?: number;
  gold?: number;
  hp?: number;
  mana?: number;
  floor?: number;
}

interface CharacterFullStatsRpc {
  character_id: string;
  name: string;
  level: number;
  xp: number;
  xp_next_level: number;
  gold: number;
  hp: number;
  max_hp: number;
  mana: number;
  max_mana: number;
  atk: number;
  def: number;
  speed: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  vitality: number;
  luck: number;
  attribute_points: number;
  critical_chance: number;
  critical_damage: number;
  sword_mastery: number;
  axe_mastery: number;
  blunt_mastery: number;
  defense_mastery: number;
  magic_mastery: number;
  sword_mastery_xp: number;
  axe_mastery_xp: number;
  blunt_mastery_xp: number;
  defense_mastery_xp: number;
  magic_mastery_xp: number;
}

interface BasicCharacterRpc {
  user_id: string;
  floor: number;
  highest_floor?: number;
  created_at: string;
  updated_at: string;
  last_activity?: string;
}

export class CharacterService {
  private static readonly adminGameRepository = new SupabaseAdminGameRepository();
  private static readonly grantSecureXpUseCase = new GrantSecureXpUseCase(
    CharacterService.adminGameRepository
  );
  private static readonly grantSecureGoldUseCase = new GrantSecureGoldUseCase(
    CharacterService.adminGameRepository
  );
  private static readonly advanceFloorUseCase = new AdvanceFloorUseCase(
    CharacterService.adminGameRepository
  );
  private static characterCache: Map<string, Character> = new Map();
  private static lastFetchTimestamp: Map<string, number> = new Map();
  private static pendingRequests: Map<string, Promise<ServiceResponse<Character>>> = new Map();
  private static pendingUserCharactersRequests: Map<string, Promise<ServiceResponse<Character[]>>> = new Map();
  private static CACHE_DURATION = 30000; // 30 segundos de cache

  private static num(v: unknown, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Espelha `get_unlocked_checkpoints` no SQL (fallback offline / RPC antiga). */
  private static checkpointsFallbackFromHighestFloor(highestFloor: number): { floor: number; description: string }[] {
    const checkpoints: { floor: number; description: string }[] = [
      { floor: 1, description: 'Andar 1 - Início da Torre' },
    ];
    if (highestFloor >= 5) {
      checkpoints.push({ floor: 5, description: 'Andar 5 - Checkpoint' });
    }
    for (let i = 1; i <= 100; i++) {
      const cp = 10 * i + 1;
      if (cp > highestFloor) break;
      checkpoints.push({
        floor: cp,
        description: `Andar ${cp} - Checkpoint Pós-Boss`,
      });
    }
    return checkpoints;
  }

  /**
   * `calculateDamage` espera `critical_damage` em percentual (ex.: 110).
   * Valores &lt; 20 são tratados como multiplicador legado (ex.: 1.5 → 150).
   */
  private static normalizePlayerCritDamage(raw: number): number {
    if (raw > 0 && raw < 20) return Math.round(raw * 100);
    return raw;
  }

  /**
   * Fonte única alinhada ao Postgres: colunas já recalculadas por `calculate_derived_stats` / RPCs.
   */
  static combatDerivedFromPersistedRow(row: Character): PersistedCombatDerivedStats {
    return {
      hp: CharacterService.num(row.hp, 0),
      max_hp: CharacterService.num(row.max_hp, 0),
      mana: CharacterService.num(row.mana, 0),
      max_mana: CharacterService.num(row.max_mana, 0),
      atk: CharacterService.num(row.atk, 0),
      def: CharacterService.num(row.def, 0),
      speed: CharacterService.num(row.speed, 0),
      magic_attack: CharacterService.num(row.magic_attack, 0),
      critical_chance: CharacterService.num(row.critical_chance, 0),
      critical_damage: CharacterService.normalizePlayerCritDamage(
        CharacterService.num(row.critical_damage, 110)
      ),
      magic_damage_bonus: CharacterService.num(row.magic_damage_bonus, 0),
      double_attack_chance: CharacterService.num(row.double_attack_chance, 0),
    };
  }
  
  // OTIMIZADO: Throttling para invalidação de cache
  private static cacheInvalidationQueue: Set<string> = new Set();
  private static cacheInvalidationTimer: NodeJS.Timeout | null = null;
  private static CACHE_INVALIDATION_DELAY = 100; // 100ms de delay para agrupar invalidações

  /**
   * Buscar informações de progressão do usuário
   * @param userId ID do usuário
   * @returns Informações de progressão
   */
  static async getUserCharacterProgression(userId: string): Promise<ServiceResponse<CharacterProgressionInfo>> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_character_progression', {
          p_user_id: userId
        })
        .single();

      if (error) throw error;

      return { 
        data: data as CharacterProgressionInfo, 
        error: null, 
        success: true 
      };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar progressão', 
        success: false 
      };
    }
  }

  /**
   * Verificar limite de personagens do usuário
   * @param userId ID do usuário
   * @returns Informações sobre limites de personagem
   */
  static async checkCharacterLimit(userId: string): Promise<ServiceResponse<CharacterLimitInfo>> {
    try {
      const { data, error } = await supabase
        .rpc('check_character_limit', {
          p_user_id: userId
        })
        .single();

      if (error) throw error;

      return { 
        data: data as CharacterLimitInfo, 
        error: null, 
        success: true 
      };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao verificar limite', 
        success: false 
      };
    }
  }

  /**
   * Buscar todos os personagens do usuário
   * @param userId ID do usuário
   * @returns Lista de personagens
   */
  static async getUserCharacters(userId: string): Promise<ServiceResponse<Character[]>> {
    const now = Date.now();
    const userCacheKey = `user_${userId}`;
    const lastFetch = this.lastFetchTimestamp.get(userCacheKey) || 0;

    if (now - lastFetch < this.CACHE_DURATION) {
      const cachedCharacters = Array.from(this.characterCache.values()).filter(char => char.user_id === userId);
      if (cachedCharacters.length > 0) {
        return { data: cachedCharacters, error: null, success: true };
      }
    }

    const inflight = this.pendingUserCharactersRequests.get(userId);
    if (inflight) {
      return inflight;
    }

    const request = (async (): Promise<ServiceResponse<Character[]>> => {
      try {
        const { data, error } = await supabase.rpc('get_user_characters', {
          p_user_id: userId,
        });

        if (error) throw error;

        const fetchedAt = Date.now();
        this.characterCache.clear();
        (data as Character[]).forEach(char => {
          this.characterCache.set(char.id, char);
        });
        this.lastFetchTimestamp.set(userCacheKey, fetchedAt);

        return { data: data as Character[], error: null, success: true };
      } catch (error) {
        return {
          data: null,
          error: error instanceof Error ? error.message : 'Erro ao buscar personagens',
          success: false,
        };
      } finally {
        this.pendingUserCharactersRequests.delete(userId);
      }
    })();

    this.pendingUserCharactersRequests.set(userId, request);
    return request;
  }

  /**
   * Buscar um personagem específico
   * @param characterId ID do personagem
   * @returns Dados do personagem
   */
  static async getCharacter(characterId: string): Promise<ServiceResponse<Character>> {
    try {
      // Verificar cache primeiro
      const cachedCharacter = this.characterCache.get(characterId);
      const now = Date.now();
      const lastFetch = this.lastFetchTimestamp.get(characterId) || 0;
      
      // Usar cache somente se estiver dentro do tempo de validade
      if (cachedCharacter && now - lastFetch < this.CACHE_DURATION) {
        return { data: cachedCharacter, error: null, success: true };
      }

      if (this.pendingRequests.has(characterId)) {
        return this.pendingRequests.get(characterId)!;
      }

      // Criar nova requisição
      const request = this.fetchCharacterFromServer(characterId);
      this.pendingRequests.set(characterId, request);

      // Remover do mapa de requisições pendentes quando concluído
      request.finally(() => {
        this.pendingRequests.delete(characterId);
      });

      const result = await request;
      
      if (result.success && result.data) {
        const healResult = await this.applyAutoHeal(characterId);
        
        if (healResult.success && healResult.data && healResult.data.healed) {
          return { data: healResult.data.character, error: null, success: true };
        }
      }

      return result;
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar personagem', 
        success: false 
      };
    }
  }

  /**
   * Buscar personagem do servidor
   * @private
   */
  private static async fetchCharacterFromServer(characterId: string): Promise<ServiceResponse<Character>> {
    try {
      const { data, error } = await supabase
        .rpc('get_character_full_stats', {
          p_character_id: characterId
        })
        .single();

      if (error) throw error;

      if (!data) {
        return { 
          data: null, 
          error: 'Personagem não encontrado', 
          success: false 
        };
      }

      // Converter os dados da função RPC para o formato Character
      const fullStatsData = data as CharacterFullStatsRpc;
      const character: Character = {
        id: fullStatsData.character_id,
        user_id: '', // Será preenchido pela função RPC se necessário
        name: fullStatsData.name,
        level: fullStatsData.level,
        xp: fullStatsData.xp,
        xp_next_level: fullStatsData.xp_next_level,
        gold: fullStatsData.gold,
        hp: fullStatsData.hp,
        max_hp: fullStatsData.max_hp,
        mana: fullStatsData.mana,
        max_mana: fullStatsData.max_mana,
        atk: fullStatsData.atk,
        def: fullStatsData.def,
        speed: fullStatsData.speed,
        floor: 1, // Será preenchido pela função RPC se necessário
        strength: fullStatsData.strength,
        dexterity: fullStatsData.dexterity,
        intelligence: fullStatsData.intelligence,
        wisdom: fullStatsData.wisdom,
        vitality: fullStatsData.vitality,
        luck: fullStatsData.luck,
        attribute_points: fullStatsData.attribute_points || 0,
        critical_chance: fullStatsData.critical_chance,
        critical_damage: fullStatsData.critical_damage,
        sword_mastery: fullStatsData.sword_mastery,
        axe_mastery: fullStatsData.axe_mastery,
        blunt_mastery: fullStatsData.blunt_mastery,
        defense_mastery: fullStatsData.defense_mastery,
        magic_mastery: fullStatsData.magic_mastery,
        sword_mastery_xp: fullStatsData.sword_mastery_xp,
        axe_mastery_xp: fullStatsData.axe_mastery_xp,
        blunt_mastery_xp: fullStatsData.blunt_mastery_xp,
        defense_mastery_xp: fullStatsData.defense_mastery_xp,
        magic_mastery_xp: fullStatsData.magic_mastery_xp,
        is_alive: true, // Será atualizado se necessário
        created_at: '', // Será preenchido se necessário
        updated_at: '', // Será preenchido se necessário
        last_activity: undefined
      };

      // Buscar dados adicionais que não estão na função get_character_full_stats
      const { data: basicData, error: basicError } = await supabase
        .rpc('get_character', {
          p_character_id: character.id
        })
        .single();

      if (!basicError && basicData) {
        const basicCharacterData = basicData as BasicCharacterRpc;
        character.user_id = basicCharacterData.user_id;
        character.floor = basicCharacterData.floor;
        character.highest_floor = CharacterService.num(
          basicCharacterData.highest_floor,
          basicCharacterData.floor
        );
        character.created_at = basicCharacterData.created_at;
        character.updated_at = basicCharacterData.updated_at;
        character.last_activity = basicCharacterData.last_activity;
      }

      this.characterCache.set(characterId, character);
      this.lastFetchTimestamp.set(characterId, Date.now());

      return { 
        data: character, 
        error: null, 
        success: true 
      };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar personagem',
        success: false 
      };
    }
  }

  /**
   * Criar um novo personagem
   * @param data Dados do personagem
   * @returns ID do personagem criado e informações de progressão
   */
  static async createCharacter(data: CreateCharacterDTO): Promise<ServiceResponse<{ id: string; progressionUpdated?: boolean }>> {
    try {
      // Validar nome do personagem no frontend primeiro
      const nameValidation = NameValidationService.validateCharacterName(data.name);
      if (!nameValidation.isValid) {
        return {
          data: null,
          error: nameValidation.error || 'Nome inválido',
          success: false
        };
      }

      // Verificar limite antes de tentar criar
      const limitInfo = await this.checkCharacterLimit(data.user_id);
      if (!limitInfo.success || !limitInfo.data?.can_create) {
        const nextSlotLevel = limitInfo.data?.next_slot_required_level || 0;
        const currentSlots = limitInfo.data?.available_slots || 3;
        
        return {
          data: null,
          error: `Limite de personagens atingido. Para criar o ${currentSlots + 1}º personagem, você precisa de ${nextSlotLevel} níveis totais entre todos os seus personagens.`,
          success: false
        };
      }

      // Formatar nome corretamente
      const formattedName = NameValidationService.formatCharacterName(data.name);

      // Verificar se o usuário já tem personagem com nome similar
      const existingCharacters = await this.getUserCharacters(data.user_id);
      if (existingCharacters.success && existingCharacters.data && existingCharacters.data.length > 0) {
        const existingNames = existingCharacters.data.map(c => c.name);
        if (NameValidationService.isTooSimilar(formattedName, existingNames)) {
          const suggestions = NameValidationService.generateNameSuggestions(formattedName);
          return {
            data: null,
            error: `Nome muito similar a um personagem existente. Sugestões: ${suggestions.join(', ')}`,
            success: false
          };
        }
      }

      // Criar novo personagem usando a função RPC com nome formatado
      const { data: result, error } = await supabase
        .rpc('create_character', {
          p_user_id: data.user_id,
          p_name: formattedName
        });

      if (error) {
        // Tratar erros específicos de validação do banco
        if (error.message.includes('Nome')) {
          return {
            data: null,
            error: error.message,
            success: false
          };
        }
        if (error.message.includes('Limite') || error.message.includes('personagem')) {
          return {
            data: null,
            error: error.message,
            success: false
          };
        }
        throw error;
      }

      // Limpar cache do usuário para forçar atualização
      this.invalidateUserCache(data.user_id);

      return { 
        data: { id: result }, 
        error: null, 
        success: true 
      };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao criar personagem', 
        success: false 
      };
    }
  }

  /**
   * Carregar personagem com seus equipamentos
   */
  static async loadCharacter(characterId: string): Promise<Character> {
    // Carregar dados básicos do personagem
    const { data: character, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (error) throw error;

    // Carregar equipamentos equipados
    const equipmentSlotsData = await EquipmentService.getEquippedItems(characterId);
    
    // Converter para array se necessário
    const equipmentSlots = Array.isArray(equipmentSlotsData) 
      ? equipmentSlotsData 
      : Object.values(equipmentSlotsData || {});

    return {
      ...character,
      equipment_slots: equipmentSlots,
    };
  }

  /**
   * FUNÇÃO SEGURA: Conceder XP com validações anti-cheat
   * @param characterId ID do personagem
   * @param xpAmount Quantidade de XP
   * @param source Fonte do XP (combat, quest, etc.)
   * @returns Resultado da operação
   */
  static async grantSecureXP(
    characterId: string,
    xpAmount: number,
    source: string = 'combat'
  ): Promise<ServiceResponse<UpdateCharacterStatsResult>> {
    try {
      // Importar o cliente admin apenas quando necessário
      const data = await this.grantSecureXpUseCase.execute({
        characterId,
        xpAmount,
        source,
      });

      // Invalidar cache do personagem específico
      this.invalidateCharacterCache(characterId);

      // Se houve level up ou slots desbloqueados, invalidar cache do usuário
      const result = data as UpdateCharacterStatsResult;
      if (result.leveled_up || result.slots_unlocked) {
        const character = await this.getCharacter(characterId);
        if (character.success && character.data) {
          this.invalidateUserCache(character.data.user_id);
        }
      }

      return { 
        data: result, 
        error: null, 
        success: true 
      };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao conceder XP', 
        success: false 
      };
    }
  }

  /**
   * FUNÇÃO SEGURA: Conceder gold com validações anti-cheat
   * @param characterId ID do personagem
   * @param goldAmount Quantidade de gold
   * @param source Fonte do gold (combat, quest, etc.)
   * @returns Novo total de gold
   */
  static async grantSecureGold(
    characterId: string,
    goldAmount: number,
    source: string = 'combat'
  ): Promise<ServiceResponse<number>> {
    try {
      // Importar o cliente admin apenas quando necessário
      const data = await this.grantSecureGoldUseCase.execute({
        characterId,
        goldAmount,
        source,
      });

      // Invalidar cache do personagem específico
      this.invalidateCharacterCache(characterId);

      return { 
        data: data as number, 
        error: null, 
        success: true 
      };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao conceder gold', 
        success: false 
      };
    }
  }

  /**
   * OTIMIZADO: Atualizar HP e Mana com validação de limites e throttling
   */
  static async updateCharacterHpMana(
    characterId: string,
    hp?: number,
    mana?: number
  ): Promise<ServiceResponse<null>> {
    try {
      if (!characterId) {
        return { success: false, error: 'ID do personagem é obrigatório', data: null };
      }

      // CRÍTICO: Garantir que os valores sejam sempre inteiros
      const integerHp = hp !== undefined ? Math.floor(Number(hp)) : undefined;
      const integerMana = mana !== undefined ? Math.floor(Number(mana)) : undefined;

      // Validar valores se fornecidos
      if (integerHp !== undefined && (integerHp < 0 || integerHp > 9999)) {
        return { success: false, error: 'Valor de HP inválido', data: null };
      }
      
      if (integerMana !== undefined && (integerMana < 0 || integerMana > 9999)) {
        return { success: false, error: 'Valor de Mana inválido', data: null };
      }

      const { error } = await supabase.rpc('internal_update_character_hp_mana', {
        p_character_id: characterId,
        p_hp: integerHp,
        p_mana: integerMana
      });

      if (error) {
        return { success: false, error: `Erro ao atualizar stats: ${error.message}`, data: null };
      }

      // OTIMIZADO: Invalidar cache usando sistema com throttling
      this.invalidateCharacterCache(characterId);

      return { success: true, error: null, data: null };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar HP/Mana', 
        data: null 
      };
    }
  }

  /**
   * OTIMIZADO: Avançar andar do personagem com validação e throttling
   */
  static async updateCharacterFloor(characterId: string, newFloor: number): Promise<ServiceResponse<null>> {
    try {
      // Importar o cliente admin apenas quando necessário
      await this.advanceFloorUseCase.execute({
        characterId,
        newFloor,
      });

      this.invalidateCharacterCache(characterId);

      return { data: null, error: null, success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      return { 
        data: null, 
        error: errorMsg, 
        success: false 
      };
    }
  }

  /**
   * Atualizar gold do personagem
   */
  static async updateGold(characterId: string, amount: number): Promise<void> {
    const { error } = await supabase
      .from('characters')
      .update({ gold: amount })
      .eq('id', characterId);

    if (error) throw error;
  }

  /**
   * Deletar um personagem
   * @param characterId ID do personagem
   * @returns Resultado da operação
   */
  static async deleteCharacter(characterId: string): Promise<{ error: string | null }> {
    try {
      // Obter dados do personagem antes de deletar para invalidar cache do usuário
      const character = await this.getCharacter(characterId);
      
      // Se o personagem existe e tem progresso, salvar no ranking histórico primeiro
      if (character.success && character.data && character.data.floor > 0) {
        try {
          // Usar a nova função para salvar no ranking histórico
          const { error: rankingError } = await supabase
            .rpc('save_ranking_entry_on_death', {
              p_character_id: characterId
            });
          
          if (rankingError) {
            // Continua com a deleção mesmo se falhar o ranking
          }
        } catch {
          // Continua com a deleção mesmo se falhar o ranking
        }
      }

      // Deletar o personagem usando a função RPC do banco
      const { error } = await supabase
        .rpc('delete_character', {
          p_character_id: characterId
        });

      if (error) throw error;

      // Invalidar cache do personagem deletado
      this.invalidateCharacterCache(characterId);
      
      // Invalidar cache do usuário para atualizar progressão
      if (character.success && character.data) {
        this.invalidateUserCache(character.data.user_id);
      }

      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Erro ao deletar personagem' };
    }
  }

  /**
   * OTIMIZADO: Limpar cache de um personagem específico com throttling
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
    }, this.CACHE_INVALIDATION_DELAY);
  }

  /**
   * OTIMIZADO: Limpar cache de um usuário específico com throttling
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
  }

  /**
   * Limpar todo o cache
   */
  static clearAllCache(): void {
    this.characterCache.clear();
    this.lastFetchTimestamp.clear();
    this.pendingRequests.clear();
  }

  /**
   * Obter checkpoints desbloqueados pelo personagem
   * @param characterId ID do personagem
   * @returns Lista de checkpoints disponíveis
   */
  static async getUnlockedCheckpoints(characterId: string): Promise<ServiceResponse<{ floor: number; description: string }[]>> {
    try {
      try {
        // Tentar usar a nova função RPC específica para personagens
        const { data, error } = await supabase
          .rpc('get_character_unlocked_checkpoints', {
            p_character_id: characterId
          });

        if (!error && data) {
          const checkpoints = data.map((row: { floor_number: number; description: string }) => ({
            floor: row.floor_number,
            description: row.description
          }));
          return { data: checkpoints, error: null, success: true };
        } else if (error) {
          // Continuar para fallback
        }
      } catch {
        // Fallback
      }

      // Fallback: obter o personagem e calcular checkpoints manualmente
      
      const characterResponse = await this.getCharacter(characterId);
      if (!characterResponse.success || !characterResponse.data) {
        return { data: null, error: 'Personagem não encontrado', success: false };
      }
      
      const character = characterResponse.data;

      const highestFloor = Math.max(
        character.floor,
        CharacterService.num(character.highest_floor, character.floor)
      );

      return {
        data: CharacterService.checkpointsFallbackFromHighestFloor(highestFloor),
        error: null,
        success: true,
      };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Erro ao obter checkpoints', success: false };
    }
  }

  /**
   * Iniciar personagem em um checkpoint específico
   * @param characterId ID do personagem
   * @param checkpointFloor Andar do checkpoint
   * @returns Resultado da operação
   */
  static async startFromCheckpoint(characterId: string, checkpointFloor: number): Promise<ServiceResponse<null>> {
    try {
      // Andar 1, 5 (mid), série pós-boss 11, 21, …
      const isValidCheckpoint =
        checkpointFloor === 1 ||
        checkpointFloor === 5 ||
        (checkpointFloor > 10 && (checkpointFloor - 1) % 10 === 0);
      
      if (!isValidCheckpoint) {
        return { data: null, error: 'Checkpoint inválido', success: false };
      }
      
      // Verificar se o personagem pode acessar este checkpoint
      const checkpointsResponse = await this.getUnlockedCheckpoints(characterId);
      if (!checkpointsResponse.success || !checkpointsResponse.data) {
        return { data: null, error: 'Erro ao verificar checkpoints', success: false };
      }
      
      const hasAccess = checkpointsResponse.data.some(cp => cp.floor === checkpointFloor);
      if (!hasAccess) {
        return { data: null, error: 'Checkpoint não desbloqueado', success: false };
      }
      
      // Atualizar o andar do personagem usando a função segura
      const updateResponse = await this.updateCharacterFloor(characterId, checkpointFloor);
      return updateResponse;
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Erro ao iniciar do checkpoint', success: false };
    }
  }

  /**
   * Calcular cura automática baseada em tempo
   * Cura total em 2 horas (de 0.1% a 100% da vida e mana)
   * @param character Dados do personagem
   * @param currentTime Timestamp atual
   * @returns HP e Mana atualizados após cura automática
   */
  static calculateAutoHeal(character: Character, currentTime: Date): { hp: number; mana: number } {
    // Se não há last_activity, não curar
    if (!character.last_activity) {
      return { hp: character.hp, mana: character.mana };
    }

    // Se HP e Mana já estão no máximo, não curar
    if (character.hp >= character.max_hp && character.mana >= character.max_mana) {
      return { hp: character.hp, mana: character.mana };
    }

    const lastActivity = new Date(character.last_activity);
    const timeDiffMs = currentTime.getTime() - lastActivity.getTime();
    const timeDiffSeconds = Math.floor(timeDiffMs / 1000);

    // Se passou menos de 1 segundo, não curar
    if (timeDiffSeconds < 1) {
      return { hp: character.hp, mana: character.mana };
    }

    // Configurações de cura - REDUZIDO para 2 horas
    const HEAL_DURATION_HOURS = 2;
    const HEAL_DURATION_SECONDS = HEAL_DURATION_HOURS * 3600; // 7200 segundos
    const MIN_PERCENT = 0.1; // Começa a curar a partir de 0.1%
    const MAX_PERCENT = 100; // Cura até 100%
    
    // Calcular HP curado
    let newHp = character.hp;
    if (character.hp < character.max_hp) {
      // Se HP está abaixo de 0.1%, ajustar para 0.1% antes de calcular cura
      const adjustedCurrentHp = Math.max(character.hp, Math.ceil(character.max_hp * (MIN_PERCENT / 100)));
      const adjustedCurrentHpPercent = (adjustedCurrentHp / character.max_hp) * 100;
      
      // Taxa de cura HP: (100% - 0.1%) / 2 horas = 99.9% / 7200s ≈ 0.01387% por segundo
      const healRatePerSecond = (MAX_PERCENT - MIN_PERCENT) / HEAL_DURATION_SECONDS;
      
      // Calcular HP curado baseado no tempo decorrido
      const healPercentage = Math.min(
        healRatePerSecond * timeDiffSeconds,
        MAX_PERCENT - adjustedCurrentHpPercent
      );
      
      const healAmount = Math.floor((healPercentage / 100) * character.max_hp);
      newHp = Math.min(character.max_hp, adjustedCurrentHp + healAmount);
    }

    // Calcular Mana curada (mesma lógica que HP)
    let newMana = character.mana;
    if (character.mana < character.max_mana) {
      // Se Mana está abaixo de 0.1%, ajustar para 0.1% antes de calcular cura
      const adjustedCurrentMana = Math.max(character.mana, Math.ceil(character.max_mana * (MIN_PERCENT / 100)));
      const adjustedCurrentManaPercent = (adjustedCurrentMana / character.max_mana) * 100;
      
      // Taxa de cura Mana: (100% - 0.1%) / 2 horas = 99.9% / 7200s ≈ 0.01387% por segundo
      const healRatePerSecond = (MAX_PERCENT - MIN_PERCENT) / HEAL_DURATION_SECONDS;
      
      // Calcular Mana curada baseada no tempo decorrido
      const healPercentage = Math.min(
        healRatePerSecond * timeDiffSeconds,
        MAX_PERCENT - adjustedCurrentManaPercent
      );
      
      const healAmount = Math.floor((healPercentage / 100) * character.max_mana);
      newMana = Math.min(character.max_mana, adjustedCurrentMana + healAmount);
    }
    
    return { hp: newHp, mana: newMana };
  }

  /**
   * Aplicar cura automática em um personagem
   * @param characterId ID do personagem
   * @returns Personagem com HP atualizado
   */
  static async applyAutoHeal(characterId: string): Promise<ServiceResponse<{ healed: boolean; oldHp: number; newHp: number; character: Character }>> {
    try {
      const characterResponse = await this.getCharacter(characterId);
      if (!characterResponse.success || !characterResponse.data) {
        return { data: null, error: 'Personagem não encontrado', success: false };
      }

      const character = characterResponse.data;
      const currentTime = new Date();
      const { hp, mana } = this.calculateAutoHeal(character, currentTime);
      
      // Se não houve cura, retornar sem atualizar
      if (hp === character.hp && mana === character.mana) {
        return {
          data: {
            healed: false,
            oldHp: character.hp,
            newHp: character.hp,
            character
          },
          error: null,
          success: true
        };
      }

      // Atualizar HP e Mana no banco usando função segura
      const updateResult = await this.updateCharacterHpMana(characterId, hp, mana);
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Erro ao atualizar HP/Mana');
      }

      // Atualizar timestamp de atividade
      await this.updateLastActivity(characterId);

      // Invalidar cache do personagem
      this.invalidateCharacterCache(characterId);

      const updatedCharacter = { ...character, hp: hp, mana: mana, last_activity: currentTime.toISOString() };

      return {
        data: {
          healed: true,
          oldHp: character.hp,
          newHp: hp,
          character: updatedCharacter
        },
        error: null,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao aplicar cura automática',
        success: false
      };
    }
  }

  /**
   * Atualizar timestamp de última atividade do personagem
   * @param characterId ID do personagem
   * @returns Resultado da operação
   */
  static async updateLastActivity(characterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .rpc('update_character_activity', {
          p_character_id: characterId
        });

      if (error) throw error;

      // Invalidar cache do personagem
      this.invalidateCharacterCache(characterId);

      return { data: null, error: null, success: true };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao atualizar última atividade',
        success: false
      };
    }
  }

  /**
   * Obter stats completos do personagem incluindo bônus de equipamentos
   */
  static async getCharacterStats(characterId: string): Promise<ServiceResponse<CharacterStats>> {
    try {
      // CRÍTICO: Usar a mesma fonte de dados que getCharacterForGame para garantir consistência
      const gamePlayerResponse = await this.getCharacterForGame(characterId);
      
      if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
        return {
          success: false,
          error: gamePlayerResponse.error || 'Erro ao carregar dados do personagem',
          data: null
        };
      }

      const gamePlayer = gamePlayerResponse.data;
      
      // Converter GamePlayer para CharacterStats usando exatamente os mesmos valores
      const characterStats: CharacterStats = {
        level: gamePlayer.level,
        xp: gamePlayer.xp,
        xp_next_level: gamePlayer.xp_next_level,
        gold: gamePlayer.gold,
        hp: gamePlayer.hp,
        max_hp: gamePlayer.max_hp,
        mana: gamePlayer.mana,
        max_mana: gamePlayer.max_mana,
        atk: gamePlayer.atk,
        def: gamePlayer.def,
        speed: gamePlayer.speed,
        
        // Atributos primários
        strength: gamePlayer.strength || 10,
        dexterity: gamePlayer.dexterity || 10,
        intelligence: gamePlayer.intelligence || 10,
        wisdom: gamePlayer.wisdom || 10,
        vitality: gamePlayer.vitality || 10,
        luck: gamePlayer.luck || 10,
        attribute_points: gamePlayer.attribute_points || 0,
        
        // CRÍTICO: Stats derivados - usar exatamente os mesmos valores do GamePlayer
        critical_chance: gamePlayer.critical_chance || 0,
        critical_damage: gamePlayer.critical_damage || 0,
        magic_damage_bonus: gamePlayer.magic_damage_bonus || 0,
        magic_attack: gamePlayer.magic_attack || 0,
        
        // Habilidades
        sword_mastery: gamePlayer.sword_mastery || 1,
        axe_mastery: gamePlayer.axe_mastery || 1,
        blunt_mastery: gamePlayer.blunt_mastery || 1,
        defense_mastery: gamePlayer.defense_mastery || 1,
        magic_mastery: gamePlayer.magic_mastery || 1,
        
        sword_mastery_xp: gamePlayer.sword_mastery_xp || 0,
        axe_mastery_xp: gamePlayer.axe_mastery_xp || 0,
        blunt_mastery_xp: gamePlayer.blunt_mastery_xp || 0,
        defense_mastery_xp: gamePlayer.defense_mastery_xp || 0,
        magic_mastery_xp: gamePlayer.magic_mastery_xp || 0,
        
        // Stats base (usar os mesmos do GamePlayer para consistência)
        base_hp: gamePlayer.base_hp || gamePlayer.base_max_hp,
        base_max_hp: gamePlayer.base_max_hp,
        base_mana: gamePlayer.base_mana || gamePlayer.base_max_mana,
        base_max_mana: gamePlayer.base_max_mana,
        base_atk: gamePlayer.base_atk,
        base_def: gamePlayer.base_def,
        base_speed: gamePlayer.base_speed,
        
        // Bônus de equipamentos (usar os mesmos do GamePlayer para consistência)
        equipment_hp_bonus: gamePlayer.equipment_hp_bonus || 0,
        equipment_mana_bonus: gamePlayer.equipment_mana_bonus || 0,
        equipment_atk_bonus: gamePlayer.equipment_atk_bonus || 0,
        equipment_def_bonus: gamePlayer.equipment_def_bonus || 0,
        equipment_speed_bonus: gamePlayer.equipment_speed_bonus || 0
      };

      return {
        success: true,
        error: null,
        data: characterStats
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null
      };
    }
  }

  /**
   * Obter personagem com stats detalhados para o jogo usando novo sistema
   */
  static async getCharacterForGame(characterId: string): Promise<ServiceResponse<GamePlayer>> {
    try {
      // Buscar dados básicos do personagem
      const { data: charData, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .single();

      if (charError) throw charError;

      if (!charData) {
        return {
          success: false,
          error: 'Personagem não encontrado',
          data: null
        };
      }

      // Buscar bônus de equipamentos
      const { EquipmentService } = await import('../game/equipment.service');
      const equipmentBonusResponse = await EquipmentService.getEquipmentBonuses(characterId);
      const equipmentBonuses = equipmentBonusResponse.success && equipmentBonusResponse.data 
        ? equipmentBonusResponse.data 
        : {
            total_atk_bonus: 0,
            total_def_bonus: 0,
            total_mana_bonus: 0,
            total_speed_bonus: 0,
            total_hp_bonus: 0,
            total_critical_chance_bonus: 0,
            total_critical_damage_bonus: 0,
            total_double_attack_chance_bonus: 0,
            total_magic_damage_bonus: 0
          };

      const derivedStats = CharacterService.combatDerivedFromPersistedRow(charData as Character);
      
      // Aplicar bônus de equipamentos aos stats derivados
      const finalStats = {
        hp: derivedStats.hp + equipmentBonuses.total_hp_bonus,
        max_hp: derivedStats.max_hp + equipmentBonuses.total_hp_bonus,
        mana: derivedStats.mana + equipmentBonuses.total_mana_bonus,
        max_mana: derivedStats.max_mana + equipmentBonuses.total_mana_bonus,
        atk: derivedStats.atk + equipmentBonuses.total_atk_bonus,
        def: derivedStats.def + equipmentBonuses.total_def_bonus,
        speed: derivedStats.speed + equipmentBonuses.total_speed_bonus,
        magic_attack: derivedStats.magic_attack,
        critical_chance: derivedStats.critical_chance + equipmentBonuses.total_critical_chance_bonus,
        critical_damage: derivedStats.critical_damage + equipmentBonuses.total_critical_damage_bonus,
        magic_damage_bonus: derivedStats.magic_damage_bonus + equipmentBonuses.total_magic_damage_bonus,
        double_attack_chance: derivedStats.double_attack_chance + equipmentBonuses.total_double_attack_chance_bonus
      };
      
      // Carregar magias equipadas do personagem
      const spellsResponse = await import('../game/spell.service').then(m => 
        m.SpellService.getCharacterEquippedSpells(characterId)
      );
      const equippedSpells = spellsResponse.success && spellsResponse.data 
        ? spellsResponse.data 
        : [];
      
      const gamePlayer: GamePlayer = {
        id: charData.id,
        user_id: charData.user_id,
        name: charData.name,
        level: charData.level,
        xp: charData.xp,
        xp_next_level: charData.xp_next_level,
        gold: charData.gold,
        hp: finalStats.hp,
        max_hp: finalStats.max_hp,
        mana: finalStats.mana,
        max_mana: finalStats.max_mana,
        atk: finalStats.atk,
        def: finalStats.def,
        speed: finalStats.speed,
        created_at: charData.created_at,
        updated_at: charData.updated_at,
        isPlayerTurn: true,
        specialCooldown: 0,
        defenseCooldown: 0,
        isDefending: false,
        floor: charData.floor,
        spells: equippedSpells,
        consumables: [],
        active_effects: {
          buffs: [],
          debuffs: [],
          dots: [],
          hots: [],
          attribute_modifications: []
        },
        
        // Atributos primários
        strength: charData.strength || 10,
        dexterity: charData.dexterity || 10,
        intelligence: charData.intelligence || 10,
        wisdom: charData.wisdom || 10,
        vitality: charData.vitality || 10,
        luck: charData.luck || 10,
        attribute_points: charData.attribute_points || 0,
        
        // Habilidades
        sword_mastery: charData.sword_mastery || 1,
        axe_mastery: charData.axe_mastery || 1,
        blunt_mastery: charData.blunt_mastery || 1,
        defense_mastery: charData.defense_mastery || 1,
        magic_mastery: charData.magic_mastery || 1,
        
        sword_mastery_xp: charData.sword_mastery_xp || 0,
        axe_mastery_xp: charData.axe_mastery_xp || 0,
        blunt_mastery_xp: charData.blunt_mastery_xp || 0,
        defense_mastery_xp: charData.defense_mastery_xp || 0,
        magic_mastery_xp: charData.magic_mastery_xp || 0,
        
        // Stats derivados calculados
        critical_chance: finalStats.critical_chance,
        critical_damage: finalStats.critical_damage,
        magic_damage_bonus: finalStats.magic_damage_bonus,
        magic_attack: finalStats.magic_attack,
        double_attack_chance: finalStats.double_attack_chance,
        
        // Stats base para exibição (sem bônus de equipamentos)
        base_hp: derivedStats.hp,
        base_max_hp: derivedStats.max_hp,
        base_mana: derivedStats.mana,
        base_max_mana: derivedStats.max_mana,
        base_atk: derivedStats.atk,
        base_def: derivedStats.def,
        base_speed: derivedStats.speed,
        
        // Bônus de equipamentos para exibição
        equipment_hp_bonus: equipmentBonuses.total_hp_bonus,
        equipment_mana_bonus: equipmentBonuses.total_mana_bonus,
        equipment_atk_bonus: equipmentBonuses.total_atk_bonus,
        equipment_def_bonus: equipmentBonuses.total_def_bonus,
        equipment_speed_bonus: equipmentBonuses.total_speed_bonus
      };

      return {
        success: true,
        error: null,
        data: gamePlayer
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null
      };
    }
  }

  /**
   * Distribuir pontos de atributo
   * @param characterId ID do personagem
   * @param distribution Distribuição de pontos
   * @returns Resultado da distribuição
   */
  static async distributeAttributePoints(
    characterId: string, 
    distribution: AttributeDistribution
  ): Promise<ServiceResponse<AttributeDistributionResult>> {
    try {
      const { data, error } = await supabase
        .rpc('distribute_attribute_points', {
          p_character_id: characterId,
          p_strength: distribution.strength,
          p_dexterity: distribution.dexterity,
          p_intelligence: distribution.intelligence,
          p_wisdom: distribution.wisdom,
          p_vitality: distribution.vitality,
          p_luck: distribution.luck
        })
        .single();

      if (error) throw error;

      // Invalidar cache do personagem
      this.invalidateCharacterCache(characterId);

      return { 
        data: data as AttributeDistributionResult, 
        error: null, 
        success: true 
      };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao distribuir pontos', 
        success: false 
      };
    }
  }

  /**
   * Adicionar XP a uma habilidade específica
   * @param characterId ID do personagem
   * @param skillType Tipo da habilidade
   * @param xpAmount Quantidade de XP
   * @returns Resultado do ganho de XP
   */
  static async addSkillXp(
    characterId: string,
    skillType: SkillType,
    xpAmount: number
  ): Promise<ServiceResponse<SkillXpResult>> {
    try {
      const { data, error } = await supabase
        .rpc('add_skill_xp', {
          p_character_id: characterId,
          p_skill_type: skillType,
          p_xp_amount: xpAmount
        })
        .single();

      if (error) throw error;

      // Invalidar cache do personagem se a habilidade subiu de nível
      if (data && (data as SkillXpResult).skill_leveled_up) {
        this.invalidateCharacterCache(characterId);
      }

      return { 
        data: data as SkillXpResult, 
        error: null, 
        success: true 
      };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao adicionar XP', 
        success: false 
      };
    }
  }

  /**
   * Recalcular todos os stats de um personagem
   * @param characterId ID do personagem
   * @returns Sucesso da operação
   */
  static async recalculateCharacterStats(characterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .rpc('recalculate_character_stats', {
          p_character_id: characterId
        });

      if (error) throw error;

      // Invalidar cache do personagem
      this.invalidateCharacterCache(characterId);

      return { 
        data: null, 
        error: null, 
        success: true 
      };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao recalcular stats', 
        success: false 
      };
    }
  }

  /**
   * Resetar progresso do personagem na torre (volta para andar 1)
   * @param characterId ID do personagem
   * @returns Sucesso da operação
   */
  static async resetCharacterProgress(characterId: string): Promise<ServiceResponse<null>> {
    try {
      // Usar a função segura para resetar para andar 1
      const result = await this.updateCharacterFloor(characterId, 1);
      if (!result.success) {
        return result;
      }

      // Atualizar HP e mana para máximo usando função segura
      const character = await this.getCharacter(characterId);
      if (character.success && character.data) {
        await this.updateCharacterHpMana(
          characterId, 
          character.data.max_hp, 
          character.data.max_mana
        );
      }

      return { 
        data: null, 
        error: null, 
        success: true 
      };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao resetar progresso', 
        success: false 
      };
    }
  }

  /**
   * Stats derivados persistidos (Postgres). Para combate com equipamentos, usar `getCharacterForGame`.
   */
  static calculateDerivedStats(character: Character): PersistedCombatDerivedStats {
    return CharacterService.combatDerivedFromPersistedRow(character);
  }

} 