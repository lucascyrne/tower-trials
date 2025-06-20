import { useMonsterStore } from '@/stores/useMonsterStore';
import { useGameStateStore } from '@/stores/useGameStateStore';

import { supabase } from '@/lib/supabase';
import { type Enemy } from '../models/game.model';
import { type MonsterBehavior } from '../models/monster.model';

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

// Interface para dados do monstro vindos do banco
interface DatabaseMonsterData {
  id?: string;
  name?: string;
  level?: number;
  hp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  behavior?: string;
  mana?: number;
  reward_xp?: number;
  reward_gold?: number;
  strength?: number;
  dexterity?: number;
  intelligence?: number;
  wisdom?: number;
  vitality?: number;
  luck?: number;
  critical_chance?: number;
  critical_damage?: number;
  critical_resistance?: number;
  physical_resistance?: number;
  magical_resistance?: number;
  debuff_resistance?: number;
  physical_vulnerability?: number;
  magical_vulnerability?: number;
  primary_trait?: string;
  secondary_trait?: string;
  special_abilities?: unknown[];
}

// ===================================================================================================
// ÚNICA FONTE DA VERDADE: REPLICAR EXATAMENTE A LÓGICA DO BANCO
// ===================================================================================================

/**
 * ESCALAMENTO IDÊNTICO AO BANCO: scale_monster_stats_balanced_v2
 * Escalamento por tier mais agressivo: 1.5x ao invés de 1.25x
 * Progressão dentro do tier: 3% por andar ao invés de 1.5%
 */
function scaleMonsterStatsBalancedV2(
  basestat: number,
  currentTier: number,
  floorInTier: number,
  scalingType: 'hp' | 'attack' | 'defense' | 'normal' = 'normal'
): number {
  // Escalamento por tier mais agressivo: 1.5x ao invés de 1.25x
  const tierMultiplier = Math.pow(1.5, Math.max(0, currentTier - 1));

  // Progressão dentro do tier: 3% por andar ao invés de 1.5%
  const floorMultiplier = 1.0 + floorInTier * 0.03;

  let finalStat: number;

  // Aplicar escalamento baseado no tipo
  switch (scalingType) {
    case 'hp':
      // HP escala mais para survivability
      finalStat = basestat * tierMultiplier * floorMultiplier * 1.2;
      break;
    case 'attack':
      // Ataque escala normalmente
      finalStat = basestat * tierMultiplier * floorMultiplier;
      break;
    case 'defense':
      // Defesa escala um pouco menos
      finalStat = basestat * tierMultiplier * floorMultiplier * 0.9;
      break;
    default:
      // Escalamento padrão
      finalStat = basestat * tierMultiplier * floorMultiplier;
  }

  return Math.max(1, Math.floor(finalStat));
}

/**
 * STATS BASE REPLICADOS DO BANCO (20241221000012)
 * Com aumento de 30% para tornar mais desafiador conforme solicitado
 */
