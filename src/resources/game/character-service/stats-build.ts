import { CharacterService } from '../character.service';

export function getCharacterForGame(characterId: string) {
  return CharacterService.getCharacterForGame(characterId);
}

export function getCharacterStats(characterId: string) {
  return CharacterService.getCharacterStats(characterId);
}

export function distributeAttributePoints(
  ...args: Parameters<typeof CharacterService.distributeAttributePoints>
): ReturnType<typeof CharacterService.distributeAttributePoints> {
  return CharacterService.distributeAttributePoints(...args);
}

export function addSkillXp(...args: Parameters<typeof CharacterService.addSkillXp>): ReturnType<typeof CharacterService.addSkillXp> {
  return CharacterService.addSkillXp(...args);
}

export function recalculateCharacterStats(characterId: string) {
  return CharacterService.recalculateCharacterStats(characterId);
}
