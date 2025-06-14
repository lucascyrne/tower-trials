import { type Character, type CreateCharacterDTO, type CharacterStats } from './character.model';
import { supabase } from '@/lib/supabase';
import { type GamePlayer } from './game-model';
import { CharacterCacheService } from './character-cache.service';
import { CharacterCheckpointService } from './character-checkpoint.service';
import { CharacterHealingService } from './character-healing.service';
import { CharacterProgressionService } from './character-progression.service';
import { CharacterStatsService } from './character-stats.service';
import { CharacterAttributesService } from './character-attributes.service';
import { NameValidationService } from './name-validation.service';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

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
   * Buscar todos os personagens do usuário
   */
  static async getUserCharacters(userId: string): Promise<ServiceResponse<Character[]>> {
    try {
      // Verificar cache primeiro
      const cachedResult = CharacterCacheService.getCachedUserCharacters(userId);
      if (cachedResult.isValid) {
        return { data: cachedResult.characters, error: null, success: true };
      }

      const { data, error } = await supabase.rpc('get_user_characters', {
        p_user_id: userId,
      });

      if (error) throw error;

      CharacterCacheService.setCachedUserCharacters(userId, data as Character[]);

      return { data: data as Character[], error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar personagens:', error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar personagens',
        success: false,
      };
    }
  }

  /**
   * Buscar um personagem específico
   */
  static async getCharacter(characterId: string): Promise<ServiceResponse<Character>> {
    try {
      // Verificar cache primeiro
      const cachedCharacter = CharacterCacheService.getCachedCharacter(characterId);
      if (cachedCharacter) {
        return { data: cachedCharacter, error: null, success: true };
      }

      // Verificar se há requisição pendente
      const pendingRequest = CharacterCacheService.getPendingRequest(characterId);
      if (pendingRequest) {
        console.log(`[CharacterService] Reutilizando requisição pendente para ${characterId}`);
        return pendingRequest;
      }

      // Criar nova requisição
      const request = this.fetchCharacterFromServer(characterId);
      CharacterCacheService.setPendingRequest(characterId, request);

      const result = await request;

      return result;
    } catch (error) {
      console.error('Erro ao buscar personagem:', error instanceof Error ? error.message : error);
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
      console.log(`[CharacterService] Buscando personagem ${characterId} do servidor`);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao buscar personagem')), 8000);
      });

      const rpcPromise = supabase
        .rpc('get_character_full_stats', {
          p_character_id: characterId,
        })
        .single();

      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

      if (error) {
        console.error(`[CharacterService] Erro RPC:`, error);
        throw error;
      }

      if (!data) {
        console.warn(`[CharacterService] Nenhum dado retornado para ${characterId}`);
        return { data: null, error: 'Personagem não encontrado', success: false };
      }

      // Converter dados da função RPC para o formato Character
      const fullStatsData = data as CharacterFullStatsRPC;
      const character: Character = {
        id: fullStatsData.character_id,
        user_id: '',
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
        floor: 1,
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
        is_alive: true,
        created_at: '',
        updated_at: '',
        last_activity: undefined,
      };

      // Buscar dados básicos adicionais
      const { data: basicData, error: basicError } = await supabase
        .from('characters')
        .select('user_id, floor, created_at, updated_at, last_activity')
        .eq('id', character.id)
        .maybeSingle();

      if (!basicError && basicData) {
        character.user_id = basicData.user_id;
        character.floor = basicData.floor;
        character.created_at = basicData.created_at;
        character.updated_at = basicData.updated_at;
        character.last_activity = basicData.last_activity;
      } else if (basicError) {
        console.warn(`[CharacterService] Aviso ao buscar dados básicos: ${basicError.message}`);
      }

      console.log(
        `[CharacterService] Personagem carregado: ${character.name} (andar: ${character.floor})`
      );
      CharacterCacheService.setCachedCharacter(characterId, character);

      return { data: character, error: null, success: true };
    } catch (error) {
      console.error(
        'Erro ao buscar personagem do servidor:',
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
   * Criar um novo personagem
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

      // Verificar nome similar
      const existingCharacters = await this.getUserCharacters(data.user_id);
      if (
        existingCharacters.success &&
        existingCharacters.data &&
        existingCharacters.data.length > 0
      ) {
        const existingNames = existingCharacters.data.map(c => c.name);
        if (NameValidationService.isTooSimilar(formattedName, existingNames)) {
          const suggestions = NameValidationService.generateNameSuggestions(formattedName);
          return {
            data: null,
            error: `Nome muito similar a um personagem existente. Sugestões: ${suggestions.join(', ')}`,
            success: false,
          };
        }
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

      CharacterCacheService.invalidateUserCache(data.user_id);

      return { data: { id: result }, error: null, success: true };
    } catch (error) {
      console.error('Erro ao criar personagem:', error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao criar personagem',
        success: false,
      };
    }
  }

  /**
   * Deletar um personagem
   */
  static async deleteCharacter(characterId: string): Promise<{ error: string | null }> {
    try {
      const character = await this.getCharacter(characterId);

      // Salvar no ranking histórico se tem progresso
      if (character.success && character.data && character.data.floor > 0) {
        console.log(`[CharacterService] Salvando ${character.data.name} no ranking histórico`);

        try {
          const { error: rankingError } = await supabase.rpc('save_ranking_entry_on_death', {
            p_character_id: characterId,
          });

          if (rankingError) {
            console.error('Erro ao salvar no ranking histórico:', rankingError);
          } else {
            console.log(
              `[CharacterService] Personagem ${character.data.name} salvo no ranking histórico`
            );
          }
        } catch (rankingError) {
          console.error('Erro ao salvar no ranking histórico:', rankingError);
        }
      }

      // Deletar personagem
      const { error } = await supabase.rpc('delete_character', {
        p_character_id: characterId,
      });

      if (error) throw error;

      CharacterCacheService.invalidateCharacterCache(characterId);

      if (character.success && character.data) {
        CharacterCacheService.invalidateUserCache(character.data.user_id);
      }

      console.log(`[CharacterService] Personagem deletado: ${characterId}`);
      return { error: null };
    } catch (error) {
      console.error('Erro ao deletar personagem:', error instanceof Error ? error.message : error);
      return { error: error instanceof Error ? error.message : 'Erro ao deletar personagem' };
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
   * Obter personagem com stats detalhados para o jogo usando novo sistema
   * OTIMIZADO: Evita requisições desnecessárias quando dados estão disponíveis
   */
  static async getCharacterForGame(
    characterId: string,
    forceRefresh: boolean = false
  ): Promise<ServiceResponse<GamePlayer>> {
    try {
      console.log(
        `[CharacterService] getCharacterForGame solicitado para: ${characterId}${forceRefresh ? ' (forçar atualização)' : ''}`
      );

      // OTIMIZADO: Verificar cache primeiro para evitar requisições desnecessárias
      if (!forceRefresh) {
        const cachedCharacter = CharacterCacheService.getCachedCharacter(characterId);
        if (cachedCharacter) {
          console.log(
            `[CharacterService] Reutilizando dados em cache para: ${cachedCharacter.name}`
          );

          // Verificar se o cache é recente (menos de 5 minutos)
          const cacheAge = Date.now() - (CharacterCacheService.getCacheTimestamp(characterId) || 0);
          const maxCacheAge = 5 * 60 * 1000; // 5 minutos

          if (cacheAge < maxCacheAge) {
            // Converter Character para GamePlayer usando dados em cache
            const gamePlayer: GamePlayer = {
              id: cachedCharacter.id,
              user_id: cachedCharacter.user_id,
              name: cachedCharacter.name,
              level: cachedCharacter.level,
              xp: cachedCharacter.xp,
              xp_next_level: cachedCharacter.xp_next_level,
              gold: cachedCharacter.gold,
              hp: cachedCharacter.hp,
              max_hp: cachedCharacter.max_hp,
              mana: cachedCharacter.mana,
              max_mana: cachedCharacter.max_mana,
              atk: cachedCharacter.atk,
              def: cachedCharacter.def,
              speed: cachedCharacter.speed,
              created_at: cachedCharacter.created_at,
              updated_at: cachedCharacter.updated_at,
              isPlayerTurn: true,
              specialCooldown: 0,
              defenseCooldown: 0,
              isDefending: false,
              floor: cachedCharacter.floor,
              spells: [], // Será carregado separadamente se necessário
              consumables: [],
              active_effects: {
                buffs: [],
                debuffs: [],
                dots: [],
                hots: [],
                attribute_modifications: [],
              },

              // Atributos primários
              strength: cachedCharacter.strength || 10,
              dexterity: cachedCharacter.dexterity || 10,
              intelligence: cachedCharacter.intelligence || 10,
              wisdom: cachedCharacter.wisdom || 10,
              vitality: cachedCharacter.vitality || 10,
              luck: cachedCharacter.luck || 10,
              attribute_points: cachedCharacter.attribute_points || 0,

              // Habilidades
              sword_mastery: cachedCharacter.sword_mastery || 1,
              axe_mastery: cachedCharacter.axe_mastery || 1,
              blunt_mastery: cachedCharacter.blunt_mastery || 1,
              defense_mastery: cachedCharacter.defense_mastery || 1,
              magic_mastery: cachedCharacter.magic_mastery || 1,

              sword_mastery_xp: cachedCharacter.sword_mastery_xp || 0,
              axe_mastery_xp: cachedCharacter.axe_mastery_xp || 0,
              blunt_mastery_xp: cachedCharacter.blunt_mastery_xp || 0,
              defense_mastery_xp: cachedCharacter.defense_mastery_xp || 0,
              magic_mastery_xp: cachedCharacter.magic_mastery_xp || 0,

              // Stats derivados calculados
              critical_chance: cachedCharacter.critical_chance || 0,
              critical_damage: cachedCharacter.critical_damage || 0,
              magic_damage_bonus: 0,
              magic_attack: 0,
              double_attack_chance: 0,

              // Stats base para exibição
              base_hp: cachedCharacter.hp,
              base_max_hp: cachedCharacter.max_hp,
              base_mana: cachedCharacter.mana,
              base_max_mana: cachedCharacter.max_mana,
              base_atk: cachedCharacter.atk,
              base_def: cachedCharacter.def,
              base_speed: cachedCharacter.speed,

              // Bônus de equipamentos para exibição
              equipment_hp_bonus: 0,
              equipment_mana_bonus: 0,
              equipment_atk_bonus: 0,
              equipment_def_bonus: 0,
              equipment_speed_bonus: 0,
            };

            // Carregar magias equipadas de forma assíncrona apenas se necessário
            try {
              const spellsResponse = await import('./spell.service').then(m =>
                m.SpellService.getCharacterEquippedSpells(characterId)
              );
              gamePlayer.spells =
                spellsResponse.success && spellsResponse.data ? spellsResponse.data : [];
            } catch (spellError) {
              console.warn('[CharacterService] Erro ao carregar magias (não crítico):', spellError);
              gamePlayer.spells = [];
            }

            console.log(
              `[CharacterService] GamePlayer criado a partir do cache (${Math.round(cacheAge / 1000)}s atrás) para: ${gamePlayer.name}`
            );
            return { success: true, error: null, data: gamePlayer };
          } else {
            console.log(
              `[CharacterService] Cache expirado (${Math.round(cacheAge / 1000)}s) - buscando dados atualizados`
            );
          }
        }
      }

      // FALLBACK: Buscar dados básicos apenas se não estiver em cache ou cache expirado
      console.log(
        `[CharacterService] Cache miss ou expirado - buscando dados do banco para: ${characterId}`
      );

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

      // Calcular stats derivados apenas se necessário
      const derivedStats = await CharacterStatsService.calculateDerivedStats(charData);

      // Carregar magias equipadas
      const spellsResponse = await import('./spell.service').then(m =>
        m.SpellService.getCharacterEquippedSpells(characterId)
      );
      const equippedSpells =
        spellsResponse.success && spellsResponse.data ? spellsResponse.data : [];

      const gamePlayer: GamePlayer = {
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
          attribute_modifications: [],
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
        critical_chance: derivedStats.critical_chance,
        critical_damage: derivedStats.critical_damage,
        magic_damage_bonus: derivedStats.magic_damage_bonus,
        magic_attack: derivedStats.magic_attack,
        double_attack_chance: derivedStats.double_attack_chance,

        // Stats base para exibição
        base_hp: derivedStats.hp,
        base_max_hp: derivedStats.max_hp,
        base_mana: derivedStats.mana,
        base_max_mana: derivedStats.max_mana,
        base_atk: derivedStats.atk,
        base_def: derivedStats.def,
        base_speed: derivedStats.speed,

        // Bônus de equipamentos para exibição
        equipment_hp_bonus: 0,
        equipment_mana_bonus: 0,
        equipment_atk_bonus: 0,
        equipment_def_bonus: 0,
        equipment_speed_bonus: 0,
      };

      // IMPORTANTE: Atualizar cache com os novos dados
      const characterForCache: Character = {
        ...charData,
        hp: derivedStats.hp,
        max_hp: derivedStats.max_hp,
        mana: derivedStats.mana,
        max_mana: derivedStats.max_mana,
        atk: derivedStats.atk,
        def: derivedStats.def,
        speed: derivedStats.speed,
        critical_chance: derivedStats.critical_chance,
        critical_damage: derivedStats.critical_damage,
      };
      CharacterCacheService.setCachedCharacter(characterId, characterForCache);

      console.log(
        `[CharacterService] GamePlayer criado a partir do banco para: ${gamePlayer.name}`
      );
      return { success: true, error: null, data: gamePlayer };
    } catch (error) {
      console.error('Erro ao buscar personagem para o jogo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null,
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
  static updateLastActivity = CharacterHealingService.updateLastActivity;
  static getUserCharacterProgression = CharacterProgressionService.getUserCharacterProgression;
  static checkCharacterLimit = CharacterProgressionService.checkCharacterLimit;
  static grantSecureXP = CharacterProgressionService.grantSecureXP;
  static grantSecureGold = CharacterProgressionService.grantSecureGold;
  static addSkillXp = CharacterProgressionService.addSkillXp;
  static updateGold = CharacterProgressionService.updateGold;
  static calculateDerivedStats = CharacterStatsService.calculateDerivedStats;
  static analyzeBuildDiversity = CharacterStatsService.analyzeBuildDiversity;
  static distributeAttributePoints = CharacterAttributesService.distributeAttributePoints;
  static recalculateCharacterStats = CharacterAttributesService.recalculateCharacterStats;
}
