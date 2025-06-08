import { supabase } from '@/lib/supabase';
import { type Monster, type MonsterDropChance } from './models/monster.model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class MonsterService {
  private static monsterCache: Map<number, Monster> = new Map();
  private static cacheExpiry: Map<number, number> = new Map();
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

      // CORRIGIDO: Limpar todo o cache para evitar conflitos de estado
      this.clearCache();

      // Buscar monstro do servidor usando get_monster_for_floor_with_initiative para stats escalados
      console.log(`[MonsterService] Buscando monstro DIRETAMENTE do servidor para andar ${floor}`);
      
      // Tentar primeiro a função padrão get_monster_for_floor
      let { data, error } = await supabase
        .rpc('get_monster_for_floor', {
          p_floor: floor
        });
        
      // Se a função padrão falhar, verificar se há uma função com iniciativa disponível
      if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
        console.log(`[MonsterService] Função get_monster_for_floor não existe, tentando fallback...`);
        
        // Fallback: buscar monstro diretamente da tabela usando lógica básica
        const { data: monsterResult, error: monsterError } = await supabase
          .from('monsters')
          .select('*')
          .lte('min_floor', floor)
          .order('min_floor', { ascending: false })
          .limit(1);
          
        if (monsterError) {
          data = null;
          error = monsterError;
        } else {
          // Simular o formato esperado da RPC
          data = monsterResult && monsterResult.length > 0 ? monsterResult[0] : null;
          error = null;
        }
      }

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
        console.error(`[MonsterService] Erro na API ao buscar monstro para andar ${floor}:`, error);
        
        // Tratar erro específico de incompatibilidade de tipos (42804)
        if (error.code === '42804' || error.message?.includes('does not match function result type')) {
          console.log(`[MonsterService] Erro de tipo detectado, tentando buscar diretamente da tabela...`);
          
          // Fallback: buscar diretamente da tabela monsters
          try {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('monsters')
              .select('*')
              .lte('min_floor', floor)
              .order('min_floor', { ascending: false })
              .limit(1);
              
            if (fallbackError) {
              throw fallbackError;
            }
            
            if (fallbackData && fallbackData.length > 0) {
              console.log(`[MonsterService] Fallback bem-sucedido, usando monstro da tabela`);
              data = fallbackData[0];
              error = null;
            } else {
              return { 
                data: null, 
                error: 'Nenhum monstro encontrado na tabela para este andar', 
                success: false 
              };
            }
          } catch (fallbackError) {
            console.error(`[MonsterService] Fallback também falhou:`, fallbackError);
                         return { 
               data: null, 
               error: `Erro na função RPC e no fallback: ${error?.message || 'Erro desconhecido'}`, 
               success: false 
             };
          }
        } else {
          return { 
            data: null, 
            error: error.message, 
            success: false 
          };
        }
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

      // Garantir que stats básicos existem (fallback para valores calculados se necessário)
      if (!monsterData.hp || !monsterData.atk || !monsterData.def) {
        console.log(`[MonsterService] Calculando stats básicos para ${monsterData.name} (andar ${floor})`);
        
        // Calcular stats básicos se não existirem
        const level = monsterData.level || Math.max(1, Math.floor(floor / 5) + 1);
        const tier = monsterData.tier || Math.max(1, Math.floor(floor / 20) + 1);
        
        monsterData.hp = monsterData.hp || Math.floor(50 + (level * 15) + (tier * 25));
        monsterData.atk = monsterData.atk || Math.floor(10 + (level * 3) + (tier * 5));
        monsterData.def = monsterData.def || Math.floor(5 + (level * 2) + (tier * 3));
        monsterData.reward_xp = monsterData.reward_xp || Math.floor(5 + (level * 2) + (tier * 2));
        monsterData.reward_gold = monsterData.reward_gold || Math.floor(3 + (level * 1) + (tier * 1));
      }

      console.log(`[MonsterService] === MONSTRO ENCONTRADO ===`);
      console.log(`[MonsterService] ID: ${monsterData.id}`);
      console.log(`[MonsterService] Nome: ${monsterData.name}`);
      console.log(`[MonsterService] HP: ${monsterData.hp}, ATK: ${monsterData.atk}, DEF: ${monsterData.def}`);
      console.log(`[MonsterService] Tier: ${monsterData.tier || 1}, Ciclo: ${monsterData.cycle_position || 'N/A'}, Boss: ${monsterData.is_boss || false}`);
      console.log(`[MonsterService] Level: ${monsterData.level}, XP: ${monsterData.reward_xp}, Gold: ${monsterData.reward_gold}`);

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
        hp: monsterData.hp,
        atk: monsterData.atk,
        def: monsterData.def,
        mana: monsterData.mana || 0,
        speed: monsterData.speed || 10,
        behavior: monsterData.behavior,
        min_floor: monsterData.min_floor,
        reward_xp: monsterData.reward_xp,
        reward_gold: monsterData.reward_gold,
        level: monsterData.level || Math.max(1, Math.floor(floor / 5) + 1),
        // CRÍTICO: Incluir possible_drops
        possible_drops: possibleDrops,
        // Novos campos do sistema cíclico
        tier: monsterData.tier || 1,
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