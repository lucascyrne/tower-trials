/**
 * Service de gerenciamento de personagens
 *
 * ✅ REFATORADO (P1): Service puro - não acessa stores diretamente
 * - Cache interno simplificado (Map em memória)
 * - Hooks gerenciam sincronização com stores
 * - Utils reutilizáveis para conversões
 */

import {
  type Character,
  type CreateCharacterDTO,
  type CharacterStats,
} from '@/models/character.model';
import { supabase } from '@/lib/supabase';
import { type GamePlayer } from '@/models/game.model';
import { CharacterCheckpointService } from '@/services/character-checkpoint.service';
import { CharacterHealingService } from '@/services/character-healing.service';
import { CharacterProgressionService } from '@/services/character-progression.service';
import { CharacterStatsService } from '@/services/character-stats.service';
import { CharacterAttributesService } from '@/services/character-attributes.service';
import { NameValidationService } from '@/services/name-validation.service';
import { convertCharacterToGamePlayer } from '@/utils/character-conversion.utils';
import { validateCharacterNameSimilarity } from '@/utils/character-validation.utils';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Cache interno simples
class SimpleCache {
  private characterCache = new Map<string, Character>();
  private cacheTimestamps = new Map<string, number>();
  private userCharactersCache = new Map<string, Character[]>();
  private userCacheTimestamps = new Map<string, number>();
  private pendingRequests = new Map<string, Promise<ServiceResponse<Character>>>();

  getCachedCharacter(id: string): Character | null {
    return this.characterCache.get(id) || null;
  }

  getCacheTimestamp(id: string): number | null {
    return this.cacheTimestamps.get(id) || null;
  }

  setCachedCharacter(id: string, character: Character): void {
    this.characterCache.set(id, character);
    this.cacheTimestamps.set(id, Date.now());
  }

  invalidateCharacterCache(id: string): void {
    this.characterCache.delete(id);
    this.cacheTimestamps.delete(id);
  }

  getCachedUserCharacters(userId: string): { isValid: boolean; characters: Character[] } {
    const characters = this.userCharactersCache.get(userId);
    const timestamp = this.userCacheTimestamps.get(userId);

    if (!characters || !timestamp) {
      return { isValid: false, characters: [] };
    }

    const isValid = Date.now() - timestamp < 15000; // 15 segundos
    return { isValid, characters };
  }

  setCachedUserCharacters(userId: string, characters: Character[]): void {
    this.userCharactersCache.set(userId, characters);
    this.userCacheTimestamps.set(userId, Date.now());
  }

  invalidateUserCache(userId: string): void {
    this.userCharactersCache.delete(userId);
    this.userCacheTimestamps.delete(userId);
  }

  getPendingRequest(id: string): Promise<ServiceResponse<Character>> | null {
    return this.pendingRequests.get(id) || null;
  }

  setPendingRequest(id: string, request: Promise<ServiceResponse<Character>>): void {
    this.pendingRequests.set(id, request);
    request.finally(() => this.pendingRequests.delete(id));
  }

  clearAll(): void {
    this.characterCache.clear();
    this.cacheTimestamps.clear();
    this.userCharactersCache.clear();
    this.userCacheTimestamps.clear();
    this.pendingRequests.clear();
  }
}

const cache = new SimpleCache();

interface CharacterFullStatsRPC {
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

export class CharacterService {
  /**
   * OTIMIZADO: Buscar todos os personagens do usuário com integração Zustand
   */
  static async getUserCharacters(userId: string): Promise<ServiceResponse<Character[]>> {
    try {
      // Verificar cache interno
      const cachedResult = cache.getCachedUserCharacters(userId);
      if (cachedResult.isValid) {
        return { data: cachedResult.characters, error: null, success: true };
      }

      const { data, error } = await supabase.rpc('get_user_characters', {
        p_user_id: userId,
      });

      if (error) throw error;

      const characters = data as Character[];

      // Atualizar cache interno
      cache.setCachedUserCharacters(userId, characters);

      return { data: characters, error: null, success: true };
    } catch (error) {
      console.error(
        '[CharacterService] Erro ao buscar personagens:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar personagens',
        success: false,
      };
    }
  }

