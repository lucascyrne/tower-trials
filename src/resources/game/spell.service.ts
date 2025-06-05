import { Spell, SpellEffectType, PlayerSpell } from './models/spell.model';
import { GamePlayer, Enemy, GameState } from './game-model';
import { supabase } from '@/lib/supabase';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Interface para dados brutos retornados pela função do banco
interface RawSpellData {
  spell_id: string;
  name: string;
  description: string;
  effect_type: SpellEffectType;
  mana_cost: number;
  cooldown: number;
  effect_value: number;
  duration: number;
  unlocked_at_level: number;
  is_equipped: boolean;
  slot_position: number | null;
}

// Interface para magias disponíveis com informações de equipamento
export interface AvailableSpell extends Spell {
  is_equipped: boolean;
  slot_position: number | null;
}

// Interface para estatísticas de magias
export interface SpellStats {
  total_available: number;
  total_equipped: number;
  highest_level_unlocked: number;
  spells_by_type: Record<string, number>;
}

export class SpellService {
  private static spellCache: Map<number, Spell[]> = new Map();
  private static lastFetchTimestamp: number = 0;
  private static CACHE_DURATION = 300000; // 5 minutos

  static clearCache(): void {
    this.spellCache.clear();
    this.lastFetchTimestamp = 0;
  }