function getBaseStatsFromDatabase(
  floor: number,
  isBoss: boolean
): {
  hp: number;
  atk: number;
  def: number;
  rewardXp: number;
  rewardGold: number;
} {
  let baseHp: number, baseAtk: number, baseDef: number;
  let baseXp: number, baseGold: number;

  // STATS BASE DO BANCO + 30% DE AUMENTO PARA DIFICULDADE
  if (floor <= 3) {
    baseHp = Math.floor(80 * 1.3); // Era 80, agora 104
    baseAtk = Math.floor(15 * 1.3); // Era 15, agora 19
    baseDef = Math.floor(5 * 1.3); // Era 5, agora 6
    baseXp = Math.floor((15 + floor * 8) * 0.4); // REDUZIDO 60%
    baseGold = Math.floor((8 + floor * 5) * 0.4); // REDUZIDO 60%
  } else if (floor <= 5) {
    baseHp = Math.floor(120 * 1.3); // Era 120, agora 156
    baseAtk = Math.floor(28 * 1.3); // Era 28, agora 36
    baseDef = Math.floor(16 * 1.3); // Era 16, agora 20
    baseXp = Math.floor((20 + floor * 12) * 0.4);
    baseGold = Math.floor((12 + floor * 8) * 0.4);
  } else if (floor <= 10) {
    baseHp = Math.floor(180 * 1.3); // Era 180, agora 234
    baseAtk = Math.floor(36 * 1.3); // Era 36, agora 46
    baseDef = Math.floor(24 * 1.3); // Era 24, agora 31
    baseXp = Math.floor((30 + floor * 18) * 0.3); // REDUZIDO 70%
    baseGold = Math.floor((18 + floor * 12) * 0.3);
  } else if (floor <= 15) {
    baseHp = Math.floor(250 * 1.3); // Era 250, agora 325
    baseAtk = Math.floor(48 * 1.3); // Era 48, agora 62
    baseDef = Math.floor(32 * 1.3); // Era 32, agora 41
    baseXp = Math.floor((50 + floor * 25) * 0.3);
    baseGold = Math.floor((25 + floor * 18) * 0.3);
  } else if (floor <= 20) {
    baseHp = Math.floor(320 * 1.3); // Era 320, agora 416
    baseAtk = Math.floor(60 * 1.3); // Era 60, agora 78
    baseDef = Math.floor(40 * 1.3); // Era 40, agora 52
    baseXp = Math.floor((70 + floor * 35) * 0.3);
    baseGold = Math.floor((35 + floor * 25) * 0.3);
  } else {
    baseHp = Math.floor(400 * 1.3); // Era 400, agora 520
    baseAtk = Math.floor(75 * 1.3); // Era 75, agora 97
    baseDef = Math.floor(50 * 1.3); // Era 50, agora 65
    baseXp = Math.floor((100 + floor * 50) * 0.3);
    baseGold = Math.floor((50 + floor * 35) * 0.3);
  }

  // Bosses 80% mais fortes (REPLICANDO EXATAMENTE O BANCO)
  if (isBoss) {
    baseHp = Math.floor(baseHp * 1.8);
    baseAtk = Math.floor(baseAtk * 1.8);
    baseDef = Math.floor(baseDef * 1.8);
    baseXp = Math.floor(baseXp * 2.5); // Bosses ainda dão mais XP
    baseGold = Math.floor(baseGold * 2.0);
  }

  return { hp: baseHp, atk: baseAtk, def: baseDef, rewardXp: baseXp, rewardGold: baseGold };
}

/**
 * SISTEMA DE MONSTROS NEMESIS - 15% de chance de spawn
 * Monstros com características extremas para surpreender jogadores
 */
function generateNemesisStats(
  baseStats: ReturnType<typeof getBaseStatsFromDatabase>,
  floor: number
): {
  isNemesis: boolean;
  nemesisType?: string;
  modifiedStats?: ReturnType<typeof getBaseStatsFromDatabase>;
} {
  // 15% de chance de nemesis em andares normais, 0% em bosses
  const isBossFloor = floor === 5 || floor % 10 === 0;
  if (isBossFloor || Math.random() > 0.15) {
    return { isNemesis: false };
  }

  const nemesisTypes = [
    {
      name: 'Berserker',
      description: 'Ataque devastador, mas defesa baixa',
      modifiers: { hp: 0.8, atk: 2.5, def: 0.4, rewardXp: 1.8, rewardGold: 1.5 },
    },
    {
      name: 'Fortress',
      description: 'Defesa impenetrável, mas ataque baixo',
      modifiers: { hp: 2.0, atk: 0.6, def: 3.0, rewardXp: 1.6, rewardGold: 1.3 },
    },
    {
      name: 'Specter',
      description: 'Muito HP, ataque e defesa normais',
      modifiers: { hp: 3.5, atk: 1.0, def: 1.0, rewardXp: 2.2, rewardGold: 1.8 },
    },
    {
      name: 'Assassin',
      description: 'Balanceado mas com stats altos',
      modifiers: { hp: 1.8, atk: 1.8, def: 1.8, rewardXp: 2.0, rewardGold: 1.6 },
    },
  ];

  const nemesisType = nemesisTypes[Math.floor(Math.random() * nemesisTypes.length)];
  const modifiedStats = {
    hp: Math.floor(baseStats.hp * nemesisType.modifiers.hp),
    atk: Math.floor(baseStats.atk * nemesisType.modifiers.atk),
    def: Math.floor(baseStats.def * nemesisType.modifiers.def),
    rewardXp: Math.floor(baseStats.rewardXp * nemesisType.modifiers.rewardXp),
    rewardGold: Math.floor(baseStats.rewardGold * nemesisType.modifiers.rewardGold),
  };

  return {
    isNemesis: true,
    nemesisType: nemesisType.name,
    modifiedStats,
  };
}

