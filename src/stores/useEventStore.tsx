import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { produce } from 'immer';
import { GameService } from '../services/game.service';
import { CharacterService } from '../services/character.service';
import { SpecialEventService } from '../services/event.service';
import type { SpecialEvent, SpecialEventResult, GameState } from '../models/game.model';

// Tipos para o sistema de eventos
export type EventData =
  | SpecialEvent
  | { type: 'timed'; duration: number; message: string }
  | { type: 'global'; scope: string; data: Record<string, unknown> };

export interface EventQueueItem {
  id: string;
  type: 'special_event' | 'timed_event' | 'global_event';
  eventData: EventData;
  scheduledFor: Date;
  priority: number;
  characterId?: string;
}

export interface EventCooldown {
  eventType: string;
  characterId?: string;
  expiresAt: Date;
  reason: string;
}

export interface EventState {
  // Estados principais
  currentEvent: SpecialEvent | null;
  eventQueue: EventQueueItem[];
  eventCooldowns: EventCooldown[];
  isProcessingEvent: boolean;
  eventHistory: Array<{
    eventId: string;
    eventType: string;
    processedAt: Date;
    characterId?: string;
    result?: SpecialEventResult;
  }>;

  // Configurações
  eventChanceMultiplier: number;
  globalEventCooldownMs: number;
  maxQueueSize: number;

  // Estados de erro e loading
  lastError: string | null;
  processingEventId: string | null;
}

export interface EventActions {
  // Ações principais
  interactWithEvent: (gameState: GameState, characterId: string) => Promise<void>;
  processEvent: (eventId: string, characterId: string) => Promise<SpecialEventResult | null>;

  // Gerenciamento de fila
  queueEvent: (event: EventQueueItem) => void;
  processEventQueue: () => Promise<void>;
  clearEventQueue: () => void;
  removeEventFromQueue: (eventId: string) => void;

  // Gerenciamento de cooldowns
  addCooldown: (
    eventType: string,
    durationMs: number,
    characterId?: string,
    reason?: string
  ) => void;
  removeCooldown: (eventType: string, characterId?: string) => void;
  checkCooldown: (eventType: string, characterId?: string) => boolean;
  clearExpiredCooldowns: () => void;

  // Utilitários
  canProcessEvent: (eventType: string, characterId?: string) => boolean;
  setCurrentEvent: (event: SpecialEvent | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setEventChanceMultiplier: (multiplier: number) => void;

  // Histórico
  addToHistory: (
    eventId: string,
    eventType: string,
    characterId?: string,
    result?: SpecialEventResult
  ) => void;
  clearHistory: () => void;

  // Reset
  resetEventState: () => void;
}

export type EventStore = EventState & EventActions;

const initialState: EventState = {
  currentEvent: null,
  eventQueue: [],
  eventCooldowns: [],
  isProcessingEvent: false,
  eventHistory: [],
  eventChanceMultiplier: 1.0,
  globalEventCooldownMs: 5000, // 5 segundos entre eventos
  maxQueueSize: 10,
  lastError: null,
  processingEventId: null,
};

export const useEventStore = create<EventStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ==================== AÇÕES PRINCIPAIS ====================

