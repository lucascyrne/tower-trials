import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { produce } from 'immer';
import type { GameLogEntry, GameLogType } from '../models/game.model';
import { useCallback } from 'react';

// Tipos estendidos para o sistema avançado de logs
export interface ExtendedGameLogEntry extends GameLogEntry {
  id: string;
  timestamp: Date;
  category: LogCategory;
  metadata?: Record<string, unknown>;
}

export type LogCategory = 'game' | 'debug' | 'analytics' | 'error';

export interface LogFilter {
  types: Set<GameLogType>;
  categories: Set<LogCategory>;
  timeRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
}

export interface LogState {
  // Estados principais
  gameMessage: string;
  gameLogs: ExtendedGameLogEntry[];
  debugLogs: ExtendedGameLogEntry[];

  // Configurações
  maxGameLogs: number;
  maxDebugLogs: number;
  enableDebugLogs: boolean;

  // Filtros e busca
  currentFilter: LogFilter;
  filteredLogs: ExtendedGameLogEntry[];

  // Estatísticas
  logStats: {
    totalLogsToday: number;
    lastLogTime: Date | null;
    logsByType: Record<GameLogType, number>;
  };

  // Estado de UI
  isLogVisible: boolean;
  autoScroll: boolean;
}

export interface LogActions {
  // Ações principais
  addGameLogMessage: (
    message: string,
    type?: GameLogType,
    metadata?: Record<string, unknown>
  ) => void;
  addDebugLog: (
    message: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    metadata?: Record<string, unknown>
  ) => void;
  setGameMessage: (message: string) => void;

  // Gerenciamento de logs
  clearGameLogs: () => void;
  clearDebugLogs: () => void;
  clearAllLogs: () => void;
  removeLogs: (ids: string[]) => void;

  // Filtros
  setFilter: (filter: Partial<LogFilter>) => void;
  resetFilter: () => void;
  applyFilter: () => void;

  // Busca
  searchLogs: (term: string) => void;

  // Configurações
  setMaxGameLogs: (max: number) => void;
  setMaxDebugLogs: (max: number) => void;
  toggleDebugLogs: () => void;
  setAutoScroll: (enabled: boolean) => void;

  // UI
  toggleLogVisibility: () => void;

  // Utilitários
  exportLogs: (category?: LogCategory) => string;
  importLogs: (data: string) => boolean;
  getLogsByType: (type: GameLogType) => ExtendedGameLogEntry[];
  getLogsByCategory: (category: LogCategory) => ExtendedGameLogEntry[];
}

export type LogStore = LogState & LogActions;

const initialFilter: LogFilter = {
  types: new Set([
    'system',
    'battle',
    'lore',
    'skill_xp',
    'level_up',
    'equipment',
    'enemy_action',
    'player_action',
    'damage',
    'healing',
  ]),
  categories: new Set(['game']),
};

const initialState: LogState = {
  gameMessage: '',
  gameLogs: [],
  debugLogs: [],
  maxGameLogs: 1000,
  maxDebugLogs: 500,
  enableDebugLogs: false,
  currentFilter: initialFilter,
  filteredLogs: [],
  logStats: {
    totalLogsToday: 0,
    lastLogTime: null,
    logsByType: {
      system: 0,
      battle: 0,
      lore: 0,
      skill_xp: 0,
      level_up: 0,
      equipment: 0,
      enemy_action: 0,
      player_action: 0,
      damage: 0,
      healing: 0,
    },
  },
  isLogVisible: true,
  autoScroll: true,
};

