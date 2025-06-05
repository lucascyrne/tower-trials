import { supabase } from '@/lib/supabase';
import { Monster } from './models/monster.model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class MonsterService {
  private static monsterCache: Map<number, Monster> = new Map();
  private static cacheExpiry: Map<number, number> = new Map();
  private static CACHE_DURATION = 2000; // Cache muito curto para evitar problemas
  private static pendingRequests: Map<number, Promise<ServiceResponse<Monster>>> = new Map();

  /**
   * Buscar monstro apropriado para o andar atual
   * @param floor Andar atual
   * @returns Monstro com stats ajustados para o andar
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

      // SEMPRE limpar cache para o andar específico para evitar problemas
      this.monsterCache.delete(floor);
      this.cacheExpiry.delete(floor);

      // Buscar monstro do servidor
      console.log(`[MonsterService] Buscando monstro DIRETAMENTE do servidor para andar ${floor}`);
      
      const { data, error } = await supabase
        .rpc('get_monster_for_floor', {
          p_floor: floor
        });

      console.log(`[MonsterService] Resposta da RPC get_monster_for_floor:`, {
        hasData: !!data,
        hasError: !!error,
        dataLength: Array.isArray(data) ? data.length : 'not-array',
        errorMessage: error?.message
      });

      if (error) {
        console.error(`[MonsterService] Erro na API ao buscar monstro para andar ${floor}:`, error);
        return { 
          data: null, 
          error: error.message, 
          success: false 
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

      console.log(`[MonsterService] === MONSTRO ENCONTRADO ===`);
      console.log(`[MonsterService] ID: ${monsterData.id}`);
      console.log(`[MonsterService] Nome: ${monsterData.name}`);
      console.log(`[MonsterService] HP: ${monsterData.hp}, ATK: ${monsterData.atk}, DEF: ${monsterData.def}`);
      console.log(`[MonsterService] Min Floor: ${monsterData.min_floor}, XP: ${monsterData.reward_xp}, Gold: ${monsterData.reward_gold}`);

      // Converter para Monster com estrutura correta
      const monster: Monster = {
        id: monsterData.id,
        name: monsterData.name,
        hp: monsterData.hp,
        atk: monsterData.atk,
        def: monsterData.def,
        mana: monsterData.mana || 0,
        speed: monsterData.speed || 10,
        behavior: monsterData.behavior,
        min_floor: monsterData.min_floor,
        reward_xp: monsterData.reward_xp,
        reward_gold: monsterData.reward_gold,
        level: Math.max(1, Math.floor(floor / 5) + 1),
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

      console.log(`[MonsterService] === MONSTRO PROCESSADO COM SUCESSO ===`);
      console.log(`[MonsterService] Retornando: ${monster.name} (HP: ${monster.hp}, ATK: ${monster.atk}, DEF: ${monster.def})`);
      
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