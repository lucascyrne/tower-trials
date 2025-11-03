import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';
import { useEffect, useCallback } from 'react';
import { type Character } from '../models/character.model';
import { CharacterService } from '../services/character.service';
import { toast } from 'sonner';
import { useAuth } from '../resources/auth/auth-hook';
import { useGameLog } from './useLogStore';

interface CharacterState {
  // Estado da lista de personagens
  characters: Character[];
  hasLoadedCharacters: boolean;
  isLoading: boolean;
  currentUserId: string | null;

  // Estado da seleção de personagem
  selectedCharacterId: string | null;
  selectedCharacterName: string | null;

  // Personagem selecionado completo (cache)
  selectedCharacter: Character | null;

  // ✅ P3: Sistema de cache unificado
  cacheTimestamps: Record<string, number>; // ID do personagem -> timestamp
  cacheDurations: {
    character: number; // Duração do cache de personagem individual (30s)
    userList: number; // Duração do cache da lista de usuário (15s)
  };
  lastUserListFetch: number | null; // Timestamp da última busca da lista de usuários
}

interface CharacterActions {
  // Ações da lista
  loadCharacters: (userId: string, setGameMessage?: (message: string) => void) => Promise<void>;
  createCharacter: (
    name: string,
    userId: string,
    addGameLogMessage?: (message: string) => void
  ) => Promise<void>;
  reloadCharacters: () => void;

  // Ações da seleção
  selectCharacter: (characterId: string, characterName: string) => void;
  clearSelection: () => void;

  // Ações de cache do personagem selecionado
  setSelectedCharacter: (character: Character | null) => void;
  loadSelectedCharacter: (characterId: string) => Promise<void>;

  // ✅ P3: Ações de gerenciamento de cache
  getCachedCharacter: (characterId: string) => Character | null;
  isCacheValid: (characterId: string) => boolean;
  isUserListCacheValid: () => boolean;
  invalidateCharacterCache: (characterId: string) => void;
  invalidateUserListCache: () => void;
  invalidateAllCache: () => void;

  // Ações de limpeza
  reset: () => void;
  resetForUser: (userId: string) => void;
}

type CharacterStore = CharacterState & CharacterActions;

