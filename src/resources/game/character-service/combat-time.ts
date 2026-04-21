import { CharacterService } from '../character.service';

export function updateCharacterHpMana(characterId: string, hp: number, mana: number) {
  return CharacterService.updateCharacterHpMana(characterId, hp, mana);
}

export function updateLastActivity(characterId: string) {
  return CharacterService.updateLastActivity(characterId);
}

export function applyAutoHeal(characterId: string) {
  return CharacterService.applyAutoHeal(characterId);
}

export function calculateAutoHeal(...args: Parameters<typeof CharacterService.calculateAutoHeal>): ReturnType<typeof CharacterService.calculateAutoHeal> {
  return CharacterService.calculateAutoHeal(...args);
}
