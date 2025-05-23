import { Character, CreateCharacterDTO, calculateBaseStats } from './models/character.model';
import { EquipmentService } from './equipment.service';
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

      return request;
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
      // Verificar se o usuário já tem 3 personagens
      const { data: characters, error: countError } = await supabase
        .from('characters')
        .select('id')
        .eq('user_id', data.user_id);

      if (countError) throw countError;
      
      if (characters && characters.length >= 3) {
        return {
          data: null,
          error: 'Você já atingiu o limite máximo de 3 personagens',
          success: false
        };
      }

      // Criar novo personagem usando a função RPC
      const { data: result, error } = await supabase
        .rpc('create_character', {
          p_user_id: data.user_id,
          p_name: data.name
        });

      if (error) {
        if (error.message.includes('Limite máximo de personagens')) {
          return {
            data: null,
            error: 'Você já atingiu o limite máximo de 3 personagens',
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
} 