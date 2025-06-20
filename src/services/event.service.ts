import { useEventStore } from '../stores/useEventStore';
import { useGameStateStore } from '../stores/useGameStateStore';

  import { supabase } from '@/lib/supabase';
import { type SpecialEvent, type SpecialEventResult } from '../models/game.model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class SpecialEventService {
  /**
   * OTIMIZADO: Obter evento especial aleatório para um andar com integração Zustand
   */
  static async getSpecialEventForFloor(floor: number): Promise<ServiceResponse<SpecialEvent>> {
    try {
      console.log(`[SpecialEventService] Verificando evento especial para andar ${floor}`);

      // Verificar elegibilidade do andar
      if (!this.isFloorEligibleForEvent(floor)) {
        console.log(`[SpecialEventService] Andar ${floor} não elegível para eventos especiais`);
        return {
          data: null,
          error: 'Andar não elegível para eventos especiais',
          success: false,
        };
      }

      // Obter configurações da store
      const eventStore = useEventStore.getState();
      const baseChance = 0.03; // 3% base
      const finalChance = baseChance * eventStore.eventChanceMultiplier;

      // Verificar chance de evento especial
      const eventRoll = Math.random();
      if (eventRoll > finalChance) {
        console.log(
          `[SpecialEventService] Chance de evento não atingida: ${(eventRoll * 100).toFixed(1)}% > ${(finalChance * 100).toFixed(1)}%`
        );
        return {
          data: null,
          error: 'Evento especial não gerado por chance',
          success: false,
        };
      }

      // Verificar cooldowns através da store
      if (!eventStore.canProcessEvent('special_event')) {
        console.log('[SpecialEventService] Evento especial em cooldown');
        return {
          data: null,
          error: 'Eventos especiais em cooldown',
          success: false,
        };
      }

      const { data, error } = await supabase
        .rpc('get_special_event_for_floor', { p_floor: floor })
        .single();

      if (error) {
        console.error(`[SpecialEventService] Erro na RPC:`, error.message);
        throw error;
      }

      if (!data) {
        throw new Error('Nenhum evento encontrado para este andar');
      }

      const event = data as SpecialEvent;
      console.log(
        `[SpecialEventService] Evento "${event.name}" gerado para andar ${floor} (chance: ${(eventRoll * 100).toFixed(1)}%)`
      );

      // Atualizar store com o evento atual
      eventStore.setCurrentEvent(event);

      // Atualizar estado do jogo
      const gameStore = useGameStateStore.getState();
      gameStore.updateGameState(draft => {
        draft.currentSpecialEvent = event;
        draft.mode = 'special_event';
        draft.gameMessage = `Você encontrou: ${event.name}!`;
      });

      return { data: event, error: null, success: true };
    } catch (error) {
      console.error(
        `[SpecialEventService] Erro ao buscar evento:`,
        error instanceof Error ? error.message : error
      );

      // Registrar erro na store
      const eventStore = useEventStore.getState();
      eventStore.setError(
        error instanceof Error ? error.message : 'Erro ao buscar evento especial'
      );

      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar evento especial',
        success: false,
      };
    }
  }

  /**
   * OTIMIZADO: Processar interação com evento especial com integração Zustand
   */
  static async processSpecialEvent(
    characterId: string,
    eventId: string
  ): Promise<ServiceResponse<SpecialEventResult>> {
    try {
      console.log(
        `[SpecialEventService] Processando evento ${eventId} para personagem ${characterId}`
      );

      // Verificar se há evento atual na store
      const eventStore = useEventStore.getState();
      const gameStore = useGameStateStore.getState();

      const currentEvent = eventStore.currentEvent || gameStore.gameState.currentSpecialEvent;
      if (!currentEvent || currentEvent.id !== eventId) {
        throw new Error('Evento não encontrado ou não está ativo');
      }

      // Verificar se pode processar o evento
      if (!eventStore.canProcessEvent('special_event', characterId)) {
        throw new Error('Evento não pode ser processado (cooldown ou já processando)');
      }

      // Marcar como processando na store
      eventStore.setError(null);

      const { data, error } = await supabase
        .rpc('process_special_event', {
          p_character_id: characterId,
          p_event_id: eventId,
        })
        .single();

      if (error) {
        console.error(`[SpecialEventService] Erro na RPC de processamento:`, error.message);
        throw error;
      }

      if (!data) {
        throw new Error('Resposta inválida do servidor');
      }

      const result = data as SpecialEventResult;
      console.log(`[SpecialEventService] Evento processado com sucesso:`, {
        hp_restored: result.hp_restored,
        mana_restored: result.mana_restored,
        gold_gained: result.gold_gained,
        message: result.message,
      });

      // Atualizar stores após processamento bem-sucedido
      this.updateStoresAfterEventProcessing(eventId, characterId, currentEvent, result);

      return { data: result, error: null, success: true };
    } catch (error) {
      console.error(
        `[SpecialEventService] Erro ao processar evento:`,
        error instanceof Error ? error.message : error
      );

      // Registrar erro na store
      const eventStore = useEventStore.getState();
      eventStore.setError(
        error instanceof Error ? error.message : 'Erro ao processar evento especial'
      );

      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao processar evento especial',
        success: false,
      };
    }
  }

  /**
   * NOVO: Atualizar stores após processamento de evento
   */
  private static updateStoresAfterEventProcessing(
    eventId: string,
    characterId: string,
    event: SpecialEvent,
    result: SpecialEventResult
  ): void {
    console.log(`[SpecialEventService] Atualizando stores após processamento do evento`);

    const eventStore = useEventStore.getState();
    const gameStore = useGameStateStore.getState();

    try {
      // 1. Adicionar ao histórico de eventos
      eventStore.addToHistory(eventId, event.type, characterId, result);

      // 2. Adicionar cooldown para evitar spam
      eventStore.addCooldown(
        'special_event',
        eventStore.globalEventCooldownMs,
        characterId,
        `Cooldown após evento ${event.name}`
      );

      // 3. Limpar evento atual
      eventStore.setCurrentEvent(null);

      // 4. Atualizar estado do jogo
      gameStore.updateGameState(draft => {
        draft.currentSpecialEvent = null;
        draft.gameMessage = result.message;
        draft.mode = 'hub'; // Voltar ao hub após evento

        // Atualizar stats do player se necessário
        if (draft.player && result.success) {
          if (result.hp_restored > 0) {
            draft.player.hp = Math.min(draft.player.max_hp, draft.player.hp + result.hp_restored);
          }
          if (result.mana_restored > 0) {
            draft.player.mana = Math.min(
              draft.player.max_mana,
              draft.player.mana + result.mana_restored
            );
          }
          if (result.gold_gained > 0) {
            draft.player.gold += result.gold_gained;
          }
        }
      });

      console.log(`[SpecialEventService] Stores atualizadas com sucesso`);
    } catch (error) {
      console.error(`[SpecialEventService] Erro ao atualizar stores:`, error);
      eventStore.setError('Erro ao atualizar estado após evento');
    }
  }

  /**
   * OTIMIZADO: Verificar se um andar é elegível para eventos especiais
   */
  static isFloorEligibleForEvent(floor: number): boolean {
    // Eventos especiais não aparecem em:
    // - Andares múltiplos de 5 (mini-boss)
    // - Andares múltiplos de 10 (boss)
    // - Andar 1 (início do jogo)
    const isEligible = floor > 1 && floor % 5 !== 0 && floor % 10 !== 0;

    console.log(
      `[SpecialEventService] Andar ${floor} elegibilidade: ${isEligible ? 'SIM' : 'NÃO'}`
    );
    return isEligible;
  }

  /**
   * OTIMIZADO: Determinar se um andar deve ter evento especial com configuração da store
   */
  static shouldGenerateSpecialEvent(floorType: string): boolean {
    const eventStore = useEventStore.getState();
    const baseChance = floorType === 'event' ? 0.7 : 0.03;
    const finalChance = baseChance * eventStore.eventChanceMultiplier;

    const shouldGenerate = Math.random() < finalChance;
    console.log(
      `[SpecialEventService] Deve gerar evento no tipo "${floorType}": ${shouldGenerate ? 'SIM' : 'NÃO'} (chance: ${(finalChance * 100).toFixed(1)}%)`
    );

    return shouldGenerate;
  }

  /**
   * Obter ícone do evento baseado no tipo
   */
  static getEventIcon(eventType: string): string {
    const icons = {
      bonfire: '🔥',
      treasure_chest: '📦',
      magic_fountain: '⛲',
    };
    return icons[eventType as keyof typeof icons] || '✨';
  }

  /**
   * Obter cor do evento baseado no tipo
   */
  static getEventColor(eventType: string): string {
    const colors = {
      bonfire: 'text-orange-500',
      treasure_chest: 'text-yellow-500',
      magic_fountain: 'text-blue-500',
    };
    return colors[eventType as keyof typeof colors] || 'text-purple-500';
  }

  /**
   * NOVO: Verificar status de eventos através da store
   */
  static getEventStatus(characterId?: string): {
    hasActiveEvent: boolean;
    isProcessing: boolean;
    canProcessEvents: boolean;
    activeCooldowns: number;
    lastError: string | null;
  } {
    const eventStore = useEventStore.getState();
    const gameStore = useGameStateStore.getState();

    const status = {
      hasActiveEvent: !!(eventStore.currentEvent || gameStore.gameState.currentSpecialEvent),
      isProcessing: eventStore.isProcessingEvent,
      canProcessEvents: eventStore.canProcessEvent('special_event', characterId),
      activeCooldowns: eventStore.eventCooldowns.length,
      lastError: eventStore.lastError,
    };

    console.log(
      `[SpecialEventService] Status de eventos para ${characterId || 'sistema'}:`,
      status
    );
    return status;
  }

  /**
   * NOVO: Limpar estado de eventos via stores
   */
  static clearEventState(): void {
    console.log(`[SpecialEventService] Limpando estado de eventos`);

    const eventStore = useEventStore.getState();
    const gameStore = useGameStateStore.getState();

    // Limpar store de eventos
    eventStore.setCurrentEvent(null);
    eventStore.clearError();
    eventStore.clearEventQueue();

    // Limpar evento no estado do jogo
    gameStore.updateGameState(draft => {
      draft.currentSpecialEvent = null;
      if (draft.mode === 'special_event') {
        draft.mode = 'hub';
      }
    });
  }

  /**
   * NOVO: Sincronizar eventos entre stores
   */
  static syncEventsBetweenStores(): void {
    const eventStore = useEventStore.getState();
    const gameStore = useGameStateStore.getState();

    // Sincronizar evento atual
    const gameEvent = gameStore.gameState.currentSpecialEvent;
    const storeEvent = eventStore.currentEvent;

    if (gameEvent && !storeEvent) {
      console.log(`[SpecialEventService] Sincronizando evento do game state para event store`);
      eventStore.setCurrentEvent(gameEvent);
    } else if (storeEvent && !gameEvent) {
      console.log(`[SpecialEventService] Sincronizando evento do event store para game state`);
      gameStore.updateGameState(draft => {
        draft.currentSpecialEvent = storeEvent;
        if (draft.mode !== 'special_event') {
          draft.mode = 'special_event';
        }
      });
    }
  }

  /**
   * NOVO: Configurar multiplicador de chance de eventos
   */
  static setEventChanceMultiplier(multiplier: number): void {
    console.log(
      `[SpecialEventService] Configurando multiplicador de chance para: ${multiplier.toFixed(2)}x`
    );

    const eventStore = useEventStore.getState();
    eventStore.setEventChanceMultiplier(multiplier);
  }

  /**
   * NOVO: Obter histórico de eventos da store
   */
  static getEventHistory(characterId?: string): Array<{
    eventId: string;
    eventType: string;
    processedAt: Date;
    characterId?: string;
    result?: SpecialEventResult;
  }> {
    const eventStore = useEventStore.getState();

    let history = eventStore.eventHistory;

    // Filtrar por personagem se especificado
    if (characterId) {
      history = history.filter(entry => entry.characterId === characterId);
    }

    console.log(
      `[SpecialEventService] Histórico de eventos${characterId ? ` para ${characterId}` : ''}: ${history.length} entradas`
    );
    return history;
  }
}
