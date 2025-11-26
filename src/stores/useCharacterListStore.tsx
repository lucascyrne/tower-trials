import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produce } from 'immer';
import { useEffect } from 'react';
import { type Character } from '../resources/character/character.model';
import { CharacterService } from '../resources/character/character.service';
import { toast } from 'sonner';
import { useAuth } from '../resources/auth/auth-hook';
import { useGameLog } from './useLogStore';

interface CharacterListState {
  characters: Character[];
  hasLoadedCharacters: boolean;
  isLoading: boolean;
  currentUserId: string | null;
}

interface CharacterListActions {
  setCharacters: (characters: Character[]) => void;
  setLoading: (loading: boolean) => void;
  setHasLoadedCharacters: (loaded: boolean) => void;
  setCurrentUserId: (userId: string | null) => void;
  loadCharacters: (
    userId: string,
    addGameLogMessage?: (message: string) => void,
    setGameMessage?: (message: string) => void
  ) => Promise<void>;
  createCharacter: (
    name: string,
    userId: string,
    addGameLogMessage?: (message: string) => void
  ) => Promise<void>;
  reloadCharacters: () => void;
  reset: () => void;
}

type CharacterListStore = CharacterListState & CharacterListActions;

export const useCharacterListStore = create<CharacterListStore>()(
  subscribeWithSelector((set, get) => ({
    // Estado inicial
    characters: [],
    hasLoadedCharacters: false,
    isLoading: false,
    currentUserId: null,

    // Ações básicas
    setCharacters: (characters: Character[]) =>
      set(
        produce(state => {
          state.characters = characters;
        })
      ),

    setLoading: (isLoading: boolean) =>
      set(
        produce(state => {
          state.isLoading = isLoading;
        })
      ),

    setHasLoadedCharacters: (hasLoadedCharacters: boolean) =>
      set(
        produce(state => {
          state.hasLoadedCharacters = hasLoadedCharacters;
        })
      ),

    setCurrentUserId: (currentUserId: string | null) =>
      set(
        produce(state => {
          state.currentUserId = currentUserId;
        })
      ),

    // Ação para carregar personagens
    loadCharacters: async (userId: string, setGameMessage?: (message: string) => void) => {
      const state = get();

      // Verificar se usuário mudou
      if (state.currentUserId !== userId) {
        console.log('[CharacterListStore] Usuário mudou, resetando estado');
        set(
          produce(draft => {
            draft.characters = [];
            draft.hasLoadedCharacters = false;
            draft.currentUserId = userId;
            draft.isLoading = false;
          })
        );
      }

      // Só carregar se usuário existe, não carregou ainda e não está carregando
      if (!userId || state.hasLoadedCharacters || state.isLoading) {
        return;
      }

      try {
        console.log('[CharacterListStore] Carregando personagens para:', userId);
        set(
          produce(draft => {
            draft.isLoading = true;
          })
        );

        const response = await CharacterService.getUserCharacters(userId);

        if (response.success && response.data) {
          set(
            produce(draft => {
              draft.characters = response.data!;
              draft.hasLoadedCharacters = true;
            })
          );

          if (response.data.length > 0) {
            setGameMessage?.('Selecione um personagem para jogar!');
          } else {
            setGameMessage?.('Você ainda não tem personagens. Crie um para começar!');
          }
        } else if (response.error) {
          console.error('[CharacterListStore] Erro ao carregar personagens:', response.error);
          toast.error('Erro', {
            description: response.error,
          });
        }
      } catch (error) {
        console.error('[CharacterListStore] Erro ao carregar personagens:', error);
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

    // Ação para criar personagem
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
          // Recarregar lista ao invés de buscar o personagem individual
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
        console.error('[CharacterListStore] Erro ao criar personagem:', error);
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

    // Ação para forçar recarga
    reloadCharacters: () => {
      console.log('[CharacterListStore] Forçando recarga de personagens');
      set(
        produce(draft => {
          draft.hasLoadedCharacters = false;
        })
      );
    },

    // Ação para resetar estado
    reset: () => {
      console.log('[CharacterListStore] Resetando estado');
      set(
        produce(draft => {
          draft.characters = [];
          draft.hasLoadedCharacters = false;
          draft.isLoading = false;
          draft.currentUserId = null;
        })
      );
    },
  }))
);

// ===== HOOKS INTEGRADOS =====

/**
 * Hook focado apenas na lista de personagens com integração automática
 */
export function useCharacterListWithAuth() {
  const { user } = useAuth();
  const { addGameLogMessage, setGameMessage } = useGameLog();
  const listStore = useCharacterListStore();

  useEffect(() => {
    if (user?.id) {
      listStore.loadCharacters(user.id, addGameLogMessage, setGameMessage);
    }
  }, [user?.id, listStore.loadCharacters, addGameLogMessage, setGameMessage]);

  return {
    ...listStore,
    user,
    createCharacter: (name: string) =>
      user?.id ? listStore.createCharacter(name, user.id, addGameLogMessage) : Promise.resolve(),
  };
}
