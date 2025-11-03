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

// Interface para dados do monstro vindos do banco
interface DatabaseMonsterData {
  id?: string;
  name?: string;
  level?: number;
  hp?: number;
  atk?: number; // ✅ CORRIGIDO: SQL retorna 'atk', não 'attack'
  def?: number; // ✅ CORRIGIDO: SQL retorna 'def', não 'defense'
  mana?: number;
  speed?: number;
  behavior?: string;
  min_floor?: number;
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
 * ESCALAMENTO TUTORIAL-FRIENDLY: scale_monster_stats_tutorial_friendly
 * Escalamento mais suave para tutorial melhor e progressão gradual
 */
function scaleMonsterStatsTutorialFriendly(
  basestat: number,
  currentTier: number,
  floorInTier: number,
  scalingType: 'hp' | 'attack' | 'defense' | 'normal' = 'normal'
): number {
  let tierMultiplier: number;
  let floorMultiplier: number;

  // Escalamento mais suave para tutorial melhor
  // Tier 1 (andares 1-20): Crescimento muito gradual
  if (currentTier === 1) {
    tierMultiplier = 1.0; // Sem multiplicador de tier no tutorial
    floorMultiplier = 1.0 + floorInTier * 0.015; // Apenas 1.5% por andar
  } else {
    // Tiers superiores: Escalamento mais agressivo
    tierMultiplier = Math.pow(1.3, Math.max(0, currentTier - 1)); // Reduzido de 1.5x
    floorMultiplier = 1.0 + floorInTier * 0.025; // Reduzido de 3%
  }

  let finalStat: number;

  // Aplicar escalamento baseado no tipo
  switch (scalingType) {
    case 'hp':
      // HP escala um pouco mais
      finalStat = basestat * tierMultiplier * floorMultiplier * 1.1;
      break;
    case 'attack':
      // Ataque escala normalmente
      finalStat = basestat * tierMultiplier * floorMultiplier;
      break;
    case 'defense':
      // Defesa escala menos
      finalStat = basestat * tierMultiplier * floorMultiplier * 0.9;
      break;
    default:
      // Escalamento padrão
      finalStat = basestat * tierMultiplier * floorMultiplier;
  }

  return Math.max(1, Math.floor(finalStat));
}

/**
 * STATS BASE TUTORIAL-FRIENDLY (20241221000022)
 * Rebalanceados para alinhar com personagens ultra-baixos e criar tutorial progressivo
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

  // TUTORIAL (Andares 1-3): Mais fracos que o personagem para ensinar mecânicas
  if (floor <= 3) {
    if (floor === 1) {
      baseHp = 45;
      baseAtk = 8;
      baseDef = 2; // Personagem nível 1: ~80 HP, ~12 ATK, ~3 DEF
    } else if (floor === 2) {
      baseHp = 55;
      baseAtk = 10;
      baseDef = 3; // Ligeiramente mais forte
    } else {
      baseHp = 65;
      baseAtk = 12;
      baseDef = 4; // Preparação para desafio real
    }
    baseXp = 12 + floor * 2; // 14-18 XP
    baseGold = 18 + floor * 4 + Math.floor(Math.random() * 8); // 22-38 Gold variável
  }
  // EARLY GAME (Andares 4-10): Progressão gradual mais desafiadora
  else if (floor <= 10) {
    const floorOffset = floor - 3;
    baseHp = 75 + floorOffset * 10; // 75, 85, 95, 105, 115, 125, 135
    baseAtk = 14 + floorOffset * 2; // 14, 16, 18, 20, 22, 24, 26
    baseDef = 5 + floorOffset; // 5, 6, 7, 8, 9, 10, 11

    if (floor <= 5) {
      baseXp = 16 + floor * 3; // 19-31 XP
      baseGold = 25 + floor * 6 + Math.floor(Math.random() * 12); // 31-67 Gold
    } else {
      baseXp = 20 + floor * 4; // 24-60 XP
      baseGold = 35 + floor * 8 + Math.floor(Math.random() * 16); // 43-131 Gold
    }
  }
  // MID GAME (Andares 11-20): Desafio real
  else if (floor <= 20) {
    baseHp = 140 + (floor - 10) * 15; // 155-290 HP
    baseAtk = 28 + (floor - 10) * 3; // 31-58 ATK
    baseDef = 12 + (floor - 10) * 2; // 14-32 DEF

    if (floor <= 15) {
      baseXp = 30 + floor * 6; // 36-120 XP
      baseGold = 50 + floor * 12 + Math.floor(Math.random() * 20); // 62-230 Gold
    } else {
      baseXp = 50 + floor * 8; // 58-210 XP
      baseGold = 80 + floor * 15 + Math.floor(Math.random() * 25); // 95-345 Gold
    }
  }
  // LATE GAME (Andares 21+): Escalamento agressivo
  else {
    baseHp = 300 + (floor - 20) * 25; // 325+ HP
    baseAtk = 60 + (floor - 20) * 5; // 65+ ATK
    baseDef = 35 + (floor - 20) * 3; // 38+ DEF
    baseXp = 80 + floor * 12; // 92+ XP
    baseGold = 120 + floor * 20 + Math.floor(Math.random() * 30); // 140+ Gold
  }

  // Bosses 50% mais fortes (REBALANCEADO DE 80% PARA 50%)
  if (isBoss) {
    baseHp = Math.floor(baseHp * 1.5); // Reduzido de 1.8x
    baseAtk = Math.floor(baseAtk * 1.4); // Reduzido de 1.8x
    baseDef = Math.floor(baseDef * 1.3); // Reduzido de 1.8x
    baseXp = Math.floor(baseXp * 2.2); // Reduzido de 2.5x
    baseGold = Math.floor(baseGold * 1.8); // Reduzido de 2.0x
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

  // APLICAR ESCALAMENTO TUTORIAL-FRIENDLY
  const scaledHp = scaleMonsterStatsTutorialFriendly(finalBaseStats.hp, tier, floorInTier, 'hp');
  const scaledAtk = scaleMonsterStatsTutorialFriendly(
    finalBaseStats.atk,
    tier,
    floorInTier,
    'attack'
  );
  const scaledDef = scaleMonsterStatsTutorialFriendly(
    finalBaseStats.def,
    tier,
    floorInTier,
    'defense'
  );
  const scaledSpeed = scaleMonsterStatsTutorialFriendly(8 + level + tier, tier, floorInTier);

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

  // ATRIBUTOS ESCALADOS MAIS SUAVEMENTE
  const attributeBase = 8 + tier * 2 + Math.floor(floorInTier / 5);

  const strength = Math.floor(
    scaleMonsterStatsTutorialFriendly(attributeBase, tier, floorInTier) * (isBoss ? 1.2 : 1)
  );
  const dexterity = Math.floor(
    scaleMonsterStatsTutorialFriendly(attributeBase * 0.7, tier, floorInTier) *
      (isNemesis ? 1.2 : 1)
  );
  const intelligence = Math.floor(
    scaleMonsterStatsTutorialFriendly(attributeBase * 0.5, tier, floorInTier)
  );
  const wisdom = Math.floor(
    scaleMonsterStatsTutorialFriendly(attributeBase * 0.5, tier, floorInTier)
  );
  const vitality = Math.floor(
    scaleMonsterStatsTutorialFriendly(attributeBase, tier, floorInTier) * (isBoss ? 1.3 : 1.1)
  );
  const luck = Math.floor(
    scaleMonsterStatsTutorialFriendly(attributeBase * 0.4, tier, floorInTier)
  );

  // STATS DE COMBATE MAIS MODERADOS
  const criticalChance = Math.min(0.25, 0.02 + tier * 0.01 + floorInTier * 0.003);
  const criticalDamage = Math.min(1.8, 1.1 + tier * 0.05 + floorInTier * 0.01);
  const criticalResistance = Math.min(0.2, tier * 0.01 + (isBoss ? 0.08 : 0.03));

  return {
    id: crypto.randomUUID(),
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
   * ✅ CORRIGIDO: Agora prioriza monstros DO BANCO com seus drops associados
   */
  static async getEnemyForFloor(
    floor: number,
    forceRefresh: boolean = false
  ): Promise<ServiceResponse<Enemy>> {
    if (floor <= 0) {
      return { data: null, error: `Andar inválido: ${floor}`, success: false };
    }

    const { getCachedMonster, cacheMonster, setFetchingMonster, setError } =
      useMonsterStore.getState();
    const { updateGameState } = useGameStateStore.getState();

    // ✅ CRÍTICO: Bypass de cache se forceRefresh for true (para batalhas)
    if (!forceRefresh) {
      const cachedEnemy = getCachedMonster(floor);
      if (cachedEnemy) {
        console.log(
          `[MonsterService] ✅ Inimigo em cache para andar ${floor}: ${cachedEnemy.name}`
        );
        updateGameState(draft => {
          draft.currentEnemy = cachedEnemy;
        });
        return { data: cachedEnemy, error: null, success: true };
      }
    } else {
      console.log(
        `[MonsterService] 🔄 Forçando recarregamento de inimigo para andar ${floor} (forceRefresh=true)`
      );
    }

    setFetchingMonster(true);
    setError(null);

    try {
      console.log(`[MonsterService] 🔍 Buscando inimigo para andar ${floor}...`);

      // ✅ TENTATIVA 1: RPC do banco (prioriza monstros cadastrados)
      let { data, error } = await Promise.race([
        supabase.rpc('get_monster_for_floor_with_initiative', { p_floor: floor }),
        new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(
            () => reject({ data: null, error: { message: 'Timeout na RPC principal' } }),
            3000
          )
        ),
      ]).catch(err => ({ data: null, error: err }));

      // ✅ TENTATIVA 2: RPC alternativa se a principal falhar
      const isTypeError =
        error?.code === '42804' ||
        error?.message?.includes('does not match function result type') ||
        error?.message?.includes('structure of query does not match');

      if (isTypeError || error) {
        console.warn(`[MonsterService] ⚠️ RPC principal falhou, tentando alternativa...`);
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
          console.log('[MonsterService] ✅ Usando dados da RPC alternativa');
        }
      }

