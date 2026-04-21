import { supabase } from '@/lib/supabase';
import { Monster, MonsterDropChance } from './models/monster.model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

function coerceIntStat(
  value: unknown,
  fallback: number,
  min: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(min, Math.floor(fallback));
  return Math.max(min, Math.floor(parsed));
}

function formatRpcError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Erro RPC desconhecido';
  const e = error as {
    message?: string;
    code?: string;
    details?: string | null;
    hint?: string | null;
  };
  const parts = [e.message || 'Erro RPC'];
  if (e.code) parts.push(`code=${e.code}`);
  if (e.details) parts.push(`details=${e.details}`);
  if (e.hint) parts.push(`hint=${e.hint}`);
  return parts.join(' | ');
}

function coerceMonsterRewards(
  rewardXp: unknown,
  rewardGold: unknown,
  level: number,
  tier: number
): { reward_xp: number; reward_gold: number } {
  const lv = Math.max(1, level);
  const ti = Math.max(1, tier);
  const fallbackXp = Math.floor(5 + lv * 2 + ti * 2);
  const fallbackGold = Math.floor(3 + lv + ti);
  const x = Number(rewardXp);
  const g = Number(rewardGold);
  return {
    reward_xp: Number.isFinite(x) && x > 0 ? Math.floor(x) : fallbackXp,
    reward_gold: Number.isFinite(g) && g > 0 ? Math.floor(g) : fallbackGold,
  };
}

export class MonsterService {
  private static monsterCache: Map<number, Monster> = new Map();
  private static cacheExpiry: Map<number, number> = new Map();
  private static CACHE_DURATION = 2000; // Cache muito curto para evitar problemas
  private static pendingRequests: Map<number, Promise<ServiceResponse<Monster>>> = new Map();

