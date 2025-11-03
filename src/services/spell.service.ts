import {
  type SpellEffectType,
  type PlayerSpell,
  type AttributeModification,
  type Spell,
  isSupportSpell,
} from '@/models/spell.model';
import { supabase } from '@/lib/supabase';
import type { Enemy, GamePlayer, GameState } from '@/models/game.model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
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

// NOVO: Cache e controle de requisições para evitar loops
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isValid: boolean;
}

interface PendingRequest<T> {
  promise: Promise<ServiceResponse<T>>;
  abortController: AbortController;
}

export class SpellService {
  // Cache tradicional por nível (usado no combate)
  private static spellCache: Map<number, Spell[]> = new Map();
  private static lastFetchTimestamp: number = 0;
  private static CACHE_DURATION = 300000; // 5 minutos

  // NOVO: Cache aprimorado para dados de personagem
  private static characterSpellCache = new Map<string, CacheEntry<AvailableSpell[]>>();
  private static equippedSpellCache = new Map<string, CacheEntry<PlayerSpell[]>>();

  // Controle de requisições pendentes
  private static pendingAvailableRequests = new Map<string, PendingRequest<AvailableSpell[]>>();
  private static pendingEquippedRequests = new Map<string, PendingRequest<PlayerSpell[]>>();

  // Configurações
  private static readonly CHARACTER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  private static readonly REQUEST_TIMEOUT = 8000; // 8 segundos

