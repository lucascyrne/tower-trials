import { Enemy } from '../game-model';

export type EnemyActionType = 'attack' | 'spell' | 'special';

export interface EnemyActionDecision {
  actionType: EnemyActionType;
  specialChance: number;
  spellChance: number;
}

export interface EnemyFallbackSpecialBehavior {
  kind: 'heal' | 'damage';
  multiplier?: number;
  message: string;
}

export function decideEnemyAction(enemy: Enemy): EnemyActionDecision {
  const hasSpecialAbilities =
    Array.isArray(enemy.special_abilities) && enemy.special_abilities.length > 0;
  const isHighIntelligence = (enemy.intelligence || 10) > (enemy.strength || 10);

  let specialChance = 0.15;
  let spellChance = 0.2;

  switch (enemy.behavior) {
    case 'aggressive':
      specialChance = 0.25;
      spellChance = 0.1;
      break;
    case 'defensive':
      specialChance = 0.3;
      spellChance = 0.15;
      break;
    case 'balanced':
      spellChance = isHighIntelligence ? 0.35 : 0.2;
      specialChance = 0.2;
      break;
  }

  if (hasSpecialAbilities) {
    specialChance += 0.1;
  }

  let actionType: EnemyActionType = 'attack';
  if (hasSpecialAbilities && Math.random() < specialChance) {
    actionType = 'special';
  } else if ((enemy.mana || 0) >= 10 && Math.random() < spellChance) {
    actionType = 'spell';
  }

  return { actionType, specialChance, spellChance };
}

export function getFallbackSpecialBehavior(enemy: Enemy): EnemyFallbackSpecialBehavior {
  switch (enemy.behavior) {
    case 'aggressive':
      return {
        kind: 'damage',
        multiplier: 1.5,
        message: `${enemy.name} usou Ataque Furioso e causou {damage} de dano!`,
      };
    case 'defensive':
      return {
        kind: 'heal',
        message: `${enemy.name} se concentrou e recuperou {heal} HP!`,
      };
    default:
      return {
        kind: 'damage',
        multiplier: 1.3,
        message: `${enemy.name} usou uma habilidade especial e causou {damage} de dano!`,
      };
  }
}