      let enemy: Enemy;

      // ✅ Se o banco funcionou, usar dados REAIS do banco
      if (data && !error) {
        const monsterData = Array.isArray(data) ? data[0] : data;

        // SEMPRE validar se os dados do banco fazem sentido
        if (this.isValidMonsterData(monsterData)) {
          enemy = this.convertToEnemyUnified(monsterData, floor);
          console.log(`[MonsterService] ✅ Inimigo do banco: ${enemy.name} (nível ~${floor})`);
        } else {
          console.error(
            `[MonsterService] ❌ Dados do banco inválidos para andar ${floor}:`,
            monsterData
          );
          throw new Error(
            `Dados do banco inválidos para andar ${floor}. Verifique a migração 00005.`
          );
        }
      } else {
        console.error(
          `[MonsterService] ❌ Falha ao buscar monstro do banco para andar ${floor}:`,
          error
        );
        throw new Error(
          `Falha ao carregar monstro para andar ${floor}: ${error?.message || 'Erro desconhecido'}`
        );
      }

      // ✅ CRÍTICO: Carregar drops SEMPRE (eles estão associados aos monstros no banco)
      try {
        console.log(`[MonsterService] 📦 Carregando drops para ${enemy.name}...`);
        await this.loadPossibleDrops(enemy);
        console.log(
          `[MonsterService] ✅ Drops carregados: ${enemy.possible_drops?.length || 0} possíveis`
        );
      } catch (dropError) {
        console.warn('[MonsterService] ⚠️ Erro ao carregar drops:', dropError);
        // Continuar mesmo sem drops - eles podem estar vazios
      }

