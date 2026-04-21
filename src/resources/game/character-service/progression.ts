import { CharacterService } from '../character.service';

export function updateCharacterFloor(characterId: string, floor: number) {
  return CharacterService.updateCharacterFloor(characterId, floor);
}

export function grantSecureXP(characterId: string, amount: number, reason: string) {
  return CharacterService.grantSecureXP(characterId, amount, reason);
}

export function grantSecureGold(characterId: string, amount: number, reason: string) {
  return CharacterService.grantSecureGold(characterId, amount, reason);
}

export function updateGold(characterId: string, amount: number) {
  return CharacterService.updateGold(characterId, amount);
}

export function startFromCheckpoint(characterId: string, floor: number) {
  return CharacterService.startFromCheckpoint(characterId, floor);
}

export function getUnlockedCheckpoints(characterId: string) {
  return CharacterService.getUnlockedCheckpoints(characterId);
}
