import { supabase } from '@/lib/supabase';
import { Spell, SpellEffect } from './models/spell.model';
import { GamePlayer, Enemy, GameState } from './game-model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class SpellService {
  private static spellCache: Map<number, Spell[]> = new Map();
  private static lastFetchTimestamp: number = 0;
  private static CACHE_DURATION = 300000; // 5 minutos

  /**
   * Buscar magias disponíveis para o nível do personagem
   * @param level Nível do personagem
   * @returns Lista de magias disponíveis
   */
  static async getAvailableSpells(level: number): Promise<ServiceResponse<Spell[]>> {
    try {
      // Verificar cache primeiro
      const now = Date.now();
      if (now - this.lastFetchTimestamp < this.CACHE_DURATION) {
        const cachedSpells = this.spellCache.get(level);
        if (cachedSpells) {
          return { data: cachedSpells, error: null, success: true };
        }
      }

      const { data, error } = await supabase
        .rpc('get_available_spells', { p_level: level });

      if (error) throw error;

      // Atualizar cache
      this.spellCache.set(level, data as Spell[]);
      this.lastFetchTimestamp = now;

      return { data: data as Spell[], error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar magias:', error instanceof Error ? error.message : error);
      return { data: null, error: 'Erro ao buscar magias', success: false };
    }
  }

  /**
   * Aplicar efeito da magia
   * @param spell Magia a ser usada
   * @param caster Personagem que está conjurando
   * @param target Alvo da magia
   * @returns Resultado da aplicação da magia
   */
  static applySpellEffect(
    spell: Spell,
    caster: GamePlayer | Enemy,
    target: GamePlayer | Enemy
  ): { message: string; success: boolean } {
    // Verificar se tem mana suficiente (apenas para o jogador)
    if ('mana' in caster && caster.mana < spell.mana_cost) {
      return { message: 'Mana insuficiente!', success: false };
    }

    // Consumir mana se for o jogador
    if ('mana' in caster) {
      caster.mana -= spell.mana_cost;
    }

    const effect: SpellEffect = {
      type: spell.effect_type,
      value: spell.effect_value,
      duration: spell.duration,
      source_spell: spell.id
    };

    // Aplicar efeito baseado no tipo com aumento de 60% para dano
    const damageMultiplier = 1.6; // 60% a mais

    switch (spell.effect_type) {
      case 'damage':
        const boostedDamage = Math.floor(spell.effect_value * damageMultiplier);
        target.hp = Math.max(0, target.hp - boostedDamage);
        return {
          message: `${spell.name} causou ${boostedDamage} de dano!`,
          success: true
        };

      case 'heal':
        if ('max_hp' in target) {
          target.hp = Math.min(target.max_hp, target.hp + spell.effect_value);
        }
        return {
          message: `${spell.name} curou ${spell.effect_value} de HP!`,
          success: true
        };

      case 'buff':
        target.active_effects.buffs.push(effect);
        if ('def' in target) {
          target.def += spell.effect_value;
        }
        return {
          message: `${spell.name} aumentou a defesa em ${spell.effect_value}!`,
          success: true
        };

      case 'debuff':
        target.active_effects.debuffs.push(effect);
        if ('attack' in target) {
          target.attack -= spell.effect_value;
        }
        return {
          message: `${spell.name} reduziu o ataque em ${spell.effect_value}!`,
          success: true
        };

      case 'dot':
        // Aumentar o dano ao longo do tempo também
        effect.value = Math.floor(effect.value * damageMultiplier);
        target.active_effects.dots.push(effect);
        return {
          message: `${spell.name} aplicou um efeito de dano ao longo do tempo!`,
          success: true
        };

      case 'hot':
        target.active_effects.hots.push(effect);
        return {
          message: `${spell.name} aplicou um efeito de cura ao longo do tempo!`,
          success: true
        };

      default:
        return { message: 'Tipo de magia não implementado', success: false };
    }
  }

  /**
   * Processar efeitos ao longo do tempo
   * @param target Alvo dos efeitos
   * @returns Mensagens dos efeitos processados
   */
  static processOverTimeEffects(target: GamePlayer | Enemy): string[] {
    const messages: string[] = [];

    // Processar DoTs
    target.active_effects.dots.forEach(effect => {
      target.hp = Math.max(0, target.hp - effect.value);
      effect.duration--;
      messages.push(`Dano ao longo do tempo causou ${effect.value} de dano!`);
    });

    // Processar HoTs
    if ('max_hp' in target) {
      target.active_effects.hots.forEach(effect => {
        target.hp = Math.min(target.max_hp, target.hp + effect.value);
        effect.duration--;
        messages.push(`Cura ao longo do tempo recuperou ${effect.value} de HP!`);
      });
    }

    // Remover efeitos expirados
    target.active_effects.dots = target.active_effects.dots.filter(e => e.duration > 0);
    target.active_effects.hots = target.active_effects.hots.filter(e => e.duration > 0);
    target.active_effects.buffs = target.active_effects.buffs.filter(e => e.duration > 0);
    target.active_effects.debuffs = target.active_effects.debuffs.filter(e => e.duration > 0);

    return messages;
  }

  /**
   * Atualizar cooldowns das magias
   * @param gameState Estado atual do jogo
   * @returns Estado atualizado
   */
  static updateSpellCooldowns(gameState: GameState): GameState {
    const { player } = gameState;
    
    player.spells = player.spells.map(spell => ({
      ...spell,
      current_cooldown: Math.max(0, spell.current_cooldown - 1)
    }));

    return {
      ...gameState,
      player
    };
  }
} 