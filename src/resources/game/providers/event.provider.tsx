import { type ReactNode, createContext, useContext, useCallback } from 'react';
import { GameService } from '../game.service';
import { CharacterService } from '../character.service';
import { useGameState } from './game-state.provider';
import { useGameLog } from './log.provider';
import { useCharacter } from './character.provider';

interface EventContextType {
  interactWithEvent: () => Promise<void>;
}

const EventContext = createContext<EventContextType | null>(null);

interface EventProviderProps {
  children: ReactNode;
}

export function EventProvider({ children }: EventProviderProps) {
  const { gameState, setGameState } = useGameState();
  const { addGameLogMessage } = useGameLog();
  const { selectedCharacter } = useCharacter();

  const interactWithEvent = useCallback(async () => {
    if (gameState.mode !== 'special_event') {
      return;
    }

    try {
      const updatedState = await GameService.processSpecialEventInteraction(gameState);
      
      if (selectedCharacter && updatedState.player) {
        if (updatedState.player.hp !== gameState.player.hp || 
            updatedState.player.mana !== gameState.player.mana) {
          await CharacterService.updateCharacterHpMana(
            selectedCharacter.id,
            updatedState.player.hp,
            updatedState.player.mana
          );
        }
        
        const goldGained = updatedState.player.gold - gameState.player.gold;
        if (goldGained > 0) {
          await CharacterService.grantSecureGold(selectedCharacter.id, goldGained, 'special_event');
        }
      }
      
      setGameState({
        ...updatedState,
        mode: 'battle',
        currentSpecialEvent: null
      });
      
      addGameLogMessage(updatedState.gameMessage || 'Evento especial concluído!', 'system');
    } catch (error) {
      console.error('[EventProvider] Erro no evento especial:', error);
      addGameLogMessage('Erro ao processar evento especial', 'system');
    }
  }, [gameState, selectedCharacter]);

  return (
    <EventContext.Provider value={{ interactWithEvent }}>
      {children}
    </EventContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export function useEvent() {
  const context = useContext(EventContext);
  
  if (!context) {
    throw new Error('useEvent deve ser usado dentro de um EventProvider');
  }
  
  return context;
} 