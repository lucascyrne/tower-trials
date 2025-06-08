import { type ReactNode } from 'react';
import { GameStateProvider } from './providers/game-state.provider';
import { LogProvider } from './providers/log.provider';
import { CharacterProvider } from './providers/character.provider';
import { BattleProvider } from './providers/battle.provider';
import { EventProvider } from './providers/event.provider';

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  return (
    <GameStateProvider>
      <LogProvider>
        <CharacterProvider>
          <BattleProvider>
            <EventProvider>
              {children}
            </EventProvider>
          </BattleProvider>
        </CharacterProvider>
      </LogProvider>
    </GameStateProvider>
  );
} 