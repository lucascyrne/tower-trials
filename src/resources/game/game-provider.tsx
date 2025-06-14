import { type ReactNode } from 'react';
import { GameStateProvider } from './game-state.provider';
import { LogProvider } from './log.provider';
import { CharacterProvider } from './character.provider';
import { BattleProvider } from './battle.provider';
import { EventProvider } from './event.provider';

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  return (
    <GameStateProvider>
      <LogProvider>
        <CharacterProvider>
          <BattleProvider>
            <EventProvider>{children}</EventProvider>
          </BattleProvider>
        </CharacterProvider>
      </LogProvider>
    </GameStateProvider>
  );
}
