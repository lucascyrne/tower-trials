import { supabase } from '@/lib/supabase';
import { Monster } from './models/monster.model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class MonsterService {
  /**
   * Buscar monstro apropriado para o andar atual
   * @param floor Andar atual
   * @returns Monstro com stats ajustados para o andar
   */
  static async getMonsterForFloor(floor: number): Promise<ServiceResponse<Monster>> {
    try {
      // Chamar a função RPC que criamos especificamente para isso
      const { data, error } = await supabase
        .rpc('get_monster_for_floor', {
          p_floor: floor
        })
        .single();

      if (error) throw error;
      
      if (!data) {
        throw new Error('Nenhum monstro encontrado para este andar');
      }

      // Aplicar redução de 60% nas recompensas
      const reductionFactor = 0.4;
      const monster = data as Monster;
      monster.reward_xp = Math.floor(monster.reward_xp * reductionFactor);
      monster.reward_gold = Math.floor(monster.reward_gold * reductionFactor);

      return { data: monster, error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar monstro:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar monstro',
        success: false 
      };
    }
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