export const useCharacterStore = create<CharacterStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Estado inicial
        characters: [],
        hasLoadedCharacters: false,
        isLoading: false,
        currentUserId: null,
        selectedCharacterId: null,
        selectedCharacterName: null,
        selectedCharacter: null,

        // ✅ P3: Estado inicial do cache
        cacheTimestamps: {},
        cacheDurations: {
          character: 30000, // 30 segundos
          userList: 15000, // 15 segundos
        },
        lastUserListFetch: null,

        // === AÇÕES DA LISTA DE PERSONAGENS ===

        loadCharacters: async (userId: string, setGameMessage?: (message: string) => void) => {
          const state = get();

          // Verificar se usuário mudou
          if (state.currentUserId !== userId) {
            set(
              produce(draft => {
                draft.characters = [];
                draft.hasLoadedCharacters = false;
                draft.currentUserId = userId;
                draft.isLoading = false;
                // Manter seleção se válida para o novo usuário
                if (draft.selectedCharacterId) {
                  // Limpar seleção se não pertence ao usuário atual
                  draft.selectedCharacterId = null;
                  draft.selectedCharacterName = null;
                  draft.selectedCharacter = null;
                }
              })
            );
          }

          // Só carregar se usuário existe, não carregou ainda e não está carregando
          if (!userId || state.hasLoadedCharacters || state.isLoading) {
            return;
          }

          try {
            set(
              produce(draft => {
                draft.isLoading = true;
              })
            );

            const response = await CharacterService.getUserCharacters(userId);

            if (response.success && response.data) {
              const now = Date.now();
              set(
                produce(draft => {
                  draft.characters = response.data!;
                  draft.hasLoadedCharacters = true;

                  // ✅ P3: Atualizar cache timestamps
                  draft.lastUserListFetch = now;
                  response.data!.forEach(character => {
                    draft.cacheTimestamps[character.id] = now;
                  });

                  // Verificar se o personagem selecionado ainda existe
                  if (draft.selectedCharacterId) {
                    const selectedExists = response.data!.find(
                      c => c.id === draft.selectedCharacterId
                    );
                    if (!selectedExists) {
                      draft.selectedCharacterId = null;
                      draft.selectedCharacterName = null;
                      draft.selectedCharacter = null;
                    } else {
                      // Atualizar dados do personagem selecionado
                      draft.selectedCharacter = selectedExists;
                      draft.selectedCharacterName = selectedExists.name;
                    }
                  }
                })
              );

              const messageFunction = setGameMessage || (() => {});
              if (response.data.length > 0) {
                messageFunction('Selecione um personagem para jogar!');
              } else {
                messageFunction('Você ainda não tem personagens. Crie um para começar!');
              }
            } else if (response.error) {
              console.error('[CharacterStore] Erro ao carregar personagens:', response.error);
              toast.error('Erro', {
                description: response.error,
              });
            }
          } catch (error) {
            console.error('[CharacterStore] Erro ao carregar personagens:', error);
            toast.error('Erro', {
              description: error instanceof Error ? error.message : 'Erro ao carregar personagens',
            });
          } finally {
            set(
              produce(draft => {
                draft.isLoading = false;
              })
            );
          }
        },

        createCharacter: async (
          name: string,
          userId: string,
          addGameLogMessage?: (message: string) => void
        ) => {
          if (!userId) {
            toast.error('Erro', {
              description: 'Você precisa estar logado para criar um personagem.',
            });
            return;
          }

          set(
            produce(draft => {
              draft.isLoading = true;
            })
          );

          try {
            const response = await CharacterService.createCharacter({
              user_id: userId,
              name,
            });

            if (response.success && response.data) {
              // Recarregar lista completa
              const newCharactersResponse = await CharacterService.getUserCharacters(userId);

              if (newCharactersResponse.success && newCharactersResponse.data) {
                set(
                  produce(draft => {
                    draft.characters = newCharactersResponse.data!;
                  })
                );

                const newCharacter = newCharactersResponse.data.find(c => c.name === name);
                if (newCharacter) {
                  toast.success('Sucesso', {
                    description: 'Personagem criado com sucesso!',
                  });
                  addGameLogMessage?.(`${newCharacter.name} foi criado!`);
                }
              }
            } else if (response.error) {
              throw new Error(response.error);
            }
          } catch (error) {
            console.error('[CharacterStore] Erro ao criar personagem:', error);
            toast.error('Erro', {
              description: error instanceof Error ? error.message : 'Erro ao criar personagem',
            });
          } finally {
            set(
              produce(draft => {
                draft.isLoading = false;
              })
            );
          }
        },

        reloadCharacters: () => {
          set(
            produce(draft => {
              draft.hasLoadedCharacters = false;
            })
          );
        },

        // === AÇÕES DA SELEÇÃO DE PERSONAGEM ===

        selectCharacter: (characterId: string, characterName: string) => {
          set(
            produce(draft => {
              draft.selectedCharacterId = characterId;
              draft.selectedCharacterName = characterName;

              // Tentar encontrar o personagem nos dados já carregados
              const character = draft.characters.find((c: Character) => c.id === characterId);
              if (character) {
                draft.selectedCharacter = character;
              } else {
                // Limpar cache se não encontrado
                draft.selectedCharacter = null;
              }
            })
          );
        },

        clearSelection: () => {
          set(
            produce(draft => {
              draft.selectedCharacterId = null;
              draft.selectedCharacterName = null;
              draft.selectedCharacter = null;
            })
          );
        },

        // === AÇÕES DE CACHE DO PERSONAGEM SELECIONADO ===

        setSelectedCharacter: (character: Character | null) => {
          set(
            produce(draft => {
              draft.selectedCharacter = character;
            })
          );
        },

        loadSelectedCharacter: async (characterId: string) => {
          try {
            const response = await CharacterService.getCharacter(characterId);

            if (response.success && response.data) {
              set(
                produce(draft => {
                  draft.selectedCharacter = response.data!;
                  // Atualizar também na lista se existir
                  const index = draft.characters.findIndex((c: Character) => c.id === characterId);
                  if (index !== -1) {
                    draft.characters[index] = response.data!;
                  }
                })
              );
            }
          } catch (error) {
            console.error('[CharacterStore] Erro ao carregar personagem completo:', error);
          }
        },

        // === ✅ P3: AÇÕES DE GERENCIAMENTO DE CACHE ===

        getCachedCharacter: (characterId: string) => {
          const state = get();
          const character = state.characters.find(c => c.id === characterId);

          if (!character) {
            return state.selectedCharacter?.id === characterId ? state.selectedCharacter : null;
          }

          // Verificar se cache é válido
          if (!state.isCacheValid(characterId)) {
            return null;
          }

          return character;
        },

        isCacheValid: (characterId: string) => {
          const state = get();
          const timestamp = state.cacheTimestamps[characterId];

          if (!timestamp) return false;

          const age = Date.now() - timestamp;
          return age <= state.cacheDurations.character;
        },

        isUserListCacheValid: () => {
          const state = get();
          if (!state.lastUserListFetch) return false;

          const age = Date.now() - state.lastUserListFetch;
          return age <= state.cacheDurations.userList;
        },

        invalidateCharacterCache: (characterId: string) => {
          set(
            produce(draft => {
              delete draft.cacheTimestamps[characterId];
            })
          );
        },

        invalidateUserListCache: () => {
          set(
            produce(draft => {
              draft.lastUserListFetch = null;
              draft.hasLoadedCharacters = false;
            })
          );
        },

        invalidateAllCache: () => {
          set(
            produce(draft => {
              draft.cacheTimestamps = {};
              draft.lastUserListFetch = null;
              draft.hasLoadedCharacters = false;
            })
          );
        },

        // === AÇÕES DE LIMPEZA ===

        reset: () => {
          set(
            produce(draft => {
              draft.characters = [];
              draft.hasLoadedCharacters = false;
              draft.isLoading = false;
              draft.currentUserId = null;
              draft.selectedCharacterId = null;
              draft.selectedCharacterName = null;
              draft.selectedCharacter = null;
              // ✅ P3: Limpar cache também
              draft.cacheTimestamps = {};
              draft.lastUserListFetch = null;
            })
          );
        },

        resetForUser: (userId: string) => {
          set(
            produce(draft => {
              draft.characters = [];
              draft.hasLoadedCharacters = false;
              draft.isLoading = false;
              draft.currentUserId = userId;
              draft.selectedCharacterId = null;
              draft.selectedCharacterName = null;
              draft.selectedCharacter = null;
              // ✅ P3: Limpar cache
              draft.cacheTimestamps = {};
              draft.lastUserListFetch = null;
            })
          );
        },
      }),
      {
        name: 'character-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: state => ({
          selectedCharacterId: state.selectedCharacterId,
          selectedCharacterName: state.selectedCharacterName,
        }),
      }
    )
  )
);

