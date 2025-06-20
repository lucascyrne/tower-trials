import { useMonsterStore } from '@/stores/useMonsterStore';
import { useGameStateStore } from '@/stores/useGameStateStore';

import { supabase } from '@/lib/supabase';
import { type Monster } from '../models/monster.model';
import { type Enemy } from '../models/game.model';

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
  /**
   * MÉTODO PRINCIPAL: Buscar inimigo para batalha
   * Agora integrado com Zustand stores para cache e estado
   */
  static async getEnemyForFloor(floor: number): Promise<ServiceResponse<Enemy>> {
    if (floor <= 0) {
      return { data: null, error: `Andar inválido: ${floor}`, success: false };
    }

    // Acessar stores
    const { getCachedMonster, cacheMonster, setFetchingMonster, setError } =
      useMonsterStore.getState();
    const { updateGameState } = useGameStateStore.getState();

    // Verificar cache da store
    const cachedEnemy = getCachedMonster(floor);
    if (cachedEnemy) {
      // Atualizar currentEnemy no gameState se necessário
      updateGameState(draft => {
        draft.currentEnemy = cachedEnemy;
        // currentFloor deve ser um objeto Floor, não um number
        // Será atualizado por outro serviço que gerencia floors
      });
      return { data: cachedEnemy, error: null, success: true };
    }

    // Iniciar loading
    setFetchingMonster(true);
    setError(null);

    try {
      console.log(`[MonsterService] Buscando enemy para andar ${floor}`);

      // ✅ CORREÇÃO: Usar função corrigida com detecção específica do erro 42804
      let { data, error } = await Promise.race([
        supabase.rpc('get_monster_for_floor_with_initiative', {
          p_floor: floor,
        }),
        new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(
            () => reject({ data: null, error: { message: 'Timeout na RPC principal' } }),
            3000 // Timeout aumentado para 3s para dar tempo da migração ser aplicada
          )
        ),
      ]).catch(err => ({ data: null, error: err }));

      // ✅ CORREÇÃO: Detecção melhorada para erro 42804 e outros erros de tipo
      const isTypeError =
        error?.code === '42804' || // Erro específico de incompatibilidade de tipos
        error?.message?.includes('does not match function result type') ||
        error?.message?.includes('Returned type uuid does not match expected type') ||
        error?.message?.includes('structure of query does not match');

      const isFunctionError =
        error?.message?.includes('does not exist') ||
        error?.message?.includes('function') ||
        error?.code === '42883'; // Função não existe

      const isTimeoutError =
        error?.message?.includes('Timeout') || error?.message?.includes('timeout');

      if (isTypeError || isFunctionError || isTimeoutError) {
        console.log(
          `[MonsterService] RPC principal falhou (${error?.code || 'unknown'}), tentando RPC alternativa:`,
          error?.message
        );

        try {
          const altResult = await Promise.race([
            supabase.rpc('get_monster_for_floor_simple', { p_floor: floor }),
            new Promise<{ data: null; error: { message: string } }>((_, reject) =>
              setTimeout(
                () => reject({ data: null, error: { message: 'Timeout na RPC alternativa' } }),
                2000
              )
            ),
          ]).catch(err => ({ data: null, error: err }));

          if (altResult.data && !altResult.error) {
            console.log('[MonsterService] RPC alternativa get_monster_for_floor_simple funcionou');
            data = altResult.data;
            error = altResult.error;
          } else {
            // Tentar função original get_monster_for_floor como último recurso
            console.log('[MonsterService] Tentando get_monster_for_floor como último recurso');
            const originalResult = await Promise.race([
              supabase.rpc('get_monster_for_floor', { p_floor: floor }),
              new Promise<{ data: null; error: { message: string } }>((_, reject) =>
                setTimeout(
                  () => reject({ data: null, error: { message: 'Timeout na RPC original' } }),
                  2000
                )
              ),
            ]).catch(err => ({ data: null, error: err }));

            data = originalResult.data;
            error = originalResult.error;
          }
        } catch (altError) {
          console.log('[MonsterService] Todas as RPCs falharam:', altError);
          error = { message: 'Todas as funções RPC falharam', code: 'RPC_FAILURE' };
        }
      }

      // ✅ CORREÇÃO: Fallback para busca direta com timeout
      if (error && !data) {
        console.log('[MonsterService] RPCs falharam, usando busca direta na tabela');

        try {
          const tableResult = await Promise.race([
            supabase
              .from('monsters')
              .select('*')
              .lte('min_floor', floor)
              .order('min_floor', { ascending: false })
              .limit(1),
            new Promise<{ data: null; error: { message: string } }>((_, reject) =>
              setTimeout(
                () => reject({ data: null, error: { message: 'Timeout na busca direta' } }),
                2000
              )
            ),
          ]).catch(err => ({ data: null, error: err }));

          data = tableResult.data?.[0] || null;
          error = tableResult.error;
        } catch (tableError) {
          console.log('[MonsterService] Busca direta também falhou:', tableError);
          error = { message: 'Todas as buscas falharam' };
        }
      }

      // ✅ CORREÇÃO: Se tudo falhar ou não há dados, usar fallback imediatamente
      if (error || !data) {
        console.warn(
          '[MonsterService] Todas as buscas falharam, usando fallback. Último erro:',
          error?.message
        );
        const fallbackEnemy = this.generateFallbackEnemy(floor);

        // Cache e atualizar estado
        cacheMonster(floor, fallbackEnemy);
        updateGameState(draft => {
          draft.currentEnemy = fallbackEnemy;
          // currentFloor gerenciado por outro serviço
        });

        setFetchingMonster(false);
        return { data: fallbackEnemy, error: null, success: true };
      }

      // Converter para Enemy
      const monsterData = Array.isArray(data) ? data[0] : data;

      // ✅ CORREÇÃO: Validar dados antes de converter
      if (!monsterData || typeof monsterData !== 'object') {
        console.warn('[MonsterService] Dados de monstro inválidos, usando fallback');
        const fallbackEnemy = this.generateFallbackEnemy(floor);
        cacheMonster(floor, fallbackEnemy);
        updateGameState(draft => {
          draft.currentEnemy = fallbackEnemy;
        });
        setFetchingMonster(false);
        return { data: fallbackEnemy, error: null, success: true };
      }

      const enemy = this.convertToEnemy(monsterData, floor);

      // Carregar drops (não crítico)
      try {
        await this.loadPossibleDrops(enemy);
      } catch (dropError) {
        console.warn('[MonsterService] Erro ao carregar drops (não crítico):', dropError);
        // Continuar sem drops
      }

      // Cache o resultado na store
      cacheMonster(floor, enemy);

      // Atualizar gameState
      updateGameState(draft => {
        draft.currentEnemy = enemy;
        // currentFloor gerenciado por outro serviço
      });

      setFetchingMonster(false);
      return { data: enemy, error: null, success: true };
    } catch (error) {
      console.error(`[MonsterService] Erro crítico ao buscar enemy:`, error);

      // ✅ CORREÇÃO: Não definir erro na store se estamos usando fallback com sucesso
      console.log('[MonsterService] Usando fallback devido a erro crítico');

      // Usar fallback em caso de erro
      const fallbackEnemy = this.generateFallbackEnemy(floor);
      cacheMonster(floor, fallbackEnemy);

      updateGameState(draft => {
        draft.currentEnemy = fallbackEnemy;
        // currentFloor gerenciado por outro serviço
      });

      setFetchingMonster(false);
      return { data: fallbackEnemy, error: null, success: true };
    }
  }

  /**
   * Método para atualizar enemy atual no gameState
   * Útil para sincronização entre stores
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
   * Converter Monster para Enemy com validação robusta
   */
  private static convertToEnemy(monsterData: Monster, floor: number): Enemy {
    // ✅ CORREÇÃO: Validação robusta dos dados de entrada
    if (!monsterData) {
      console.warn('[MonsterService] monsterData é null/undefined, usando dados padrão');
      monsterData = {} as Monster;
    }

    // ✅ CORREÇÃO: Garantir que o ID seja sempre string válida
    const id =
      typeof monsterData.id === 'string' && monsterData.id.length > 0
        ? monsterData.id
        : `generated_${floor}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // ✅ CORREÇÃO: Validar e garantir valores numéricos válidos
    const level =
      typeof monsterData.level === 'number' && monsterData.level > 0
        ? monsterData.level
        : Math.max(1, Math.floor(floor / 5) + 1);

    const baseHp =
      typeof monsterData.hp === 'number' && monsterData.hp > 0 ? monsterData.hp : 50 + floor * 10;

    const baseAtk =
      typeof monsterData.atk === 'number' && monsterData.atk > 0 ? monsterData.atk : 10 + floor * 2;

    const baseDef =
      typeof monsterData.def === 'number' && monsterData.def >= 0 ? monsterData.def : 5 + floor * 1;

    const baseSpeed =
      typeof monsterData.speed === 'number' && monsterData.speed > 0
        ? monsterData.speed
        : 10 + Math.floor(floor / 2);

    const baseMana =
      typeof monsterData.mana === 'number' && monsterData.mana >= 0
        ? monsterData.mana
        : Math.floor(level * 5);

    // ✅ CORREÇÃO: Validar strings e usar fallbacks seguros
    const name =
      typeof monsterData.name === 'string' && monsterData.name.length > 0
        ? monsterData.name
        : `Monstro Andar ${floor}`;

    const behavior = ['aggressive', 'defensive', 'balanced'].includes(monsterData.behavior)
      ? monsterData.behavior
      : 'balanced';

    // ✅ CORREÇÃO: Validar valores de recompensa
    const rewardXp =
      typeof monsterData.reward_xp === 'number' && monsterData.reward_xp > 0
        ? monsterData.reward_xp
        : Math.floor(5 + floor * 2);

    const rewardGold =
      typeof monsterData.reward_gold === 'number' && monsterData.reward_gold > 0
        ? monsterData.reward_gold
        : Math.floor(3 + floor * 1);

    // ✅ SISTEMA DE CICLOS INTEGRADO AO CONVERTER
    const tier =
      typeof monsterData.tier === 'number' && monsterData.tier > 0
        ? monsterData.tier
        : Math.max(1, Math.floor(floor / 20) + 1);

    const baseTier =
      typeof monsterData.base_tier === 'number' && monsterData.base_tier > 0
        ? monsterData.base_tier
        : Math.max(1, Math.floor(floor / 20) + 1);

    const cyclePosition =
      typeof monsterData.cycle_position === 'number' && monsterData.cycle_position > 0
        ? monsterData.cycle_position
        : ((floor - 1) % 20) + 1;

    // ✅ BOSS LOGIC CONSISTENTE COM SISTEMA DE CHECKPOINTS
    const isBoss =
      typeof monsterData.is_boss === 'boolean'
        ? monsterData.is_boss
        : floor === 5 || floor % 10 === 0;

    const isElite = !isBoss && floor % 5 === 0 && floor > 5;

    // ✅ CORREÇÃO: Validar atributos primários
    const strength =
      typeof monsterData.strength === 'number' && monsterData.strength > 0
        ? monsterData.strength
        : 10 + Math.floor(level / 2);

    const dexterity =
      typeof monsterData.dexterity === 'number' && monsterData.dexterity > 0
        ? monsterData.dexterity
        : 10 + Math.floor(level / 3);

    const intelligence =
      typeof monsterData.intelligence === 'number' && monsterData.intelligence > 0
        ? monsterData.intelligence
        : 8 + Math.floor(level / 3);

    const wisdom =
      typeof monsterData.wisdom === 'number' && monsterData.wisdom > 0
        ? monsterData.wisdom
        : 8 + Math.floor(level / 4);

    const vitality =
      typeof monsterData.vitality === 'number' && monsterData.vitality > 0
        ? monsterData.vitality
        : 12 + Math.floor(level / 2);

    const luck =
      typeof monsterData.luck === 'number' && monsterData.luck > 0
        ? monsterData.luck
        : 5 + Math.floor(level / 4);

    // ✅ CORREÇÃO: Validar stats de combate avançado
    const criticalChance =
      typeof monsterData.critical_chance === 'number' && monsterData.critical_chance >= 0
        ? Math.min(0.5, monsterData.critical_chance) // Cap em 50%
        : 0.05 + level * 0.005;

    const criticalDamage =
      typeof monsterData.critical_damage === 'number' && monsterData.critical_damage > 1
        ? monsterData.critical_damage
        : 1.5 + level * 0.05;

    // ✅ CORREÇÃO: Validar resistências (devem estar entre 0 e 1)
    const physicalResistance =
      typeof monsterData.physical_resistance === 'number'
        ? Math.max(0, Math.min(0.9, monsterData.physical_resistance))
        : 0.0;

    const magicalResistance =
      typeof monsterData.magical_resistance === 'number'
        ? Math.max(0, Math.min(0.9, monsterData.magical_resistance))
        : 0.0;

    // ✅ CORREÇÃO: Validar arrays
    const specialAbilities = Array.isArray(monsterData.special_abilities)
      ? monsterData.special_abilities.filter(ability => typeof ability === 'string')
      : [];

    console.log(
      `[MonsterService] ✅ Convertendo: ${name} (T${tier}C${cyclePosition}) - Floor: ${floor} | ${isBoss ? 'BOSS' : isElite ? 'ELITE' : 'Normal'}`
    );

    return {
      id,
      name,
      level,
      hp: baseHp,
      maxHp: baseHp,
      attack: baseAtk,
      defense: baseDef,
      speed: baseSpeed,
      image: isBoss ? '👑' : isElite ? '⭐' : '👾', // ✅ Assets diferenciados
      behavior: isElite ? 'aggressive' : isBoss ? 'defensive' : behavior,
      mana: baseMana,
      reward_xp: rewardXp,
      reward_gold: rewardGold,
      possible_drops: [], // Será preenchido por loadPossibleDrops
      active_effects: {
        buffs: [],
        debuffs: [],
        dots: [],
        hots: [],
        attribute_modifications: [],
      },
      tier,
      base_tier: baseTier,
      cycle_position: cyclePosition,
      is_boss: isBoss,
      strength,
      dexterity,
      intelligence,
      wisdom,
      vitality,
      luck,
      critical_chance: criticalChance,
      critical_damage: criticalDamage,
      critical_resistance:
        typeof monsterData.critical_resistance === 'number'
          ? Math.max(0, Math.min(0.5, monsterData.critical_resistance))
          : Math.min(0.3, tier * 0.02 + (isBoss ? 0.1 : 0.05)), // ✅ Escalamento por tier
      physical_resistance: Math.max(physicalResistance, tier * 0.015 + (isBoss ? 0.05 : 0.02)),
      magical_resistance: Math.max(magicalResistance, tier * 0.015 + (isElite ? 0.05 : 0.02)),
      debuff_resistance:
        typeof monsterData.debuff_resistance === 'number'
          ? Math.max(0, Math.min(0.9, monsterData.debuff_resistance))
          : Math.min(0.4, tier * 0.025 + (isBoss ? 0.15 : 0.05)), // ✅ Escalamento por tier
      physical_vulnerability:
        typeof monsterData.physical_vulnerability === 'number'
          ? Math.max(0.5, Math.min(3.0, monsterData.physical_vulnerability))
          : Math.max(0.8, 1.0 - tier * 0.01), // ✅ Reduz com tier
      magical_vulnerability:
        typeof monsterData.magical_vulnerability === 'number'
          ? Math.max(0.5, Math.min(3.0, monsterData.magical_vulnerability))
          : Math.max(0.8, 1.0 - tier * 0.01), // ✅ Reduz com tier
      primary_trait:
        typeof monsterData.primary_trait === 'string' && monsterData.primary_trait.length > 0
          ? monsterData.primary_trait
          : isBoss
            ? 'boss'
            : isElite
              ? 'elite'
              : tier > 3
                ? 'veteran'
                : 'common',
      secondary_trait:
        typeof monsterData.secondary_trait === 'string' && monsterData.secondary_trait.length > 0
          ? monsterData.secondary_trait
          : tier > 5
            ? 'ancient'
            : tier > 2
              ? 'experienced'
              : 'basic',
      special_abilities:
        specialAbilities.length > 0
          ? specialAbilities
          : [
              ...(isBoss ? ['Powerful Strike', 'Boss Aura'] : []),
              ...(isElite ? ['Swift Attack'] : []),
              ...(tier > 3 ? ['Tier Mastery'] : []),
            ],
    };
  }

  /**
   * Carregar drops possíveis
   * Agora com loading state da store
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
   * ✅ CORRIGIDO: Gerar enemy com sistema de ciclos infinitos até andar 1000
   */
  private static generateFallbackEnemy(floor: number): Enemy {
    // ✅ SISTEMA DE CICLOS INFINITOS
    const tier = Math.max(1, Math.floor(floor / 20) + 1); // Tier a cada 20 andares
    const cyclePosition = ((floor - 1) % 20) + 1; // Posição no ciclo (1-20)
    const level = Math.max(1, Math.floor(floor / 3) + 1);

    // ✅ BOSS FLOORS CONSISTENTES: 5, 10, 20, 30, 40...
    const isBoss = floor === 5 || floor % 10 === 0;
    const isElite = floor % 5 === 0 && floor > 5 && !isBoss;

    // ✅ NOMES ESCALÁVEIS COM TIERS
    const monsterTypes = [
      'Slime',
      'Goblin',
      'Orc',
      'Skeleton',
      'Wolf',
      'Spider',
      'Troll',
      'Dragon',
    ];
    const tierPrefixes = [
      '',
      'Greater',
      'Elder',
      'Ancient',
      'Legendary',
      'Mythic',
      'Cosmic',
      'Void',
    ];

    const typeIndex = Math.floor(cyclePosition / 3) % monsterTypes.length;
    const baseName = monsterTypes[typeIndex];
    const tierPrefix =
      tier > 1 && tier <= tierPrefixes.length ? tierPrefixes[tier - 1] : `T${tier}`;

    let name = baseName;
    if (tier > 1) name = `${tierPrefix} ${baseName}`;
    if (isBoss) name = `Boss ${name}`;
    else if (isElite) name = `Elite ${name}`;

    // ✅ STATS BASE BALANCEADOS PARA ESCALAMENTO INFINITO
    let baseHp, baseAtk, baseDef;

    // Progressão por faixas de andar
    if (floor <= 5) {
      baseHp = isBoss ? 80 : 60;
      baseAtk = isBoss ? 20 : 15;
      baseDef = isBoss ? 12 : 8;
    } else if (floor <= 20) {
      baseHp = isBoss ? 120 : 90;
      baseAtk = isBoss ? 30 : 22;
      baseDef = isBoss ? 18 : 12;
    } else if (floor <= 50) {
      baseHp = isBoss ? 180 : 135;
      baseAtk = isBoss ? 45 : 32;
      baseDef = isBoss ? 25 : 18;
    } else if (floor <= 100) {
      baseHp = isBoss ? 250 : 190;
      baseAtk = isBoss ? 60 : 45;
      baseDef = isBoss ? 35 : 25;
    } else {
      // Para andares 100+: escalamento baseado em tier
      const baseTierHp = 300 + (tier - 6) * 100;
      const baseTierAtk = 70 + (tier - 6) * 20;
      const baseTierDef = 40 + (tier - 6) * 10;

      baseHp = isBoss ? baseTierHp * 1.4 : baseTierHp;
      baseAtk = isBoss ? baseTierAtk * 1.4 : baseTierAtk;
      baseDef = isBoss ? baseTierDef * 1.4 : baseTierDef;
    }

    // ✅ ESCALAMENTO POR TIER E POSIÇÃO NO CICLO
    const tierMultiplier = Math.pow(1.5, tier - 1); // 1.5x por tier (mais agressivo)
    const cycleMultiplier = 1 + (cyclePosition - 1) * 0.03; // 3% por posição no ciclo
    const eliteMultiplier = isElite ? 1.3 : 1; // Elites 30% mais fortes

    const hp = Math.floor(baseHp * tierMultiplier * cycleMultiplier * eliteMultiplier);
    const atk = Math.floor(baseAtk * tierMultiplier * cycleMultiplier * eliteMultiplier);
    const def = Math.floor(baseDef * tierMultiplier * cycleMultiplier * eliteMultiplier);
    const speed = Math.floor((10 + level + tier * 2) * cycleMultiplier);

    // ✅ RECOMPENSAS ESCALADAS POR TIER E DIFICULDADE
    const baseXp = 15 + level * 2 + tier * 5;
    const baseGold = 10 + level + tier * 3;

    const xpMultiplier = (isBoss ? 2.5 : isElite ? 1.8 : 1) * cycleMultiplier;
    const goldMultiplier = (isBoss ? 2.0 : isElite ? 1.5 : 1) * cycleMultiplier;

    const reward_xp = Math.floor(baseXp * xpMultiplier);
    const reward_gold = Math.floor(baseGold * goldMultiplier);

    console.log(
      `[MonsterService] ✅ Enemy gerado: ${name} (T${tier}C${cyclePosition}) - HP:${hp} ATK:${atk} DEF:${def} | XP:${reward_xp} Gold:${reward_gold}`
    );

    // ✅ ATRIBUTOS ESCALADOS POR TIER E CICLO
    const attributeBase = 10 + tier * 3 + Math.floor(cyclePosition / 4);
    const attributeMultiplier = tierMultiplier * cycleMultiplier;

    return {
      id: `fallback_${floor}_${Date.now()}`,
      name,
      level,
      hp,
      maxHp: hp,
      attack: atk,
      defense: def,
      speed,
      image: isBoss ? '👑' : isElite ? '⭐' : '👾', // Assets diferenciados
      behavior: isElite ? 'aggressive' : isBoss ? 'defensive' : 'balanced',
      mana: Math.floor((20 + level * 4 + tier * 5) * cycleMultiplier),
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

      // ✅ SISTEMA DE CICLOS COMPLETO
      tier,
      base_tier: Math.max(1, Math.floor(floor / 20) + 1),
      cycle_position: cyclePosition,
      is_boss: isBoss,

      // ✅ ATRIBUTOS PRIMÁRIOS ESCALADOS
      strength: Math.floor(attributeBase * attributeMultiplier * (isBoss ? 1.3 : 1)),
      dexterity: Math.floor(attributeBase * attributeMultiplier * (isElite ? 1.3 : 1)),
      intelligence: Math.floor(attributeBase * 0.8 * attributeMultiplier),
      wisdom: Math.floor(attributeBase * 0.7 * attributeMultiplier),
      vitality: Math.floor(attributeBase * attributeMultiplier * (isBoss ? 1.4 : 1.2)),
      luck: Math.floor(attributeBase * 0.6 * attributeMultiplier),

      // ✅ STATS DE COMBATE ESCALADOS
      critical_chance: Math.min(0.4, 0.05 + tier * 0.02 + cyclePosition * 0.005),
      critical_damage: Math.min(3.0, 1.5 + tier * 0.1 + cyclePosition * 0.02),
      critical_resistance: Math.min(0.3, tier * 0.02 + (isBoss ? 0.1 : 0.05)),

      // ✅ RESISTÊNCIAS ESCALADAS POR TIER
      physical_resistance: Math.min(0.25, tier * 0.015 + (isBoss ? 0.05 : 0.02)),
      magical_resistance: Math.min(0.25, tier * 0.015 + (isElite ? 0.05 : 0.02)),
      debuff_resistance: Math.min(0.4, tier * 0.025 + (isBoss ? 0.15 : 0.05)),

      // ✅ VULNERABILIDADES BALANCEADAS
      physical_vulnerability: Math.max(0.8, 1.0 - tier * 0.01),
      magical_vulnerability: Math.max(0.8, 1.0 - tier * 0.01),

      // ✅ TRAITS DINÂMICOS
      primary_trait: isBoss ? 'boss' : isElite ? 'elite' : tier > 3 ? 'veteran' : 'common',
      secondary_trait: tier > 5 ? 'ancient' : tier > 2 ? 'experienced' : 'basic',
      special_abilities: [
        ...(isBoss ? ['Powerful Strike', 'Boss Aura'] : []),
        ...(isElite ? ['Swift Attack'] : []),
        ...(tier > 3 ? ['Tier Mastery'] : []),
        ...(tier > 6 ? ['Ancient Power'] : []),
      ],
    };
  }

  /**
   * Limpar cache - agora usa a store
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
   * Útil para melhorar a performance
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