  /**
   * OTIMIZADO: Buscar um personagem específico com integração Zustand
   */
  static async getCharacter(characterId: string): Promise<ServiceResponse<Character>> {
    try {
      // Verificar cache interno
      const cachedCharacter = cache.getCachedCharacter(characterId);
      if (cachedCharacter) {
        return { data: cachedCharacter, error: null, success: true };
      }

      // Verificar se há requisição pendente
      const pendingRequest = cache.getPendingRequest(characterId);
      if (pendingRequest) {
        const result = await pendingRequest;
        return result;
      }

      // Criar nova requisição
      const request = this.fetchCharacterFromServer(characterId);
      cache.setPendingRequest(characterId, request);

      const result = await request;

      // ✅ CORREÇÃO: NÃO modificar store Zustand diretamente
      // O estado será sincronizado pelos hooks apropriados

      return result;
    } catch (error) {
      console.error(
        '[CharacterService] Erro ao buscar personagem:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar personagem',
        success: false,
      };
    }
  }

  /**
   * Buscar personagem do servidor
   * @private
   */
  private static async fetchCharacterFromServer(
    characterId: string
  ): Promise<ServiceResponse<Character>> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao buscar personagem')), 8000);
      });

      // Tentar buscar com a função RPC primeiro (incluindo personagens mortos)
      const rpcPromise = supabase
        .rpc('get_character_full_stats', {
          p_character_id: characterId,
        })
        .single();

      try {
        const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

        if (error) {
          console.warn(`[CharacterService] Erro RPC (tentando fallback):`, error);
          // Se a função RPC falhar, usar fallback com consulta direta
          return await this.fetchCharacterFromServerFallback(characterId);
        }

        if (!data) {
          console.warn(
            `[CharacterService] Nenhum dado retornado pela RPC para ${characterId}, tentando fallback`
          );
          return await this.fetchCharacterFromServerFallback(characterId);
        }

        // Converter dados da função RPC para o formato Character
        if (!data || typeof data !== 'object' || !('character_id' in data)) {
          console.warn(
            `[CharacterService] Dados RPC inválidos para ${characterId}, usando fallback`
          );
          return await this.fetchCharacterFromServerFallback(characterId);
        }
        const character = await this.convertRPCDataToCharacter(
          data as CharacterFullStatsRPC,
          characterId
        );
        cache.setCachedCharacter(characterId, character);

        return { data: character, error: null, success: true };
      } catch (rpcError) {
        console.warn(`[CharacterService] Falha na RPC, usando fallback:`, rpcError);
        return await this.fetchCharacterFromServerFallback(characterId);
      }
    } catch (error) {
      console.error(
        'Erro geral ao buscar personagem do servidor:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar personagem',
        success: false,
      };
    }
  }

  /**
   * Fallback para buscar personagem com consulta direta quando RPC falha
   * @private
   */
  private static async fetchCharacterFromServerFallback(
    characterId: string
  ): Promise<ServiceResponse<Character>> {
    try {
      // Buscar dados básicos da tabela characters
      const { data: charData, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .maybeSingle();

      if (charError) {
        console.error(`[CharacterService] Erro no fallback:`, charError);
        throw charError;
      }

      if (!charData) {
        console.warn(`[CharacterService] Personagem não encontrado no fallback: ${characterId}`);
        return { data: null, error: 'Personagem não encontrado', success: false };
      }

      // Calcular stats derivados se necessário
      const derivedStats = await CharacterStatsService.calculateDerivedStats(charData);

      const character: Character = {
        id: charData.id,
        user_id: charData.user_id,
        name: charData.name,
        level: charData.level,
        xp: charData.xp,
        xp_next_level: charData.xp_next_level,
        gold: charData.gold,
        hp: derivedStats.hp,
        max_hp: derivedStats.max_hp,
        mana: derivedStats.mana,
        max_mana: derivedStats.max_mana,
        atk: derivedStats.atk,
        def: derivedStats.def,
        speed: derivedStats.speed,
        floor: charData.floor,
        strength: charData.strength || 10,
        dexterity: charData.dexterity || 10,
        intelligence: charData.intelligence || 10,
        wisdom: charData.wisdom || 10,
        vitality: charData.vitality || 10,
        luck: charData.luck || 10,
        attribute_points: charData.attribute_points || 0,
        critical_chance: derivedStats.critical_chance,
        critical_damage: derivedStats.critical_damage,
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
        is_alive: true,
        created_at: charData.created_at,
        updated_at: charData.updated_at,
        last_activity: charData.last_activity,
      };

      cache.setCachedCharacter(characterId, character);

      return { data: character, error: null, success: true };
    } catch (error) {
      console.error(
        'Erro no fallback ao buscar personagem:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar personagem',
        success: false,
      };
    }
  }

  /**
   * Converter dados da RPC para formato Character
   * @private
   */
  private static async convertRPCDataToCharacter(
    data: CharacterFullStatsRPC,
    characterId: string
  ): Promise<Character> {
    // ✅ VALIDAÇÃO RIGOROSA - falhar se dados críticos estiverem ausentes
    if (!data.character_id || !data.name || data.level === null || data.level === undefined) {
      throw new Error('RPC retornou dados incompletos do personagem: faltam id, name ou level');
    }

    if (data.level < 1 || data.level > 100) {
      throw new Error(`RPC retornou nível inválido: ${data.level}`);
    }

    const character: Character = {
      id: data.character_id,
      user_id: '',
      name: data.name,
      level: data.level,
      xp: data.xp,
      xp_next_level: data.xp_next_level,
      gold: data.gold,
      hp: data.hp,
      max_hp: data.max_hp,
      mana: data.mana,
      max_mana: data.max_mana,
      atk: data.atk,
      def: data.def,
      speed: data.speed,
      floor: 1,
      strength: data.strength,
      dexterity: data.dexterity,
      intelligence: data.intelligence,
      wisdom: data.wisdom,
      vitality: data.vitality,
      luck: data.luck,
      attribute_points: data.attribute_points || 0,
      critical_chance: data.critical_chance,
      critical_damage: data.critical_damage,
      sword_mastery: data.sword_mastery,
      axe_mastery: data.axe_mastery,
      blunt_mastery: data.blunt_mastery,
      defense_mastery: data.defense_mastery,
      magic_mastery: data.magic_mastery,
      sword_mastery_xp: data.sword_mastery_xp,
      axe_mastery_xp: data.axe_mastery_xp,
      blunt_mastery_xp: data.blunt_mastery_xp,
      defense_mastery_xp: data.defense_mastery_xp,
      magic_mastery_xp: data.magic_mastery_xp,
      is_alive: true,
      created_at: '',
      updated_at: '',
      last_activity: undefined,
    };

    // Buscar dados adicionais da tabela characters
    const { data: basicData, error: basicError } = await supabase
      .from('characters')
      .select('user_id, floor, created_at, updated_at, last_activity')
      .eq('id', character.id)
      .maybeSingle();

    if (basicError) {
      throw new Error(`Erro ao buscar dados adicionais do personagem: ${basicError.message}`);
    }

    if (!basicData) {
      throw new Error(`Personagem ${character.id} não encontrado na tabela characters`);
    }

    character.user_id = basicData.user_id;
    character.floor = Math.max(1, basicData.floor || 1);
    character.created_at = basicData.created_at;
    character.updated_at = basicData.updated_at;
    character.last_activity = basicData.last_activity;

    cache.setCachedCharacter(characterId, character);

    return character;
  }

  /**
   * Criar um novo personagem
   *
   * ✅ REFATORADO (P1): Service puro - validação via util, sem acesso a stores
   */
  static async createCharacter(
    data: CreateCharacterDTO
  ): Promise<ServiceResponse<{ id: string; progressionUpdated?: boolean }>> {
    try {
      // Validar nome no frontend
      const nameValidation = NameValidationService.validateCharacterName(data.name);
      if (!nameValidation.isValid) {
        return {
          data: null,
          error: nameValidation.error || 'Nome inválido',
          success: false,
        };
      }

      // Verificar limite antes de tentar criar
      const limitInfo = await CharacterProgressionService.checkCharacterLimit(data.user_id);
      if (!limitInfo.success || !limitInfo.data?.can_create) {
        const nextSlotLevel = limitInfo.data?.next_slot_required_level || 0;
        const currentSlots = limitInfo.data?.available_slots || 3;

        return {
          data: null,
          error: `Limite de personagens atingido. Para criar o ${currentSlots + 1}º personagem, você precisa de ${nextSlotLevel} níveis totais entre todos os seus personagens.`,
          success: false,
        };
      }

      const formattedName = NameValidationService.formatCharacterName(data.name);

      // Verificar nome similar usando util puro
      const similarityValidation = await validateCharacterNameSimilarity(
        formattedName,
        data.user_id
      );
      if (!similarityValidation.isValid) {
        return {
          data: null,
          error: similarityValidation.error || 'Nome inválido',
          success: false,
        };
      }

      // Criar personagem
      const { data: result, error } = await supabase.rpc('create_character', {
        p_user_id: data.user_id,
        p_name: formattedName,
      });

      if (error) {
        if (error.message.includes('Nome')) {
          return { data: null, error: error.message, success: false };
        }
        if (error.message.includes('Limite') || error.message.includes('personagem')) {
          return { data: null, error: error.message, success: false };
        }
        throw error;
      }

      // Invalidar caches
      cache.invalidateUserCache(data.user_id);
      return { data: { id: result }, error: null, success: true };
    } catch (error) {
      console.error(
        '[CharacterService] Erro ao criar personagem:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao criar personagem',
        success: false,
      };
    }
  }

  /**
   * OTIMIZADO: Marcar personagem como morto (Permadeath) sem deletar
   * O personagem persiste para exibição no cemitério e ranking
   */
  static async markCharacterDead(characterId: string): Promise<{ error: string | null }> {
    try {
      const character = await this.getCharacter(characterId);
      let userId: string | null = null;

      if (character.success && character.data) {
        userId = character.data.user_id;

        // Marcar como morto e salvar no ranking via função RPC
        const { error: deathError } = await supabase.rpc('mark_character_dead', {
          p_character_id: characterId,
        });

        if (deathError) {
          console.error('[CharacterService] Erro ao marcar personagem como morto:', deathError);
          throw deathError;
        }

        console.log(`[CharacterService] Personagem ${characterId} marcado como morto`);
      }

      // Invalidar caches
      cache.invalidateCharacterCache(characterId);

      if (userId) {
        cache.invalidateUserCache(userId);
      }

      return { error: null };
    } catch (error) {
      console.error(
        '[CharacterService] Erro ao marcar personagem como morto:',
        error instanceof Error ? error.message : error
      );
      return {
        error: error instanceof Error ? error.message : 'Erro ao marcar personagem como morto',
      };
    }
  }

  /**
   * Obter stats completos do personagem incluindo bônus de equipamentos
   */
  static async getCharacterStats(characterId: string): Promise<ServiceResponse<CharacterStats>> {
    try {
      const gamePlayerResponse = await this.getCharacterForGame(characterId);

      if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
        return {
          success: false,
          error: gamePlayerResponse.error || 'Erro ao carregar dados do personagem',
          data: null,
        };
      }

      const gamePlayer = gamePlayerResponse.data;

      // Converter GamePlayer para CharacterStats
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

        // Stats derivados
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

        // Stats base
        base_hp: gamePlayer.base_hp || gamePlayer.base_max_hp,
        base_max_hp: gamePlayer.base_max_hp,
        base_mana: gamePlayer.base_mana || gamePlayer.base_max_mana,
        base_max_mana: gamePlayer.base_max_mana,
        base_atk: gamePlayer.base_atk,
        base_def: gamePlayer.base_def,
        base_speed: gamePlayer.base_speed,

        // Bônus de equipamentos
        equipment_hp_bonus: gamePlayer.equipment_hp_bonus || 0,
        equipment_mana_bonus: gamePlayer.equipment_mana_bonus || 0,
        equipment_atk_bonus: gamePlayer.equipment_atk_bonus || 0,
        equipment_def_bonus: gamePlayer.equipment_def_bonus || 0,
        equipment_speed_bonus: gamePlayer.equipment_speed_bonus || 0,
      };

      return { success: true, error: null, data: characterStats };
    } catch (error) {
      console.error('Erro ao buscar stats do personagem:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null,
      };
    }
  }

  /**
   * Obter personagem com stats detalhados para o jogo
   *
   * ✅ REFATORADO (P1): Service puro - sem acesso a stores
   * - Cache simplificado: apenas service cache + banco
   * - Conversão delegada para util reutilizável
   * - ~600 linhas removidas (código duplicado + cache complexo)
   */
  static async getCharacterForGame(
    characterId: string,
    forceRefresh: boolean = false,
    applyAutoHeal: boolean = true
  ): Promise<ServiceResponse<GamePlayer>> {
    try {
      // 1. Verificar cache do serviço (se não forceRefresh)
      if (!forceRefresh) {
        const cachedCharacter = cache.getCachedCharacter(characterId);
        const cacheTimestamp = cache.getCacheTimestamp(characterId);

        if (cachedCharacter && cacheTimestamp && Date.now() - cacheTimestamp < 5 * 60 * 1000) {
          // Converter usando util (com recálculo de equipamentos)
          const gamePlayer = await convertCharacterToGamePlayer(cachedCharacter, characterId);
          return { success: true, error: null, data: gamePlayer };
        }
      }

      // 2. Buscar do banco
      const { data: charData, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .maybeSingle();

      if (charError) throw charError;

      if (!charData) {
        return {
          success: false,
          error: 'Personagem não encontrado',
          data: null,
        };
      }

      // 3. Aplicar auto-heal se necessário (ANTES de converter)
      if (applyAutoHeal) {
        try {
          const healResult = await CharacterHealingService.applyAutoHeal(charData, true);

          if (healResult.success && healResult.data && healResult.data.healed) {
            // Atualizar dados do personagem com HP/Mana curados
            charData.hp = healResult.data.newHp;
            charData.mana = healResult.data.character.mana;

            // Cache será atualizado no final
            cache.invalidateCharacterCache(characterId);
          }
        } catch (healError) {
          console.warn(`[CharacterService] Erro no auto-heal (não crítico):`, healError);
        }
      }

      // 4. Converter Character → GamePlayer usando util
      const gamePlayer = await convertCharacterToGamePlayer(charData, characterId);

      // 5. Atualizar cache com os novos dados
      const characterForCache: Character = {
        ...charData,
        hp: gamePlayer.hp,
        max_hp: gamePlayer.max_hp,
        mana: gamePlayer.mana,
        max_mana: gamePlayer.max_mana,
        atk: gamePlayer.base_atk,
        def: gamePlayer.base_def,
        speed: gamePlayer.base_speed,
        critical_chance: gamePlayer.critical_chance,
        critical_damage: gamePlayer.critical_damage,
      };

      cache.setCachedCharacter(characterId, characterForCache);
      return { success: true, error: null, data: gamePlayer };
    } catch (error) {
      console.error('[CharacterService] Erro ao buscar personagem para o jogo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null,
      };
    }
  }

  /**
   * ✅ CORREÇÃO: Invalidar cache específico de um personagem para garantir dados atualizados
   */
  static invalidateCharacterCache(characterId: string): void {
    cache.invalidateCharacterCache(characterId);
  }

  /**
   * ✅ NOVO: Método utilitário para forçar cura completa no hub (debug)
   */
  static async debugForceFullHeal(
    characterId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Buscar personagem atual
      const charResult = await this.getCharacter(characterId);
      if (!charResult.success || !charResult.data) {
        return { success: false, message: 'Personagem não encontrado' };
      }

      const character = charResult.data;

      // Forçar cura via direct update
      const updateResult = await CharacterHealingService.updateCharacterHpMana(
        characterId,
        character.max_hp,
        character.max_mana
      );

      if (!updateResult.success) {
        return { success: false, message: updateResult.error || 'Erro ao atualizar HP/Mana' };
      }

      // Invalidar cache
      this.invalidateCharacterCache(characterId);
      return {
        success: true,
        message: `Cura forçada aplicada: ${character.hp} -> ${character.max_hp} HP, ${character.mana} -> ${character.max_mana} Mana`,
      };
    } catch (error) {
      console.error('[CharacterService] 🔧 DEBUG: Erro na cura forçada:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  // Métodos delegados para os serviços especializados
  static getUnlockedCheckpoints = CharacterCheckpointService.getUnlockedCheckpoints;
  static startFromCheckpoint = CharacterCheckpointService.startFromCheckpoint;
  static resetCharacterProgress = CharacterCheckpointService.resetCharacterProgress;
  static updateCharacterFloor = CharacterCheckpointService.updateCharacterFloor;
  static updateCharacterHpMana = CharacterHealingService.updateCharacterHpMana;
  static applyAutoHeal = CharacterHealingService.applyAutoHeal;
  static forceFullHealForHub = CharacterHealingService.forceFullHealForHub;
  static updateLastActivity = CharacterHealingService.updateLastActivity;
  static getUserCharacterProgression = CharacterProgressionService.getUserCharacterProgression;
  static checkCharacterLimit = CharacterProgressionService.checkCharacterLimit;
  static grantSecureXP = CharacterProgressionService.grantSecureXP;
  static grantSecureGold = CharacterProgressionService.grantSecureGold;
  static addSkillXp = CharacterProgressionService.addSkillXp;
  static updateGold = CharacterProgressionService.updateGold;
  static calculateDerivedStats = CharacterStatsService.calculateDerivedStats;
  static distributeAttributePoints = CharacterAttributesService.distributeAttributePoints;
  static recalculateCharacterStats = CharacterAttributesService.recalculateCharacterStats;
}