// Função para gerar ID único
const generateLogId = () => `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Função para verificar se é o mesmo dia
const isSameDay = (date1: Date, date2: Date) => {
  return date1.toDateString() === date2.toDateString();
};

export const useLogStore = create<LogStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ==================== AÇÕES PRINCIPAIS ====================

        addGameLogMessage: (message, type = 'system', metadata = {}) => {
          const state = get();

          // Verificar duplicatas nos últimos 5 logs (comportamento original)
          const recentLogs = state.gameLogs.slice(-5);
          const isDuplicate = recentLogs.some(log => log.text === message && log.type === type);

          if (isDuplicate) {
            return;
          }

          const newLog: ExtendedGameLogEntry = {
            id: generateLogId(),
            text: message,
            type,
            timestamp: new Date(),
            category: 'game',
            metadata,
          };

          set(
            produce((state: LogState) => {
              // Adicionar log
              state.gameLogs.push(newLog);

              // Manter limite
              if (state.gameLogs.length > state.maxGameLogs) {
                state.gameLogs = state.gameLogs.slice(-state.maxGameLogs);
              }

              // Atualizar estatísticas
              state.logStats.lastLogTime = newLog.timestamp;
              state.logStats.logsByType[type]++;

              // Atualizar contador diário
              if (
                !state.logStats.lastLogTime ||
                !isSameDay(state.logStats.lastLogTime, newLog.timestamp)
              ) {
                state.logStats.totalLogsToday = 1;
              } else {
                state.logStats.totalLogsToday++;
              }
            })
          );

          // Aplicar filtro automaticamente
          get().applyFilter();
        },

        addDebugLog: (message, level, metadata = {}) => {
          const state = get();

          if (!state.enableDebugLogs) {
            return;
          }

          const newLog: ExtendedGameLogEntry = {
            id: generateLogId(),
            text: `[${level.toUpperCase()}] ${message}`,
            type: 'system',
            timestamp: new Date(),
            category: 'debug',
            metadata: { level, ...metadata },
          };

          set(
            produce((state: LogState) => {
              state.debugLogs.push(newLog);

              // Manter limite
              if (state.debugLogs.length > state.maxDebugLogs) {
                state.debugLogs = state.debugLogs.slice(-state.maxDebugLogs);
              }
            })
          );

          get().applyFilter();
        },

        setGameMessage: message => {
          set({ gameMessage: message });
        },

        // ==================== GERENCIAMENTO DE LOGS ====================

        clearGameLogs: () => {
          set(
            produce((state: LogState) => {
              state.gameLogs = [];
              state.logStats.logsByType = {
                system: 0,
                battle: 0,
                lore: 0,
                skill_xp: 0,
                level_up: 0,
                equipment: 0,
                enemy_action: 0,
                player_action: 0,
                damage: 0,
                healing: 0,
              };
            })
          );
          get().applyFilter();
        },

        clearDebugLogs: () => {
          set({ debugLogs: [] });
          get().applyFilter();
        },

        clearAllLogs: () => {
          get().clearGameLogs();
          get().clearDebugLogs();
        },

        removeLogs: ids => {
          set(
            produce((state: LogState) => {
              state.gameLogs = state.gameLogs.filter(log => !ids.includes(log.id));
              state.debugLogs = state.debugLogs.filter(log => !ids.includes(log.id));
            })
          );
          get().applyFilter();
        },

        // ==================== FILTROS ====================

        setFilter: filter => {
          set(
            produce((state: LogState) => {
              Object.assign(state.currentFilter, filter);
            })
          );
          get().applyFilter();
        },

        resetFilter: () => {
          set({ currentFilter: initialFilter });
          get().applyFilter();
        },

        applyFilter: () => {
          const state = get();
          const { currentFilter, gameLogs, debugLogs } = state;

          const allLogs = [
            ...gameLogs.filter(() => currentFilter.categories.has('game')),
            ...(state.enableDebugLogs
              ? debugLogs.filter(() => currentFilter.categories.has('debug'))
              : []),
          ];

          const filtered = allLogs.filter((log: ExtendedGameLogEntry) => {
            // Filtrar por tipo
            if (!currentFilter.types.has(log.type)) {
              return false;
            }

            // Filtrar por período
            if (currentFilter.timeRange) {
              const logTime = log.timestamp.getTime();
              const startTime = currentFilter.timeRange.start.getTime();
              const endTime = currentFilter.timeRange.end.getTime();

              if (logTime < startTime || logTime > endTime) {
                return false;
              }
            }

            // Filtrar por termo de busca
            if (currentFilter.searchTerm) {
              const searchLower = currentFilter.searchTerm.toLowerCase();
              return log.text.toLowerCase().includes(searchLower);
            }

            return true;
          });

          // Ordenar por timestamp (mais recente primeiro)
          filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

          set({ filteredLogs: filtered });
        },

        // ==================== BUSCA ====================

        searchLogs: term => {
          get().setFilter({ searchTerm: term });
        },

        // ==================== CONFIGURAÇÕES ====================

        setMaxGameLogs: max => {
          set({ maxGameLogs: Math.max(10, Math.min(10000, max)) });
        },

        setMaxDebugLogs: max => {
          set({ maxDebugLogs: Math.max(10, Math.min(5000, max)) });
        },

        toggleDebugLogs: () => {
          set(
            produce((state: LogState) => {
              state.enableDebugLogs = !state.enableDebugLogs;

              // Atualizar filtro para incluir/excluir debug logs
              if (state.enableDebugLogs) {
                state.currentFilter.categories.add('debug');
              } else {
                state.currentFilter.categories.delete('debug');
              }
            })
          );
          get().applyFilter();
        },

        setAutoScroll: enabled => {
          set({ autoScroll: enabled });
        },

        // ==================== UI ====================

        toggleLogVisibility: () => {
          set(
            produce((state: LogState) => {
              state.isLogVisible = !state.isLogVisible;
            })
          );
        },

        // ==================== UTILITÁRIOS ====================

        exportLogs: category => {
          const state = get();
          const logsToExport = category
            ? state.filteredLogs.filter((log: ExtendedGameLogEntry) => log.category === category)
            : state.filteredLogs;

          const exportData = {
            exportedAt: new Date().toISOString(),
            category,
            logs: logsToExport,
            stats: state.logStats,
          };

          return JSON.stringify(exportData, null, 2);
        },

        importLogs: data => {
          try {
            const importData = JSON.parse(data);

            if (!importData.logs || !Array.isArray(importData.logs)) {
              return false;
            }

            set(
              produce((state: LogState) => {
                // Adicionar logs importados
                for (const log of importData.logs) {
                  if (log.category === 'game') {
                    state.gameLogs.push({
                      ...log,
                      id: generateLogId(),
                      timestamp: new Date(log.timestamp || Date.now()),
                    });
                  } else if (log.category === 'debug' && state.enableDebugLogs) {
                    state.debugLogs.push({
                      ...log,
                      id: generateLogId(),
                      timestamp: new Date(log.timestamp || Date.now()),
                    });
                  }
                }

                // Manter limites
                if (state.gameLogs.length > state.maxGameLogs) {
                  state.gameLogs = state.gameLogs.slice(-state.maxGameLogs);
                }
                if (state.debugLogs.length > state.maxDebugLogs) {
                  state.debugLogs = state.debugLogs.slice(-state.maxDebugLogs);
                }
              })
            );

            get().applyFilter();
            return true;
          } catch (error) {
            console.error('[LogStore] Erro ao importar logs:', error);
            return false;
          }
        },

        getLogsByType: type => {
          const state = get();
          return [...state.gameLogs, ...state.debugLogs].filter(
            (log: ExtendedGameLogEntry) => log.type === type
          );
        },

        getLogsByCategory: category => {
          const state = get();
          if (category === 'game') {
            return state.gameLogs;
          } else if (category === 'debug') {
            return state.debugLogs;
          }
          return [];
        },
      }),
      {
        name: 'log-store',
        // Configurar o que deve ser persistido
        partialize: state => ({
          // Persistir apenas logs do jogo, não debug
          gameLogs: state.gameLogs.slice(-100), // Últimos 100 logs
          maxGameLogs: state.maxGameLogs,
          enableDebugLogs: state.enableDebugLogs,
          autoScroll: state.autoScroll,
          logStats: state.logStats,
        }),
        // Versão do store para migrações futuras
        version: 1,
      }
    ),
    {
      name: 'log-store',
    }
  )
);

// ==================== HOOKS OTIMIZADOS ====================

// Hook principal com seletor otimizado
export const useGameLog = () => {
  const store = useLogStore();

  // Estabilizar as funções com useCallback para evitar re-renders
  const addGameLogMessage = useCallback(
    (message: string, type?: GameLogType, metadata?: Record<string, unknown>) => {
      store.addGameLogMessage(message, type, metadata);
    },
    [store.addGameLogMessage]
  );

  const setGameMessage = useCallback(
    (message: string) => {
      store.setGameMessage(message);
    },
    [store.setGameMessage]
  );

  const clearGameLogs = useCallback(() => {
    store.clearGameLogs();
  }, [store.clearGameLogs]);

  const searchLogs = useCallback(
    (term: string) => {
      store.searchLogs(term);
    },
    [store.searchLogs]
  );

  const setFilter = useCallback(
    (filter: Partial<LogFilter>) => {
      store.setFilter(filter);
    },
    [store.setFilter]
  );

  const toggleLogVisibility = useCallback(() => {
    store.toggleLogVisibility();
  }, [store.toggleLogVisibility]);

  return {
    // Estados principais (mantém compatibilidade)
    gameMessage: store.gameMessage,
    gameLog: store.filteredLogs.map((log: ExtendedGameLogEntry) => ({
      text: log.text,
      type: log.type,
    })),

    // Ações principais (mantém compatibilidade) - agora estabilizadas
    addGameLogMessage,
    setGameMessage,

    // Funcionalidades avançadas - também estabilizadas
    clearGameLogs,
    searchLogs,
    setFilter,
    logStats: store.logStats,
    isLogVisible: store.isLogVisible,
    toggleLogVisibility,
  };
};

// Seletores específicos para performance
export const useLogMessages = () =>
  useLogStore(state => ({
    gameMessage: state.gameMessage,
    gameLogs: state.filteredLogs,
    autoScroll: state.autoScroll,
  }));

export const useLogControls = () =>
  useLogStore(state => ({
    addGameLogMessage: state.addGameLogMessage,
    addDebugLog: state.addDebugLog,
    clearGameLogs: state.clearGameLogs,
    clearDebugLogs: state.clearDebugLogs,
    setFilter: state.setFilter,
    searchLogs: state.searchLogs,
  }));

export const useLogStats = () =>
  useLogStore(state => ({
    logStats: state.logStats,
    totalLogs: state.gameLogs.length + state.debugLogs.length,
    enableDebugLogs: state.enableDebugLogs,
    toggleDebugLogs: state.toggleDebugLogs,
  }));

export const useLogSettings = () =>
  useLogStore(state => ({
    maxGameLogs: state.maxGameLogs,
    maxDebugLogs: state.maxDebugLogs,
    enableDebugLogs: state.enableDebugLogs,
    autoScroll: state.autoScroll,
    setMaxGameLogs: state.setMaxGameLogs,
    setMaxDebugLogs: state.setMaxDebugLogs,
    toggleDebugLogs: state.toggleDebugLogs,
    setAutoScroll: state.setAutoScroll,
  }));

// Hook para compatibilidade com contexto antigo
export const useLogContext = () => {
  const { gameMessage, gameLog, addGameLogMessage, setGameMessage } = useGameLog();

  return {
    gameMessage,
    gameLog,
    addGameLogMessage,
    setGameMessage,
  };
};
