import { useContext } from 'react';
import { CharacterContext, type CharacterContextType } from './character-context';

export function useCharacter(): CharacterContextType {
  const context = useContext(CharacterContext);

  if (!context) {
    throw new Error('useCharacter deve ser usado dentro de um CharacterProvider');
  }

  return context;
}
