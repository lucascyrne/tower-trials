import { supabase } from '@/lib/supabase';
import { type Monster } from './monster.model';
import { type Enemy } from './game-model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

interface SupabaseDropData {
  drop_id: string;
  drop_chance: number;
  min_quantity: number;
  max_quantity: number;
  monster_drops: unknown;
}

export class MonsterService {
  private static enemyCache: Map<number, Enemy> = new Map();
  private static cacheExpiry: Map<number, number> = new Map();
  private static readonly CACHE_DURATION = 30000; // 30 segundos

  /**
   * MÉTODO PRINCIPAL: Buscar inimigo para batalha
   */
  static async getEnemyForFloor(floor: number): Promise<ServiceResponse<Enemy>> {
    if (floor <= 0) {
      return { data: null, error: `Andar inválido: ${floor}`, success: false };
    }

    // Verificar cache
    const cachedEnemy = this.enemyCache.get(floor);
    const cacheExpiry = this.cacheExpiry.get(floor);
    const now = Date.now();

    if (cachedEnemy && cacheExpiry && now < cacheExpiry) {
      return { data: cachedEnemy, error: null, success: true };
    }

    try {
      console.log(`[MonsterService] Buscando enemy para andar ${floor}`);

      // Tentar RPC primeiro
      let { data, error } = await supabase.rpc('get_monster_for_floor_with_initiative', {
        p_floor: floor,
      });

      // Fallback para RPC alternativa
      if (error?.message?.includes('does not exist')) {
        const altResult = await supabase.rpc('get_monster_for_floor', { p_floor: floor });
        data = altResult.data;
        error = altResult.error;
      }

      // Fallback para busca direta
      if (error) {
        const tableResult = await supabase
          .from('monsters')
          .select('*')
          .lte('min_floor', floor)
          .order('min_floor', { ascending: false })
          .limit(1);
        data = tableResult.data?.[0] || null;
        error = tableResult.error;
      }

      // Se tudo falhar, usar fallback
      if (error || !data) {
        const fallbackEnemy = this.generateFallbackEnemy(floor);
        this.cacheEnemy(floor, fallbackEnemy);
        return { data: fallbackEnemy, error: null, success: true };
      }

      // Converter para Enemy
      const monsterData = Array.isArray(data) ? data[0] : data;
      const enemy = this.convertToEnemy(monsterData, floor);

      // Carregar drops
      await this.loadPossibleDrops(enemy);

      // Cache resultado
      this.cacheEnemy(floor, enemy);

      return { data: enemy, error: null, success: true };
    } catch (error) {
      console.error(`[MonsterService] Erro ao buscar enemy:`, error);
      const fallbackEnemy = this.generateFallbackEnemy(floor);
      this.cacheEnemy(floor, fallbackEnemy);
      return { data: fallbackEnemy, error: null, success: true };
    }
  }

  /**
   * Cache do enemy
   */
  private static cacheEnemy(floor: number, enemy: Enemy): void {
    const now = Date.now();
    this.enemyCache.set(floor, enemy);
    this.cacheExpiry.set(floor, now + this.CACHE_DURATION);
  }

  /**
   * Converter Monster para Enemy
   */
  private static convertToEnemy(monsterData: Monster, floor: number): Enemy {
    const level = monsterData.level || Math.max(1, Math.floor(floor / 5) + 1);

    return {
      id: monsterData.id || `generated_${floor}_${Date.now()}`,
      name: monsterData.name || `Monstro Andar ${floor}`,
      level,
      hp: monsterData.hp || 50 + floor * 10,
      maxHp: monsterData.hp || 50 + floor * 10,
      attack: monsterData.atk || 10 + floor * 2,
      defense: monsterData.def || 5 + floor * 1,
      speed: monsterData.speed || 10,
      image: monsterData.image || '👾',
      behavior: monsterData.behavior || 'balanced',
      mana: monsterData.mana || 0,
      reward_xp: monsterData.reward_xp || Math.floor(5 + floor * 2),
      reward_gold: monsterData.reward_gold || Math.floor(3 + floor * 1),
      possible_drops: [],
      active_effects: {
        buffs: [],
        debuffs: [],
        dots: [],
        hots: [],
        attribute_modifications: [],
      },
      tier: monsterData.tier || 1,
      base_tier: monsterData.base_tier || 1,
      cycle_position: monsterData.cycle_position || ((floor - 1) % 20) + 1,
      is_boss: monsterData.is_boss || false,
      strength: monsterData.strength || 10,
      dexterity: monsterData.dexterity || 10,
      intelligence: monsterData.intelligence || 10,
      wisdom: monsterData.wisdom || 10,
      vitality: monsterData.vitality || 10,
      luck: monsterData.luck || 10,
      critical_chance: monsterData.critical_chance || 0.05,
      critical_damage: monsterData.critical_damage || 1.5,
      critical_resistance: monsterData.critical_resistance || 0.1,
      physical_resistance: monsterData.physical_resistance || 0.0,
      magical_resistance: monsterData.magical_resistance || 0.0,
      debuff_resistance: monsterData.debuff_resistance || 0.0,
      physical_vulnerability: monsterData.physical_vulnerability || 1.0,
      magical_vulnerability: monsterData.magical_vulnerability || 1.0,
      primary_trait: monsterData.primary_trait || 'common',
      secondary_trait: monsterData.secondary_trait || 'basic',
      special_abilities: monsterData.special_abilities || [],
    };
  }

