import { supabase } from '@/lib/supabase';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PotionSlot {
  slot_position: number;
  consumable_id: string | null;
  consumable_name: string | null;
  consumable_description: string | null;
  effect_value: number | null;
  consumable_type: string | null;
  available_quantity: number;
  consumable_price: number | null;
}

export interface SpellSlot {
  slot_position: number;
  spell_id: string | null;
  spell_name: string | null;
  spell_description: string | null;
  mana_cost: number | null;
  damage: number | null;
  spell_type: string | null;
}

export interface PotionUseResult {
  success: boolean;
  message: string;
  new_hp: number;
  new_mana: number;
}

// NOVO: Cache e controle de requisições concorrentes
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isValid: boolean;
}

interface PendingRequest<T> {
  promise: Promise<ServiceResponse<T>>;
  abortController: AbortController;
}

export class SlotService {
  // Cache para slots de poção por personagem
  private static potionSlotsCache = new Map<string, CacheEntry<PotionSlot[]>>();
  private static spellSlotsCache = new Map<string, CacheEntry<SpellSlot[]>>();

  // Controle de requisições pendentes
  private static pendingPotionRequests = new Map<string, PendingRequest<PotionSlot[]>>();
  private static pendingSpellRequests = new Map<string, PendingRequest<SpellSlot[]>>();

  // Configurações de cache
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  private static readonly REQUEST_TIMEOUT = 8000; // 8 segundos