/**
 * ÚNICA FONTE DA VERDADE: Gerar enemy com lógica idêntica ao banco
 */
function generateEnemyFromDatabaseLogic(floor: number): Enemy {
  // CÁLCULOS IDÊNTICOS AO BANCO
  const tier = Math.max(1, Math.floor(floor / 20) + 1);
  const floorInTier = floor - (tier - 1) * 20;
  const level = Math.max(1, Math.floor(floor / 3));

  // BOSS LOGIC IDÊNTICA AO BANCO
  const bossFloors = [5, 10, 15, 20];
  const isBoss = bossFloors.includes(floor) || (floor > 20 && floor % 10 === 0);

  // STATS BASE DO BANCO
  const baseStats = getBaseStatsFromDatabase(floor, isBoss);

  // SISTEMA NEMESIS (apenas em monstros normais)
  const nemesisResult = generateNemesisStats(baseStats, floor);
  const finalBaseStats = nemesisResult.modifiedStats || baseStats;
  const isNemesis = nemesisResult.isNemesis;
  const nemesisType = nemesisResult.nemesisType;

  // APLICAR ESCALAMENTO IDÊNTICO AO BANCO
  const scaledHp = scaleMonsterStatsBalancedV2(finalBaseStats.hp, tier, floorInTier, 'hp');
  const scaledAtk = scaleMonsterStatsBalancedV2(finalBaseStats.atk, tier, floorInTier, 'attack');
  const scaledDef = scaleMonsterStatsBalancedV2(finalBaseStats.def, tier, floorInTier, 'defense');
  const scaledSpeed = scaleMonsterStatsBalancedV2(10 + level + tier * 2, tier, floorInTier);

  // NOMES DINÂMICOS
  const monsterTypes = ['Slime', 'Goblin', 'Orc', 'Skeleton', 'Wolf', 'Spider', 'Troll', 'Dragon'];
  const tierPrefixes = ['', 'Greater', 'Elder', 'Ancient', 'Legendary', 'Mythic', 'Cosmic', 'Void'];

  const typeIndex = Math.floor(floorInTier / 3) % monsterTypes.length;
  const baseName = monsterTypes[typeIndex];
  const tierPrefix = tier > 1 && tier <= tierPrefixes.length ? tierPrefixes[tier - 1] : `T${tier}`;

  let name = baseName;
  if (tier > 1) name = `${tierPrefix} ${baseName}`;
  if (isBoss) name = `Boss ${name}`;
  else if (isNemesis) name = `${nemesisType} ${name}`;

  // ATRIBUTOS ESCALADOS IDENTICAMENTE AO BANCO
  const attributeBase = 10 + tier * 3 + Math.floor(floorInTier / 4);
  // const attributeMultiplier = Math.pow(1.5, tier - 1) * (1 + floorInTier * 0.03);

  const strength = Math.floor(
    scaleMonsterStatsBalancedV2(attributeBase, tier, floorInTier) * (isBoss ? 1.3 : 1)
  );
  const dexterity = Math.floor(
    scaleMonsterStatsBalancedV2(attributeBase * 0.8, tier, floorInTier) * (isNemesis ? 1.3 : 1)
  );
  const intelligence = Math.floor(
    scaleMonsterStatsBalancedV2(attributeBase * 0.6, tier, floorInTier)
  );
  const wisdom = Math.floor(scaleMonsterStatsBalancedV2(attributeBase * 0.7, tier, floorInTier));
  const vitality = Math.floor(
    scaleMonsterStatsBalancedV2(attributeBase, tier, floorInTier) * (isBoss ? 1.4 : 1.2)
  );
  const luck = Math.floor(scaleMonsterStatsBalancedV2(attributeBase * 0.6, tier, floorInTier));

  // STATS DE COMBATE ESCALADOS IDENTICAMENTE AO BANCO
  const criticalChance = Math.min(0.4, 0.05 + tier * 0.02 + floorInTier * 0.005);
  const criticalDamage = Math.min(3.0, 1.5 + tier * 0.1 + floorInTier * 0.02);
  const criticalResistance = Math.min(0.3, tier * 0.02 + (isBoss ? 0.1 : 0.05));

  console.log(
    `[MonsterService] ✅ Enemy gerado com lógica do banco: ${name} (T${tier}F${floorInTier}) - HP:${scaledHp} ATK:${scaledAtk} DEF:${scaledDef} | XP:${finalBaseStats.rewardXp} Gold:${finalBaseStats.rewardGold}${isNemesis ? ` [NEMESIS: ${nemesisType}]` : ''}`
  );

  return {
    id: `unified_${floor}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    level,
    hp: scaledHp,
    maxHp: scaledHp,
    attack: scaledAtk,
    defense: scaledDef,
    speed: scaledSpeed,
    image: isBoss ? '👑' : isNemesis ? '💀' : '👾',
    behavior: isNemesis ? 'aggressive' : isBoss ? 'defensive' : 'balanced',
    mana: Math.floor((20 + level * 4 + tier * 5) * (1 + floorInTier * 0.03)),
    reward_xp: finalBaseStats.rewardXp,
    reward_gold: finalBaseStats.rewardGold,
    possible_drops: [],
    active_effects: {
      buffs: [],
      debuffs: [],
      dots: [],
      hots: [],
      attribute_modifications: [],
    },
    tier,
    base_tier: Math.max(1, Math.floor(floor / 20) + 1),
    cycle_position: floorInTier,
    is_boss: isBoss,
    strength,
    dexterity,
    intelligence,
    wisdom,
    vitality,
    luck,
    critical_chance: criticalChance,
    critical_damage: criticalDamage,
    critical_resistance: criticalResistance,
    physical_resistance: Math.min(0.25, tier * 0.015 + (isBoss ? 0.05 : 0.02)),
    magical_resistance: Math.min(0.25, tier * 0.015 + (isNemesis ? 0.05 : 0.02)),
    debuff_resistance: Math.min(0.4, tier * 0.025 + (isBoss ? 0.15 : 0.05)),
    physical_vulnerability: Math.max(0.8, 1.0 - tier * 0.01),
    magical_vulnerability: Math.max(0.8, 1.0 - tier * 0.01),
    primary_trait: isBoss ? 'boss' : isNemesis ? 'nemesis' : tier > 3 ? 'veteran' : 'common',
    secondary_trait: isNemesis
      ? nemesisType?.toLowerCase()
      : tier > 5
        ? 'ancient'
        : tier > 2
          ? 'experienced'
          : 'basic',
    special_abilities: [
      ...(isBoss ? ['Powerful Strike', 'Boss Aura'] : []),
      ...(isNemesis ? [`${nemesisType} Mastery`] : []),
      ...(tier > 3 ? ['Tier Mastery'] : []),
      ...(tier > 6 ? ['Ancient Power'] : []),
    ],
  };
}

export class MonsterService {
  /**
   * MÉTODO PRINCIPAL: Buscar inimigo para batalha
   * SEMPRE usa a mesma lógica do banco para consistência total
   */
  static async getEnemyForFloor(floor: number): Promise<ServiceResponse<Enemy>> {
    if (floor <= 0) {
      return { data: null, error: `Andar inválido: ${floor}`, success: false };
    }

    const { getCachedMonster, cacheMonster, setFetchingMonster, setError } =
      useMonsterStore.getState();
    const { updateGameState } = useGameStateStore.getState();

    // Verificar cache
    const cachedEnemy = getCachedMonster(floor);
    if (cachedEnemy) {
      updateGameState(draft => {
        draft.currentEnemy = cachedEnemy;
      });
      return { data: cachedEnemy, error: null, success: true };
    }

    setFetchingMonster(true);
    setError(null);

    try {
      console.log(`[MonsterService] Buscando enemy para andar ${floor}`);

      // TENTATIVA 1: RPC do banco
      let { data, error } = await Promise.race([
        supabase.rpc('get_monster_for_floor_with_initiative', { p_floor: floor }),
        new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(
            () => reject({ data: null, error: { message: 'Timeout na RPC principal' } }),
            3000
          )
        ),
      ]).catch(err => ({ data: null, error: err }));

      // TENTATIVA 2: RPC alternativa se a principal falhar
      const isTypeError =
        error?.code === '42804' ||
        error?.message?.includes('does not match function result type') ||
        error?.message?.includes('structure of query does not match');

      if (isTypeError || error) {
        console.log(`[MonsterService] RPC principal falhou, tentando alternativa:`, error?.message);
        try {
          const altResult = await Promise.race([
            supabase.rpc('get_monster_for_floor_simple', { p_floor: floor }),
            new Promise<{ data: null; error: { message: string } }>((_, reject) =>
              setTimeout(
                () => reject({ data: null, error: { message: 'Timeout alternativo' } }),
                2000
              )
            ),
          ]).catch(err => ({ data: null, error: err }));

          if (altResult.data && !altResult.error) {
            data = altResult.data;
            error = altResult.error;
          }
        } catch (altError) {
          console.log('[MonsterService] RPC alternativa também falhou:', altError);
        }
      }

      let enemy: Enemy;

      // Se o banco funcionou, converter mantendo consistência com a lógica unificada
      if (data && !error) {
        const monsterData = Array.isArray(data) ? data[0] : data;

        // SEMPRE validar se os dados do banco fazem sentido
        if (this.isValidMonsterData(monsterData)) {
          enemy = this.convertToEnemyUnified(monsterData, floor);
        } else {
          console.warn('[MonsterService] Dados do banco inválidos, usando lógica unificada');
          enemy = generateEnemyFromDatabaseLogic(floor);
        }
      } else {
        // Se o banco falhou, usar a lógica unificada que replica exatamente o banco
        console.log('[MonsterService] Banco indisponível, usando lógica unificada');
        enemy = generateEnemyFromDatabaseLogic(floor);
      }

      // Carregar drops
      try {
        await this.loadPossibleDrops(enemy);
      } catch (dropError) {
        console.warn('[MonsterService] Erro ao carregar drops:', dropError);
      }

      // Cache e atualizar estado
      cacheMonster(floor, enemy);
      updateGameState(draft => {
        draft.currentEnemy = enemy;
      });

      setFetchingMonster(false);
      return { data: enemy, error: null, success: true };
    } catch (error) {
      console.error(`[MonsterService] Erro crítico:`, error);

      // FALLBACK FINAL: sempre usar lógica unificada
      const fallbackEnemy = generateEnemyFromDatabaseLogic(floor);
      cacheMonster(floor, fallbackEnemy);

      updateGameState(draft => {
        draft.currentEnemy = fallbackEnemy;
      });

      setFetchingMonster(false);
      return { data: fallbackEnemy, error: null, success: true };
    }
  }

  /**
   * Validar se os dados do banco são consistentes
   */
  private static isValidMonsterData(monsterData: DatabaseMonsterData): boolean {
    if (!monsterData || typeof monsterData !== 'object') return false;

    const requiredNumericFields = ['hp', 'attack', 'defense', 'level'];
    for (const field of requiredNumericFields) {
      const value = monsterData[field as keyof DatabaseMonsterData];
      if (typeof value !== 'number' || value <= 0) {
        return false;
      }
    }

    if (!monsterData.name || typeof monsterData.name !== 'string') return false;

    return true;
  }

  /**
   * Converter dados do banco mantendo consistência com lógica unificada
   */
  private static convertToEnemyUnified(monsterData: DatabaseMonsterData, floor: number): Enemy {
    const tier = Math.max(1, Math.floor(floor / 20) + 1);
    const cyclePosition = ((floor - 1) % 20) + 1;
    const isBoss = floor === 5 || floor % 10 === 0;

    // Usar dados do banco quando válidos, fallback para lógica unificada quando não
    const id =
      typeof monsterData.id === 'string' ? monsterData.id : `converted_${floor}_${Date.now()}`;
    const name = typeof monsterData.name === 'string' ? monsterData.name : `Monster Floor ${floor}`;
    const level =
      typeof monsterData.level === 'number'
        ? monsterData.level
        : Math.max(1, Math.floor(floor / 3));

    // Stats principais - validar antes de usar
    const hp =
      typeof monsterData.hp === 'number' && monsterData.hp > 0
        ? monsterData.hp
        : generateEnemyFromDatabaseLogic(floor).hp;
    const attack =
      typeof monsterData.attack === 'number' && monsterData.attack > 0
        ? monsterData.attack
        : generateEnemyFromDatabaseLogic(floor).attack;
    const defense =
      typeof monsterData.defense === 'number' && monsterData.defense >= 0
        ? monsterData.defense
        : generateEnemyFromDatabaseLogic(floor).defense;
    const speed =
      typeof monsterData.speed === 'number' && monsterData.speed > 0
        ? monsterData.speed
        : generateEnemyFromDatabaseLogic(floor).speed;

    // Recompensas - aplicar a mesma redução da lógica unificada
    const baseRewardXp = typeof monsterData.reward_xp === 'number' ? monsterData.reward_xp : 50;
    const baseRewardGold =
      typeof monsterData.reward_gold === 'number' ? monsterData.reward_gold : 25;

    const rewardXp = Math.floor(baseRewardXp * (floor <= 10 ? 0.4 : floor <= 20 ? 0.3 : 0.3));
    const rewardGold = Math.floor(baseRewardGold * (floor <= 10 ? 0.4 : floor <= 20 ? 0.3 : 0.3));

    // Validar behavior
    const isValidBehavior = (behavior: string): behavior is MonsterBehavior => {
      return ['aggressive', 'defensive', 'balanced'].includes(behavior);
    };

    const behavior: MonsterBehavior =
      typeof monsterData.behavior === 'string' && isValidBehavior(monsterData.behavior)
        ? monsterData.behavior
        : 'balanced';

    return {
      id,
      name,
      level,
      hp,
      maxHp: hp,
      attack,
      defense,
      speed,
      image: isBoss ? '👑' : '👾',
      behavior,
      mana: typeof monsterData.mana === 'number' ? monsterData.mana : Math.floor(level * 5),
      reward_xp: rewardXp,
      reward_gold: rewardGold,
      possible_drops: [],
      active_effects: {
        buffs: [],
        debuffs: [],
        dots: [],
        hots: [],
        attribute_modifications: [],
      },
      tier,
      base_tier: Math.max(1, Math.floor(floor / 20) + 1),
      cycle_position: cyclePosition,
      is_boss: isBoss,
      strength: typeof monsterData.strength === 'number' ? monsterData.strength : 10 + level,
      dexterity: typeof monsterData.dexterity === 'number' ? monsterData.dexterity : 8 + level,
      intelligence:
        typeof monsterData.intelligence === 'number' ? monsterData.intelligence : 6 + level,
      wisdom: typeof monsterData.wisdom === 'number' ? monsterData.wisdom : 6 + level,
      vitality: typeof monsterData.vitality === 'number' ? monsterData.vitality : 12 + level,
      luck: typeof monsterData.luck === 'number' ? monsterData.luck : 5 + level,
      critical_chance:
        typeof monsterData.critical_chance === 'number'
          ? Math.min(0.5, monsterData.critical_chance)
          : 0.05 + level * 0.005,
      critical_damage:
        typeof monsterData.critical_damage === 'number'
          ? monsterData.critical_damage
          : 1.5 + level * 0.05,
      critical_resistance:
        typeof monsterData.critical_resistance === 'number'
          ? Math.min(0.5, monsterData.critical_resistance)
          : 0.1,
      physical_resistance:
        typeof monsterData.physical_resistance === 'number'
          ? Math.max(0, Math.min(0.9, monsterData.physical_resistance))
          : 0.0,
      magical_resistance:
        typeof monsterData.magical_resistance === 'number'
          ? Math.max(0, Math.min(0.9, monsterData.magical_resistance))
          : 0.0,
      debuff_resistance:
        typeof monsterData.debuff_resistance === 'number'
          ? Math.max(0, Math.min(0.9, monsterData.debuff_resistance))
          : 0.0,
      physical_vulnerability:
        typeof monsterData.physical_vulnerability === 'number'
          ? Math.max(0.5, Math.min(3.0, monsterData.physical_vulnerability))
          : 1.0,
      magical_vulnerability:
        typeof monsterData.magical_vulnerability === 'number'
          ? Math.max(0.5, Math.min(3.0, monsterData.magical_vulnerability))
          : 1.0,
      primary_trait:
        typeof monsterData.primary_trait === 'string'
          ? monsterData.primary_trait
          : isBoss
            ? 'boss'
            : 'common',
      secondary_trait:
        typeof monsterData.secondary_trait === 'string' ? monsterData.secondary_trait : 'basic',
      special_abilities: Array.isArray(monsterData.special_abilities)
        ? monsterData.special_abilities.filter((a: unknown): a is string => typeof a === 'string')
        : [],
    };
  }

  /**
   * Carregar drops possíveis
   */
  private static async loadPossibleDrops(enemy: Enemy): Promise<void> {
    const { setLoadingDrops, setError } = useMonsterStore.getState();

    setLoadingDrops(true);

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

        console.log(
          `[MonsterService] Carregados ${enemy.possible_drops.length} drops possíveis para ${enemy.name}`
        );
      }
    } catch (error) {
      console.warn(`[MonsterService] Erro ao carregar drops:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar drops';
      setError(`Drops não carregados: ${errorMessage}`);
    } finally {
      setLoadingDrops(false);
    }
  }

  /**
   * Método para atualizar enemy atual no gameState
   */
  static updateCurrentEnemy(enemy: Enemy): void {
    const { updateGameState } = useGameStateStore.getState();
    updateGameState(draft => {
      draft.currentEnemy = enemy;
    });
  }

  /**
   * Método para obter enemy atual do gameState
   */
  static getCurrentEnemy(): Enemy | null {
    return useGameStateStore.getState().gameState.currentEnemy;
  }

  /**
   * Limpar cache
   */
  static clearCache(): void {
    const { clearCache } = useMonsterStore.getState();
    clearCache();
  }

  /**
   * Método utilitário para verificar se um enemy está em cache
   */
  static isEnemyCached(floor: number): boolean {
    const { getCachedMonster } = useMonsterStore.getState();
    return getCachedMonster(floor) !== null;
  }

  /**
   * Método para pré-carregar enemies de andares próximos
   */
  static async preloadNearbyFloors(currentFloor: number, range: number = 2): Promise<void> {
    const promises: Promise<ServiceResponse<Enemy>>[] = [];

    for (let i = currentFloor + 1; i <= currentFloor + range; i++) {
      if (!this.isEnemyCached(i)) {
        promises.push(this.getEnemyForFloor(i));
      }
    }

    if (promises.length > 0) {
      console.log(`[MonsterService] Pré-carregando ${promises.length} andares próximos`);
      await Promise.allSettled(promises);
    }
  }
}
