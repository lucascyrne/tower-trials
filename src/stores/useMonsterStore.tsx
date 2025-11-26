import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produce } from 'immer';
import { type Enemy } from '../resources/game/game.model';
import { toast } from 'sonner';

interface MonsterCache {
  enemy: Enemy;
  expiry: number;
}

interface MonsterStoreState {
  // ✅ CORREÇÃO: Usar objeto simples ao invés de Map para evitar problemas com Immer
  monsterCache: Record<number, MonsterCache>;

  // Estado de loading
  loading: {
    fetchingMonster: boolean;
    loadingDrops: boolean;
  };

  // Erros
  error: string | null;

  // Configurações de cache
  cacheDuration: number;
}

interface MonsterStoreActions {
  // Ações de cache
  cacheMonster: (floor: number, enemy: Enemy) => void;
  getCachedMonster: (floor: number) => Enemy | null;
  clearCache: () => void;

  // Ações de loading
  setFetchingMonster: (loading: boolean) => void;
  setLoadingDrops: (loading: boolean) => void;

  // Ações de erro
  setError: (error: string | null) => void;

  // Ações de configuração
  setCacheDuration: (duration: number) => void;
}

type MonsterStore = MonsterStoreState & MonsterStoreActions;

const CACHE_DURATION = 30000; // 30 segundos

export const useMonsterStore = create<MonsterStore>()(
  subscribeWithSelector((set, get) => ({
    // === ESTADO INICIAL ===
    monsterCache: {},
    loading: {
      fetchingMonster: false,
      loadingDrops: false,
    },
    error: null,
    cacheDuration: CACHE_DURATION,

    // === AÇÕES DE CACHE ===
    cacheMonster: (floor: number, enemy: Enemy) => {
      set(
        produce(draft => {
          const now = Date.now();
          // ✅ CORREÇÃO: Usar objeto simples ao invés de Map
          draft.monsterCache[floor] = {
            enemy: {
              ...enemy,
              // ✅ CORREÇÃO: Garantir que active_effects seja sempre um objeto válido
              active_effects: enemy.active_effects || {
                buffs: [],
                debuffs: [],
                dots: [],
                hots: [],
                attribute_modifications: [],
              },
            },
            expiry: now + draft.cacheDuration,
          };
        })
      );
    },

    getCachedMonster: (floor: number) => {
      const cache = get().monsterCache[floor];
      if (!cache) return null;

      const now = Date.now();
      if (now >= cache.expiry) {
        // Cache expirado
        set(
          produce(draft => {
            delete draft.monsterCache[floor];
          })
        );
        return null;
      }
      return cache.enemy;
    },

    clearCache: () => {
      set(
        produce(draft => {
          draft.monsterCache = {};
        })
      );
    },

    // === AÇÕES DE LOADING ===
    setFetchingMonster: (loading: boolean) => {
      set(
        produce(draft => {
          draft.loading.fetchingMonster = loading;
        })
      );
    },

    setLoadingDrops: (loading: boolean) => {
      set(
        produce(draft => {
          draft.loading.loadingDrops = loading;
        })
      );
    },

    // === AÇÕES DE ERRO ===
    setError: (error: string | null) => {
      set(
        produce(draft => {
          draft.error = error;
        })
      );

      // Side effect: mostrar toast de erro
      if (error) {
        toast.error('Erro ao carregar monstro', {
          description: error,
        });
      }
    },

    // === AÇÕES DE CONFIGURAÇÃO ===
    setCacheDuration: (duration: number) => {
      set(
        produce(draft => {
          draft.cacheDuration = duration;
        })
      );
    },
  }))
);

// === SELETORES UTILITÁRIOS ===
export const useMonsterLoading = () => useMonsterStore(state => state.loading);
export const useMonsterError = () => useMonsterStore(state => state.error);
export const useMonsterCache = () => useMonsterStore(state => state.monsterCache);
