import {
  type Character,
  type CreateCharacterDTO,
  type CharacterStats,
} from '../models/character.model';
import { supabase } from '@/lib/supabase';
import { type GamePlayer } from '../game-model';
import { CharacterCacheService } from './character-cache.service';
import { CharacterCheckpointService } from './character-checkpoint.service';
import { CharacterHealingService } from './character-healing.service';
import { CharacterProgressionService } from './character-progression.service';
import { CharacterStatsService } from './character-stats.service';
import { CharacterAttributesService } from './character-attributes.service';
import { NameValidationService } from '../name-validation.service';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
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

      // Atualizar cache
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

      // Verificar se já existe uma requisição pendente
      const pendingRequest = CharacterCacheService.getPendingRequest(characterId);
      if (pendingRequest) {
        console.log(
          `[CharacterService] Reutilizando requisição pendente para personagem ${characterId}`
        );
        return pendingRequest;
      }

      // Criar nova requisição
      const request = this.fetchCharacterFromServer(characterId);
      CharacterCacheService.setPendingRequest(characterId, request);

      const result = await request;

      // Aplicar cura automática se o personagem foi carregado com sucesso
      if (result.success && result.data) {
        console.log(`[CharacterService] Aplicando cura automática para ${result.data.name}`);
        const healResult = await CharacterHealingService.applyAutoHeal(characterId);

        if (healResult.success && healResult.data && healResult.data.healed) {
          console.log(
            `[CharacterService] ${result.data.name} curado: ${healResult.data.oldHp} -> ${healResult.data.newHp} HP`
          );
          return { data: healResult.data.character, error: null, success: true };
        }
      }

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
      const { data, error } = await supabase
        .rpc('get_character_full_stats', {
          p_character_id: characterId,
        })
        .single();

      if (error) throw error;

      if (!data) {
        return { data: null, error: 'Personagem não encontrado', success: false };
      }

      // Converter os dados da função RPC para o formato Character
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fullStatsData = data as any;
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

      // Buscar dados adicionais que não estão na função get_character_full_stats
      const { data: basicData, error: basicError } = await supabase
        .rpc('get_character', {
          p_character_id: character.id,
        })
        .single();

      if (!basicError && basicData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const basicCharacterData = basicData as any;
        character.user_id = basicCharacterData.user_id;
        character.floor = basicCharacterData.floor;
        character.created_at = basicCharacterData.created_at;
        character.updated_at = basicCharacterData.updated_at;
        character.last_activity = basicCharacterData.last_activity;
      }

      console.log(
        `[CharacterService] Personagem carregado do servidor: ${character.name} (andar: ${character.floor})`
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
      // Validar nome do personagem no frontend primeiro
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

      // Formatar nome corretamente
      const formattedName = NameValidationService.formatCharacterName(data.name);

      // Verificar se o usuário já tem personagem com nome similar
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

      // Criar novo personagem usando a função RPC com nome formatado
      const { data: result, error } = await supabase.rpc('create_character', {
        p_user_id: data.user_id,
        p_name: formattedName,
      });

      if (error) {
        // Tratar erros específicos de validação do banco
        if (error.message.includes('Nome')) {
          return { data: null, error: error.message, success: false };
        }
        if (error.message.includes('Limite') || error.message.includes('personagem')) {
          return { data: null, error: error.message, success: false };
        }
        throw error;
      }

      // Limpar cache do usuário para forçar atualização
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
      // Obter dados do personagem antes de deletar para invalidar cache do usuário
      const character = await this.getCharacter(characterId);

      // Se o personagem existe e tem progresso, salvar no ranking histórico primeiro
      if (character.success && character.data && character.data.floor > 0) {
        console.log(
          `[CharacterService] Salvando personagem ${character.data.name} no ranking histórico antes de deletar`
        );

        try {
          // Usar a nova função para salvar no ranking histórico
          const { error: rankingError } = await supabase.rpc('save_ranking_entry_on_death', {
            p_character_id: characterId,
          });

          if (rankingError) {
            console.error('Erro ao salvar no ranking histórico:', rankingError);
            // Continua com a deleção mesmo se falhar o ranking
          } else {
            console.log(
              `[CharacterService] Personagem ${character.data.name} salvo no ranking histórico com sucesso`
            );
          }
        } catch (rankingError) {
          console.error('Erro ao salvar no ranking histórico:', rankingError);
          // Continua com a deleção mesmo se falhar o ranking
        }
      }

      // Deletar o personagem usando a função RPC do banco
      const { error } = await supabase.rpc('delete_character', {
        p_character_id: characterId,
      });

      if (error) throw error;

      // Invalidar cache do personagem deletado
      CharacterCacheService.invalidateCharacterCache(characterId);

      // Invalidar cache do usuário para atualizar progressão
      if (character.success && character.data) {
        CharacterCacheService.invalidateUserCache(character.data.user_id);
      }

      console.log(`[CharacterService] Personagem deletado com sucesso: ${characterId}`);
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
      // CRÍTICO: Usar a mesma fonte de dados que getCharacterForGame para garantir consistência
      const gamePlayerResponse = await this.getCharacterForGame(characterId);

      if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
        return {
          success: false,
          error: gamePlayerResponse.error || 'Erro ao carregar dados do personagem',
          data: null,
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
          data: null,
        };
      }

      // Calcular stats derivados usando o CharacterStatsService
      const derivedStats = await CharacterStatsService.calculateDerivedStats(charData);

      // Carregar magias equipadas do personagem
      const spellsResponse = await import('../spell.service').then(m =>
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
        equipment_hp_bonus: 0, // Será calculado pelo CharacterStatsService
        equipment_mana_bonus: 0,
        equipment_atk_bonus: 0,
        equipment_def_bonus: 0,
        equipment_speed_bonus: 0,
      };

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