      interactWithEvent: async (gameState, characterId) => {
        const state = get();

        // Verificações de segurança
        if (state.isProcessingEvent) {
          console.warn('[EventStore] Evento já está sendo processado');
          return;
        }

        if (gameState.mode !== 'special_event' || !gameState.currentSpecialEvent) {
          console.warn('[EventStore] Nenhum evento especial ativo');
          return;
        }

        const currentEvent = gameState.currentSpecialEvent;

        // Verificar cooldown
        if (!state.canProcessEvent(currentEvent.type, characterId)) {
          set({ lastError: 'Evento em cooldown ou não pode ser processado' });
          return;
        }

        set({
          isProcessingEvent: true,
          processingEventId: currentEvent.id,
          lastError: null,
        });

        try {
          // 1. Processar evento especial via GameService
          const updatedState = await GameService.processSpecialEventInteraction(gameState);

          // 2. Atualizar dados do personagem no banco
          if (updatedState.player) {
            // Atualizar HP/Mana se mudaram
            if (
              updatedState.player.hp !== gameState.player.hp ||
              updatedState.player.mana !== gameState.player.mana
            ) {
              await CharacterService.updateCharacterHpMana(
                characterId,
                updatedState.player.hp,
                updatedState.player.mana
              );
            }

            // Conceder ouro se ganhou
            const goldGained = updatedState.player.gold - gameState.player.gold;
            if (goldGained > 0) {
              await CharacterService.grantSecureGold(characterId, goldGained);
            }
          }

          // 3. Adicionar ao histórico
          get().addToHistory(currentEvent.id, currentEvent.type, characterId);

          // 4. Adicionar cooldown global
          get().addCooldown(
            'global',
            state.globalEventCooldownMs,
            characterId,
            'Cooldown global após evento'
          );

          // 5. Limpar evento atual
          set({ currentEvent: null });

          console.log('[EventStore] Evento processado com sucesso:', currentEvent.name);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          console.error('[EventStore] Erro ao processar evento:', error);
          set({ lastError: errorMessage });
        } finally {
          set({
            isProcessingEvent: false,
            processingEventId: null,
          });
        }
      },

      processEvent: async (eventId, characterId) => {
        const state = get();

        if (state.isProcessingEvent) {
          return null;
        }

        try {
          set({ isProcessingEvent: true, processingEventId: eventId });

          const result = await SpecialEventService.processSpecialEvent(characterId, eventId);

          if (result.success && result.data) {
            get().addToHistory(eventId, 'special_event', characterId, result.data);
            return result.data;
          }

          throw new Error(result.error || 'Falha ao processar evento');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          set({ lastError: errorMessage });
          return null;
        } finally {
          set({ isProcessingEvent: false, processingEventId: null });
        }
      },

      // ==================== GERENCIAMENTO DE FILA ====================

      queueEvent: event => {
        set(
          produce((state: EventState) => {
            if (state.eventQueue.length >= state.maxQueueSize) {
              console.warn('[EventStore] Fila de eventos cheia, removendo evento mais antigo');
              state.eventQueue.shift();
            }

            // Inserir ordenado por prioridade e data
            const insertIndex = state.eventQueue.findIndex(
              item =>
                item.priority < event.priority ||
                (item.priority === event.priority && item.scheduledFor > event.scheduledFor)
            );

            if (insertIndex === -1) {
              state.eventQueue.push(event);
            } else {
              state.eventQueue.splice(insertIndex, 0, event);
            }
          })
        );
      },

      processEventQueue: async () => {
        const state = get();
        const now = new Date();

        if (state.isProcessingEvent || state.eventQueue.length === 0) {
          return;
        }

        // Limpar cooldowns expirados
        get().clearExpiredCooldowns();

        // Processar eventos prontos
        const readyEvents = state.eventQueue.filter(
          event => event.scheduledFor <= now && get().canProcessEvent(event.type, event.characterId)
        );

        for (const event of readyEvents.slice(0, 3)) {
          // Processar até 3 eventos por vez
          try {
            if (event.type === 'special_event' && event.characterId) {
              const specialEvent = event.eventData as SpecialEvent;
              await get().processEvent(specialEvent.id, event.characterId);
            }

            get().removeEventFromQueue(event.id);
          } catch (error) {
            console.error('[EventStore] Erro ao processar evento da fila:', error);
            get().removeEventFromQueue(event.id);
          }
        }
      },

      clearEventQueue: () => {
        set({ eventQueue: [] });
      },

      removeEventFromQueue: eventId => {
        set(
          produce((state: EventState) => {
            state.eventQueue = state.eventQueue.filter(event => event.id !== eventId);
          })
        );
      },

      // ==================== GERENCIAMENTO DE COOLDOWNS ====================

      addCooldown: (eventType, durationMs, characterId, reason = 'Cooldown padrão') => {
        const expiresAt = new Date(Date.now() + durationMs);

        set(
          produce((state: EventState) => {
            // Remover cooldown existente do mesmo tipo e personagem
            state.eventCooldowns = state.eventCooldowns.filter(
              cd => !(cd.eventType === eventType && cd.characterId === characterId)
            );

            // Adicionar novo cooldown
            state.eventCooldowns.push({
              eventType,
              characterId,
              expiresAt,
              reason,
            });
          })
        );
      },

