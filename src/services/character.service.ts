import { useCharacterStore } from '../stores/useCharacterStore';
import {
  type Character,
  type CreateCharacterDTO,
  type CharacterStats,
} from '@/models/character.model';
import { supabase } from '@/lib/supabase';
import { type GamePlayer } from '@/models/game.model';
import { CharacterCacheService } from '@/services/character-cache.service';
import { CharacterCheckpointService } from '@/services/character-checkpoint.service';
import { CharacterHealingService } from '@/services/character-healing.service';
import { CharacterProgressionService } from '@/services/character-progression.service';
import { CharacterStatsService } from '@/services/character-stats.service';
import { CharacterAttributesService } from '@/services/character-attributes.service';
import { NameValidationService } from '@/services/name-validation.service';
import { useGameStateStore } from '@/stores/useGameStateStore';

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
   * OTIMIZADO: Buscar todos os personagens do usuário com integração Zustand
   */
  static async getUserCharacters(userId: string): Promise<ServiceResponse<Character[]>> {
    try {
      console.log('[CharacterService] Buscando personagens para usuário:', userId);

      // Verificar cache do serviço
      const cachedResult = CharacterCacheService.getCachedUserCharacters(userId);
      if (cachedResult.isValid) {
        console.log('[CharacterService] Usando cache do serviço');
        // NÃO modificar store diretamente - ela será atualizada pelo hook useCharacterWithAuth
        return { data: cachedResult.characters, error: null, success: true };
      }

      const { data, error } = await supabase.rpc('get_user_characters', {
        p_user_id: userId,
      });

      if (error) throw error;

      const characters = data as Character[];

      // Atualizar cache do serviço
      CharacterCacheService.setCachedUserCharacters(userId, characters);

      // ✅ CORREÇÃO: NÃO modificar estado do Zustand diretamente
      // O hook useCharacterWithAuth é responsável por manter o estado sincronizado
      console.log(
        `[CharacterService] ${characters.length} personagens carregados (sem mutação direta do store)`
      );

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
      console.log('[CharacterService] Buscando personagem:', characterId);

      // Verificar cache do serviço
      const cachedCharacter = CharacterCacheService.getCachedCharacter(characterId);
      if (cachedCharacter) {
        console.log('[CharacterService] Usando cache do serviço');
        // ✅ CORREÇÃO: NÃO modificar store diretamente
        return { data: cachedCharacter, error: null, success: true };
      }

      // Verificar se há requisição pendente
      const pendingRequest = CharacterCacheService.getPendingRequest(characterId);
      if (pendingRequest) {
        console.log(`[CharacterService] Reutilizando requisição pendente para ${characterId}`);
        const result = await pendingRequest;

        // ✅ CORREÇÃO: NÃO modificar store diretamente - o hook gerencia isso
        return result;
      }

      // Criar nova requisição
      const request = this.fetchCharacterFromServer(characterId);
      CharacterCacheService.setPendingRequest(characterId, request);

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
      console.log(`[CharacterService] Buscando personagem ${characterId} do servidor`);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao buscar personagem')), 8000);
      });

      // Tentar buscar com a função RPC primeiro (incluindo personagens mortos)
      const rpcPromise = supabase
        .rpc('get_character_full_stats_any_status', {
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
        console.log(
          `[CharacterService] Personagem carregado via RPC: ${character.name} (andar: ${character.floor})`
        );
        CharacterCacheService.setCachedCharacter(characterId, character);

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
      console.log(`[CharacterService] Usando fallback para buscar personagem ${characterId}`);

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

      console.log(
        `[CharacterService] Personagem carregado via fallback: ${character.name} (andar: ${character.floor})`
      );
      CharacterCacheService.setCachedCharacter(characterId, character);

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
    // Converter dados da função RPC para o formato Character
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

    // Buscar dados básicos adicionais
    const { data: basicData, error: basicError } = await supabase
      .from('characters')
      .select('user_id, floor, created_at, updated_at, last_activity')
      .eq('id', character.id)
      .maybeSingle();

    if (!basicError && basicData) {
      character.user_id = basicData.user_id;
      character.floor = Math.max(1, basicData.floor || 1);
      character.created_at = basicData.created_at;
      character.updated_at = basicData.updated_at;
      character.last_activity = basicData.last_activity;
    } else if (basicError) {
      console.warn(`[CharacterService] Aviso ao buscar dados básicos: ${basicError.message}`);
      character.floor = 1;
    }

    console.log(
      `[CharacterService] Personagem carregado: ${character.name} (andar: ${character.floor})`
    );
    CharacterCacheService.setCachedCharacter(characterId, character);

    return character;
  }

  /**
   * OTIMIZADO: Criar um novo personagem com integração Zustand
   */
  static async createCharacter(
    data: CreateCharacterDTO
  ): Promise<ServiceResponse<{ id: string; progressionUpdated?: boolean }>> {
    try {
      console.log('[CharacterService] Criando personagem:', data.name);

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

      // Verificar nome similar usando dados da store primeiro
      const store = useCharacterStore.getState();
      let existingCharacters: Character[] = [];

      if (store.currentUserId === data.user_id && store.hasLoadedCharacters) {
        existingCharacters = store.characters;
      } else {
        const existingResponse = await this.getUserCharacters(data.user_id);
        existingCharacters =
          existingResponse.success && existingResponse.data ? existingResponse.data : [];
      }

      if (existingCharacters.length > 0) {
        const existingNames = existingCharacters.map(c => c.name);
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

      // Invalidar caches
      CharacterCacheService.invalidateUserCache(data.user_id);

      // ✅ CORREÇÃO: NÃO forçar recarregamento direto no store
      // O hook useCharacterWithAuth detectará a mudança e recarregará automaticamente

      console.log('[CharacterService] Personagem criado com sucesso:', result);
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
   * OTIMIZADO: Deletar um personagem com integração Zustand
   */
  static async deleteCharacter(characterId: string): Promise<{ error: string | null }> {
    try {
      console.log('[CharacterService] Deletando personagem:', characterId);

      const character = await this.getCharacter(characterId);
      let userId: string | null = null;

      // Salvar no ranking histórico se tem progresso
      if (character.success && character.data && character.data.floor > 0) {
        userId = character.data.user_id;
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

      // Invalidar caches
      CharacterCacheService.invalidateCharacterCache(characterId);

      if (userId) {
        CharacterCacheService.invalidateUserCache(userId);

        // ✅ CORREÇÃO: NÃO modificar store Zustand diretamente
        // Os hooks detectarão a mudança nos dados e atualizarão automaticamente
      }

      console.log(`[CharacterService] Personagem deletado: ${characterId}`);
      return { error: null };
    } catch (error) {
      console.error(
        '[CharacterService] Erro ao deletar personagem:',
        error instanceof Error ? error.message : error
      );
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
   * OTIMIZADO: Obter personagem com stats detalhados para o jogo com integração Zustand
   * ✅ CORREÇÃO: Garantir auto-heal consistente para fonte única de verdade do HP
   */
  static async getCharacterForGame(
    characterId: string,
    forceRefresh: boolean = false,
    applyAutoHeal: boolean = true
  ): Promise<ServiceResponse<GamePlayer>> {
    try {
      console.log(
        `[CharacterService] getCharacterForGame solicitado para: ${characterId}${forceRefresh ? ' (forçar atualização)' : ''}`
      );

      // ✅ CORREÇÃO: Verificar store Zustand primeiro se não for refresh forçado
      // Mas sempre verificar se os dados estão atualizados após batalhas
      if (!forceRefresh) {
        const store = useCharacterStore.getState();
        if (store.selectedCharacterId === characterId && store.selectedCharacter) {
          console.log('[CharacterService] Verificando dados da store Zustand...');

          // ✅ CORREÇÃO: Cache mais conservador para garantir dados atualizados
          const cacheAge = Date.now() - (CharacterCacheService.getCacheTimestamp(characterId) || 0);
          const maxCacheAge = 2 * 60 * 1000; // ✅ REDUZIDO: 2 minutos ao invés de 5

          // ✅ CORREÇÃO CRÍTICA: Verificar se dados parecem desatualizados
          const cachedCharacter = store.selectedCharacter;
          const gameStatePlayer = useGameStateStore.getState().gameState.player;

          // Se há um player no gameState com gold/xp diferente, forçar refresh
          const hasNewerGameData =
            gameStatePlayer &&
            gameStatePlayer.id === characterId &&
            (gameStatePlayer.gold !== cachedCharacter.gold ||
              gameStatePlayer.xp !== cachedCharacter.xp ||
              gameStatePlayer.hp !== cachedCharacter.hp);

          if (cacheAge < maxCacheAge && !hasNewerGameData) {
            console.log('[CharacterService] ✅ Reutilizando dados da store Zustand (cache válido)');
            const cachedCharacter = store.selectedCharacter;

            // Converter Character para GamePlayer usando dados da store
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
              `[CharacterService] GamePlayer criado a partir da store Zustand (${Math.round(cacheAge / 1000)}s atrás) para: ${gamePlayer.name}`
            );
            return { success: true, error: null, data: gamePlayer };
          } else {
            // ✅ CORREÇÃO: Log detalhado sobre por que não usar cache
            console.log('[CharacterService] 🔄 Cache da store inválido:', {
              cacheAgeSeconds: Math.round(cacheAge / 1000),
              maxAgeSeconds: Math.round(maxCacheAge / 1000),
              hasNewerGameData,
              cachedGold: cachedCharacter.gold,
              gameStateGold: gameStatePlayer?.gold,
              cachedHp: cachedCharacter.hp,
              gameStateHp: gameStatePlayer?.hp,
            });
          }
        }
      }

      // Verificar cache do serviço
      if (!forceRefresh) {
        const cachedCharacter = CharacterCacheService.getCachedCharacter(characterId);
        if (cachedCharacter) {
          console.log(
            `[CharacterService] Reutilizando dados em cache do serviço para: ${cachedCharacter.name}`
          );

          // Verificar se o cache é recente (menos de 5 minutos)
          const cacheAge = Date.now() - (CharacterCacheService.getCacheTimestamp(characterId) || 0);
          const maxCacheAge = 5 * 60 * 1000; // 5 minutos

          if (cacheAge < maxCacheAge) {
            // Atualizar store se for o personagem selecionado
            const store = useCharacterStore.getState();
            if (store.selectedCharacterId === characterId) {
              store.setSelectedCharacter(cachedCharacter);
            }

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

      // ✅ CORREÇÃO CRÍTICA: Aplicar auto-heal se solicitado para garantir HP consistente
      if (applyAutoHeal) {
        try {
          console.log(
            `[CharacterService] 🩺 Aplicando auto-heal para ${gamePlayer.name} (HP atual: ${gamePlayer.hp}/${gamePlayer.max_hp})`
          );
          // ✅ CORREÇÃO: Forçar cura completa quando carregando para o hub
          const healResult = await CharacterHealingService.applyAutoHeal(characterId, true);

          if (healResult.success && healResult.data) {
            if (healResult.data.healed) {
              console.log(
                `[CharacterService] ✅ Auto-heal APLICADO: ${healResult.data.oldHp} -> ${healResult.data.newHp} HP (curou ${healResult.data.newHp - healResult.data.oldHp} HP)`
              );

              // Atualizar o gamePlayer com os valores curados
              gamePlayer.hp = healResult.data.newHp;
              gamePlayer.mana = healResult.data.character.mana;

              // Invalidar cache para que próximas consultas usem dados atualizados
              CharacterCacheService.invalidateCharacterCache(characterId);
            } else {
              console.log(
                `[CharacterService] ℹ️ Auto-heal NÃO NECESSÁRIO para ${gamePlayer.name} - já com HP/Mana máximos (${healResult.data.newHp}/${gamePlayer.max_hp})`
              );
            }
          } else {
            console.warn(
              `[CharacterService] ⚠️ Auto-heal FALHOU para ${gamePlayer.name}: ${healResult.error}`
            );
          }
        } catch (healError) {
          console.warn(`[CharacterService] Erro no auto-heal (não crítico):`, healError);
          // Continuar mesmo se auto-heal falhar
        }
      }

      // IMPORTANTE: Atualizar caches com os novos dados (incluindo auto-heal se aplicado)
      const characterForCache: Character = {
        ...charData,
        hp: gamePlayer.hp, // ✅ CORREÇÃO: Usar HP após auto-heal
        max_hp: gamePlayer.max_hp,
        mana: gamePlayer.mana, // ✅ CORREÇÃO: Usar mana após auto-heal
        max_mana: gamePlayer.max_mana,
        atk: derivedStats.atk,
        def: derivedStats.def,
        speed: derivedStats.speed,
        critical_chance: derivedStats.critical_chance,
        critical_damage: derivedStats.critical_damage,
      };

      CharacterCacheService.setCachedCharacter(characterId, characterForCache);

      // ✅ CORREÇÃO: NÃO modificar store Zustand diretamente
      // Os hooks gerenciarão a sincronização do estado automaticamente

      console.log(
        `[CharacterService] GamePlayer criado a partir do banco para: ${gamePlayer.name} (HP final: ${gamePlayer.hp}/${gamePlayer.max_hp})`
      );
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
    CharacterCacheService.invalidateCharacterCache(characterId);
    console.log(`[CharacterService] Cache invalidado para personagem ${characterId}`);
  }

  /**
   * ✅ NOVO: Método utilitário para forçar cura completa no hub (debug)
   */
  static async debugForceFullHeal(
    characterId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[CharacterService] 🔧 DEBUG: Forçando cura completa para ${characterId}`);

      // Buscar personagem atual
      const charResult = await this.getCharacter(characterId);
      if (!charResult.success || !charResult.data) {
        return { success: false, message: 'Personagem não encontrado' };
      }

      const character = charResult.data;
      console.log(
        `[CharacterService] 🔧 DEBUG: HP antes da cura: ${character.hp}/${character.max_hp}`
      );

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

      console.log(
        `[CharacterService] 🔧 DEBUG: HP após cura forçada: ${character.max_hp}/${character.max_hp}`
      );
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
