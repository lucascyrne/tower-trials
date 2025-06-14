import { createContext } from 'react';
import { type Character } from './character.model';

export interface CharacterContextType {
  characters: Character[];
  selectedCharacter: Character | null;
  createCharacter: (name: string) => Promise<void>;
  selectCharacter: (character: Character) => Promise<void>;
  loadCharacterForHub: (character: Character) => Promise<void>;
  initializeBattle: (character: Character, battleKey: string) => Promise<void>;
  updatePlayerStats: (hp: number, mana: number) => void;
  reloadCharacters: () => void;
}

export const CharacterContext = createContext<CharacterContextType | null>(null);
