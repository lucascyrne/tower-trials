import { CharacterService } from '../character.service';
export function getUserCharacters(userId: string) {
  return CharacterService.getUserCharacters(userId);
}

export function getCharacter(characterId: string) {
  return CharacterService.getCharacter(characterId);
}

export function createCharacter(...args: Parameters<typeof CharacterService.createCharacter>): ReturnType<typeof CharacterService.createCharacter> {
  return CharacterService.createCharacter(...args);
}

export function deleteCharacter(characterId: string) {
  return CharacterService.deleteCharacter(characterId);
}

export function checkCharacterLimit(userId: string) {
  return CharacterService.checkCharacterLimit(userId);
}

export function invalidateCharacterCache(
  ...args: Parameters<typeof CharacterService.invalidateCharacterCache>
): ReturnType<typeof CharacterService.invalidateCharacterCache> {
  return CharacterService.invalidateCharacterCache(...args);
}
