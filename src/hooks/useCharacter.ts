import { useMemo } from 'react';
import {
  useCharacterBasicOperations,
  useCharacterHubOperations,
  useCharacterBattleOperations,
  useCharacterEventOperations,
} from '@/hooks/useCharacterOperations';
import { useCharacterManagement } from '@/stores/useCharacterStore';

/**
 * Hook consolidado que combina operações de personagem
 * Substitui o hook deprecated useCharacter()
 */
export function useCharacterOperations() {
  const { characters, createCharacter, reloadCharacters, selectedCharacterId } = useCharacterManagement();

  const { selectCharacter, updatePlayerStats } = useCharacterBasicOperations();
  const { loadCharacterForHub } = useCharacterHubOperations();
  const { initializeBattle } = useCharacterBattleOperations();
  const { initializeSpecialEvent } = useCharacterEventOperations();

  // Encontrar personagem selecionado baseado no ID
  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId) return null;
    return characters.find(char => char.id === selectedCharacterId) || null;
  }, [selectedCharacterId, characters]);

  return useMemo(
    () => ({
      characters,
      selectedCharacter,
      createCharacter,
      selectCharacter,
      loadCharacterForHub,
      initializeBattle,
      initializeSpecialEvent,
      updatePlayerStats,
      reloadCharacters,
    }),
    [
      characters,
      selectedCharacter,
      createCharacter,
      selectCharacter,
      loadCharacterForHub,
      initializeBattle,
      initializeSpecialEvent,
      updatePlayerStats,
      reloadCharacters,
    ]
  );
}
