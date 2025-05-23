import { Character, CreateCharacterDTO, calculateBaseStats } from './models/character.model';
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
        .rpc('get_character', {
          p_character_id: characterId
        });

      if (error) throw error;

      if (!data) {
        return { 
          data: null, 
          error: 'Personagem não encontrado', 
          success: false 
        };
      }

      // Atualizar cache
      const character = data as Character;
      console.log(`[CharacterService] Personagem carregado do servidor: ${character.name} (andar: ${character.floor})`);
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
   * @returns ID do personagem criado
   */
  static async createCharacter(data: CreateCharacterDTO): Promise<ServiceResponse<{ id: string }>> {
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

      // Formatar nome corretamente
      const formattedName = NameValidationService.formatCharacterName(data.name);

      // Verificar se o usuário já tem 3 personagens
      const { data: characters, error: countError } = await supabase
        .from('characters')
        .select('id, name')
        .eq('user_id', data.user_id);

      if (countError) throw countError;
      
      if (characters && characters.length >= 3) {
        return {
          data: null,
          error: 'Você já atingiu o limite máximo de 3 personagens',
          success: false
        };
      }

      // Verificar se já existe personagem com nome similar
      if (characters && characters.length > 0) {
        const existingNames = characters.map(c => c.name);
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
        if (error.message.includes('Limite máximo de personagens')) {
          return {
            data: null,
            error: 'Você já atingiu o limite máximo de 3 personagens',
            success: false
          };
        }
        if (error.message.includes('já possui um personagem com este nome')) {
          return {
            data: null,
            error: 'Você já possui um personagem com este nome',
            success: false
          };
        }
        throw error;
      }

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
    const equipmentSlots = await EquipmentService.getEquippedSlots(characterId);

    // Calcular stats com bônus de equipamento
    const baseStats = calculateBaseStats(character.level, equipmentSlots);

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
   * @returns Resultado da atualização
   */
  static async updateCharacterStats(
    characterId: string,
    stats: UpdateCharacterStatsDTO
  ): Promise<ServiceResponse<{ leveled_up: boolean; new_level: number; new_xp: number; new_xp_next_level: number }>> {
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

      return { 
        data: { 
          leveled_up: data.leveled_up,
          new_level: data.new_level,
          new_xp: data.new_xp, 
          new_xp_next_level: data.new_xp_next_level 
        }, 
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
      // Deletar o personagem usando a função RPC do banco
      const { error } = await supabase
        .rpc('delete_character', {
          p_character_id: characterId
        });

      if (error) throw error;

      // Invalidar cache do personagem deletado
      this.invalidateCharacterCache(characterId);

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
} 