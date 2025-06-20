import { useEvent as useEventStore } from '@/stores/useEventStore';
import { useGameStateStore } from '@/stores/useGameStateStore';
import { useCharacterManagement } from '@/stores/useCharacterStore';

/**
 * Hook de compatibilidade que mantém a mesma interface do EventContext antigo.
 * Facilita a migração gradual do Context API para Zustand.
 */
export function useEvent() {
  const { interactWithEvent: storeInteractWithEvent, isProcessingEvent, lastError } = useEventStore();
  const { selectedCharacter } = useCharacterManagement();
  const { gameState } = useGameStateStore();
  const interactWithEvent = async () => {
    if (!selectedCharacter) {
      console.warn('[useEventContext] Nenhum personagem selecionado');
      return;
    }

    await storeInteractWithEvent(gameState, selectedCharacter.id);
  };

  // Retorna a mesma interface do contexto antigo
  return {
    interactWithEvent,
    // Estados extras que podem ser úteis
    isProcessingEvent,
    lastError,
  };
}
