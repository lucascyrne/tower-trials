import { type Consumable } from '@/resources/game/models/consumable.model';

/**
 * Formatar o efeito de um consumível para exibição
 * @param consumable Consumível
 * @returns String formatada do efeito
 */
export function formatConsumableEffect(consumable: Consumable): string {
  if (!consumable.effect_value || consumable.effect_value <= 0) {
    return '';
  }

  switch (consumable.type) {
    case 'potion':
      if (consumable.description.includes('HP') || consumable.description.includes('Vida')) {
        return `+${consumable.effect_value} HP`;
      }
      if (consumable.description.includes('Mana')) {
        return `+${consumable.effect_value} Mana`;
      }
      return `+${consumable.effect_value}`;

    case 'buff':
      if (consumable.description.includes('Força') || consumable.description.includes('ataque')) {
        return `+${consumable.effect_value} Ataque por 3 turnos`;
      }
      if (consumable.description.includes('Defesa')) {
        return `+${consumable.effect_value} Defesa por 3 turnos`;
      }
      return `+${consumable.effect_value} por 3 turnos`;

    case 'antidote':
      return 'Remove efeitos negativos';

    default:
      return `+${consumable.effect_value}`;
  }
}

/**
 * Formatar efeito baseado na descrição do slot de poção
 * @param effectValue Valor do efeito
 * @param description Descrição do consumível
 * @returns String formatada do efeito
 */
export function formatPotionSlotEffect(effectValue: number, description: string): string {
  if (!effectValue || effectValue <= 0) {
    return '';
  }

  if (description.includes('HP') || description.includes('Vida')) {
    return `+${effectValue} HP`;
  }
  if (description.includes('Mana')) {
    return `+${effectValue} Mana`;
  }
  return `+${effectValue}`;
}

/**
 * Obter ícone do consumível baseado no tipo e descrição
 * @param consumable Consumível
 * @returns String do emoji/ícone
 */
export function getConsumableIcon(consumable: Consumable): string {
  switch (consumable.type) {
    case 'potion':
      if (consumable.description.includes('HP') || consumable.description.includes('Vida')) {
        return '❤️';
      }
      if (consumable.description.includes('Mana')) {
        return '💙';
      }
      return '🧪';

    case 'buff':
      if (consumable.description.includes('Força') || consumable.description.includes('ataque')) {
        return '⚔️';
      }
      if (consumable.description.includes('Defesa')) {
        return '🛡️';
      }
      return '✨';

    case 'antidote':
      return '🌿';

    default:
      return '📦';
  }
}
