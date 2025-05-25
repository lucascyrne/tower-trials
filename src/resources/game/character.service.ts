import { 
  Character, 
  CreateCharacterDTO, 
  calculateBaseStats, 
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

export class CharacterService {
  private static characterCache: Map<string, Character> = new Map();
  private static lastFetchTimestamp: Map<string, number> = new Map();
  private static pendingRequests: Map<string, Promise<ServiceResponse<Character>>> = new Map();
  private static CACHE_DURATION = 30000; // 30 segundos de cache

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
      console.error('Erro ao buscar progressão de personagens:', error instanceof Error ? error.message : error);
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
      console.error('Erro ao verificar limite de personagens:', error instanceof Error ? error.message : error);
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
    try {
      // Verificar se já buscamos recentemente
      const now = Date.now();
      const userCacheKey = `user_${userId}`;
      const lastFetch = this.lastFetchTimestamp.get(userCacheKey) || 0;
      
      if (now - lastFetch < this.CACHE_DURATION) {
        const cachedCharacters = Array.from(this.characterCache.values()).filter(char => char.user_id === userId);
        if (cachedCharacters.length > 0) {
          console.log(`[CharacterService] Usando lista de personagens em cache para usuário ${userId}`);
          return { data: cachedCharacters, error: null, success: true };
        }
      }

      const { data, error } = await supabase
        .rpc('get_user_characters', {
          p_user_id: userId
        });

      if (error) throw error;

      // Atualizar cache
      this.characterCache.clear();
      (data as Character[]).forEach(char => {
        this.characterCache.set(char.id, char);
      });
      this.lastFetchTimestamp.set(userCacheKey, now);

      return { data: data as Character[], error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar personagens:', error instanceof Error ? error.message : error);
      return { data: null, error: error instanceof Error ? error.message : 'Erro ao buscar personagens', success: false };
    }
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
        console.log(`[CharacterService] Usando personagem em cache: ${cachedCharacter.name} (andar: ${cachedCharacter.floor})`);
        return { data: cachedCharacter, error: null, success: true };
      }

      // Verificar se já existe uma requisição pendente para este personagem
      if (this.pendingRequests.has(characterId)) {
        console.log(`[CharacterService] Reutilizando requisição pendente para personagem ${characterId}`);
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
      
      // Aplicar cura automática se o personagem foi carregado com sucesso
      if (result.success && result.data) {
        console.log(`[CharacterService] Aplicando cura automática para ${result.data.name}`);
        const healResult = await this.applyAutoHeal(characterId);
        
        if (healResult.success && healResult.data && healResult.data.healed) {
          console.log(`[CharacterService] ${result.data.name} curado: ${healResult.data.oldHp} -> ${healResult.data.newHp} HP`);
          
          // Mostrar notificação de cura se significativa (mais de 5% do HP máximo)
          const healAmount = healResult.data.newHp - healResult.data.oldHp;
          const healPercent = (healAmount / result.data.max_hp) * 100;
          
          if (healPercent >= 5) {
            // A notificação será mostrada pelo componente que chama esta função
            console.log(`[CharacterService] Cura significativa detectada: +${healAmount} HP (${healPercent.toFixed(1)}%)`);
          }
          
          return { data: healResult.data.character, error: null, success: true };
        }
      }

      return result;
    } catch (error) {
      console.error('Erro ao buscar personagem:', error instanceof Error ? error.message : error);
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
      console.log(`[CharacterService] Buscando personagem ${characterId} do servidor`);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fullStatsData = data as any; // Dados da função get_character_full_stats
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
        attribute_points: fullStatsData.attribute_points,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const basicCharacterData = basicData as any;
        character.user_id = basicCharacterData.user_id;
        character.floor = basicCharacterData.floor;
        character.created_at = basicCharacterData.created_at;
        character.updated_at = basicCharacterData.updated_at;
        character.last_activity = basicCharacterData.last_activity;
      }

      console.log(`[CharacterService] Personagem carregado do servidor: ${character.name} (andar: ${character.floor}) com crítico: ${character.critical_chance}`);
      this.characterCache.set(characterId, character);
      this.lastFetchTimestamp.set(characterId, Date.now());

      return { 
        data: character, 
        error: null, 
        success: true 
      };
    } catch (error) {
      console.error('Erro ao buscar personagem do servidor:', error instanceof Error ? error.message : error);
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
      console.error('Erro ao criar personagem:', error instanceof Error ? error.message : error);
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
    const equipmentSlotsData = await EquipmentService.getEquippedSlots(characterId);
    
    // Converter para array se necessário
    const equipmentSlots = Array.isArray(equipmentSlotsData) 
      ? equipmentSlotsData 
      : Object.values(equipmentSlotsData || {});

    // Calcular stats com bônus de equipamento
    const baseStats = calculateBaseStats(character.level, undefined);

    return {
      ...character,
      equipment_slots: equipmentSlots,
      ...baseStats
    };
  }

  /**
   * Atualizar stats do personagem
   * @param characterId ID do personagem
   * @param stats Stats a serem atualizados
   * @returns Resultado da atualização com informações de progressão
   */
  static async updateCharacterStats(
    characterId: string,
    stats: UpdateCharacterStatsDTO
  ): Promise<ServiceResponse<UpdateCharacterStatsResult>> {
    try {
      // Se temos o parâmetro floor, atualizamos separadamente
      if (stats.floor !== undefined) {
        await this.updateCharacterFloor(characterId, stats.floor);
      }
      
      const { data, error } = await supabase
        .rpc('update_character_stats', {
          p_character_id: characterId,
          p_xp: stats.xp,
          p_gold: stats.gold,
          p_hp: stats.hp,
          p_mana: stats.mana,
        });

      if (error) throw error;

      // Atualizar também o last_activity para marcar atividade recente
      await this.updateLastActivity(characterId);

      // Invalidar cache apenas do personagem específico
      this.invalidateCharacterCache(characterId);

      // Se houve level up, também invalidar cache do usuário para atualizar progressão
      if (data.leveled_up || data.slots_unlocked) {
        const character = await this.getCharacter(characterId);
        if (character.success && character.data) {
          this.invalidateUserCache(character.data.user_id);
        }
      }

      return { 
        data: data as UpdateCharacterStatsResult, 
        error: null, 
        success: true 
      };
    } catch (error) {
      console.error('Erro ao atualizar stats:', error instanceof Error ? error.message : error);
      return { data: null, error: error instanceof Error ? error.message : 'Erro ao atualizar stats', success: false };
    }
  }

  /**
   * Atualizar o andar atual do personagem
   * @param characterId ID do personagem
   * @param floor Número do andar
   * @returns Resultado da operação
   */
  static async updateCharacterFloor(characterId: string, floor: number): Promise<ServiceResponse<null>> {
    try {
      console.log(`[CharacterService] updateCharacterFloor - ID: ${characterId}, Andar: ${floor}`);
      
      // Verificar cache para evitar atualizações redundantes
      const cachedCharacter = this.characterCache.get(characterId);
      if (cachedCharacter && (cachedCharacter as Character).floor === floor) {
        console.log(`[CharacterService] Andar já está atualizado para ${floor}, ignorando atualização`);
        return { data: null, error: null, success: true };
      }
      
      console.log(`[CharacterService] Chamando RPC update_character_floor...`);
      
      // Usar a função RPC dedicada para atualizar o andar
      const { error } = await supabase
        .rpc('update_character_floor', {
          p_character_id: characterId,
          p_floor: floor
        });

      if (error) {
        console.error('[CharacterService] Erro na RPC update_character_floor:', error.message);
        throw error;
      }

      // Apenas invalidar o cache específico do personagem
      this.characterCache.delete(characterId);

      console.log(`[CharacterService] Andar atualizado com sucesso para ${floor}`);
      
      return { data: null, error: null, success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[CharacterService] Erro crítico ao atualizar andar:', errorMsg);
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
      console.error('Erro ao deletar personagem:', error instanceof Error ? error.message : error);
      return { error: error instanceof Error ? error.message : 'Erro ao deletar personagem' };
    }
  }

  /**
   * Limpar cache de um personagem específico
   */
  static invalidateCharacterCache(characterId: string): void {
    this.characterCache.delete(characterId);
    this.lastFetchTimestamp.delete(characterId);
    console.log(`[CharacterService] Cache invalidado para personagem ${characterId}`);
  }

  /**
   * Limpar cache de um usuário específico
   */
  static invalidateUserCache(userId: string): void {
    const userCacheKey = `user_${userId}`;
    this.lastFetchTimestamp.delete(userCacheKey);
    
    // Remover todos os personagens deste usuário do cache
    Array.from(this.characterCache.entries()).forEach(([id, character]) => {
      if (character.user_id === userId) {
        this.characterCache.delete(id);
      }
    });
    
    console.log(`[CharacterService] Cache de usuário ${userId} invalidado`);
  }

  /**
   * Limpar todo o cache
   */
  static clearAllCache(): void {
    this.characterCache.clear();
    this.lastFetchTimestamp.clear();
    this.pendingRequests.clear();
    console.log('[CharacterService] Todo o cache foi limpo');
  }

  /**
   * Obter checkpoints desbloqueados pelo personagem
   * @param characterId ID do personagem
   * @returns Lista de checkpoints disponíveis
   */
  static async getUnlockedCheckpoints(characterId: string): Promise<ServiceResponse<{ floor: number; description: string }[]>> {
    try {
      // Obter o personagem para saber o andar mais alto alcançado
      const characterResponse = await this.getCharacter(characterId);
      if (!characterResponse.success || !characterResponse.data) {
        return { data: null, error: 'Personagem não encontrado', success: false };
      }
      
      const character = characterResponse.data;
      const highestFloor = character.floor;
      
      try {
        // Tentar usar a função RPC
        const { data, error } = await supabase
          .rpc('get_unlocked_checkpoints', {
            p_highest_floor: highestFloor
          });

        if (!error && data) {
          const checkpoints = data.map((row: { floor_number: number; description: string }) => ({
            floor: row.floor_number,
            description: row.description
          }));
          return { data: checkpoints, error: null, success: true };
        }
      } catch (rpcError) {
        console.warn('Função RPC não disponível, usando fallback:', rpcError);
      }

      // Fallback: gerar checkpoints manualmente
      const checkpoints: { floor: number; description: string }[] = [];
      
      // Sempre incluir o andar 1
      checkpoints.push({ floor: 1, description: 'Andar 1 - Início da Torre' });
      
      // Adicionar checkpoints a cada 10 andares até o andar mais alto
      for (let floor = 10; floor <= highestFloor; floor += 10) {
        checkpoints.push({
          floor,
          description: `Andar ${floor} - Checkpoint de Chefe`
        });
      }

      return { data: checkpoints, error: null, success: true };
    } catch (error) {
      console.error('Erro ao obter checkpoints:', error instanceof Error ? error.message : error);
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
      // Verificar se o checkpoint é válido (deve ser múltiplo de 10 ou andar 1)
      if (checkpointFloor !== 1 && checkpointFloor % 10 !== 0) {
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
      
      // Atualizar o andar do personagem
      const updateResponse = await this.updateCharacterFloor(characterId, checkpointFloor);
      return updateResponse;
    } catch (error) {
      console.error('Erro ao iniciar do checkpoint:', error instanceof Error ? error.message : error);
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
    
    // Log apenas se houve cura significativa
    if (newHp > character.hp || newMana > character.mana) {
      console.log(`[AutoHeal] ${character.name}: HP ${character.hp} -> ${newHp} (+${newHp - character.hp}), Mana ${character.mana} -> ${newMana} (+${newMana - character.mana}) após ${Math.floor(timeDiffSeconds / 60)}min`);
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

      // Atualizar HP e Mana no banco
      const { error } = await supabase
        .from('characters')
        .update({
          hp: hp,
          mana: mana,
          last_activity: currentTime.toISOString()
        })
        .eq('id', characterId);

      if (error) throw error;

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
      console.error('Erro ao aplicar cura automática:', error instanceof Error ? error.message : error);
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
        .from('characters')
        .update({
          last_activity: new Date().toISOString()
        })
        .eq('id', characterId);

      if (error) throw error;

      // Invalidar cache do personagem
      this.invalidateCharacterCache(characterId);

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao atualizar última atividade:', error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao atualizar última atividade',
        success: false
      };
    }
  }

  /**
   * Obter stats completos do personagem incluindo atributos e habilidades
   * @param characterId ID do personagem
   * @returns Stats completos do personagem
   */
  static async getCharacterStats(characterId: string): Promise<ServiceResponse<CharacterStats>> {
    try {
      const { data, error } = await supabase
        .rpc('get_character_full_stats', {
          p_character_id: characterId
        })
        .single();

      if (error) throw error;

      return { 
        data: data as CharacterStats, 
        error: null, 
        success: true 
      };
    } catch (error) {
      console.error('Erro ao buscar stats do personagem:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar stats', 
        success: false 
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
      console.error('Erro ao distribuir pontos de atributo:', error instanceof Error ? error.message : error);
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
      console.error('Erro ao adicionar XP de habilidade:', error instanceof Error ? error.message : error);
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
      console.error('Erro ao recalcular stats:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao recalcular stats', 
        success: false 
      };
    }
  }
} 