  /**
   * NOVO: Verificar se cache é válido
   */
  private static isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
    if (!entry) return false;
    const now = Date.now();
    return entry.isValid && now - entry.timestamp < this.CHARACTER_CACHE_DURATION;
  }

  /**
   * NOVO: Cancelar requisição pendente
   */
  private static cancelPendingRequest<T>(
    pendingMap: Map<string, PendingRequest<T>>,
    key: string
  ): void {
    const pending = pendingMap.get(key);
    if (pending) {
      pending.abortController.abort();
      pendingMap.delete(key);
    }
  }

  /**
   * NOVO: Invalidar cache de personagem
   */
  static invalidateCharacterCache(characterId: string): void {
    // Cancelar requisições pendentes
    this.cancelPendingRequest(this.pendingAvailableRequests, characterId);
    this.cancelPendingRequest(this.pendingEquippedRequests, characterId);

    // Invalidar entradas de cache
    const availableEntry = this.characterSpellCache.get(characterId);
    if (availableEntry) availableEntry.isValid = false;

    const equippedEntry = this.equippedSpellCache.get(characterId);
    if (equippedEntry) equippedEntry.isValid = false;
  }

  /**
   * NOVO: Limpar todo o cache
   */
  static clearCache(): void {
    // Cache tradicional
    this.spellCache.clear();
    this.lastFetchTimestamp = 0;

    // Cancelar todas as requisições pendentes
    for (const [, pending] of this.pendingAvailableRequests) {
      pending.abortController.abort();
    }
    for (const [, pending] of this.pendingEquippedRequests) {
      pending.abortController.abort();
    }

    // Limpar caches de personagem
    this.characterSpellCache.clear();
    this.equippedSpellCache.clear();
    this.pendingAvailableRequests.clear();
    this.pendingEquippedRequests.clear();
  }

  // REFATORADO: Obter todas as magias disponíveis com cache robusto
  static async getCharacterAvailableSpells(
    characterId: string,
    characterLevel: number
  ): Promise<ServiceResponse<AvailableSpell[]>> {
    try {
      // 1. Verificar cache primeiro
      const cachedEntry = this.characterSpellCache.get(characterId);
      if (this.isCacheValid(cachedEntry)) {
        return { data: cachedEntry!.data, error: null, success: true };
      }

      // 2. Verificar se há requisição pendente
      const pendingRequest = this.pendingAvailableRequests.get(characterId);
      if (pendingRequest) {
        try {
          return await pendingRequest.promise;
        } catch (error) {
          if (!pendingRequest.abortController.signal.aborted) {
            throw error;
          }
        }
      }

      // 3. Criar nova requisição
      const abortController = new AbortController();
      const requestPromise = this.fetchCharacterAvailableSpells(
        characterId,
        characterLevel,
        abortController.signal
      );

      this.pendingAvailableRequests.set(characterId, {
        promise: requestPromise,
        abortController,
      });

      try {
        const result = await requestPromise;

        // Atualizar cache se bem-sucedido
        if (result.success && result.data) {
          this.characterSpellCache.set(characterId, {
            data: result.data,
            timestamp: Date.now(),
            isValid: true,
          });
        }

        return result;
      } finally {
        this.pendingAvailableRequests.delete(characterId);
      }
    } catch (error) {
      console.error('[SpellService] Erro ao buscar magias disponíveis:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false,
      };
    }
  }

  // NOVO: Método privado para buscar magias disponíveis do servidor
  private static async fetchCharacterAvailableSpells(
    characterId: string,
    characterLevel: number,
    signal: AbortSignal
  ): Promise<ServiceResponse<AvailableSpell[]>> {
    // Timeout Promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout ao carregar magias disponíveis'));
      }, this.REQUEST_TIMEOUT);

      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new Error('Request cancelado'));
      });
    });

    // RPC Promise - Buscar magias disponíveis para o nível
    const rpcPromise = supabase.rpc('get_available_spells', {
      p_level: characterLevel,
    });

    const { data: spellsData, error: spellsError } = await Promise.race([
      rpcPromise,
      timeoutPromise,
    ]);

    if (signal.aborted) {
      throw new Error('Request cancelado');
    }

    if (spellsError) throw spellsError;

    // Buscar informações de equipamento do personagem
    const { data: equippedData, error: equippedError } = await supabase
      .from('spell_slots')
      .select('slot_position, spell_id')
      .eq('character_id', characterId);

    if (equippedError) throw equippedError;

    // Mapear equipamento por spell_id
    const equippedMap = new Map<string, number>();
    (equippedData || []).forEach((item: { slot_position: number; spell_id: string | null }) => {
      if (item.spell_id) {
        equippedMap.set(item.spell_id, item.slot_position);
      }
    });

    // Combinar dados de spells com informações de equipamento
    const spells: AvailableSpell[] = (spellsData || []).map((spell: Spell) => ({
      id: spell.id,
      name: spell.name,
      description: spell.description,
      effect_type: spell.effect_type,
      mana_cost: spell.mana_cost,
      cooldown: spell.cooldown,
      effect_value: spell.effect_value,
      duration: spell.duration,
      unlocked_at_level: spell.unlocked_at_level || 1, // Fallback se não existir o campo
      is_equipped: equippedMap.has(spell.id),
      slot_position: equippedMap.get(spell.id) || null,
    }));

    return { data: spells, error: null, success: true };
  }

  // REFATORADO: Equipar magias com invalidação de cache
  static async setCharacterSpells(
    characterId: string,
    spellIds: (string | null)[]
  ): Promise<ServiceResponse<null>> {
    try {
      const [spell1, spell2, spell3] = spellIds;

      // ✅ Usar RPC correta: set_spell_slot (para cada slot)

      // Chamar set_spell_slot para cada slot
      const results = await Promise.all([
        supabase.rpc('set_spell_slot', {
          p_character_id: characterId,
          p_slot_position: 1,
          p_spell_id: spell1 || null,
        }),
        supabase.rpc('set_spell_slot', {
          p_character_id: characterId,
          p_slot_position: 2,
          p_spell_id: spell2 || null,
        }),
        supabase.rpc('set_spell_slot', {
          p_character_id: characterId,
          p_slot_position: 3,
          p_spell_id: spell3 || null,
        }),
      ]);

      // Verificar erros
      for (const result of results) {
        if (result.error) throw result.error;
      }

      // CRÍTICO: Invalidar cache após mudança
      this.invalidateCharacterCache(characterId);

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('[SpellService] Erro ao equipar magias:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false,
      };
    }
  }

  // REFATORADO: Obter estatísticas com cálculo local
  static calculateSpellStats(availableSpells: AvailableSpell[]): SpellStats {
    const equipped = availableSpells.filter(s => s.is_equipped);
    const spellsByType: Record<string, number> = {};

    availableSpells.forEach(spell => {
      spellsByType[spell.effect_type] = (spellsByType[spell.effect_type] || 0) + 1;
    });

    const stats: SpellStats = {
      total_available: availableSpells.length,
      total_equipped: equipped.length,
      highest_level_unlocked:
        availableSpells.length > 0 ? Math.max(...availableSpells.map(s => s.unlocked_at_level)) : 1,
      spells_by_type: spellsByType,
    };

    return stats;
  }

  // Método existente - obter magias disponíveis por nível (usado no combate)
  static async getAvailableSpells(level: number): Promise<ServiceResponse<Spell[]>> {
    const now = Date.now();
    if (this.spellCache.has(level) && now - this.lastFetchTimestamp < this.CACHE_DURATION) {
      return { data: this.spellCache.get(level)!, error: null, success: true };
    }

    try {
      const { data, error } = await supabase.rpc('get_available_spells', { p_level: level });

      if (error) throw error;

      this.spellCache.set(level, data || []);
      this.lastFetchTimestamp = now;

      return { data: data || [], error: null, success: true };
    } catch (error) {
      console.error('[SpellService] Erro ao buscar magias:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false,
      };
    }
  }

  /**
   * Calcular dano de magia escalado com atributos e habilidade (EXTREMAMENTE BALANCEADO)
   */
  static calculateScaledSpellDamage(baseDamage: number, caster: GamePlayer | Enemy): number {
    if (!('intelligence' in caster) || !('wisdom' in caster) || !('magic_mastery' in caster)) {
      return baseDamage;
    }

    const intelligence = caster.intelligence || 10;
    const wisdom = caster.wisdom || 10;
    const magicMastery = caster.magic_mastery || 1;

    const intScaling = Math.pow(intelligence, 1.35) * 1.8;
    const wisScaling = Math.pow(wisdom, 1.2) * 1.2;
    const masteryScaling = Math.pow(magicMastery, 1.2) * 2.5;

    let totalBonus = intScaling + wisScaling + masteryScaling;

    // Diminishing returns
    if (totalBonus > 150) {
      totalBonus = 150 + (totalBonus - 150) * 0.6;
    }

    totalBonus = Math.min(300, totalBonus);
    const scaledDamage = Math.round(baseDamage * (1 + totalBonus / 100));

    return scaledDamage;
  }

  /**
   * Calcular cura de magia escalada com atributos e habilidade (ESPECIALIZADA)
   */
  static calculateScaledSpellHealing(baseHealing: number, caster: GamePlayer | Enemy): number {
    if (!('wisdom' in caster) || !('magic_mastery' in caster)) {
      return baseHealing;
    }

    const wisdom = caster.wisdom || 10;
    const magicMastery = caster.magic_mastery || 1;

    const wisScaling = Math.pow(wisdom, 1.3) * 2.2;
    const masteryScaling = Math.pow(magicMastery, 1.15) * 1.8;

    let totalBonus = wisScaling + masteryScaling;

    if (totalBonus > 120) {
      totalBonus = 120 + (totalBonus - 120) * 0.5;
    }

    totalBonus = Math.min(220, totalBonus);
    const scaledHealing = Math.round(baseHealing * (1 + totalBonus / 100));

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
  ): { message: string; success: boolean; endsTurn: boolean } {
    const effects = {
      damage: () => {
        const damage = this.calculateScaledSpellDamage(spell.effect_value, caster);
        // ✅ CORREÇÃO: Modificar HP de forma segura (o caller deve aplicar a mudança)
        target.hp = Math.max(0, target.hp - damage);
        return `${spell.name} causou ${damage} de dano mágico!`;
      },
      heal: () => {
        const healing = this.calculateScaledSpellHealing(spell.effect_value, caster);
        const maxHp = 'max_hp' in target ? target.max_hp : target.maxHp;
        const oldHp = target.hp;
        // ✅ CORREÇÃO: Modificar HP de forma segura (o caller deve aplicar a mudança)
        target.hp = Math.min(maxHp, target.hp + healing);
        const actualHeal = target.hp - oldHp;
        return `${spell.name} restaurou ${actualHeal} HP!`;
      },
      buff: () => this.applyAttributeEffect(spell, target, 'buff'),
      debuff: () => this.applyAttributeEffect(spell, target, 'debuff'),
      dot: () => this.applyOverTimeEffect(spell, target, 'dot'),
      hot: () => this.applyOverTimeEffect(spell, target, 'hot'),
    };

    try {
      const message = effects[spell.effect_type]?.() || `${spell.name} não teve efeito!`;

      // ✅ CORREÇÃO: Apenas magias de suporte (buffs/heals/debuffs) não consomem turno
      // Magias de dano devem passar o turno para o inimigo como ataques físicos
      const isSupportSpellResult = isSupportSpell(spell);
      const endsTurn = isSupportSpellResult; // Invertido: suporte = true (pula turno), dano = false (passa turno)

      return { message, success: true, endsTurn };
    } catch (error) {
      console.error('Erro ao aplicar efeito da magia:', error);
      return { message: `Erro ao usar ${spell.name}!`, success: false, endsTurn: true };
    }
  }

  private static applyAttributeEffect(
    spell: Spell,
    target: GamePlayer | Enemy,
    type: 'buff' | 'debuff'
  ): string {
    if (!target.active_effects) return `${spell.name} não teve efeito!`;

    // ✅ CORREÇÃO CRÍTICA: Criar cópia do active_effects para evitar mutação read-only
    const activeEffects = {
      buffs: [...target.active_effects.buffs],
      debuffs: [...target.active_effects.debuffs],
      dots: [...target.active_effects.dots],
      hots: [...target.active_effects.hots],
      attribute_modifications: target.active_effects.attribute_modifications
        ? [...target.active_effects.attribute_modifications]
        : [],
    };

    if (type === 'buff') {
      const modifications = this.getAttributeModificationsForSpell(spell);
      if (modifications.length > 0) {
        // ✅ CORREÇÃO: Adicionar modificações específicas com duração da spell
        const spellDuration = spell.duration || 3;
        const modifiedMods = modifications.map(mod => ({
          ...mod,
          duration: spellDuration,
        }));

        activeEffects.attribute_modifications.push(...modifiedMods);

        const modMessages = modifiedMods
          .map(mod => {
            const sign = mod.value > 0 ? '+' : '';
            const suffix = mod.type === 'percentage' ? '%' : '';
            return `${sign}${mod.value}${suffix} ${this.translateAttributeName(mod.attribute)}`;
          })
          .join(', ');

        // ✅ CORREÇÃO CRÍTICA: NÃO criar buff genérico quando há modificações específicas
        target.active_effects = activeEffects;
        return `${spell.name} concedeu: ${modMessages} por ${spellDuration} turnos!`;
      } else {
        // ✅ CORREÇÃO: Apenas criar buff genérico se NÃO há modificações específicas
        const value = this.calculateScaledSpellDamage(spell.effect_value, target);
        const effectDuration = spell.duration || 3;
        const effect = {
          type,
          value,
          duration: effectDuration,
          source_spell: spell.name,
        };

        activeEffects.buffs.push(effect);
        target.active_effects = activeEffects;
        return `${spell.name} aplicou um efeito benéfico genérico (+${value}) por ${effectDuration} turnos!`;
      }
    } else {
      // Debuffs
      const modifications = this.getAttributeModificationsForSpell(spell);
      if (modifications.length > 0) {
        const effectDuration = spell.duration || 3;
        // Para debuffs, inverter o sinal dos modificadores
        const debuffMods = modifications.map(mod => ({
          ...mod,
          value: -Math.abs(mod.value), // Garantir que seja negativo
          duration: effectDuration,
        }));
        activeEffects.attribute_modifications.push(...debuffMods);

        const modMessages = debuffMods
          .map(mod => {
            const suffix = mod.type === 'percentage' ? '%' : '';
            return `${mod.value}${suffix} ${this.translateAttributeName(mod.attribute)}`;
          })
          .join(', ');

        // ✅ CORREÇÃO CRÍTICA: NÃO criar debuff genérico quando há modificações específicas
        target.active_effects = activeEffects;
        return `${spell.name} reduziu: ${modMessages} por ${effectDuration} turnos!`;
      } else {
        // ✅ CORREÇÃO: Apenas criar debuff genérico se NÃO há modificações específicas
        const value = this.calculateScaledSpellDamage(spell.effect_value, target);
        const effectDuration = spell.duration || 3;
        const effect = {
          type,
          value,
          duration: effectDuration,
          source_spell: spell.name,
        };

        activeEffects.debuffs.push(effect);
        target.active_effects = activeEffects;
        return `${spell.name} aplicou um efeito prejudicial genérico (-${value}) por ${effectDuration} turnos!`;
      }
    }
  }

  private static applyOverTimeEffect(
    spell: Spell,
    target: GamePlayer | Enemy,
    type: 'dot' | 'hot'
  ): string {
    if (!target.active_effects) return `${spell.name} não teve efeito!`;

    const value =
      type === 'dot'
        ? this.calculateScaledSpellDamage(spell.effect_value, target)
        : this.calculateScaledSpellHealing(spell.effect_value, target);

    const effect = {
      type,
      value,
      duration: spell.duration,
      source_spell: spell.name,
    };

    // ✅ CORREÇÃO: Criar cópia do active_effects para evitar mutação read-only
    const activeEffects = {
      buffs: [...target.active_effects.buffs],
      debuffs: [...target.active_effects.debuffs],
      dots: [...target.active_effects.dots],
      hots: [...target.active_effects.hots],
      attribute_modifications: target.active_effects.attribute_modifications
        ? [...target.active_effects.attribute_modifications]
        : [],
    };

    if (type === 'dot') {
      activeEffects.dots.push(effect);

      // ✅ CORREÇÃO: Reatribuir o objeto completo
      target.active_effects = activeEffects;
      return `${spell.name} aplicou dano contínuo (${value} por ${spell.duration} turnos)!`;
    } else {
      activeEffects.hots.push(effect);

      // ✅ CORREÇÃO: Reatribuir o objeto completo
      target.active_effects = activeEffects;
      return `${spell.name} aplicou cura contínua (${value} por ${spell.duration} turnos)!`;
    }
  }

  /**
   * Processar efeitos ao longo do tempo
   * @param target Alvo dos efeitos
   * @returns Mensagens dos efeitos processados
   */
  static processOverTimeEffects(target: GamePlayer | Enemy): string[] {
    const messages: string[] = [];

    if (!('active_effects' in target) || !target.active_effects) return messages;

    // ✅ CORREÇÃO CRÍTICA: Criar cópia completa do active_effects para evitar mutação read-only
    const activeEffects = {
      buffs: [...target.active_effects.buffs],
      debuffs: [...target.active_effects.debuffs],
      dots: [...target.active_effects.dots],
      hots: [...target.active_effects.hots],
      attribute_modifications: target.active_effects.attribute_modifications
        ? [...target.active_effects.attribute_modifications]
        : [],
    };

    // ✅ CORREÇÃO: Processar DoTs com cópia dos objetos
    activeEffects.dots = activeEffects.dots
      .map(effect => ({ ...effect })) // Criar cópia do objeto
      .filter(effect => {
        target.hp = Math.max(0, target.hp - effect.value);
        effect.duration--;
        messages.push(`${effect.source_spell} causou ${effect.value} de dano contínuo.`);
        return effect.duration > 0;
      });

    // ✅ CORREÇÃO: Processar HoTs com cópia dos objetos
    activeEffects.hots = activeEffects.hots
      .map(effect => ({ ...effect })) // Criar cópia do objeto
      .filter(effect => {
        const maxHp = 'max_hp' in target ? target.max_hp : target.maxHp;
        const oldHp = target.hp;
        target.hp = Math.min(maxHp, target.hp + effect.value);
        const actualHeal = target.hp - oldHp;
        effect.duration--;

        if (actualHeal > 0) {
          messages.push(`${effect.source_spell} restaurou ${actualHeal} HP.`);
        }

        return effect.duration > 0;
      });

    // ✅ CORREÇÃO CRÍTICA: Processar modificações de atributos com cópia dos objetos
    if (activeEffects.attribute_modifications) {
      activeEffects.attribute_modifications = activeEffects.attribute_modifications
        .map(mod => ({ ...mod })) // Criar cópia do objeto
        .filter(mod => {
          mod.duration--;
          if (mod.duration <= 0) {
            messages.push(
              `O efeito de ${mod.source_spell} em ${this.translateAttributeName(mod.attribute)} expirou.`
            );
            return false;
          }
          return true;
        });
    }

    // ✅ CORREÇÃO: Processar buffs genéricos com cópia dos objetos
    activeEffects.buffs = activeEffects.buffs
      .map(effect => ({ ...effect })) // Criar cópia do objeto
      .filter(effect => {
        effect.duration--;
        if (effect.duration <= 0) {
          messages.push(`O efeito benéfico de ${effect.source_spell} expirou.`);
          return false;
        }
        return true;
      });

    // ✅ CORREÇÃO: Processar debuffs genéricos com cópia dos objetos
    activeEffects.debuffs = activeEffects.debuffs
      .map(effect => ({ ...effect })) // Criar cópia do objeto
      .filter(effect => {
        effect.duration--;
        if (effect.duration <= 0) {
          messages.push(`O efeito prejudicial de ${effect.source_spell} expirou.`);
          return false;
        }
        return true;
      });

    // ✅ CORREÇÃO: Reatribuir o objeto completo ao invés de propriedades individuais
    target.active_effects = activeEffects;

    return messages;
  }

  /**
   * Atualizar cooldowns das magias
   * @param gameState Estado atual do jogo
   * @returns Estado atualizado
   */
  static updateSpellCooldowns(gameState: GameState): GameState {
    // ✅ CORREÇÃO: Criar cópia do gameState para evitar mutação read-only
    const updatedGameState = {
      ...gameState,
      player: {
        ...gameState.player,
        spells: gameState.player.spells.map(spell => ({
          ...spell,
          current_cooldown: spell.current_cooldown > 0 ? spell.current_cooldown - 1 : 0,
        })),
      },
    };

    return updatedGameState;
  }

  /**
   * ✅ NOVA FUNÇÃO: Resetar todos os cooldowns das magias
   * Esta função deve ser chamada quando uma nova batalha é iniciada (novo andar/inimigo)
   * @param gameState Estado atual do jogo
   * @returns Estado atualizado com todos os cooldowns resetados
   */
  static resetSpellCooldowns(gameState: GameState): GameState {
    // ✅ CORREÇÃO: Criar cópia do gameState para evitar mutação read-only
    const updatedGameState = {
      ...gameState,
      player: {
        ...gameState.player,
        spells: gameState.player.spells.map(spell => {
          return {
            ...spell,
            current_cooldown: 0, // ✅ CRÍTICO: Resetar todos os cooldowns para 0
          };
        }),
      },
    };
    return updatedGameState;
  }

  // Utilitário para obter ícone da magia baseado no tipo
  static getSpellTypeIcon(effectType: SpellEffectType): string {
    const icons = {
      damage: '⚔️',
      heal: '❤️',
      buff: '🛡️',
      debuff: '💀',
      dot: '🔥',
      hot: '✨',
    };
    return icons[effectType] || '🔮';
  }

  // Utilitário para obter cor da magia baseado no tipo
  static getSpellTypeColor(effectType: SpellEffectType): string {
    const colors = {
      damage: 'text-red-500',
      heal: 'text-green-500',
      buff: 'text-blue-500',
      debuff: 'text-purple-500',
      dot: 'text-orange-500',
      hot: 'text-emerald-500',
    };
    return colors[effectType] || 'text-gray-500';
  }

  // Utilitário para traduzir tipo de efeito
  static translateEffectType(effectType: SpellEffectType): string {
    const translations = {
      damage: 'Dano',
      heal: 'Cura',
      buff: 'Benefício',
      debuff: 'Maldição',
      dot: 'Dano Contínuo',
      hot: 'Cura Contínua',
    };
    return translations[effectType] || effectType;
  }

  /**
   * Obter modificações de atributos específicas baseadas no nome da magia
   * @param spell Magia sendo aplicada
   * @returns Array de modificações de atributos
   */
  static getAttributeModificationsForSpell(spell: Spell): AttributeModification[] {
    const modifications: AttributeModification[] = [];
    const spellName = spell.name.toLowerCase();

    // ✅ CORREÇÃO: Multiplicadores MUITO MAIORES e palavras-chave expandidas
    const attributeMap = [
      {
        keywords: ['força', 'strength', 'fortalecer', 'fúria', 'guerreiro', 'berserker', 'poder'],
        attribute: 'atk',
        multiplier: 1.2, // Era 0.5, agora 1.2x
      },
      {
        keywords: ['velocidade', 'speed', 'agilidade', 'pressa', 'vento', 'corrida'],
        attribute: 'speed',
        multiplier: 1.0, // Era 0.3, agora 1.0x
      },
      {
        keywords: ['defesa', 'defense', 'proteção', 'armadura', 'barreira', 'escudo'],
        attribute: 'def',
        multiplier: 1.1, // Era 0.4, agora 1.1x
      },
      {
        keywords: ['crítico', 'critical', 'precisão', 'foco', 'mira', 'acerto'],
        attribute: 'critical_chance',
        multiplier: 0.8, // Era 0.2, agora 0.8x
        type: 'percentage',
      },
      {
        keywords: ['magia', 'magic', 'mystic', 'arcano', 'místico', 'feitiço'],
        attribute: 'magic_attack',
        multiplier: 1.3, // Era 0.6, agora 1.3x
      },
      {
        keywords: ['destruição', 'devastação', 'carnificina', 'massacre'],
        attribute: 'critical_damage',
        multiplier: 1.5, // Novo atributo
        type: 'percentage',
      },
    ];

    attributeMap.forEach(({ keywords, attribute, multiplier, type = 'flat' }) => {
      if (keywords.some(keyword => spellName.includes(keyword))) {
        // ✅ CORREÇÃO: Valor mínimo garantido para efeitos visíveis
        const rawValue = Math.floor(spell.effect_value * multiplier);
        const finalValue = Math.max(5, rawValue); // Mínimo 5 para garantir efeito visível

        modifications.push({
          attribute: attribute as
            | 'atk'
            | 'def'
            | 'speed'
            | 'magic_attack'
            | 'critical_chance'
            | 'critical_damage',
          value: finalValue,
          type: type as 'flat' | 'percentage',
          // ✅ CORREÇÃO: Usar duração da spell ao invés de fixo
          duration: spell.duration || 3,
          source_spell: spell.name,
          applied_at: Date.now(),
        });
      }
    });

    return modifications;
  }

  /**
   * Traduzir nomes de atributos para português
   * @param attribute Nome do atributo
   * @returns Nome traduzido
   */
  static translateAttributeName(attribute: string): string {
    const translations = {
      atk: 'Ataque',
      def: 'Defesa',
      speed: 'Velocidade',
      magic_attack: 'Ataque Mágico',
      critical_chance: 'Chance Crítica',
      critical_damage: 'Dano Crítico',
    };
    return translations[attribute as keyof typeof translations] || attribute;
  }

  // REFATORADO: Obter magias equipadas com cache robusto
  static async getCharacterEquippedSpells(
    characterId: string
  ): Promise<ServiceResponse<PlayerSpell[]>> {
    try {
      // Verificar cache primeiro
      const cachedEntry = this.equippedSpellCache.get(characterId);
      if (this.isCacheValid(cachedEntry)) {
        return { data: cachedEntry!.data, error: null, success: true };
      }

      // Verificar se há requisição pendente
      const pendingRequest = this.pendingEquippedRequests.get(characterId);
      if (pendingRequest) {
        try {
          return await pendingRequest.promise;
        } catch (error) {
          if (!pendingRequest.abortController.signal.aborted) {
            throw error;
          }
        }
      }

      // Criar nova requisição
      const abortController = new AbortController();
      const requestPromise = this.fetchCharacterEquippedSpells(characterId, abortController.signal);

      this.pendingEquippedRequests.set(characterId, {
        promise: requestPromise,
        abortController,
      });

      try {
        const result = await requestPromise;

        // Atualizar cache se bem-sucedido
        if (result.success && result.data) {
          this.equippedSpellCache.set(characterId, {
            data: result.data,
            timestamp: Date.now(),
            isValid: true,
          });
        }

        return result;
      } finally {
        this.pendingEquippedRequests.delete(characterId);
      }
    } catch (error) {
      console.error('[SpellService] Erro ao buscar magias equipadas:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false,
      };
    }
  }

  // NOVO: Método privado para buscar magias equipadas do servidor
  private static async fetchCharacterEquippedSpells(
    characterId: string,
    signal: AbortSignal
  ): Promise<ServiceResponse<PlayerSpell[]>> {
    const { data, error } = await supabase
      .from('spell_slots')
      .select(
        `
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
      `
      )
      .eq('character_id', characterId)
      .not('spell_id', 'is', null)
      .order('slot_position');

    if (signal.aborted) {
      throw new Error('Request cancelado');
    }

    if (error) throw error;

    const playerSpells: PlayerSpell[] = (data || []).map(item => {
      const spell = Array.isArray(item.spell) ? item.spell[0] : item.spell;
      return {
        id: spell.id,
        name: spell.name,
        description: spell.description,
        mana_cost: spell.mana_cost,
        cooldown: spell.cooldown,
        current_cooldown: 0,
        effect_type: spell.effect_type as SpellEffectType,
        effect_value: spell.effect_value,
        duration: spell.duration || 0,
        unlocked_at_level: spell.unlocked_at_level,
      };
    });

    return { data: playerSpells, error: null, success: true };
  }
}
