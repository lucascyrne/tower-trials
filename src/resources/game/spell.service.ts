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
        const damage = spell.effect_value;
        target.hp = Math.max(0, target.hp - damage);
        message = `${spell.name} causou ${damage} de dano!`;
        break;

      case 'heal':
        const healAmount = spell.effect_value;
        const maxHp = 'max_hp' in target ? target.max_hp : target.maxHp;
        const oldHp = target.hp;
        target.hp = Math.min(maxHp, target.hp + healAmount);
        const actualHeal = target.hp - oldHp;
        message = `${spell.name} restaurou ${actualHeal} HP!`;
        break;

      case 'buff':
        // Aplicar buff temporário
        message = `${spell.name} aplicou um efeito benéfico!`;
        break;

      case 'debuff':
        // Aplicar debuff temporário
        message = `${spell.name} aplicou um efeito prejudicial!`;
        break;

      case 'dot':
        // Dano ao longo do tempo
        message = `${spell.name} aplicou dano contínuo!`;
        break;

      case 'hot':
        // Cura ao longo do tempo
        message = `${spell.name} aplicou cura contínua!`;
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
} 