// Seletores utilitários
export const useCharacterList = () =>
  useCharacterStore(state => ({
    characters: state.characters,
    hasLoadedCharacters: state.hasLoadedCharacters,
    isLoading: state.isLoading,
    loadCharacters: state.loadCharacters,
    createCharacter: state.createCharacter,
    reloadCharacters: state.reloadCharacters,
  }));

export const useCharacterSelection = () =>
  useCharacterStore(state => ({
    selectedCharacterId: state.selectedCharacterId,
    selectedCharacterName: state.selectedCharacterName,
    selectedCharacter: state.selectedCharacter,
    selectCharacter: state.selectCharacter,
    clearSelection: state.clearSelection,
    loadSelectedCharacter: state.loadSelectedCharacter,
  }));

// Seletores individuais memoizados para evitar re-renders desnecessários
export const useCharacterListData = () => useCharacterStore(state => state.characters);

export const useCharacterListLoading = () => useCharacterStore(state => state.isLoading);

export const useCharacterListHasLoaded = () =>
  useCharacterStore(state => state.hasLoadedCharacters);

export const useSelectedCharacterId = () => useCharacterStore(state => state.selectedCharacterId);

export const useSelectedCharacterName = () =>
  useCharacterStore(state => state.selectedCharacterName);

export const useSelectedCharacterData = () => useCharacterStore(state => state.selectedCharacter);

// ===== HOOKS INTEGRADOS =====

/**
 * Hook que integra o store de personagem com autenticação
 * Carrega automaticamente os personagens quando o usuário muda
 */
