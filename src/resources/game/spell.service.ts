import { type GamePlayer, type Enemy, type GameState } from './game-model';
import {
  type SpellEffectType,
  type PlayerSpell,
  type AttributeModification,
  type Spell,
} from './spell.model';
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
  private static spellStatsCache = new Map<string, CacheEntry<SpellStats>>();

  // Controle de requisições pendentes
  private static pendingAvailableRequests = new Map<string, PendingRequest<AvailableSpell[]>>();
  private static pendingEquippedRequests = new Map<string, PendingRequest<PlayerSpell[]>>();
  private static pendingStatsRequests = new Map<string, PendingRequest<SpellStats>>();

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
      console.log(`[SpellService] Cancelando requisição pendente: ${key}`);
      pending.abortController.abort();
      pendingMap.delete(key);
    }
  }

  /**
   * NOVO: Invalidar cache de personagem
   */
  static invalidateCharacterCache(characterId: string): void {
    console.log(`[SpellService] Invalidando cache para: ${characterId}`);

    // Cancelar requisições pendentes
    this.cancelPendingRequest(this.pendingAvailableRequests, characterId);
    this.cancelPendingRequest(this.pendingEquippedRequests, characterId);
    this.cancelPendingRequest(this.pendingStatsRequests, characterId);

    // Invalidar entradas de cache
    const availableEntry = this.characterSpellCache.get(characterId);
    if (availableEntry) availableEntry.isValid = false;

    const equippedEntry = this.equippedSpellCache.get(characterId);
    if (equippedEntry) equippedEntry.isValid = false;

    const statsEntry = this.spellStatsCache.get(characterId);
    if (statsEntry) statsEntry.isValid = false;
  }

  /**
   * NOVO: Limpar todo o cache
   */
  static clearCache(): void {
    console.log('[SpellService] Limpando todo o cache');

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
    for (const [, pending] of this.pendingStatsRequests) {
      pending.abortController.abort();
    }

    // Limpar caches de personagem
    this.characterSpellCache.clear();
    this.equippedSpellCache.clear();
    this.spellStatsCache.clear();
    this.pendingAvailableRequests.clear();
    this.pendingEquippedRequests.clear();
    this.pendingStatsRequests.clear();
  }

  // REFATORADO: Obter todas as magias disponíveis com cache robusto
  static async getCharacterAvailableSpells(
    characterId: string
  ): Promise<ServiceResponse<AvailableSpell[]>> {
    try {
      console.log(`[SpellService] Solicitando magias disponíveis para: ${characterId}`);

      // 1. Verificar cache primeiro
      const cachedEntry = this.characterSpellCache.get(characterId);
      if (this.isCacheValid(cachedEntry)) {
        console.log(`[SpellService] Cache hit para magias disponíveis: ${characterId}`);
        return { data: cachedEntry!.data, error: null, success: true };
      }

      // 2. Verificar se há requisição pendente
      const pendingRequest = this.pendingAvailableRequests.get(characterId);
      if (pendingRequest) {
        console.log(`[SpellService] Reutilizando requisição pendente: ${characterId}`);
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

    // RPC Promise
    const rpcPromise = supabase.rpc('get_character_available_spells', {
      p_character_id: characterId,
    });

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

    if (signal.aborted) {
      throw new Error('Request cancelado');
    }

    if (error) throw error;

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
      slot_position: item.slot_position,
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

      const { error } = await supabase.rpc('set_character_spells', {
        p_character_id: characterId,
        p_spell_1_id: spell1 || null,
        p_spell_2_id: spell2 || null,
        p_spell_3_id: spell3 || null,
      });

      if (error) throw error;

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

  // REFATORADO: Obter estatísticas com cache
  static async getCharacterSpellStats(characterId: string): Promise<ServiceResponse<SpellStats>> {
    try {
      // Verificar cache primeiro
      const cachedEntry = this.spellStatsCache.get(characterId);
      if (this.isCacheValid(cachedEntry)) {
        console.log(`[SpellService] Cache hit para spell stats: ${characterId}`);
        return { data: cachedEntry!.data, error: null, success: true };
      }

      // Verificar requisição pendente
      const pendingRequest = this.pendingStatsRequests.get(characterId);
      if (pendingRequest) {
        console.log(`[SpellService] Reutilizando requisição stats pendente: ${characterId}`);
        return await pendingRequest.promise;
      }

      // Criar nova requisição
      const abortController = new AbortController();
      const requestPromise = this.fetchCharacterSpellStats(characterId, abortController.signal);

      this.pendingStatsRequests.set(characterId, {
        promise: requestPromise,
        abortController,
      });

      try {
        const result = await requestPromise;

        if (result.success && result.data) {
          this.spellStatsCache.set(characterId, {
            data: result.data,
            timestamp: Date.now(),
            isValid: true,
          });
        }

        return result;
      } finally {
        this.pendingStatsRequests.delete(characterId);
      }
    } catch (error) {
      console.error('[SpellService] Erro ao buscar estatísticas de magias:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false,
      };
    }
  }

  // NOVO: Método privado para buscar stats do servidor
  private static async fetchCharacterSpellStats(
    characterId: string,
    signal: AbortSignal
  ): Promise<ServiceResponse<SpellStats>> {
    const { data, error } = await supabase.rpc('get_character_spell_stats', {
      p_character_id: characterId,
    });

    if (signal.aborted) {
      throw new Error('Request cancelado');
    }

    if (error) throw error;

    const stats = data[0] || {
      total_available: 0,
      total_equipped: 0,
      highest_level_unlocked: 1,
      spells_by_type: {},
    };

    return { data: stats, error: null, success: true };
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

    console.log('[SpellService] Dano mágico calculado:', {
      baseDamage,
      totalBonus: `${totalBonus.toFixed(1)}%`,
      scaledDamage,
    });

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

    console.log('[SpellService] Cura mágica calculada:', {
      baseHealing,
      totalBonus: `${totalBonus.toFixed(1)}%`,
      scaledHealing,
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
    const effects = {
      damage: () => {
        const damage = this.calculateScaledSpellDamage(spell.effect_value, caster);
        target.hp = Math.max(0, target.hp - damage);
        return `${spell.name} causou ${damage} de dano mágico!`;
      },
      heal: () => {
        const healing = this.calculateScaledSpellHealing(spell.effect_value, caster);
        const maxHp = 'max_hp' in target ? target.max_hp : target.maxHp;
        const oldHp = target.hp;
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
      return { message, success: true };
    } catch (error) {
      console.error('Erro ao aplicar efeito da magia:', error);
      return { message: `Erro ao usar ${spell.name}!`, success: false };
    }
  }

  private static applyAttributeEffect(
    spell: Spell,
    target: GamePlayer | Enemy,
    type: 'buff' | 'debuff'
  ): string {
    if (!target.active_effects) return `${spell.name} não teve efeito!`;

    const value = this.calculateScaledSpellDamage(spell.effect_value, target);
    const effect = {
      type,
      value,
      duration: spell.duration,
      source_spell: spell.name,
    };

    if (type === 'buff') {
      target.active_effects.buffs.push(effect);
      const modifications = this.getAttributeModificationsForSpell(spell);
      if (modifications.length > 0 && target.active_effects.attribute_modifications) {
        target.active_effects.attribute_modifications.push(...modifications);
        const modMessages = modifications
          .map(
            mod =>
              `+${mod.value}${mod.type === 'percentage' ? '%' : ''} ${this.translateAttributeName(mod.attribute)}`
          )
          .join(', ');
        return `${spell.name} aumentou: ${modMessages}!`;
      }
      return `${spell.name} aplicou um efeito benéfico (+${value})!`;
    } else {
      target.active_effects.debuffs.push(effect);
      return `${spell.name} aplicou um efeito prejudicial (-${value})!`;
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

    if (type === 'dot') {
      target.active_effects.dots.push(effect);
      return `${spell.name} aplicou dano contínuo (${value} por ${spell.duration} turnos)!`;
    } else {
      target.active_effects.hots.push(effect);
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

    // Processar DoTs
    target.active_effects.dots = target.active_effects.dots.filter(effect => {
      target.hp = Math.max(0, target.hp - effect.value);
      effect.duration--;
      messages.push(`${effect.source_spell} causou ${effect.value} de dano contínuo.`);
      return effect.duration > 0;
    });

    // Processar HoTs
    target.active_effects.hots = target.active_effects.hots.filter(effect => {
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

    // Processar modificações de atributos
    if (target.active_effects.attribute_modifications) {
      target.active_effects.attribute_modifications =
        target.active_effects.attribute_modifications.filter(mod => {
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

    return messages;
  }

  /**
   * Atualizar cooldowns das magias
   * @param gameState Estado atual do jogo
   * @returns Estado atualizado
   */
  static updateSpellCooldowns(gameState: GameState): GameState {
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

    const attributeMap = [
      { keywords: ['força', 'strength', 'fortalecer'], attribute: 'atk', multiplier: 0.5 },
      { keywords: ['velocidade', 'speed', 'agilidade'], attribute: 'speed', multiplier: 0.3 },
      { keywords: ['defesa', 'defense', 'proteção'], attribute: 'def', multiplier: 0.4 },
      {
        keywords: ['crítico', 'critical', 'precisão'],
        attribute: 'critical_chance',
        multiplier: 0.2,
        type: 'percentage',
      },
      { keywords: ['magia', 'magic', 'mystic'], attribute: 'magic_attack', multiplier: 0.6 },
    ];

    attributeMap.forEach(({ keywords, attribute, multiplier, type = 'flat' }) => {
      if (keywords.some(keyword => spellName.includes(keyword))) {
        modifications.push({
          attribute: attribute as
            | 'atk'
            | 'def'
            | 'speed'
            | 'magic_attack'
            | 'critical_chance'
            | 'critical_damage',
          value: Math.floor(spell.effect_value * multiplier),
          type: type as 'flat' | 'percentage',
          duration: spell.duration,
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
      console.log(`[SpellService] Solicitando magias equipadas para: ${characterId}`);

      // Verificar cache primeiro
      const cachedEntry = this.equippedSpellCache.get(characterId);
      if (this.isCacheValid(cachedEntry)) {
        console.log(`[SpellService] Cache hit para magias equipadas: ${characterId}`);
        return { data: cachedEntry!.data, error: null, success: true };
      }

      // Verificar se há requisição pendente
      const pendingRequest = this.pendingEquippedRequests.get(characterId);
      if (pendingRequest) {
        console.log(`[SpellService] Reutilizando requisição equipadas pendente: ${characterId}`);
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
    console.log(`[SpellService] Buscando magias equipadas do servidor: ${characterId}`);

    const { data, error } = await supabase
      .from('character_spell_slots')
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

    console.log(`[SpellService] ${playerSpells.length} magias equipadas encontradas`);
    return { data: playerSpells, error: null, success: true };
  }
}