  // Obter todas as magias disponíveis para um personagem com informações de equipamento
  static async getCharacterAvailableSpells(characterId: string): Promise<ServiceResponse<AvailableSpell[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_character_available_spells', {
          p_character_id: characterId
        });

      if (error) {
        console.error('Erro ao buscar magias disponíveis:', error);
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      // Mapear os dados para o formato esperado
      const spells: AvailableSpell[] = data.map((item: RawSpellData) => ({
        id: item.spell_id,
        name: item.name,
        description: item.description,
        effect_type: item.effect_type,
        mana_cost: item.mana_cost,
        cooldown: item.cooldown,
        effect_value: item.effect_value,
        duration: item.duration,
        unlocked_at_level: item.unlocked_at_level,
        is_equipped: item.is_equipped,
        slot_position: item.slot_position
      }));

      return {
        data: spells,
        error: null,
        success: true
      };
    } catch (error) {
      console.error('Erro ao buscar magias disponíveis:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false
      };
    }
  }

  // Equipar até 3 magias selecionadas
  static async setCharacterSpells(
    characterId: string,
    spellIds: (string | null)[]
  ): Promise<ServiceResponse<null>> {
    try {
      // Garantir que temos no máximo 3 spells
      const spell1 = spellIds[0] || null;
      const spell2 = spellIds[1] || null;
      const spell3 = spellIds[2] || null;

      const { error } = await supabase
        .rpc('set_character_spells', {
          p_character_id: characterId,
          p_spell_1_id: spell1,
          p_spell_2_id: spell2,
          p_spell_3_id: spell3
        });

      if (error) {
        console.error('Erro ao equipar magias:', error);
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      return {
        data: null,
        error: null,
        success: true
      };
    } catch (error) {
      console.error('Erro ao equipar magias:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false
      };
    }
  }

  // Obter estatísticas de magias do personagem
  static async getCharacterSpellStats(characterId: string): Promise<ServiceResponse<SpellStats>> {
    try {
      const { data, error } = await supabase
        .rpc('get_character_spell_stats', {
          p_character_id: characterId
        });

      if (error) {
        console.error('Erro ao buscar estatísticas de magias:', error);
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      const stats = data[0] || {
        total_available: 0,
        total_equipped: 0,
        highest_level_unlocked: 1,
        spells_by_type: {}
      };

      return {
        data: stats,
        error: null,
        success: true
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas de magias:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false
      };
    }
  }

  // Método existente - obter magias disponíveis por nível (usado no combate)
  static async getAvailableSpells(level: number): Promise<ServiceResponse<Spell[]>> {
    // Verificar cache primeiro
    const now = Date.now();
    if (this.spellCache.has(level) && (now - this.lastFetchTimestamp) < this.CACHE_DURATION) {
      return {
        data: this.spellCache.get(level)!,
        error: null,
        success: true
      };
    }

    try {
      const { data, error } = await supabase
        .rpc('get_available_spells', {
          p_level: level
        });

      if (error) {
        console.error('Erro ao buscar magias:', error);
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      // Cache o resultado
      this.spellCache.set(level, data || []);
      this.lastFetchTimestamp = now;

      return {
        data: data || [],
        error: null,
        success: true
      };
    } catch (error) {
      console.error('Erro ao buscar magias:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false
      };
    }
  }

  /**
   * Calcular dano de magia escalado com atributos e habilidade (EXTREMAMENTE BALANCEADO)
   */
  static calculateScaledSpellDamage(baseDamage: number, caster: GamePlayer | Enemy): number {
    // Se for um inimigo, usar dano base
    if (!('intelligence' in caster) || !('wisdom' in caster) || !('magic_mastery' in caster)) {
      return baseDamage;
    }

    const intelligence = caster.intelligence || 10;
    const wisdom = caster.wisdom || 10;
    const magicMastery = caster.magic_mastery || 1;

    // FÓRMULA REBALANCEADA PARA ESPECIALIZAÇÃO EXTREMA
    
    // Intelligence: Escalamento logarítmico agressivo para magos
    const intScaling = Math.pow(intelligence, 1.35) * 1.8;
    
    // Wisdom: Escalamento moderado
    const wisScaling = Math.pow(wisdom, 1.2) * 1.2;
    
    // Magic Mastery: Escalamento controlado
    const masteryScaling = Math.pow(magicMastery, 1.2) * 2.5;
    
    // Total com diminishing returns graduais
    let totalBonus = intScaling + wisScaling + masteryScaling;
    
    // Diminishing returns para valores altos
    if (totalBonus > 150) {
      totalBonus = 150 + ((totalBonus - 150) * 0.6);
    }
    
    // Cap final em 300% para especialistas extremos
    totalBonus = Math.min(300, totalBonus);
    
    // Aplicar bônus ao dano base
    const scaledDamage = Math.round(baseDamage * (1 + totalBonus / 100));
    
    console.log('[SpellService] Cálculo de dano mágico ESPECIALIZADO:', {
      baseDamage,
      intelligence,
      wisdom,
      magicMastery,
      intScaling: `${intScaling.toFixed(1)}%`,
      wisScaling: `${wisScaling.toFixed(1)}%`,
      masteryScaling: `${masteryScaling.toFixed(1)}%`,
      totalBonus: `${totalBonus.toFixed(1)}%`,
      scaledDamage
    });
    
    return scaledDamage;
  }

  /**
   * Calcular cura de magia escalada com atributos e habilidade (ESPECIALIZADA)
   */
  static calculateScaledSpellHealing(baseHealing: number, caster: GamePlayer | Enemy): number {
    // Se for um inimigo, usar cura base
    if (!('wisdom' in caster) || !('magic_mastery' in caster)) {
      return baseHealing;
    }

    const wisdom = caster.wisdom || 10;
    const magicMastery = caster.magic_mastery || 1;

    // FÓRMULA REBALANCEADA PARA CURADORES ESPECIALIZADOS
    
    // Wisdom: Escalamento agressivo para curadores
    const wisScaling = Math.pow(wisdom, 1.3) * 2.2;
    
    // Magic Mastery: Escalamento moderado
    const masteryScaling = Math.pow(magicMastery, 1.15) * 1.8;
    
    let totalBonus = wisScaling + masteryScaling;
    
    // Diminishing returns para cura (menor que dano)
    if (totalBonus > 120) {
      totalBonus = 120 + ((totalBonus - 120) * 0.5);
    }
    
    // Cap em 220% para cura especializada
    totalBonus = Math.min(220, totalBonus);
    
    // Aplicar bônus à cura base
    const scaledHealing = Math.round(baseHealing * (1 + totalBonus / 100));
    
    console.log('[SpellService] Cálculo de cura mágica ESPECIALIZADA:', {
      baseHealing,
      wisdom,
      magicMastery,
      wisScaling: `${wisScaling.toFixed(1)}%`,
      masteryScaling: `${masteryScaling.toFixed(1)}%`,
      totalBonus: `${totalBonus.toFixed(1)}%`,
      scaledHealing
    });
    
    return scaledHealing;
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
    let message = '';
    let success = true;

    switch (spell.effect_type) {
      case 'damage':
        // NOVO: Usar dano escalado
        const scaledDamage = this.calculateScaledSpellDamage(spell.effect_value, caster);
        target.hp = Math.max(0, target.hp - scaledDamage);
        message = `${spell.name} causou ${scaledDamage} de dano mágico!`;
        break;

      case 'heal':
        // NOVO: Usar cura escalada
        const scaledHealing = this.calculateScaledSpellHealing(spell.effect_value, caster);
        const maxHp = 'max_hp' in target ? target.max_hp : target.maxHp;
        const oldHp = target.hp;
        target.hp = Math.min(maxHp, target.hp + scaledHealing);
        const actualHeal = target.hp - oldHp;
        message = `${spell.name} restaurou ${actualHeal} HP!`;
        break;

      case 'buff':
        // Aplicar buff temporário (escalado se aplicável)
        if (target.active_effects) {
          const buffValue = this.calculateScaledSpellDamage(spell.effect_value, caster);
          target.active_effects.buffs.push({
            type: 'buff',
            value: buffValue,
            duration: spell.duration,
            source_spell: spell.name
          });
          message = `${spell.name} aplicou um efeito benéfico (+${buffValue})!`;
        } else {
          message = `${spell.name} aplicou um efeito benéfico!`;
        }
        break;

      case 'debuff':
        // Aplicar debuff temporário (escalado se aplicável)
        if (target.active_effects) {
          const debuffValue = this.calculateScaledSpellDamage(spell.effect_value, caster);
          target.active_effects.debuffs.push({
            type: 'debuff',
            value: debuffValue,
            duration: spell.duration,
            source_spell: spell.name
          });
          message = `${spell.name} aplicou um efeito prejudicial (-${debuffValue})!`;
        } else {
          message = `${spell.name} aplicou um efeito prejudicial!`;
        }
        break;

      case 'dot':
        // Dano ao longo do tempo (escalado)
        if (target.active_effects) {
          const dotDamage = this.calculateScaledSpellDamage(spell.effect_value, caster);
          target.active_effects.dots.push({
            type: 'dot',
            value: dotDamage,
            duration: spell.duration,
            source_spell: spell.name
          });
          message = `${spell.name} aplicou dano contínuo (${dotDamage} por ${spell.duration} turnos)!`;
        } else {
          message = `${spell.name} aplicou dano contínuo!`;
        }
        break;

      case 'hot':
        // Cura ao longo do tempo (escalada)
        if (target.active_effects) {
          const hotHealing = this.calculateScaledSpellHealing(spell.effect_value, caster);
          target.active_effects.hots.push({
            type: 'hot',
            value: hotHealing,
            duration: spell.duration,
            source_spell: spell.name
          });
          message = `${spell.name} aplicou cura contínua (${hotHealing} por ${spell.duration} turnos)!`;
        } else {
          message = `${spell.name} aplicou cura contínua!`;
        }
        break;

      default:
        message = `${spell.name} foi usado, mas não teve efeito!`;
        success = false;
    }

    return { message, success };
  }

  /**
   * Processar efeitos ao longo do tempo
   * @param target Alvo dos efeitos
   * @returns Mensagens dos efeitos processados
   */
  static processOverTimeEffects(target: GamePlayer | Enemy): string[] {
    const messages: string[] = [];
    
    if ('active_effects' in target && target.active_effects) {
      // Processar DoTs (Damage over Time)
      target.active_effects.dots.forEach((effect, index) => {
        target.hp = Math.max(0, target.hp - effect.value);
        effect.duration--;
        messages.push(`${effect.source_spell} causou ${effect.value} de dano contínuo.`);
        
        if (effect.duration <= 0) {
          target.active_effects!.dots.splice(index, 1);
        }
      });

      // Processar HoTs (Heal over Time)
      target.active_effects.hots.forEach((effect, index) => {
        const maxHp = 'max_hp' in target ? target.max_hp : target.maxHp;
        const oldHp = target.hp;
        target.hp = Math.min(maxHp, target.hp + effect.value);
        const actualHeal = target.hp - oldHp;
        effect.duration--;
        
        if (actualHeal > 0) {
          messages.push(`${effect.source_spell} restaurou ${actualHeal} HP.`);
        }
        
        if (effect.duration <= 0) {
          target.active_effects!.hots.splice(index, 1);
        }
      });
    }

    return messages;
  }

  /**
   * Atualizar cooldowns das magias
   * @param gameState Estado atual do jogo
   * @returns Estado atualizado
   */
  static updateSpellCooldowns(gameState: GameState): GameState {
    // Reduzir cooldowns das magias do jogador
    gameState.player.spells.forEach((spell: PlayerSpell) => {
      if (spell.current_cooldown > 0) {
        spell.current_cooldown--;
      }
    });

    return gameState;
  }

  // Utilitário para obter ícone da magia baseado no tipo
  static getSpellTypeIcon(effectType: SpellEffectType): string {
    const icons = {
      'damage': '⚔️',
      'heal': '❤️',
      'buff': '🛡️',
      'debuff': '💀',
      'dot': '🔥',
      'hot': '✨'
    };
    return icons[effectType] || '🔮';
  }

  // Utilitário para obter cor da magia baseado no tipo
  static getSpellTypeColor(effectType: SpellEffectType): string {
    const colors = {
      'damage': 'text-red-500',
      'heal': 'text-green-500',
      'buff': 'text-blue-500',
      'debuff': 'text-purple-500',
      'dot': 'text-orange-500',
      'hot': 'text-emerald-500'
    };
    return colors[effectType] || 'text-gray-500';
  }

  // Utilitário para traduzir tipo de efeito
  static translateEffectType(effectType: SpellEffectType): string {
    const translations = {
      'damage': 'Dano',
      'heal': 'Cura',
      'buff': 'Benefício',
      'debuff': 'Maldição',
      'dot': 'Dano Contínuo',
      'hot': 'Cura Contínua'
    };
    return translations[effectType] || effectType;
  }

  // Obter apenas as magias equipadas do personagem (slots)
  static async getCharacterEquippedSpells(characterId: string): Promise<ServiceResponse<PlayerSpell[]>> {
    try {
      console.log(`[SpellService] Buscando magias equipadas para personagem: ${characterId}`);
      
      const { data, error } = await supabase
        .from('character_spell_slots')
        .select(`
          slot_position,
          spell_id,
          spell:spells(
            id,
            name,
            description,
            mana_cost,
            cooldown,
            effect_type,
            effect_value,
            duration,
            unlocked_at_level
          )
        `)
        .eq('character_id', characterId)
        .not('spell_id', 'is', null)
        .order('slot_position');

      if (error) {
        console.error('Erro ao buscar magias equipadas:', error);
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      console.log(`[SpellService] ${data?.length || 0} magias equipadas encontradas`);

      // Converter para PlayerSpell[]
      const playerSpells: PlayerSpell[] = (data || []).map(item => {
        const spell = Array.isArray(item.spell) ? item.spell[0] : item.spell;
        return {
          id: spell.id,
          name: spell.name,
          description: spell.description,
          mana_cost: spell.mana_cost,
          cooldown: spell.cooldown,
          current_cooldown: 0, // Sempre começa em 0 no início da batalha
          effect_type: spell.effect_type as SpellEffectType,
          effect_value: spell.effect_value,
          duration: spell.duration || 0,
          unlocked_at_level: spell.unlocked_at_level
        };
      });

      console.log(`[SpellService] Magias equipadas processadas:`, playerSpells.map(s => s.name));

      return {
        data: playerSpells,
        error: null,
        success: true
      };
    } catch (error) {
      console.error('Erro ao buscar magias equipadas:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false
      };
    }
  }
} 