  /**
   * NOVO: Verificar se cache é válido
   */
  private static isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
    if (!entry) return false;
    const now = Date.now();
    return entry.isValid && now - entry.timestamp < this.CACHE_DURATION;
  }

  /**
   * NOVO: Cancelar requisição pendente
   */
  private static cancelPendingRequest<T>(
    pendingMap: Map<string, PendingRequest<T>>,
    key: string
  ): void {
    const pending = pendingMap.get(key);
    if (pending) {
      console.log(`[SlotService] Cancelando requisição pendente: ${key}`);
      pending.abortController.abort();
      pendingMap.delete(key);
    }
  }

  /**
   * NOVO: Invalidar cache
   */
  static invalidateCache(characterId: string): void {
    console.log(`[SlotService] Invalidando cache para: ${characterId}`);

    // Cancelar requisições pendentes
    this.cancelPendingRequest(this.pendingPotionRequests, characterId);
    this.cancelPendingRequest(this.pendingSpellRequests, characterId);

    // Invalidar cache
    const potionEntry = this.potionSlotsCache.get(characterId);
    if (potionEntry) {
      potionEntry.isValid = false;
    }

    const spellEntry = this.spellSlotsCache.get(characterId);
    if (spellEntry) {
      spellEntry.isValid = false;
    }
  }

  /**
   * REFATORADO: Obter slots de poção com cache e controle de concorrência
   */
  static async getCharacterPotionSlots(
    characterId: string
  ): Promise<ServiceResponse<PotionSlot[]>> {
    try {
      console.log(`[SlotService] Solicitando slots de poção para: ${characterId}`);

      // 1. Verificar cache primeiro
      const cachedEntry = this.potionSlotsCache.get(characterId);
      if (this.isCacheValid(cachedEntry)) {
        console.log(`[SlotService] Cache hit para slots de poção: ${characterId}`);
        return { data: cachedEntry!.data, error: null, success: true };
      }

      // 2. Verificar se há requisição pendente
      const pendingRequest = this.pendingPotionRequests.get(characterId);
      if (pendingRequest) {
        console.log(`[SlotService] Reutilizando requisição pendente: ${characterId}`);
        try {
          return await pendingRequest.promise;
        } catch (error) {
          // Se a requisição foi cancelada, continuar para fazer nova requisição
          if (!pendingRequest.abortController.signal.aborted) {
            throw error;
          }
        }
      }

      // 3. Criar nova requisição com controle de cancelamento
      const abortController = new AbortController();

      const requestPromise = this.fetchPotionSlotsFromServer(characterId, abortController.signal);

      // Armazenar requisição pendente
      this.pendingPotionRequests.set(characterId, {
        promise: requestPromise,
        abortController,
      });

      try {
        const result = await requestPromise;

        // Atualizar cache apenas se bem-sucedido
        if (result.success && result.data) {
          this.potionSlotsCache.set(characterId, {
            data: result.data,
            timestamp: Date.now(),
            isValid: true,
          });
        }

        return result;
      } finally {
        // Limpar requisição pendente
        this.pendingPotionRequests.delete(characterId);
      }
    } catch (error) {
      console.error('[SlotService] Erro ao buscar slots de poção:', error);

      // Retornar slots vazios como fallback seguro
      return this.getFallbackPotionSlots();
    }
  }

  /**
   * NOVO: Buscar slots do servidor com timeout e cancelamento
   */
  private static async fetchPotionSlotsFromServer(
    characterId: string,
    signal: AbortSignal
  ): Promise<ServiceResponse<PotionSlot[]>> {
    console.log(`[SlotService] Buscando slots do servidor: ${characterId}`);

    // Timeout Promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout ao carregar slots de poção'));
      }, this.REQUEST_TIMEOUT);

      // Cancelar timeout se request for abortado
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new Error('Request cancelado'));
      });
    });

    // RPC Promise
    const rpcPromise = supabase.rpc('get_character_potion_slots', {
      p_character_id: characterId,
    });

    try {
      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

      if (signal.aborted) {
        throw new Error('Request cancelado');
      }

      if (error) {
        console.error(`[SlotService] Erro RPC:`, error);
        throw error;
      }

      // Normalizar dados - sempre garantir 3 slots
      const slots: PotionSlot[] = [];
      for (let i = 1; i <= 3; i++) {
        const existingSlot = (data as PotionSlot[])?.find(s => s.slot_position === i);
        slots.push(
          existingSlot || {
            slot_position: i,
            consumable_id: null,
            consumable_name: null,
            consumable_description: null,
            effect_value: null,
            consumable_type: null,
            available_quantity: 0,
            consumable_price: null,
          }
        );
      }

      console.log(`[SlotService] ${slots.length} slots carregados do servidor`);
      return { data: slots, error: null, success: true };
    } catch (error) {
      if (signal.aborted) {
        console.log(`[SlotService] Request cancelado para: ${characterId}`);
        throw error; // Re-throw para ser tratado pelo caller
      }

      console.error('[SlotService] Erro ao buscar do servidor:', error);
      throw error;
    }
  }

  /**
   * NOVO: Fallback seguro para slots de poção
   */
  private static getFallbackPotionSlots(): ServiceResponse<PotionSlot[]> {
    console.log('[SlotService] Retornando slots vazios como fallback');
    const fallbackSlots: PotionSlot[] = [];
    for (let i = 1; i <= 3; i++) {
      fallbackSlots.push({
        slot_position: i,
        consumable_id: null,
        consumable_name: null,
        consumable_description: null,
        effect_value: null,
        consumable_type: null,
        available_quantity: 0,
        consumable_price: null,
      });
    }

    return {
      data: fallbackSlots,
      error: null,
      success: true,
    };
  }

  /**
   * REFATORADO: Obter slots de spell com cache
   */
  static async getCharacterSpellSlots(characterId: string): Promise<ServiceResponse<SpellSlot[]>> {
    try {
      // Verificar cache primeiro
      const cachedEntry = this.spellSlotsCache.get(characterId);
      if (this.isCacheValid(cachedEntry)) {
        console.log(`[SlotService] Cache hit para spell slots: ${characterId}`);
        return { data: cachedEntry!.data, error: null, success: true };
      }

      // Verificar requisição pendente
      const pendingRequest = this.pendingSpellRequests.get(characterId);
      if (pendingRequest) {
        console.log(`[SlotService] Reutilizando requisição spell pendente: ${characterId}`);
        return await pendingRequest.promise;
      }

      // Criar nova requisição
      const abortController = new AbortController();
      const requestPromise = this.fetchSpellSlotsFromServer(characterId, abortController.signal);

      this.pendingSpellRequests.set(characterId, {
        promise: requestPromise,
        abortController,
      });

      try {
        const result = await requestPromise;

        if (result.success && result.data) {
          this.spellSlotsCache.set(characterId, {
            data: result.data,
            timestamp: Date.now(),
            isValid: true,
          });
        }

        return result;
      } finally {
        this.pendingSpellRequests.delete(characterId);
      }
    } catch (error) {
      console.error('[SlotService] Erro ao buscar spell slots:', error);
      return { data: null, error: 'Erro ao buscar slots de spell', success: false };
    }
  }

  /**
   * NOVO: Buscar spell slots do servidor
   */
  private static async fetchSpellSlotsFromServer(
    characterId: string,
    signal: AbortSignal
  ): Promise<ServiceResponse<SpellSlot[]>> {
    const { data, error } = await supabase.rpc('get_character_spell_slots', {
      p_character_id: characterId,
    });

    if (signal.aborted) {
      throw new Error('Request cancelado');
    }

    if (error) throw error;

    // Garantir que sempre temos 3 slots
    const slots: SpellSlot[] = [];
    for (let i = 1; i <= 3; i++) {
      const existingSlot = (data as SpellSlot[])?.find(s => s.slot_position === i);
      slots.push(
        existingSlot || {
          slot_position: i,
          spell_id: null,
          spell_name: null,
          spell_description: null,
          mana_cost: null,
          damage: null,
          spell_type: null,
        }
      );
    }

    return { data: slots, error: null, success: true };
  }

  /**
   * REFATORADO: Configurar slot de poção com invalidação de cache
   */
  static async setPotionSlot(
    characterId: string,
    slotPosition: number,
    consumableId: string
  ): Promise<ServiceResponse<null>> {
    try {
      console.log(`[SlotService] Configurando slot ${slotPosition} com consumível ${consumableId}`);

      const { data, error } = await supabase
        .rpc('set_potion_slot', {
          p_character_id: characterId,
          p_slot_position: slotPosition,
          p_consumable_id: consumableId,
        })
        .single();

      if (error) {
        console.error('[SlotService] Erro no RPC set_potion_slot:', error.message);
        throw error;
      }

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        console.warn(`[SlotService] Operação falhou: ${result.error}`);
        return {
          data: null,
          error: result.error || 'Erro ao configurar slot de poção',
          success: false,
        };
      }

      // CRÍTICO: Invalidar cache após mudança
      this.invalidateCache(characterId);

      console.log(`[SlotService] Slot ${slotPosition} configurado com sucesso`);
      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao configurar slot de poção:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao configurar slot de poção',
        success: false,
      };
    }
  }

  /**
   * REFATORADO: Limpar slot de poção com invalidação de cache
   */
  static async clearPotionSlot(
    characterId: string,
    slotPosition: number
  ): Promise<ServiceResponse<null>> {
    try {
      console.log(`[SlotService] Limpando slot ${slotPosition}`);

      const { data, error } = await supabase
        .rpc('clear_potion_slot', {
          p_character_id: characterId,
          p_slot_position: slotPosition,
        })
        .single();

      if (error) {
        console.error('[SlotService] Erro no RPC clear_potion_slot:', error.message);
        throw error;
      }

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        console.warn(`[SlotService] Falha ao limpar slot: ${result.error}`);
        return {
          data: null,
          error: result.error || 'Erro ao limpar slot de poção',
          success: false,
        };
      }

      // CRÍTICO: Invalidar cache após mudança
      this.invalidateCache(characterId);

      console.log(`[SlotService] Slot ${slotPosition} limpo com sucesso`);
      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao limpar slot de poção:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao limpar slot de poção',
        success: false,
      };
    }
  }

  /**
   * Configurar slot de spell
   */
  static async setSpellSlot(
    characterId: string,
    slotPosition: number,
    spellId: string | null
  ): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase.rpc('set_spell_slot', {
        p_character_id: characterId,
        p_slot_position: slotPosition,
        p_spell_id: spellId,
      });

      if (error) throw error;

      // Invalidar cache após mudança
      this.invalidateCache(characterId);

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao configurar slot de spell:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao configurar slot de spell',
        success: false,
      };
    }
  }

  /**
   * OTIMIZADO: Consumir poção do slot
   */
  static async consumePotionFromSlot(
    characterId: string,
    slotPosition: number
  ): Promise<ServiceResponse<PotionUseResult>> {
    try {
      console.log(`[SlotService] Consumindo poção do slot ${slotPosition}`);

      if (!characterId) {
        return { success: false, error: 'ID do personagem é obrigatório', data: null };
      }

      if (slotPosition < 1 || slotPosition > 3) {
        return { success: false, error: 'Posição do slot inválida (1-3)', data: null };
      }

      const { supabaseAdmin } = await import('@/lib/supabase');

      const { data, error } = await supabaseAdmin.rpc('consume_potion_from_slot', {
        p_character_id: characterId,
        p_slot_position: slotPosition,
      });

      // ✅ CORREÇÃO: Log detalhado da resposta bruta do RPC
      console.log(`[SlotService] 🔍 DEBUG: Resposta bruta do RPC:`, {
        data,
        error,
        dataType: typeof data,
        isArray: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 'N/A',
      });

      if (error) {
        console.error('[SlotService] Erro RPC ao consumir poção:', error);
        return {
          success: false,
          error: error.message || 'Erro ao usar poção',
          data: null,
        };
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.error('[SlotService] Resposta inválida da função RPC:', data);
        return {
          success: false,
          error: 'Nenhum resultado retornado da função',
          data: null,
        };
      }

      const resultData = data[0];
      console.log(`[SlotService] 🔍 DEBUG: Dados do primeiro elemento:`, {
        resultData,
        resultDataType: typeof resultData,
        success: resultData?.success,
        successType: typeof resultData?.success,
        message: resultData?.message,
        new_hp: resultData?.new_hp,
        new_mana: resultData?.new_mana,
      });

      if (!resultData) {
        return {
          success: false,
          error: 'Resultado vazio da função',
          data: null,
        };
      }

      // ✅ CORREÇÃO: Melhorar validação e conversão de tipos
      const rawSuccess = resultData.success;
      const rawMessage = resultData.message;
      const rawHp = resultData.new_hp;
      const rawMana = resultData.new_mana;

      // ✅ CRÍTICO: Conversão mais robusta de boolean
      let isSuccess = false;
      if (typeof rawSuccess === 'boolean') {
        isSuccess = rawSuccess;
      } else if (typeof rawSuccess === 'string') {
        isSuccess = rawSuccess.toLowerCase() === 'true' || rawSuccess === 't';
      } else {
        isSuccess = Boolean(rawSuccess);
      }

      console.log(`[SlotService] 🔍 DEBUG: Conversão de success:`, {
        rawSuccess,
        rawSuccessType: typeof rawSuccess,
        isSuccess,
      });

      // ✅ CORREÇÃO: Validação mais robusta de números
      const newHp = Math.floor(Number(rawHp) || 0);
      const newMana = Math.floor(Number(rawMana) || 0);

      if (isNaN(newHp) || isNaN(newMana)) {
        console.error('[SlotService] Valores NaN detectados:', {
          rawHp,
          rawMana,
          newHp,
          newMana,
          resultData,
        });
        return {
          success: false,
          error: 'Erro nos valores de HP/Mana retornados',
          data: null,
        };
      }

      const result: PotionUseResult = {
        success: isSuccess,
        message: String(rawMessage || 'Poção usada'),
        new_hp: newHp,
        new_mana: newMana,
      };

      console.log(`[SlotService] 🔍 DEBUG: Resultado processado:`, {
        result,
        originalData: resultData,
      });

      // CRÍTICO: Invalidar cache APENAS APÓS consumo bem-sucedido ou erro
      this.invalidateCache(characterId);

      // ✅ CORREÇÃO: Verificar sucesso DEPOIS da invalidação de cache
      if (!result.success) {
        console.warn(`[SlotService] ⚠️ RPC indicou falha:`, {
          message: result.message,
          resultData,
          characterId,
          slotPosition,
        });

        return {
          success: false,
          error: result.message,
          data: null,
        };
      }

      console.log(`[SlotService] ✅ Resultado final da poção:`, {
        success: result.success,
        message: result.message,
        hp: result.new_hp,
        mana: result.new_mana,
      });

      return {
        success: true,
        error: null,
        data: result,
      };
    } catch (error) {
      console.error('[SlotService] Erro crítico ao consumir poção:', error);

      // ✅ CORREÇÃO: Invalidar cache mesmo em caso de erro crítico
      this.invalidateCache(characterId);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null,
      };
    }
  }

  /**
   * Limpar slot de spell
   */
  static async clearSpellSlot(
    characterId: string,
    slotPosition: number
  ): Promise<ServiceResponse<null>> {
    return this.setSpellSlot(characterId, slotPosition, null);
  }

  /**
   * NOVO: Limpar todo o cache (útil para debugging)
   */
  static clearAllCache(): void {
    console.log('[SlotService] Limpando todo o cache');

    // Cancelar todas as requisições pendentes
    for (const [, pending] of this.pendingPotionRequests) {
      pending.abortController.abort();
    }
    for (const [, pending] of this.pendingSpellRequests) {
      pending.abortController.abort();
    }

    // Limpar caches e requisições pendentes
    this.potionSlotsCache.clear();
    this.spellSlotsCache.clear();
    this.pendingPotionRequests.clear();
    this.pendingSpellRequests.clear();
  }
}
