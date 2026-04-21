import { GamePlayer, Enemy, GameState } from './game-model';
import { Spell, SpellEffectType } from './models/spell.model';
import {
  applySpellEffect,
  calculateScaledSpellDamage,
  calculateScaledSpellHealing,
  processOverTimeEffects,
  updateSpellCooldowns,
} from './spell-service/spell-combat';
import {
  AvailableSpell,
  clearSpellCache,
  getAvailableSpells,
  getCharacterAvailableSpells,
  getCharacterEquippedSpells,
  getCharacterSpellStats,
  setCharacterSpells,
} from './spell-service/spell-repository';
import { getAttributeModificationsForSpell, getSpellTypeColor, getSpellTypeIcon, translateAttributeName, translateEffectType } from './spell-service/spell-ui-helpers';
import { ServiceResponse, SpellStats } from './spell-service/types';

export type { AvailableSpell, SpellStats };

export class SpellService {
  static clearCache(): void {
    clearSpellCache();
  }

  static async getCharacterAvailableSpells(characterId: string): Promise<ServiceResponse<AvailableSpell[]>> {
    return getCharacterAvailableSpells(characterId);
  }

  static async setCharacterSpells(characterId: string, spellIds: (string | null)[]): Promise<ServiceResponse<null>> {
    return setCharacterSpells(characterId, spellIds);
  }

  static async getCharacterSpellStats(characterId: string): Promise<ServiceResponse<SpellStats>> {
    return getCharacterSpellStats(characterId);
  }

  static async getAvailableSpells(level: number): Promise<ServiceResponse<Spell[]>> {
    return getAvailableSpells(level);
  }

  /**
   * Calcular dano de magia escalado com atributos e habilidade (EXTREMAMENTE BALANCEADO)
   */
  static calculateScaledSpellDamage(baseDamage: number, caster: GamePlayer | Enemy): number {
    return calculateScaledSpellDamage(baseDamage, caster);
  }

  /**
   * Calcular cura de magia escalada com atributos e habilidade (ESPECIALIZADA)
   */
  static calculateScaledSpellHealing(baseHealing: number, caster: GamePlayer | Enemy): number {
    return calculateScaledSpellHealing(baseHealing, caster);
  }

  /**
   * Aplicar efeito da magia
   * @param spell Magia a ser usada
   * @param caster Personagem que está conjurando
   * @param target Alvo da magia
   * @returns Resultado da aplicação da magia
   */
  static applySpellEffect(spell: Spell, caster: GamePlayer | Enemy, target: GamePlayer | Enemy): { message: string; success: boolean } {
    return applySpellEffect(spell, caster, target);
  }

  /**
   * Processar efeitos ao longo do tempo
   * @param target Alvo dos efeitos
   * @returns Mensagens dos efeitos processados
   */
  static processOverTimeEffects(target: GamePlayer | Enemy): string[] {
    return processOverTimeEffects(target);
  }

  /**
   * Atualizar cooldowns das magias
   * @param gameState Estado atual do jogo
   * @returns Estado atualizado
   */
  static updateSpellCooldowns(gameState: GameState): GameState {
    return updateSpellCooldowns(gameState);
  }

  // Utilitário para obter ícone da magia baseado no tipo
  static getSpellTypeIcon(effectType: SpellEffectType): string {
    return getSpellTypeIcon(effectType);
  }

  // Utilitário para obter cor da magia baseado no tipo
  static getSpellTypeColor(effectType: SpellEffectType): string {
    return getSpellTypeColor(effectType);
  }

  // Utilitário para traduzir tipo de efeito
  static translateEffectType(effectType: SpellEffectType): string {
    return translateEffectType(effectType);
  }

  /**
   * Obter modificações de atributos específicas baseadas no nome da magia
   * @param spell Magia sendo aplicada
   * @returns Array de modificações de atributos
   */
  static getAttributeModificationsForSpell(spell: Spell) {
    return getAttributeModificationsForSpell(spell);
  }

  /**
   * Traduzir nomes de atributos para português
   * @param attribute Nome do atributo
   * @returns Nome traduzido
   */
  static translateAttributeName(attribute: string): string {
    return translateAttributeName(attribute);
  }

  // Obter apenas as magias equipadas do personagem (slots)
  static async getCharacterEquippedSpells(characterId: string): Promise<ServiceResponse<import('./models/spell.model').PlayerSpell[]>> {
    return getCharacterEquippedSpells(characterId);
  }
} 