      removeCooldown: (eventType, characterId) => {
        set(
          produce((state: EventState) => {
            state.eventCooldowns = state.eventCooldowns.filter(
              cd => !(cd.eventType === eventType && cd.characterId === characterId)
            );
          })
        );
      },

      checkCooldown: (eventType, characterId) => {
        const state = get();
        const now = new Date();

        return state.eventCooldowns.some(
          cd => cd.eventType === eventType && cd.characterId === characterId && cd.expiresAt > now
        );
      },

      clearExpiredCooldowns: () => {
        const now = new Date();

        set(
          produce((state: EventState) => {
            state.eventCooldowns = state.eventCooldowns.filter(cd => cd.expiresAt > now);
          })
        );
      },

      // ==================== UTILITÁRIOS ====================

      canProcessEvent: (eventType, characterId) => {
        const state = get();

        // Verificar se está processando outro evento
        if (state.isProcessingEvent) {
          return false;
        }

        // Verificar cooldown específico do evento
        if (get().checkCooldown(eventType, characterId)) {
          return false;
        }

        // Verificar cooldown global
        if (get().checkCooldown('global', characterId)) {
          return false;
        }

        return true;
      },

      setCurrentEvent: event => {
        set({ currentEvent: event });
      },

      setError: error => {
        set({ lastError: error });
      },

      clearError: () => {
        set({ lastError: null });
      },

      setEventChanceMultiplier: multiplier => {
        set({ eventChanceMultiplier: Math.max(0.1, Math.min(5.0, multiplier)) });
      },

      // ==================== HISTÓRICO ====================

      addToHistory: (eventId, eventType, characterId, result) => {
        set(
          produce((state: EventState) => {
            state.eventHistory.unshift({
              eventId,
              eventType,
              characterId,
              result,
              processedAt: new Date(),
            });

            // Manter só os últimos 50 eventos
            if (state.eventHistory.length > 50) {
              state.eventHistory = state.eventHistory.slice(0, 50);
            }
          })
        );
      },

      clearHistory: () => {
        set({ eventHistory: [] });
      },

      // ==================== RESET ====================

      resetEventState: () => {
        set({ ...initialState });
      },
    }),
    {
      name: 'event-store',
    }
  )
);

// Hook para usar o store com seletor otimizado
export const useEvent = () => {
  const store = useEventStore();

  return {
    // Estados principais
    currentEvent: store.currentEvent,
    isProcessingEvent: store.isProcessingEvent,
    eventQueue: store.eventQueue,
    eventCooldowns: store.eventCooldowns,
    eventHistory: store.eventHistory,
    lastError: store.lastError,

    // Ações principais
    interactWithEvent: store.interactWithEvent,
    processEvent: store.processEvent,

    // Utilitários
    canProcessEvent: store.canProcessEvent,
    setCurrentEvent: store.setCurrentEvent,
    clearError: store.clearError,

    // Gerenciamento
    queueEvent: store.queueEvent,
    processEventQueue: store.processEventQueue,
    addCooldown: store.addCooldown,
    checkCooldown: store.checkCooldown,
  };
};

// Seletores específicos para performance
export const useEventProcessing = () =>
  useEventStore(state => ({
    isProcessingEvent: state.isProcessingEvent,
    processingEventId: state.processingEventId,
    lastError: state.lastError,
  }));

export const useEventQueue = () =>
  useEventStore(state => ({
    eventQueue: state.eventQueue,
    queueEvent: state.queueEvent,
    processEventQueue: state.processEventQueue,
    clearEventQueue: state.clearEventQueue,
  }));

export const useEventCooldowns = () =>
  useEventStore(state => ({
    eventCooldowns: state.eventCooldowns,
    addCooldown: state.addCooldown,
    checkCooldown: state.checkCooldown,
    canProcessEvent: state.canProcessEvent,
  }));