      // Cache e atualizar estado
      cacheMonster(floor, enemy);
      updateGameState(draft => {
        draft.currentEnemy = enemy;
      });

      setFetchingMonster(false);
      return { data: enemy, error: null, success: true };
    } catch (error) {
      console.error(`[MonsterService] ❌ Erro crítico ao carregar inimigo:`, error);
      setFetchingMonster(false);

      // ✅ CRÍTICO: Retornar erro em vez de fallback
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido ao carregar monstro';
      setError(errorMessage);

      return {
        data: null,
        error: errorMessage,
        success: false,
      };
    }
  }

  /**
   * Validar se os dados do banco são consistentes
   */
  private static isValidMonsterData(monsterData: DatabaseMonsterData): boolean {
    if (!monsterData || typeof monsterData !== 'object') {
      return false;
    }

    // ✅ CRÍTICO: Campos obrigatórios (sem level - será calculado de min_floor)
    const requiredNumericFields = ['hp', 'atk', 'def', 'min_floor'];
    for (const field of requiredNumericFields) {
      const value = monsterData[field as keyof DatabaseMonsterData];

      if (typeof value !== 'number' || value <= 0) {
        return false;
      }
    }

    if (!monsterData.name || typeof monsterData.name !== 'string') {
      return false;
    }

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
    const id = typeof monsterData.id === 'string' ? monsterData.id : crypto.randomUUID();
    const name = typeof monsterData.name === 'string' ? monsterData.name : `Monster Floor ${floor}`;

    // ✅ CRÍTICO: Calcular level a partir de min_floor (não vem do RPC)
    const minFloor = typeof monsterData.min_floor === 'number' ? monsterData.min_floor : 1;
    const level = Math.max(1, Math.floor(minFloor / 3));

    // Stats principais - validar antes de usar
    const hp =
      typeof monsterData.hp === 'number' && monsterData.hp > 0
        ? monsterData.hp
        : generateEnemyFromDatabaseLogic(floor).hp;
    const attack =
      typeof monsterData.atk === 'number' && monsterData.atk > 0
        ? monsterData.atk
        : generateEnemyFromDatabaseLogic(floor).attack;
    const defense =
      typeof monsterData.def === 'number' && monsterData.def >= 0
        ? monsterData.def
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

    // ✅ CRÍTICO: Garantir que possible_drops sempre existe (array vazio se necessário)
    if (!enemy.possible_drops) {
      enemy.possible_drops = [];
    }

    setLoadingDrops(true);

    try {
      // ✅ CORREÇÃO: Usar função RPC ao invés de query direta com join
      const { data: possibleDropsData, error } = await supabase.rpc(
        'get_monster_possible_drops_with_info',
        {
          p_monster_id: enemy.id,
        }
      );

      if (error) {
        console.warn(`[MonsterService] ⚠️ Erro ao carregar drops via RPC:`, error);
        setError(`Drops não carregados: ${error.message}`);
        // ✅ Manter array vazio ao invés de deixar undefined
        return;
      }

      if (possibleDropsData && Array.isArray(possibleDropsData) && possibleDropsData.length > 0) {
        console.log(`[MonsterService] ✅ Carregados ${possibleDropsData.length} drops possíveis`);
        enemy.possible_drops = possibleDropsData.map(
          (dropData: {
            drop_id: string;
            drop_chance: number;
            min_quantity: number;
            max_quantity: number;
            drop_name: string;
            drop_description: string;
            rarity: string;
            value: number;
          }) => ({
            drop_id: dropData.drop_id,
            drop_chance: dropData.drop_chance,
            min_quantity: dropData.min_quantity,
            max_quantity: dropData.max_quantity,
            drop_info: {
              id: dropData.drop_id,
              name: dropData.drop_name,
              description: dropData.drop_description,
              rarity: dropData.rarity,
              value: dropData.value,
            },
          })
        );
      } else {
        console.log(`[MonsterService] ℹ️ Este inimigo não possui drops possíveis`);
      }
    } catch (error) {
      console.warn(`[MonsterService] ❌ Erro ao carregar drops:`, error);
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
      await Promise.allSettled(promises);
    }
  }
}
