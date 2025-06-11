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
          success: false,
        };
      }

      // NOVO: Verificar cache primeiro antes de fazer requisições
      const cachedMonster = this.monsterCache.get(floor);
      const cacheExpiry = this.cacheExpiry.get(floor);
      const now = Date.now();

      if (cachedMonster && cacheExpiry && now < cacheExpiry) {
        console.log(
          `[MonsterService] Retornando monstro do cache para andar ${floor}: ${cachedMonster.name}`
        );
        return { data: cachedMonster, error: null, success: true };
      }

      // NOVO: Verificar se já existe requisição pendente
      if (this.pendingRequests.has(floor)) {
        console.log(`[MonsterService] Reutilizando requisição pendente para andar ${floor}`);
        return this.pendingRequests.get(floor)!;
      }

      console.log(`[MonsterService] === INÍCIO BUSCA MONSTRO ANDAR ${floor} ===`);

      // Criar promessa para requisição e armazenar no mapa
      const requestPromise = this.fetchMonsterFromServer(floor);
      this.pendingRequests.set(floor, requestPromise);

      // Limpar da lista de pendentes quando concluído
      requestPromise.finally(() => {
        this.pendingRequests.delete(floor);
      });

      const result = await requestPromise;

      // CRÍTICO: Se falhar, sempre usar fallback para garantir que há monstro
      if (!result.success || !result.data) {
        console.warn(`[MonsterService] Falha na busca, usando fallback para andar ${floor}`);
        const fallbackMonster = this.generateBasicMonster(floor);

        // Cache o resultado do fallback
        this.monsterCache.set(floor, fallbackMonster);
        this.cacheExpiry.set(floor, now + 30000);

        return { data: fallbackMonster, error: null, success: true };
      }

      return result;
    } catch (error) {
      console.error(`[MonsterService] EXCEÇÃO ao obter monstro para andar ${floor}:`, error);

      // CRÍTICO: Sempre retornar fallback em caso de exceção
      console.log(
        `[MonsterService] Gerando monstro de fallback para andar ${floor} devido à exceção`
      );
      const fallbackMonster = this.generateBasicMonster(floor);

      // Cache o resultado do fallback
      const now = Date.now();
      this.monsterCache.set(floor, fallbackMonster);
      this.cacheExpiry.set(floor, now + 30000);

      return { data: fallbackMonster, error: null, success: true };
    }
  }

  /**
   * Buscar monstro do servidor (método privado para controle de cache)
   * @private
   */
  private static async fetchMonsterFromServer(floor: number): Promise<ServiceResponse<Monster>> {
    try {
      // Buscar monstro do servidor usando get_monster_for_floor_with_initiative para stats escalados
      console.log(`[MonsterService] Buscando monstro DIRETAMENTE do servidor para andar ${floor}`);

      // Tentar primeiro a função padrão get_monster_for_floor
      let { data, error } = await supabase.rpc('get_monster_for_floor', {
        p_floor: floor,
      });

      // Se a função padrão falhar, verificar se há uma função com iniciativa disponível
      if (
        error &&
        error.message?.includes('function') &&
        error.message?.includes('does not exist')
      ) {
        console.log(
          `[MonsterService] Função get_monster_for_floor não existe, tentando get_monster_for_floor_with_initiative...`
        );

        // Tentar função com iniciativa
        const { data: initiativeData, error: initiativeError } = await supabase.rpc(
          'get_monster_for_floor_with_initiative',
          {
            p_floor: floor,
          }
        );

        if (initiativeError) {
          console.log(`[MonsterService] Função com iniciativa também falhou, usando fallback...`);

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
            console.log(`[MonsterService] Usando fallback da tabela: ${data?.name || 'N/A'}`);
          }
        } else {
          data = initiativeData;
          error = initiativeError;
          console.log(`[MonsterService] Usando função com iniciativa: ${data?.name || 'N/A'}`);
        }
      } else if (!error) {
        console.log(`[MonsterService] Usando função padrão: ${data?.name || 'N/A'}`);
      }

      console.log(`[MonsterService] Resposta da RPC get_monster_for_floor:`, {
        hasData: !!data,
        hasError: !!error,
        dataType: typeof data,
        isArray: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 'not-array',
        errorMessage: error?.message,
        errorCode: error?.code,
      });

      if (error) {
        console.error(`[MonsterService] Erro na API ao buscar monstro para andar ${floor}:`, error);

        // CRÍTICO: Sempre usar fallback em caso de erro da API
        console.log(`[MonsterService] Usando fallback devido a erro na API`);
        const fallbackMonster = this.generateBasicMonster(floor);

        // Cache o resultado do fallback
        const now = Date.now();
        this.monsterCache.set(floor, fallbackMonster);
        this.cacheExpiry.set(floor, now + 30000);

        return { data: fallbackMonster, error: null, success: true };
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.error(`[MonsterService] Nenhum monstro retornado para andar ${floor}`);

        // CRÍTICO: Usar fallback se não há dados
        console.log(`[MonsterService] Gerando monstro de fallback - nenhum dado retornado`);
        const fallbackMonster = this.generateBasicMonster(floor);

        // Cache o resultado do fallback
        const now = Date.now();
        this.monsterCache.set(floor, fallbackMonster);
        this.cacheExpiry.set(floor, now + 30000);

        return { data: fallbackMonster, error: null, success: true };
      }

      // Garantir que temos um objeto único
      const monsterData = Array.isArray(data) ? data[0] : data;

      if (!monsterData || !monsterData.id || !monsterData.name) {
        console.error(
          `[MonsterService] Dados de monstro inválidos para andar ${floor}:`,
          monsterData
        );
        return {
          data: null,
          error: 'Dados do monstro inválidos',
          success: false,
        };
      }

      // Garantir que stats básicos existem (fallback para valores calculados se necessário)
      if (!monsterData.hp || !monsterData.atk || !monsterData.def) {
        console.log(
          `[MonsterService] Calculando stats básicos para ${monsterData.name} (andar ${floor})`
        );

        // Calcular stats básicos se não existirem
        const level = monsterData.level || Math.max(1, Math.floor(floor / 5) + 1);
        const tier = monsterData.tier || Math.max(1, Math.floor(floor / 20) + 1);

        monsterData.hp = monsterData.hp || Math.floor(50 + level * 15 + tier * 25);
        monsterData.atk = monsterData.atk || Math.floor(10 + level * 3 + tier * 5);
        monsterData.def = monsterData.def || Math.floor(5 + level * 2 + tier * 3);
        monsterData.reward_xp = monsterData.reward_xp || Math.floor(5 + level * 2 + tier * 2);
        monsterData.reward_gold = monsterData.reward_gold || Math.floor(3 + level * 1 + tier * 1);
      }

      console.log(`[MonsterService] === MONSTRO ENCONTRADO ===`);
      console.log(`[MonsterService] ID: ${monsterData.id}`);
      console.log(`[MonsterService] Nome: ${monsterData.name}`);
      console.log(
        `[MonsterService] HP: ${monsterData.hp}, ATK: ${monsterData.atk}, DEF: ${monsterData.def}`
      );
      console.log(
        `[MonsterService] Tier: ${monsterData.tier || 1}, Ciclo: ${monsterData.cycle_position || 'N/A'}, Boss: ${monsterData.is_boss || false}`
      );
      console.log(
        `[MonsterService] Level: ${monsterData.level}, XP: ${monsterData.reward_xp}, Gold: ${monsterData.reward_gold}`
      );

      // NOVO: Buscar os possible_drops do monstro
      console.log(`[MonsterService] Buscando possible_drops para monstro ${monsterData.id}...`);

      const { data: possibleDropsData, error: dropsError } = await supabase
        .from('monster_possible_drops')
        .select(
          `
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
        `
        )
        .eq('monster_id', monsterData.id);

      if (dropsError) {
        console.warn(
          `[MonsterService] Erro ao buscar drops do monstro ${monsterData.id}:`,
          dropsError
        );
        // Continuar sem drops em caso de erro
      }

      // Converter drops para formato correto
      const possibleDrops: MonsterDropChance[] = (possibleDropsData || []).map(dropData => ({
        drop_id: dropData.drop_id,
        drop_chance: dropData.drop_chance,
        min_quantity: dropData.min_quantity,
        max_quantity: dropData.max_quantity,
        // Incluir dados do drop para referência (pegar primeiro elemento do array)
        drop_info: Array.isArray(dropData.monster_drops)
          ? dropData.monster_drops[0]
          : dropData.monster_drops,
      }));

      console.log(
        `[MonsterService] Encontrados ${possibleDrops.length} possible_drops para ${monsterData.name}`
      );
      possibleDrops.forEach(drop => {
        console.log(
          `[MonsterService] - ${drop.drop_info?.name || 'Drop desconhecido'} (chance: ${(drop.drop_chance * 100).toFixed(1)}%, qtd: ${drop.min_quantity}-${drop.max_quantity})`
        );
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
        special_abilities: monsterData.special_abilities || [],
      };

      console.log(`[MonsterService] === MONSTRO PROCESSADO COM SUCESSO ===`);
      console.log(
        `[MonsterService] Retornando: ${monster.name} (HP: ${monster.hp}, ATK: ${monster.atk}, DEF: ${monster.def})`
      );
      console.log(`[MonsterService] Possible drops: ${monster.possible_drops?.length || 0} tipos`);

      // NOVO: Cachear o resultado por 30 segundos
      const now = Date.now();
      this.monsterCache.set(floor, monster);
      this.cacheExpiry.set(floor, now + 30000); // 30 segundos

      return { data: monster, error: null, success: true };
    } catch (error) {
      console.error(
        `[MonsterService] EXCEÇÃO ao buscar monstro do servidor para andar ${floor}:`,
        error
      );
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar monstro do servidor',
        success: false,
      };
    }
  }

  private static lastClearTime = 0;
  private static MIN_CLEAR_INTERVAL = 1000; // Mínimo 1 segundo entre clears

  /**
   * Limpar o cache de monstros (com throttling)
   * @public
   */
  static clearCache(): void {
    const now = Date.now();
    if (now - this.lastClearTime < this.MIN_CLEAR_INTERVAL) {
      console.log(
        `[MonsterService] Cache clear throttled - última limpeza há ${now - this.lastClearTime}ms`
      );
      return;
    }

    this.monsterCache.clear();
    this.cacheExpiry.clear();
    this.pendingRequests.clear();
    this.lastClearTime = now;
    console.log('[MonsterService] Cache de monstros limpo');
  }

  /**
   * Gerar monstro básico como fallback quando RPC falha
   * @private
   */
  private static generateBasicMonster(floor: number): Monster {
    const level = Math.max(1, Math.floor(floor / 5) + 1);
    const tier = Math.max(1, Math.floor(floor / 20) + 1);
    const isBoss = floor % 10 === 0;

    // Nomes básicos baseados no andar
    const monsterNames = [
      'Slime',
      'Goblin',
      'Orc',
      'Skeleton',
      'Wolf',
      'Spider',
      'Troll',
      'Dragon',
      'Demon',
      'Lich',
    ];

    const nameIndex = Math.floor(floor / 2) % monsterNames.length;
    const baseName = monsterNames[nameIndex];
    const tierSuffix = tier > 1 ? ` Tier ${tier}` : '';
    const bossPrefix = isBoss ? 'Boss ' : '';

    const name = `${bossPrefix}${baseName}${tierSuffix}`;

    // Stats básicos escalados
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
      id: `generated_${floor}_${Date.now()}`,
      name,
      level,
      hp,
      atk,
      def,
      mana: Math.floor(20 + level * 5),
      speed,
      behavior: 'balanced',
      min_floor: floor,
      reward_xp,
      reward_gold,
      image: isBoss ? '👑' : '👾',
      possible_drops: [],
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
