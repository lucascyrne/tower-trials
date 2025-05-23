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
  private static CACHE_DURATION = 30000; // 30 segundos
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

      console.log(`[MonsterService] Solicitando monstro para o andar ${floor}`);

      // Verificar cache
      const now = Date.now();
      const cachedMonster = this.monsterCache.get(floor);
      const expiryTime = this.cacheExpiry.get(floor) || 0;

      if (cachedMonster && now < expiryTime) {
        console.log(`[MonsterService] Usando monstro em cache para o andar ${floor}: ${cachedMonster.name}`);
        return { data: { ...cachedMonster }, error: null, success: true };
      }

      // Verificar se já existe uma requisição pendente para este andar
      if (this.pendingRequests.has(floor)) {
        console.log(`[MonsterService] Reutilizando requisição pendente para o andar ${floor}`);
        return this.pendingRequests.get(floor)!;
      }

      // Criar nova requisição
      const request = this.fetchMonsterFromServer(floor);
      this.pendingRequests.set(floor, request);

      // Remover do mapa de requisições pendentes quando concluído
      request.finally(() => {
        this.pendingRequests.delete(floor);
      });

      return request;
    } catch (error) {
      console.error(`[MonsterService] Erro ao obter monstro para andar ${floor}:`, error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar monstro',
        success: false 
      };
    }
  }

  /**
   * Realizar a requisição ao servidor para obter um monstro
   * @private
   */
  private static async fetchMonsterFromServer(floor: number): Promise<ServiceResponse<Monster>> {
    try {
      console.log(`[MonsterService] Buscando monstro no servidor para andar ${floor}`);
      
      // Chamar a função RPC que criamos especificamente para isso
      const { data, error } = await supabase
        .rpc('get_monster_for_floor', {
          p_floor: floor
        })
        .single();

      if (error) {
        console.error(`[MonsterService] Erro na API ao buscar monstro para andar ${floor}:`, error.message);
        throw error;
      }
      
      if (!data) {
        console.error(`[MonsterService] Nenhum monstro retornado para andar ${floor}`);
        throw new Error('Nenhum monstro encontrado para este andar');
      }

      // Atualizar cache
      this.monsterCache.set(floor, { ...data } as Monster);
      this.cacheExpiry.set(floor, Date.now() + this.CACHE_DURATION);

      const monster = data as Monster;
      console.log(`[MonsterService] Monstro obtido para andar ${floor}: ${monster.name}`);
      
      return { data: monster, error: null, success: true };
    } catch (error) {
      console.error(`[MonsterService] Falha ao buscar monstro para andar ${floor}:`, error instanceof Error ? error.message : error);
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