  /**
   * Carregar drops possíveis
   */
  private static async loadPossibleDrops(enemy: Enemy): Promise<void> {
    try {
      const { data: possibleDropsData } = await supabase
        .from('monster_possible_drops')
        .select(
          `
          drop_id,
          drop_chance,
          min_quantity,
          max_quantity,
          monster_drops:drop_id (id, name, description, rarity, value)
        `
        )
        .eq('monster_id', enemy.id);

      if (possibleDropsData) {
        enemy.possible_drops = possibleDropsData.map((dropData: SupabaseDropData) => ({
          drop_id: dropData.drop_id,
          drop_chance: dropData.drop_chance,
          min_quantity: dropData.min_quantity,
          max_quantity: dropData.max_quantity,
          drop_info: Array.isArray(dropData.monster_drops)
            ? dropData.monster_drops[0]
            : dropData.monster_drops,
        }));
      }
    } catch (error) {
      console.warn(`[MonsterService] Erro ao carregar drops:`, error);
    }
  }

  /**
   * Gerar enemy de fallback
   */
  private static generateFallbackEnemy(floor: number): Enemy {
    const level = Math.max(1, Math.floor(floor / 5) + 1);
    const tier = Math.max(1, Math.floor(floor / 20) + 1);
    const isBoss = floor % 10 === 0;

    const monsterNames = [
      'Slime',
      'Goblin',
      'Orc',
      'Skeleton',
      'Wolf',
      'Spider',
      'Troll',
      'Dragon',
    ];
    const nameIndex = Math.floor(floor / 2) % monsterNames.length;
    const baseName = monsterNames[nameIndex];
    const name = `${isBoss ? 'Boss ' : ''}${baseName}${tier > 1 ? ` T${tier}` : ''}`;

    const baseHp = isBoss ? 80 : 50;
    const baseAtk = isBoss ? 15 : 10;
    const baseDef = isBoss ? 8 : 5;

    const hp = Math.floor(baseHp + level * 15 + tier * 25);
    const atk = Math.floor(baseAtk + level * 3 + tier * 5);
    const def = Math.floor(baseDef + level * 2 + tier * 3);
    const speed = Math.floor(10 + level * 1 + tier * 2);

    const reward_xp = Math.floor((5 + level * 2 + tier * 2) * (isBoss ? 2.5 : 1));
    const reward_gold = Math.floor((3 + level * 1 + tier * 1) * (isBoss ? 2.5 : 1));

    return {
      id: `fallback_${floor}_${Date.now()}`,
      name,
      level,
      hp,
      maxHp: hp,
      attack: atk,
      defense: def,
      speed,
      image: isBoss ? '👑' : '👾',
      behavior: 'balanced',
      mana: Math.floor(20 + level * 5),
      reward_xp,
      reward_gold,
      possible_drops: [],
      active_effects: {
        buffs: [],
        debuffs: [],
        dots: [],
        hots: [],
        attribute_modifications: [],
      },
      tier,
      base_tier: 1,
      cycle_position: ((floor - 1) % 20) + 1,
      is_boss: isBoss,
      strength: Math.floor(10 + level * 2),
      dexterity: Math.floor(10 + level * 1),
      intelligence: Math.floor(8 + level * 1),
      wisdom: Math.floor(8 + level * 1),
      vitality: Math.floor(12 + level * 2),
      luck: Math.floor(5 + level),
      critical_chance: 0.05 + level * 0.005,
      critical_damage: 1.5 + level * 0.05,
      critical_resistance: 0.1,
      physical_resistance: 0.0,
      magical_resistance: 0.0,
      debuff_resistance: 0.0,
      physical_vulnerability: 1.0,
      magical_vulnerability: 1.0,
      primary_trait: isBoss ? 'boss' : 'common',
      secondary_trait: 'basic',
      special_abilities: isBoss ? ['Boss Fury'] : [],
    };
  }

  /**
   * Limpar cache
   */
  static clearCache(): void {
    this.enemyCache.clear();
    this.cacheExpiry.clear();
  }
}