  /**
   * Buscar monstro apropriado para o andar atual com seus possible_drops
   * @param floor Andar atual
   * @returns Monstro com stats ajustados para o andar e seus drops possíveis
   */
  static async getMonsterForFloor(floor: number): Promise<ServiceResponse<Monster>> {
    try {
      // Validar andar
      if (floor <= 0) {
        console.warn(`[MonsterService] Tentativa de gerar monstro para andar inválido: ${floor}`);
        return { 
          data: null, 
          error: `Andar inválido: ${floor}`, 
          success: false 
        };
      }

      console.log(`[MonsterService] === INÍCIO BUSCA MONSTRO ANDAR ${floor} ===`);

      // Buscar monstro do servidor usando get_monster_for_floor_with_initiative para stats escalados
      console.log(`[MonsterService] Buscando monstro DIRETAMENTE do servidor para andar ${floor}`);
      
      // Tentar primeiro a função padrão get_monster_for_floor
      const { data, error } = await supabase
        .rpc('get_monster_for_floor', {
          p_floor: floor
        });
        
      console.log(`[MonsterService] Resposta da RPC get_monster_for_floor:`, {
        hasData: !!data,
        hasError: !!error,
        dataType: typeof data,
        isArray: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 'not-array',
        errorMessage: error?.message,
        errorCode: error?.code
      });

      if (error) {
        const formattedError = formatRpcError(error);
        console.error(`[MonsterService] Erro na API ao buscar monstro para andar ${floor}:`, formattedError);
        return {
          data: null,
          error: `Falha no RPC get_monster_for_floor: ${formattedError}`,
          success: false,
        };
      }
      
      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.error(`[MonsterService] Nenhum monstro retornado para andar ${floor}`);
        return { 
          data: null, 
          error: 'Nenhum monstro encontrado para este andar', 
          success: false 
        };
      }

      // Garantir que temos um objeto único
      const monsterData = Array.isArray(data) ? data[0] : data;
      
      if (!monsterData || !monsterData.id || !monsterData.name) {
        console.error(`[MonsterService] Dados de monstro inválidos para andar ${floor}:`, monsterData);
        return { 
          data: null, 
          error: 'Dados do monstro inválidos', 
          success: false 
        };
      }

      const fallbackLevel = Math.max(1, Math.floor(floor / 5) + 1);
      const fallbackTier = Math.max(1, Math.floor(floor / 20) + 1);
      const level = coerceIntStat(monsterData.level, fallbackLevel, 1);
      const tier = coerceIntStat(monsterData.tier, fallbackTier, 1);

      // Sanitizar números vindos da RPC antes de montar o objeto de domínio
      const hp = coerceIntStat(monsterData.hp, 50 + (level * 15) + (tier * 25), 1);
      const atk = coerceIntStat(monsterData.atk, 10 + (level * 3) + (tier * 5), 1);
      const def = coerceIntStat(monsterData.def, 5 + (level * 2) + (tier * 3), 0);
      const mana = coerceIntStat(monsterData.mana, 0, 0);
      const speed = coerceIntStat(monsterData.speed, 10, 1);

      const fb = coerceMonsterRewards(monsterData.reward_xp, monsterData.reward_gold, level, tier);

      // Não mascarar payload inconsistente: sinalizar erro para retry/control flow no serviço de jogo.
      const hasInvalidPayload =
        !Number.isFinite(Number(monsterData.hp)) ||
        !Number.isFinite(Number(monsterData.atk)) ||
        !Number.isFinite(Number(monsterData.def)) ||
        Number(monsterData.hp) <= 0 ||
        Number(monsterData.atk) <= 0 ||
        Number(monsterData.def) < 0;
      if (hasInvalidPayload) {
        const payloadInfo = JSON.stringify({
          id: monsterData.id,
          floor,
          hp: monsterData.hp,
          atk: monsterData.atk,
          def: monsterData.def,
          level: monsterData.level,
          tier: monsterData.tier,
        });
        console.error(`[MonsterService] Payload inválido de get_monster_for_floor: ${payloadInfo}`);
        return {
          data: null,
          error: 'Payload inválido retornado por get_monster_for_floor (hp/atk/def inconsistentes)',
          success: false,
        };
      }

      console.log(`[MonsterService] === MONSTRO ENCONTRADO ===`);
      console.log(`[MonsterService] ID: ${monsterData.id}`);
      console.log(`[MonsterService] Nome: ${monsterData.name}`);
      console.log(`[MonsterService] HP: ${hp}, ATK: ${atk}, DEF: ${def}`);
      console.log(`[MonsterService] Tier: ${tier}, Ciclo: ${monsterData.cycle_position || 'N/A'}, Boss: ${monsterData.is_boss || false}`);
      console.log(`[MonsterService] Level: ${level}, XP: ${fb.reward_xp}, Gold: ${fb.reward_gold}`);

      // NOVO: Buscar os possible_drops do monstro
      console.log(`[MonsterService] Buscando possible_drops para monstro ${monsterData.id}...`);
      
      const { data: possibleDropsData, error: dropsError } = await supabase
        .from('monster_possible_drops')
        .select(`
          drop_id,
          drop_chance,
          min_quantity,
          max_quantity,
          monster_drops:drop_id (
            id,
            name,
            description,
            rarity,
            value
          )
        `)
        .eq('monster_id', monsterData.id);

      if (dropsError) {
        console.warn(`[MonsterService] Erro ao buscar drops do monstro ${monsterData.id}:`, dropsError);
        // Continuar sem drops em caso de erro
      }

      // Converter drops para formato correto
      const possibleDrops: MonsterDropChance[] = (possibleDropsData || []).map(dropData => ({
        drop_id: dropData.drop_id,
        drop_chance: dropData.drop_chance,
        min_quantity: dropData.min_quantity,
        max_quantity: dropData.max_quantity,
        // Incluir dados do drop para referência (pegar primeiro elemento do array)
        drop_info: Array.isArray(dropData.monster_drops) ? dropData.monster_drops[0] : dropData.monster_drops
      }));

      console.log(`[MonsterService] Encontrados ${possibleDrops.length} possible_drops para ${monsterData.name}`);
      possibleDrops.forEach(drop => {
        console.log(`[MonsterService] - ${drop.drop_info?.name || 'Drop desconhecido'} (chance: ${(drop.drop_chance * 100).toFixed(1)}%, qtd: ${drop.min_quantity}-${drop.max_quantity})`);
      });

      // Converter para Monster com estrutura correta
      const monster: Monster = {
        id: monsterData.id,
        name: monsterData.name,
        hp,
        atk,
        def,
        mana,
        speed,
        behavior: monsterData.behavior,
        min_floor: monsterData.min_floor,
        reward_xp: fb.reward_xp,
        reward_gold: fb.reward_gold,
        level,
        // CRÍTICO: Incluir possible_drops
        possible_drops: possibleDrops,
        // Novos campos do sistema cíclico
        tier,
        base_tier: monsterData.base_tier || 1,
        cycle_position: monsterData.cycle_position || ((floor - 1) % 20) + 1,
        is_boss: monsterData.is_boss || false,
        // Campos opcionais
        strength: monsterData.strength,
        dexterity: monsterData.dexterity,
        intelligence: monsterData.intelligence,
        wisdom: monsterData.wisdom,
        vitality: monsterData.vitality,
        luck: monsterData.luck,
        critical_chance: monsterData.critical_chance,
        critical_damage: monsterData.critical_damage,
        critical_resistance: monsterData.critical_resistance,
        physical_resistance: monsterData.physical_resistance,
        magical_resistance: monsterData.magical_resistance,
        debuff_resistance: monsterData.debuff_resistance,
        physical_vulnerability: monsterData.physical_vulnerability,
        magical_vulnerability: monsterData.magical_vulnerability,
        primary_trait: monsterData.primary_trait,
        secondary_trait: monsterData.secondary_trait,
        special_abilities: monsterData.special_abilities || []
      };

      const rewards = coerceMonsterRewards(
        monster.reward_xp,
        monster.reward_gold,
        monster.level ?? 1,
        monster.tier ?? 1
      );
      monster.reward_xp = rewards.reward_xp;
      monster.reward_gold = rewards.reward_gold;

      console.log(`[MonsterService] === MONSTRO PROCESSADO COM SUCESSO ===`);
      console.log(`[MonsterService] Retornando: ${monster.name} (HP: ${monster.hp}, ATK: ${monster.atk}, DEF: ${monster.def})`);
      console.log(`[MonsterService] Possible drops: ${monster.possible_drops?.length || 0} tipos`);
      
      return { data: monster, error: null, success: true };

    } catch (error) {
      console.error(`[MonsterService] EXCEÇÃO ao obter monstro para andar ${floor}:`, error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar monstro',
        success: false 
      };
    }
  }

  /**
   * Limpar o cache de monstros
   * @public
   */
  static clearCache(): void {
    this.monsterCache.clear();
    this.cacheExpiry.clear();
    this.pendingRequests.clear();
    console.log('[MonsterService] Cache de monstros limpo');
  }

  /**
   * Calcular dano baseado no comportamento do monstro
   * @param monster Monstro que realizará o ataque
   * @param baseAtk Ataque base
   * @param baseDef Defesa base
   * @returns Dano calculado
   */
  static calculateDamage(monster: Monster, baseAtk: number, baseDef: number): number {
    let atkMultiplier = 1.0;
    let defMultiplier = 1.0;

    switch (monster.behavior) {
      case 'aggressive':
        atkMultiplier = 1.2;
        defMultiplier = 0.8;
        break;
      case 'defensive':
        atkMultiplier = 0.8;
        defMultiplier = 1.2;
        break;
      case 'balanced':
        atkMultiplier = 1.0;
        defMultiplier = 1.0;
        break;
    }

    const finalAtk = baseAtk * atkMultiplier;
    const finalDef = baseDef * defMultiplier;

    return Math.max(1, Math.floor(finalAtk - finalDef / 2));
  }
} 