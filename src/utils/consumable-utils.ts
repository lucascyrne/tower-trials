import type { Consumable } from '@/models/consumable.model';
import { AssetManager } from './asset-utils';

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
    case 'elixir':
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
 * Obter path da imagem do consumível usando o AssetManager
 * @param consumable Consumível
 * @returns Path para a imagem do consumível
 */
export function getConsumableImagePath(consumable: Consumable): string {
  return AssetManager.getConsumableIcon(consumable);
}

/**
 * Obter ícone emoji do consumível (para casos onde só emoji é necessário)
 * @param consumable Consumível
 * @returns String do emoji/ícone
 * @deprecated Use getConsumableImagePath() para assets reais
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
    case 'elixir':
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

/**
 * Obter classe CSS para cor do tipo de consumível
 * @param consumable Consumível
 * @returns String com classes CSS
 */
export function getConsumableTypeColor(consumable: Consumable): string {
  switch (consumable.type) {
    case 'potion':
      if (consumable.description.includes('HP') || consumable.description.includes('Vida')) {
        return 'text-red-400';
      }
      if (consumable.description.includes('Mana')) {
        return 'text-blue-400';
      }
      return 'text-purple-400';

    case 'buff':
    case 'elixir':
      return 'text-amber-400';

    case 'antidote':
      return 'text-green-400';

    default:
      return 'text-slate-400';
  }
}

/**
 * Verificar se um consumível é uma poção de vida
 * @param consumable Consumível
 * @returns Se é uma poção de vida
 */
export function isHealthPotion(consumable: Consumable): boolean {
  if (consumable.type !== 'potion') return false;

  // Verificar pelo nome e descrição com padrões mais amplos
  const nameAndDesc = `${consumable.name} ${consumable.description}`.toLowerCase();

  return (
    nameAndDesc.includes('vida') ||
    nameAndDesc.includes('hp') ||
    nameAndDesc.includes('health') ||
    nameAndDesc.includes('cura') ||
    nameAndDesc.includes('heal') ||
    nameAndDesc.includes('restaura hp') ||
    nameAndDesc.includes('recupera hp')
  );
}

/**
 * Verificar se um consumível é uma poção de mana
 * @param consumable Consumível
 * @returns Se é uma poção de mana
 */
export function isManaPotion(consumable: Consumable): boolean {
  if (consumable.type !== 'potion') return false;

  // Verificar pelo nome e descrição com padrões mais amplos
  const nameAndDesc = `${consumable.name} ${consumable.description}`.toLowerCase();

  return (
    nameAndDesc.includes('mana') ||
    nameAndDesc.includes('mp') ||
    nameAndDesc.includes('magia') ||
    nameAndDesc.includes('magic') ||
    nameAndDesc.includes('energia') ||
    nameAndDesc.includes('restaura mana') ||
    nameAndDesc.includes('recupera mana')
  );
}

/**
 * Obter o tipo específico de uma poção
 * @param consumable Consumível
 * @returns Tipo específico da poção
 */
export function getPotionSubType(consumable: Consumable): 'health' | 'mana' | 'other' {
  if (consumable.type !== 'potion') return 'other';

  if (isHealthPotion(consumable)) return 'health';
  if (isManaPotion(consumable)) return 'mana';

  return 'other';
}
