import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';

interface CharacterSelectionState {
  selectedCharacterId: string | null;
  selectedCharacterName: string | null;
}

interface CharacterSelectionActions {
  selectCharacter: (characterId: string, characterName: string) => void;
  clearSelection: () => void;
}

type CharacterSelectionStore = CharacterSelectionState & CharacterSelectionActions;

export const useCharacterSelectionStore = create<CharacterSelectionStore>()(
  persist(
    set => ({
      // Estado inicial
      selectedCharacterId: null,
      selectedCharacterName: null,

      // Ações
      selectCharacter: (characterId: string, characterName: string) => {
        console.log('[CharacterSelectionStore] Selecionando personagem:', {
          characterId,
          characterName,
        });
        set(
          produce(state => {
            state.selectedCharacterId = characterId;
            state.selectedCharacterName = characterName;
          })
        );
      },

      clearSelection: () => {
        console.log('[CharacterSelectionStore] Limpando seleção');
        set(
          produce(state => {
            state.selectedCharacterId = null;
            state.selectedCharacterName = null;
          })
        );
      },
    }),
    {
      name: 'character-selection-storage', // Nome da chave no localStorage
      partialize: state => ({
        selectedCharacterId: state.selectedCharacterId,
        selectedCharacterName: state.selectedCharacterName,
      }),
    }
  )
);