export function useCharacterWithAuth() {
  const { user } = useAuth();
  const { addGameLogMessage, setGameMessage } = useGameLog();

  // Memoizar as funções do store para evitar re-criações
  const {
    characters,
    hasLoadedCharacters,
    isLoading,
    currentUserId,
    selectedCharacterId,
    selectedCharacterName,
    selectedCharacter,
    loadCharacters: storeLoadCharacters,
    createCharacter: storeCreateCharacter,
    reloadCharacters,
    selectCharacter,
    clearSelection,
    loadSelectedCharacter,
    setSelectedCharacter,
    reset,
    resetForUser,
  } = useCharacterStore();

  // Criar versões estáveis das funções
  const loadCharacters = useCallback(
    (userId: string, messageFunction?: (message: string) => void) => {
      return storeLoadCharacters(userId, messageFunction);
    },
    [storeLoadCharacters]
  );

  const createCharacter = useCallback(
    (name: string, userId: string, logFunction?: (message: string) => void) => {
      return storeCreateCharacter(name, userId, logFunction);
    },
    [storeCreateCharacter]
  );

  // Carregar personagens automaticamente quando usuário muda
  useEffect(() => {
    if (user?.id) {
      storeLoadCharacters(user.id, setGameMessage);
    } else {
      // Limpar estado quando usuário desloga
      reset();
    }
  }, [user?.id, storeLoadCharacters, setGameMessage, reset]);

  return {
    characters,
    hasLoadedCharacters,
    isLoading,
    currentUserId,
    selectedCharacterId,
    selectedCharacterName,
    selectedCharacter,
    loadCharacters,
    reloadCharacters,
    selectCharacter,
    clearSelection,
    loadSelectedCharacter,
    setSelectedCharacter,
    reset,
    resetForUser,
    user,
    // Versões simplificadas das ações que não precisam de parâmetros
    createCharacter: useCallback(
      (name: string) =>
        user?.id ? createCharacter(name, user.id, addGameLogMessage) : Promise.resolve(),
      [user?.id, createCharacter, addGameLogMessage]
    ),
  };
}

/**
 * Hook focado apenas na seleção de personagem
 */
export function useCharacterSelectionWithCache() {
  // Usar seletores memoizados para evitar re-renders
  const selectedCharacterId = useCharacterStore(state => state.selectedCharacterId);
  const selectedCharacterName = useCharacterStore(state => state.selectedCharacterName);
  const selectedCharacter = useCharacterStore(state => state.selectedCharacter);
  const selectCharacter = useCharacterStore(state => state.selectCharacter);
  const clearSelection = useCharacterStore(state => state.clearSelection);
  const loadSelectedCharacter = useCharacterStore(state => state.loadSelectedCharacter);

  // Carregar dados completos do personagem selecionado quando muda
  useEffect(() => {
    if (selectedCharacterId && !selectedCharacter) {
      loadSelectedCharacter(selectedCharacterId);
    }
  }, [selectedCharacterId, selectedCharacter, loadSelectedCharacter]);

  return {
    selectedCharacterId,
    selectedCharacterName,
    selectedCharacter,
    selectCharacter,
    clearSelection,
    loadSelectedCharacter,
  };
}

/**
 * Hook combinado que oferece todas as funcionalidades
 * Recomendado para componentes que precisam de acesso completo
 */
export function useCharacterManagement() {
  const characterWithAuth = useCharacterWithAuth();
  const selectionWithCache = useCharacterSelectionWithCache();

  return {
    // Estado da lista
    characters: characterWithAuth.characters,
    hasLoadedCharacters: characterWithAuth.hasLoadedCharacters,
    isLoading: characterWithAuth.isLoading,

    // Estado da seleção
    selectedCharacterId: selectionWithCache.selectedCharacterId,
    selectedCharacterName: selectionWithCache.selectedCharacterName,
    selectedCharacter: selectionWithCache.selectedCharacter,

    // Ações da lista
    createCharacter: characterWithAuth.createCharacter,
    reloadCharacters: characterWithAuth.reloadCharacters,

    // Ações da seleção
    selectCharacter: selectionWithCache.selectCharacter,
    clearSelection: selectionWithCache.clearSelection,

    // Ações de limpeza
    reset: characterWithAuth.reset,

    // Dados do usuário
    user: characterWithAuth.user,
  };
}
