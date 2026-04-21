import { Dispatch, SetStateAction, useEffect } from 'react';
import { toast } from 'sonner';
import { CharacterService } from '../character.service';
import { Character } from '../models/character.model';

interface UseGamePermadeathEffectParams {
  mode: string;
  characterDeleted?: boolean;
  playerName: string;
  playerId: string;
  userId?: string;
  setSelectedCharacter: (character: null) => void;
  setCharacters: Dispatch<SetStateAction<Character[]>>;
}

export function useGamePermadeathEffect({
  mode,
  characterDeleted,
  playerName,
  playerId,
  userId,
  setSelectedCharacter,
  setCharacters,
}: UseGamePermadeathEffectParams) {
  useEffect(() => {
    if (mode === 'gameover' && characterDeleted) {
      toast.error('Permadeath!', {
        description: `${playerName} foi perdido permanentemente. Redirecionando...`,
        duration: 3000,
      });

      setSelectedCharacter(null);

      if (playerId) {
        CharacterService.invalidateCharacterCache(playerId);
      }

      if (userId) {
        CharacterService.getUserCharacters(userId).then(response => {
          if (response.success && response.data) {
            setCharacters(response.data);
          }
        });
      }

      setTimeout(() => {
        window.location.href = '/game/play';
      }, 2000);
    }
  }, [mode, characterDeleted, playerName, playerId, userId, setSelectedCharacter, setCharacters]);
}
