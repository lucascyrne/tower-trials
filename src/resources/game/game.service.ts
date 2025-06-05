'use client';

import { ActionType, Enemy, GameResponse, GameState, GamePlayer, Floor, FloorType, BattleRewards } from './game-model';
import { MonsterService } from './monster.service';
import { SpellService } from './spell.service';
import { ConsumableService } from './consumable.service';
import { CharacterService } from './character.service';
import { SkillXpGain, SkillXpService } from './skill-xp.service';
import { supabase } from '@/lib/supabase';
import { CemeteryService } from './cemetery.service';
import { EquipmentService } from './equipment.service';
import { PlayerSpell, SpellEffectType } from './models/spell.model';
import { SkillType } from './models/character.model';

// Interface para salvar o progresso do jogo
interface SaveProgressData {
  user_id: string;
  player_name: string;
  current_floor: number;
  hp: number;
  max_hp: number;
  attack: number;
  defense: number;
  highest_floor: number;
}

// Interface para carregar o progresso
interface GameProgressEntry {
  id: string;
  user_id: string;
  player_name: string;
  current_floor: number;
  level: number;
  xp: number;
  xp_next_level: number;
  gold: number;
  mana: number;
  max_mana: number;
  atk: number;
  def: number;
  speed: number;
  hp: number;
  max_hp: number;
  highest_floor: number;
  created_at: string;
  updated_at: string;
}

interface CharacterSpell {
  spell_id: string;
  current_cooldown: number;
  spell: {
    id: string;
    name: string;
    description: string;
    mana_cost: number;
    cooldown: number;
    effect_type: string;
    effect_value: number;
    target_type: string;
    element: string;
    unlocked_at_level: number;
  }[];
}

export class GameService {
  // Cache temporário para dados de andar
  private static floorCache: Map<number, Floor> = new Map();
  private static floorCacheExpiry: Map<number, number> = new Map();
  private static FLOOR_CACHE_DURATION = 10000; // 10 segundos de cache

  /**
   * Limpar todos os caches
   * Esta função deve ser chamada após transições importantes para garantir dados atualizados
   */
  static clearAllCaches(): void {
    console.log('[GameService] Limpando todos os caches');
    this.floorCache.clear();
    this.floorCacheExpiry.clear();
    MonsterService.clearCache();
    console.log('[GameService] Todos os caches foram limpos');
  }

  /**
   * Gerar inimigo para o andar especificado
   * @param floor Número do andar
   * @returns Inimigo gerado ou null se falhar
   */
  static async generateEnemy(floor: number): Promise<Enemy | null> {
    try {
      console.log(`[GameService] Iniciando geração de inimigo para andar ${floor}`);
      
      // Buscar monstro do serviço (dados reais do banco)
      const { data: monsterData, error, success } = await MonsterService.getMonsterForFloor(floor);
      
      if (!success || error || !monsterData) {
        console.error(`[GameService] Erro ao buscar monstro para andar ${floor}:`, error);
        throw new Error(`Nenhum monstro encontrado para o andar ${floor}: ${error}`);
      }

      // Validar dados essenciais do monstro
      if (!monsterData.name || !monsterData.hp || !monsterData.atk || !monsterData.def) {
        console.error(`[GameService] Dados de monstro incompletos para andar ${floor}:`, monsterData);
        throw new Error(`Dados de monstro incompletos para o andar ${floor}`);
      }

      // Converter para Enemy - todos os dados vêm do banco
      const enemy: Enemy = {
        id: monsterData.id,
        name: monsterData.name,
        level: monsterData.level || Math.max(1, Math.floor(floor / 5) + 1),
        hp: monsterData.hp,
        maxHp: monsterData.hp,
        attack: monsterData.atk,
        defense: monsterData.def,
        speed: monsterData.speed || 10,
        image: monsterData.image || '👾',
        behavior: monsterData.behavior || 'balanced',
        mana: monsterData.mana || 0,
        reward_xp: monsterData.reward_xp,
        reward_gold: monsterData.reward_gold,
        possible_drops: monsterData.possible_drops || [],
        active_effects: {
          buffs: [],
          debuffs: [],
          dots: [],
          hots: []
        },
        // Atributos primários do banco
        strength: monsterData.strength,
        dexterity: monsterData.dexterity,
        intelligence: monsterData.intelligence,
        wisdom: monsterData.wisdom,
        vitality: monsterData.vitality,
        luck: monsterData.luck,
        // Propriedades de combate avançadas do banco
        critical_chance: monsterData.critical_chance,
        critical_damage: monsterData.critical_damage,
        critical_resistance: monsterData.critical_resistance,
        // Resistências do banco
        physical_resistance: monsterData.physical_resistance,
        magical_resistance: monsterData.magical_resistance,
        debuff_resistance: monsterData.debuff_resistance,
        // Vulnerabilidades do banco
        physical_vulnerability: monsterData.physical_vulnerability,
        magical_vulnerability: monsterData.magical_vulnerability,
        // Características especiais do banco
        primary_trait: monsterData.primary_trait,
        secondary_trait: monsterData.secondary_trait,
        special_abilities: monsterData.special_abilities || []
      };

      console.log(`[GameService] Monstro real gerado: ${enemy.name} (HP: ${enemy.hp}/${enemy.maxHp}, ATK: ${enemy.attack}, DEF: ${enemy.defense})`);
      
      return enemy;
    } catch (error) {
      console.error(`[GameService] Erro ao gerar inimigo para andar ${floor}:`, error);
      return null;
    }
  }

  /**
   * Salvar o progresso do jogo
   * @param gameState Estado atual do jogo
   * @param userId ID do usuário
   * @returns Resultado da operação
   */
  static async saveGameProgress(gameState: GameState, userId: string): Promise<GameResponse> {
    const { player, currentFloor } = gameState;
    
    const progressData: SaveProgressData = {
      user_id: userId,
      player_name: player.name,
      current_floor: player.floor,
      hp: player.hp,
      max_hp: player.max_hp,
      attack: player.atk,
      defense: player.def,
      highest_floor: Math.max(player.floor, currentFloor?.floorNumber || 1)
    };

    try {
      const { data, error } = await supabase
        .from('game_progress')
        .upsert(progressData)
        .select();

      if (error) {
        console.error('Erro ao salvar progresso:', error);
        return {
          success: false,
          error: error.message,
          data: null
        };
      }

      return {
        success: true,
        error: undefined,
        data: data[0] as GameProgressEntry
      };
    } catch (error) {
      console.error('Erro geral ao salvar:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null
      };
    }
  }
  


  /**
   * Carregar o progresso do jogo
   * @param userId ID do usuário
   * @returns Resultado da operação com os dados do progresso
   */
  static async loadGameProgress(userId: string): Promise<GameResponse> {
    try {
      const { data, error } = await supabase
        .from('game_progress')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Erro ao carregar progresso:', error);
        return {
          success: false,
          error: error.message,
          data: null
        };
      }

      return {
        success: true,
        error: undefined,
        data: data[0] as GameProgressEntry || null
      };
    } catch (error) {
      console.error('Erro geral ao carregar:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null
      };
    }
  }

  /**
   * Calcular o dano de ataque
   * @param attackerAttack Valor de ataque do atacante
   * @param defenderDefense Valor de defesa do defensor
   * @returns Valor do dano calculado
   */
  static calculateDamage(attackerAttack: number, defenderDefense: number): number {
    // Garantir que os valores sejam números válidos
    const safeAttack = Number(attackerAttack) || 0;
    const safeDefense = Number(defenderDefense) || 0;
    
    if (safeAttack <= 0) {
      console.warn(`[GameService] Ataque inválido: ${attackerAttack} -> usando 1`);
      return 1;
    }
    
    // Fórmula básica: dano = ataque - (defesa * 0.5)
    // Dano mínimo de 1
    const baseDamage = safeAttack - (safeDefense * 0.5);
    const finalDamage = Math.max(1, Math.floor(baseDamage));
    
    console.log(`[GameService] Cálculo de dano: ATK ${safeAttack} - DEF ${safeDefense} = ${finalDamage}`);
    
    return finalDamage;
  }

  /**
   * Processar ação do jogador
   * @param action Tipo de ação
   * @param gameState Estado atual do jogo
   * @param spellId ID da magia (opcional)
   * @param consumableId ID do consumível (opcional)
   * @returns Novo estado do jogo e resultado da ação
   */
  static async processPlayerAction(
    action: ActionType, 
    gameState: GameState,
    spellId?: string,
    consumableId?: string
  ): Promise<{ 
    newState: GameState;
    skipTurn: boolean;
    message: string;
    skillXpGains?: SkillXpGain[];
    skillMessages?: string[];
  }> {
    const { player, currentEnemy } = gameState;
    let message = '';
    let skipTurn = false;
    const skillXpGains: SkillXpGain[] = [];
    const skillMessages: string[] = [];

    if (!currentEnemy) {
      return {
        newState: gameState,
        skipTurn: true,
        message: 'Nenhum inimigo para atacar!',
        skillXpGains,
        skillMessages
      };
    }

    const newState = { ...gameState };

    // Resetar flag de poção usada no início do turno
    newState.player.potionUsedThisTurn = false;

    switch (action) {
      case 'attack':
        const damage = this.calculateDamage(player.atk, currentEnemy.defense);
        newState.currentEnemy!.hp = Math.max(0, currentEnemy.hp - damage);
        message = `Você atacou ${currentEnemy.name} e causou ${damage} de dano!`;
        
        // Ganhar XP de maestria com espada baseado no dano causado
        const swordXpGain = Math.floor(damage * 0.1); // 10% do dano como XP
        if (swordXpGain > 0) {
          skillXpGains.push({
            skill: SkillType.SWORD_MASTERY,
            xp: swordXpGain,
            reason: 'combat_attack'
          });
          skillMessages.push(`+${swordXpGain} XP de Maestria com Espadas`);
        }
        break;

      case 'defend':
        if (player.defenseCooldown > 0) {
          return {
            newState: gameState,
            skipTurn: true,
            message: `Defesa em cooldown! Aguarde ${player.defenseCooldown} turnos.`,
            skillXpGains,
            skillMessages
          };
        }
        
        newState.player.isDefending = true;
        newState.player.defenseCooldown = 3; // 3 turnos de cooldown
        message = 'Você assume uma postura defensiva!';
        
        // Ganhar XP de maestria de defesa
        const defenseXpGain = 5; // XP fixo por uso da defesa
        skillXpGains.push({
          skill: SkillType.DEFENSE_MASTERY,
          xp: defenseXpGain,
          reason: 'combat_defense'
        });
        break;

      case 'flee':
        const fleeChance = Math.random();
        if (fleeChance > 0.7) {
          // 30% de chance de fugir
          message = `Você conseguiu fugir de ${currentEnemy.name}!`;
          skipTurn = true;
        } else {
          // Falha na fuga, recebe dano
          const fleeDamage = Math.floor(currentEnemy.attack * 0.3);
          newState.player.hp = Math.max(0, player.hp - fleeDamage);
          message = `Você falhou ao tentar fugir e recebeu ${fleeDamage} de dano!`;
        }
        break;

      case 'spell':
        if (!spellId) {
          return {
            newState: gameState,
            skipTurn: true,
            message: 'Nenhuma magia especificada!',
            skillXpGains,
            skillMessages
          };
        }
        
        const spell = player.spells.find(s => s.id === spellId);
        if (!spell) {
          return {
            newState: gameState,
            skipTurn: true,
            message: 'Magia não encontrada!',
            skillXpGains,
            skillMessages
          };
        }
        
        if (player.mana < spell.mana_cost) {
          return {
            newState: gameState,
            skipTurn: true,
            message: 'Mana insuficiente!',
            skillXpGains,
            skillMessages
          };
        }
        
        if (spell.current_cooldown > 0) {
          return {
            newState: gameState,
            skipTurn: true,
            message: `${spell.name} está em cooldown por ${spell.current_cooldown} turnos!`,
            skillXpGains,
            skillMessages
          };
        }
        
        // Consumir mana
        newState.player.mana -= spell.mana_cost;
        
        // Aplicar cooldown
        const spellIndex = newState.player.spells.findIndex(s => s.id === spellId);
        if (spellIndex !== -1) {
          newState.player.spells[spellIndex].current_cooldown = spell.cooldown;
        }
        
        // Aplicar efeito da magia
        const spellResult = SpellService.applySpellEffect(spell, player, currentEnemy);
        message = spellResult.message;
        
        if (!spellResult.success) {
          skipTurn = true;
        }
        
        // Ganhar XP de maestria mágica baseado no custo de mana
        const magicXpGain = Math.floor(spell.mana_cost * 0.2); // 20% do custo de mana como XP
        if (magicXpGain > 0) {
          skillXpGains.push({
            skill: SkillType.MAGIC_MASTERY,
            xp: magicXpGain,
            reason: 'combat_spell'
          });
          skillMessages.push(`+${magicXpGain} XP de Maestria Mágica`);
        }
        break;

      case 'consumable':
        if (!consumableId) {
          return {
            newState: gameState,
            skipTurn: true,
            message: 'Nenhum consumível especificado!',
            skillXpGains,
            skillMessages
          };
        }
        
        // Encontrar o consumível no inventário
        const consumable = player.consumables?.find(c => c.consumable_id === consumableId);
        if (!consumable || consumable.quantity <= 0) {
          return {
            newState: gameState,
            skipTurn: true,
            message: 'Consumível não encontrado ou sem quantidade!',
            skillXpGains,
            skillMessages
          };
        }
        
        // Aplicar efeito do consumível (implementação simplificada)
        // Assumindo que é uma poção de cura por agora
        const healAmount = 50; // Valor fixo por enquanto
        const oldHp = player.hp;
        newState.player.hp = Math.min(player.max_hp, player.hp + healAmount);
        const actualHeal = newState.player.hp - oldHp;
        
        // Reduzir quantidade do consumível
        if (newState.player.consumables) {
          const consumableIndex = newState.player.consumables.findIndex(c => c.consumable_id === consumableId);
          if (consumableIndex !== -1) {
            newState.player.consumables[consumableIndex].quantity -= 1;
            if (newState.player.consumables[consumableIndex].quantity <= 0) {
              newState.player.consumables.splice(consumableIndex, 1);
            }
          }
        }
        
        // Marcar que uma poção foi usada neste turno
        newState.player.potionUsedThisTurn = true;
        
        message = `Você usou ${consumable.consumable?.name || 'Item'} e recuperou ${actualHeal} HP!`;
        break;

      default:
        return {
          newState: gameState,
          skipTurn: true,
          message: 'Ação inválida!',
          skillXpGains,
          skillMessages
        };
    }

    // Reduzir cooldown de defesa se ativo
    if (newState.player.defenseCooldown > 0) {
      newState.player.defenseCooldown--;
    }

    // Processar efeitos ao longo do tempo no jogador
    if (newState.player.active_effects) {
      const playerMessages = SpellService.processOverTimeEffects(newState.player);
      if (playerMessages.length > 0) {
        message += ' ' + playerMessages.join(' ');
      }
    }

    // Resetar defesa após o turno
    newState.player.isDefending = false;

    return {
      newState,
      skipTurn,
      message,
      skillXpGains,
      skillMessages
    };
  }

  /**
   * Obter dados do andar
   * @param floorNumber Número do andar
   * @returns Dados do andar ou null se falhar
   */
  static async getFloorData(floorNumber: number): Promise<Floor | null> {
    console.log(`[GameService] Solicitando dados do andar ${floorNumber}`);
    
    // Verificar cache primeiro
    const now = Date.now();
    const cachedFloor = this.floorCache.get(floorNumber);
    const cacheExpiry = this.floorCacheExpiry.get(floorNumber);
    
    if (cachedFloor && cacheExpiry && now < cacheExpiry) {
      console.log(`[GameService] Dados do andar ${floorNumber} obtidos do cache: ${cachedFloor.description}`);
      return cachedFloor;
    }

    try {
      console.log(`[GameService] Buscando dados do andar ${floorNumber} do servidor`);
      
      const { data, error } = await supabase.rpc('get_floor_data', {
        p_floor_number: floorNumber
      });

      if (error) {
        console.error(`[GameService] Erro na RPC get_floor_data para andar ${floorNumber}:`, error);
        return null;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.error(`[GameService] Nenhum dado encontrado para andar ${floorNumber}`);
        return null;
      }

      // A RPC pode retornar um array, pegar o primeiro elemento
      const floorData = Array.isArray(data) ? data[0] : data;
      
      if (!floorData) {
        console.error(`[GameService] Dados de andar vazios para andar ${floorNumber}`);
        return null;
      }

      // Garantir que a estrutura Floor seja correta
      const floor: Floor = {
        floorNumber: floorData.floor_number || floorNumber,
        type: floorData.type || 'common',
        isCheckpoint: floorData.is_checkpoint || false,
        minLevel: floorData.min_level || 1,
        description: floorData.description || `Andar ${floorNumber}`
      };

      console.log(`[GameService] Dados do andar ${floorNumber} carregados: ${floor.description} (tipo: ${floor.type}, checkpoint: ${floor.isCheckpoint})`);

      // Cache por 10 segundos
      this.floorCache.set(floorNumber, floor);
      this.floorCacheExpiry.set(floorNumber, now + this.FLOOR_CACHE_DURATION);

      return floor;
    } catch (error) {
      console.error(`[GameService] Exceção na função getFloorData para andar ${floorNumber}:`, error);
      return null;
    }
  }

  /**
   * Calcular recompensas baseadas no tipo do andar
   * @param baseXP XP base do monstro
   * @param baseGold Gold base do monstro
   * @param floorType Tipo do andar
   * @returns Recompensas calculadas
   */
  static calculateFloorRewards(baseXP: number, baseGold: number, floorType: FloorType): { xp: number; gold: number } {
    let multiplier = 1;
    
    switch (floorType) {
      case 'boss':
        multiplier = 2.5;
        break;
      case 'elite':
        multiplier = 1.8;
        break;
      case 'event':
        multiplier = 1.2;
        break;
      case 'common':
      default:
        multiplier = 1;
        break;
    }
    
    return {
      xp: Math.floor(baseXP * multiplier),
      gold: Math.floor(baseGold * multiplier)
    };
  }

  /**
   * Processar a derrota do inimigo
   * @param gameState Estado atual do jogo
   * @returns Novo estado do jogo após a derrota do inimigo
   */
  static async processEnemyDefeat(gameState: GameState): Promise<GameState> {
    try {
      console.log('[GameService] Processando derrota do inimigo');
      
      const { player, currentEnemy, currentFloor } = gameState;
      
      if (!currentEnemy || !currentFloor) {
        console.warn('[GameService] Estado inválido para processar derrota do inimigo');
        return gameState;
      }

      // CRÍTICO: Evitar processamento duplicado verificando se já temos recompensas
      if (gameState.battleRewards) {
        console.warn('[GameService] Tentativa de processar derrota de inimigo que já possui recompensas - ignorando');
        return gameState;
      }

      // Calcular recompensas base
      const baseXP = currentEnemy.reward_xp || 10;
      const baseGold = currentEnemy.reward_gold || 5;
      
      // Aplicar multiplicadores baseados no tipo de andar
      const { xp, gold } = this.calculateFloorRewards(baseXP, baseGold, currentFloor.type);
      
      console.log(`[GameService] Recompensas calculadas - XP: ${xp}, Gold: ${gold}`);

      // Verificar se subiu de nível
      const oldLevel = player.level;
      const newXP = player.xp + xp;
      const leveledUp = newXP >= player.xp_next_level;

      // Simular drops (implementação básica)
      const drops: { name: string; quantity: number }[] = [];
      
      // 30% de chance de drop básico
      if (Math.random() < 0.3) {
        drops.push({
          name: "Poção de Vida Menor",
          quantity: 1
        });
      }
      
      // Boss tem chance de drops especiais
      if (currentFloor.type === 'boss' && Math.random() < 0.8) {
        drops.push({
          name: "Item Épico",
          quantity: 1
        });
      }

      // Criar objeto de recompensas ANTES de atualizar o player
      const battleRewards: BattleRewards = {
        xp,
        gold,
        drops,
        leveledUp,
        newLevel: leveledUp ? oldLevel + 1 : undefined
      };

      // Atualizar estado do jogador
      const updatedPlayer: GamePlayer = {
        ...player,
        xp: newXP,
        level: leveledUp ? oldLevel + 1 : oldLevel,
        gold: player.gold + gold
      };

      console.log(`[GameService] Derrota processada - Level: ${updatedPlayer.level}, XP: ${updatedPlayer.xp}, Gold: ${updatedPlayer.gold}`);

      // Retornar estado atualizado com recompensas
      return {
        ...gameState,
        player: updatedPlayer,
        battleRewards,
        currentEnemy: null,
        isPlayerTurn: true,
        gameMessage: `Inimigo derrotado! +${xp} XP, +${gold} Gold${battleRewards.leveledUp ? ` - LEVEL UP!` : ''}`
      };
    } catch (error) {
      console.error('[GameService] Erro ao processar derrota do inimigo:', error);
      
      // Retornar estado com recompensas mínimas em caso de erro
      const { player } = gameState;
      const xp = 10;
      const gold = 5;
      
      return {
        ...gameState,
        player: {
          ...player,
          xp: player.xp + xp,
          gold: player.gold + gold
        },
        battleRewards: {
          xp,
          gold,
          drops: [],
          leveledUp: false
        },
        currentEnemy: null,
        isPlayerTurn: true,
        gameMessage: `Inimigo derrotado! +${xp} XP, +${gold} Gold`
      };
    }
  }

  /**
   * Obter nomes dos drops obtidos
   * @private
   * @param drops Lista de drops obtidos
   * @returns Nomes dos drops formatados
   */
  private static async getDropNames(drops: { drop_id: string; quantity: number }[]): Promise<string[]> {
    if (drops.length === 0) return [];

    try {
      const dropIds = drops.map(d => d.drop_id);
      
      const { data, error } = await supabase
        .from('consumables')
        .select('id, name')
        .in('id', dropIds);

      if (error) {
        console.error('Erro ao buscar nomes dos drops:', error);
        return drops.map(d => `Item ${d.drop_id}`);
      }

      return drops.map(drop => {
        const item = data?.find(d => d.id === drop.drop_id);
        return item?.name || `Item ${drop.drop_id}`;
      });
    } catch (error) {
      console.error('Erro ao processar drops:', error);
      return drops.map(d => `Item ${d.drop_id}`);
    }
  }

  /**
   * Processar ação do inimigo
   * @param gameState Estado atual do jogo
   * @param playerDefendAction Indica se o jogador usou a ação de defesa (DEPRECATED)
   * @returns Novo estado do jogo após a ação do inimigo
   */
  static async processEnemyAction(gameState: GameState, playerDefendAction: boolean): Promise<{
    newState: GameState;
    skillXpGains?: SkillXpGain[];
    skillMessages?: string[];
  }> {
    if (!gameState.currentEnemy || gameState.currentEnemy.hp <= 0) {
      return { newState: { ...gameState, isPlayerTurn: true } };
    }

    const enemy = gameState.currentEnemy;
    const player = gameState.player;
    const skillXpGains: SkillXpGain[] = [];
    
    // Processar efeitos contínuos no inimigo (DoTs, buffs, etc.)
    SpellService.processOverTimeEffects(enemy);
    
    // Se o inimigo morreu por efeitos ao longo do tempo
    if (enemy.hp <= 0) {
      return {
        newState: {
          ...gameState,
          isPlayerTurn: true,
          gameMessage: `${enemy.name} foi derrotado por efeitos ao longo do tempo!`
        }
      };
    }

    // Determinar ação do inimigo
    let actionType: 'attack' | 'spell' | 'special' = 'attack';
    
    // IA básica do inimigo
    if (enemy.mana >= 10 && Math.random() < 0.3) {
      actionType = 'spell';
    } else if (Math.random() < 0.1) {
      actionType = 'special';
    }

    let message = '';
    let damage = 0;
    let actualDamage = 0;

    switch (actionType) {
      case 'attack':
        damage = this.calculateDamage(enemy.attack, player.def);
        
        // Aplicar resistência de defesa se jogador está defendendo
        if (player.isDefending || playerDefendAction) {
          actualDamage = Math.floor(damage * 0.15); // 85% de redução
          message = `${enemy.name} atacou, mas você reduziu o dano de ${damage} para ${actualDamage} com sua defesa!`;
          
          // NOVO: XP de defesa extra por bloquear efetivamente
          try {
            const equipmentSlotsResponse = await EquipmentService.getEquippedSlots(player.id);
            const equipmentSlots = equipmentSlotsResponse || null;
            const blockedDamage = damage - actualDamage;
            
            const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(equipmentSlots, blockedDamage);
            skillXpGains.push(...defenseSkillXp);
          } catch (error) {
            console.warn('[processEnemyAction] Erro ao calcular XP de defesa:', error);
          }
        } else {
          actualDamage = damage;
          message = `${enemy.name} atacou e causou ${actualDamage} de dano!`;
          
          // NOVO: XP de defesa menor por receber ataque (experiência passiva)
          try {
            const equipmentSlotsResponse = await EquipmentService.getEquippedSlots(player.id);
            const equipmentSlots = equipmentSlotsResponse || null;
            
            // XP reduzido por ser um ataque não bloqueado
            const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(equipmentSlots, Math.floor(actualDamage * 0.3));
            skillXpGains.push(...defenseSkillXp);
          } catch (error) {
            console.warn('[processEnemyAction] Erro ao calcular XP de defesa passiva:', error);
          }
        }
        
        // Aplicar dano
        const newHp = Math.max(0, player.hp - actualDamage);
        
        // CRÍTICO: Verificar se o jogador morreu e processar permadeath
        if (newHp <= 0) {
          console.log(`[GameService] Jogador ${player.name} morreu - iniciando processo de permadeath`);
          
          try {
            // Matar o personagem permanentemente
            const deathResult = await CemeteryService.killCharacter(
              player.id,
              'Battle defeat',
              enemy.name
            );
            
            if (deathResult.success) {
              console.log(`[GameService] Personagem ${player.name} movido para o cemitério com sucesso`);
              
              return {
                newState: {
                  ...gameState,
                  player: {
                    ...player,
                    hp: 0,
                    isDefending: false
                  },
                  mode: 'gameover',
                  isPlayerTurn: true,
                  gameMessage: `${message} Você foi derrotado! Seu personagem foi perdido permanentemente.`,
                  characterDeleted: true // Flag para indicar que o personagem foi deletado
                }
              };
            } else {
              console.error(`[GameService] Erro ao mover personagem para cemitério:`, deathResult.error);
              // Em caso de erro, ainda processar como morte mas sem deletar
              return {
                newState: {
                  ...gameState,
                  player: {
                    ...player,
                    hp: 0,
                    isDefending: false
                  },
                  mode: 'gameover',
                  isPlayerTurn: true,
                  gameMessage: `${message} Você foi derrotado!`
                }
              };
            }
          } catch (error) {
            console.error(`[GameService] Erro crítico ao processar morte:`, error);
            // Fallback em caso de erro crítico
            return {
              newState: {
                ...gameState,
                player: {
                  ...player,
                  hp: 0,
                  isDefending: false
                },
                mode: 'gameover',
                isPlayerTurn: true,
                gameMessage: `${message} Você foi derrotado!`
              }
            };
          }
        }
        
        const resultState = {
          ...gameState,
          player: {
            ...player,
            hp: newHp,
            isDefending: false, // Remover estado de defesa após ser atacado
            potionUsedThisTurn: false // Resetar flag de poção quando o turno retorna ao jogador
          },
          isPlayerTurn: true,
          gameMessage: message
        };

        // Gerar mensagens de habilidade
        const skillMessages = skillXpGains.length > 0 
          ? skillXpGains.map(gain => `+${gain.xp} XP em ${SkillXpService.getSkillDisplayName(gain.skill)}`)
          : undefined;

        return { newState: resultState, skillXpGains, skillMessages };

      case 'spell':
        // Inimigo usa magia
        const spellDamage = Math.floor(enemy.attack * 1.2);
        const spellCost = 10;
        
        // Aplicar resistência de defesa se jogador está defendendo
        if (player.isDefending || playerDefendAction) {
          actualDamage = Math.floor(spellDamage * 0.15);
          message = `${enemy.name} lançou uma magia, mas você reduziu o dano de ${spellDamage} para ${actualDamage} com sua defesa!`;
          
          // XP de defesa por bloquear magia (menor que físico)
          try {
            const equipmentSlotsResponse = await EquipmentService.getEquippedSlots(player.id);
            const equipmentSlots = equipmentSlotsResponse || null;
            const blockedDamage = Math.floor((spellDamage - actualDamage) * 0.5); // Menor XP para defesa mágica
            
            const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(equipmentSlots, blockedDamage);
            skillXpGains.push(...defenseSkillXp);
          } catch (error) {
            console.warn('[processEnemyAction] Erro ao calcular XP de defesa mágica:', error);
          }
        } else {
          actualDamage = spellDamage;
          message = `${enemy.name} lançou uma magia e causou ${actualDamage} de dano mágico!`;
        }
        
        const newSpellHp = Math.max(0, player.hp - actualDamage);
        
        // CRÍTICO: Verificar se o jogador morreu e processar permadeath
        if (newSpellHp <= 0) {
          console.log(`[GameService] Jogador ${player.name} morreu por magia - iniciando processo de permadeath`);
          
          try {
            // Matar o personagem permanentemente
            const deathResult = await CemeteryService.killCharacter(
              player.id,
              'Battle defeat',
              enemy.name
            );
            
            if (deathResult.success) {
              console.log(`[GameService] Personagem ${player.name} movido para o cemitério com sucesso`);
              
              return {
                newState: {
                  ...gameState,
                  player: {
                    ...player,
                    hp: 0,
                    isDefending: false
                  },
                  currentEnemy: {
                    ...enemy,
                    mana: Math.max(0, enemy.mana - spellCost)
          },
                  mode: 'gameover',
                  isPlayerTurn: true,
                  gameMessage: `${message} Você foi derrotado! Seu personagem foi perdido permanentemente.`,
                  characterDeleted: true // Flag para indicar que o personagem foi deletado
                }
              };
            } else {
              console.error(`[GameService] Erro ao mover personagem para cemitério:`, deathResult.error);
              // Em caso de erro, ainda processar como morte mas sem deletar
              return {
                newState: {
                  ...gameState,
                  player: {
                    ...player,
                    hp: 0,
                    isDefending: false
                  },
                  currentEnemy: {
                    ...enemy,
                    mana: Math.max(0, enemy.mana - spellCost)
                  },
                  mode: 'gameover',
                  isPlayerTurn: true,
                  gameMessage: `${message} Você foi derrotado!`
                }
              };
            }
          } catch (error) {
            console.error(`[GameService] Erro crítico ao processar morte por magia:`, error);
            // Fallback em caso de erro crítico
            return {
              newState: {
                ...gameState,
                player: {
                  ...player,
                  hp: 0,
                  isDefending: false
                },
                currentEnemy: {
                  ...enemy,
                  mana: Math.max(0, enemy.mana - spellCost)
                },
                mode: 'gameover',
                isPlayerTurn: true,
                gameMessage: `${message} Você foi derrotado!`
              }
            };
          }
        }
        
        const spellResultState = {
          ...gameState,
          player: {
            ...player,
            hp: newSpellHp,
            isDefending: false,
            potionUsedThisTurn: false // Resetar flag de poção quando o turno retorna ao jogador
          },
          currentEnemy: {
            ...enemy,
            mana: Math.max(0, enemy.mana - spellCost)
          },
          isPlayerTurn: true,
          gameMessage: message
        };

        const spellSkillMessages = skillXpGains.length > 0 
          ? skillXpGains.map(gain => `+${gain.xp} XP em ${SkillXpService.getSkillDisplayName(gain.skill)}`)
          : undefined;

        return { newState: spellResultState, skillXpGains, skillMessages: spellSkillMessages };

      case 'special':
        // Habilidade especial baseada no comportamento
        switch (enemy.behavior) {
          case 'aggressive':
            damage = Math.floor(enemy.attack * 1.5);
            actualDamage = player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
            message = `${enemy.name} usou Ataque Furioso e causou ${actualDamage} de dano!`;
            break;
          case 'defensive':
            // Inimigo se cura
            const healAmount = Math.floor(enemy.maxHp * 0.15);
            const newEnemyHp = Math.min(enemy.maxHp, enemy.hp + healAmount);
            return {
              newState: {
                ...gameState,
                player: {
                  ...player,
                  potionUsedThisTurn: false // Resetar flag de poção quando o turno retorna ao jogador
                },
                currentEnemy: {
                  ...enemy,
                  hp: newEnemyHp
                },
                isPlayerTurn: true,
                gameMessage: `${enemy.name} se concentrou e recuperou ${healAmount} HP!`
              }
            };
          default:
            damage = Math.floor(enemy.attack * 1.3);
            actualDamage = player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
            message = `${enemy.name} usou uma habilidade especial e causou ${actualDamage} de dano!`;
        }
        
        // XP de defesa por receber habilidade especial
        if (actualDamage > 0) {
          try {
            const equipmentSlotsResponse = await EquipmentService.getEquippedSlots(player.id);
            const equipmentSlots = equipmentSlotsResponse || null;
            
            if (player.isDefending || playerDefendAction) {
              const blockedDamage = damage - actualDamage;
              const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(equipmentSlots, blockedDamage);
              skillXpGains.push(...defenseSkillXp);
            } else {
              // XP passivo reduzido
              const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(equipmentSlots, Math.floor(actualDamage * 0.2));
              skillXpGains.push(...defenseSkillXp);
            }
          } catch (error) {
            console.warn('[processEnemyAction] Erro ao calcular XP de defesa especial:', error);
          }
        }
        
        const newSpecialHp = Math.max(0, player.hp - actualDamage);
        
        // CRÍTICO: Verificar se o jogador morreu e processar permadeath
        if (newSpecialHp <= 0) {
          console.log(`[GameService] Jogador ${player.name} morreu por habilidade especial - iniciando processo de permadeath`);
          
          try {
            // Matar o personagem permanentemente
            const deathResult = await CemeteryService.killCharacter(
              player.id,
              'Battle defeat',
              enemy.name
            );
            
            if (deathResult.success) {
              console.log(`[GameService] Personagem ${player.name} movido para o cemitério com sucesso`);
              
              return {
                newState: {
                  ...gameState,
                  player: {
                    ...player,
                    hp: 0,
                    isDefending: false
                  },
                  mode: 'gameover',
                  isPlayerTurn: true,
                  gameMessage: `${message} Você foi derrotado! Seu personagem foi perdido permanentemente.`,
                  characterDeleted: true // Flag para indicar que o personagem foi deletado
                }
              };
            } else {
              console.error(`[GameService] Erro ao mover personagem para cemitério:`, deathResult.error);
              // Em caso de erro, ainda processar como morte mas sem deletar
              return {
                newState: {
                  ...gameState,
                  player: {
                    ...player,
                    hp: 0,
                    isDefending: false
                  },
                  mode: 'gameover',
                  isPlayerTurn: true,
                  gameMessage: `${message} Você foi derrotado!`
                }
              };
            }
          } catch (error) {
            console.error(`[GameService] Erro crítico ao processar morte por habilidade especial:`, error);
            // Fallback em caso de erro crítico
            return {
              newState: {
                ...gameState,
                player: {
                  ...player,
                  hp: 0,
                  isDefending: false
                },
                mode: 'gameover',
                isPlayerTurn: true,
                gameMessage: `${message} Você foi derrotado!`
              }
            };
          }
        }
        
        const specialResultState = {
          ...gameState,
          player: {
            ...player,
            hp: newSpecialHp,
            isDefending: false,
            potionUsedThisTurn: false // Resetar flag de poção quando o turno retorna ao jogador
          },
          isPlayerTurn: true,
          gameMessage: message
        };

        const specialSkillMessages = skillXpGains.length > 0 
          ? skillXpGains.map(gain => `+${gain.xp} XP em ${SkillXpService.getSkillDisplayName(gain.skill)}`)
          : undefined;

        return { newState: specialResultState, skillXpGains, skillMessages: specialSkillMessages };

      default:
        return { 
          newState: { 
            ...gameState, 
            player: {
              ...gameState.player,
              potionUsedThisTurn: false // Resetar flag de poção quando o turno retorna ao jogador
            },
            isPlayerTurn: true
          }
        };
    }
  }

  /**
   * Avançar para o próximo andar após coletar recompensas
   * @param gameState Estado atual do jogo
   * @returns Novo estado com o próximo andar
   */
  static async advanceToNextFloor(gameState: GameState): Promise<GameState> {
    const { player } = gameState;
    const nextFloor = player.floor + 1;
    
    console.log(`[GameService] Avançando do andar ${player.floor} para ${nextFloor}`);

    try {
      // Limpar todos os caches antes de começar
      console.log(`[GameService] === LIMPANDO CACHES ANTES DE AVANÇAR ===`);
      this.clearAllCaches();
      MonsterService.clearCache();
      console.log(`[GameService] === CACHES LIMPOS ===`);

      // Atualizar andar no banco de dados ANTES de gerar novos dados
      console.log(`[GameService] === ATUALIZANDO ANDAR NO BANCO ===`);
      console.log(`[GameService] Personagem: ${player.id}`);
      console.log(`[GameService] Andar atual: ${player.floor} -> Próximo andar: ${nextFloor}`);
      
      const updateResult = await CharacterService.updateCharacterFloor(player.id, nextFloor);
      if (!updateResult.success) {
        console.error(`[GameService] ERRO ao atualizar andar:`, updateResult.error);
        throw new Error(updateResult.error || 'Erro ao atualizar andar do personagem');
      }
      console.log(`[GameService] === ANDAR ATUALIZADO NO BANCO: ${nextFloor} ===`);

      // Obter dados do próximo andar
      console.log(`[GameService] Carregando dados do andar ${nextFloor}...`);
      const nextFloorData = await this.getFloorData(nextFloor);
      if (!nextFloorData) {
        throw new Error(`Erro ao gerar dados do andar ${nextFloor}`);
      }

      console.log(`[GameService] Dados do andar ${nextFloor} carregados:`, nextFloorData.description);

      // Gerar novo inimigo para o próximo andar
      console.log(`[GameService] === GERANDO INIMIGO PARA ANDAR ${nextFloor} ===`);
      console.log(`[GameService] Chamando MonsterService.getMonsterForFloor(${nextFloor})...`);
      
      const nextEnemy = await this.generateEnemy(nextFloor);
      
      // CRÍTICO: Se não conseguir gerar inimigo, algo está errado
      if (!nextEnemy) {
        console.error(`[GameService] === FALHA AO GERAR INIMIGO ===`);
        console.error(`[GameService] Andar solicitado: ${nextFloor}`);
        console.error(`[GameService] generateEnemy retornou: null`);
        throw new Error(`Falha ao gerar inimigo para o andar ${nextFloor} - verifique se há monstros no banco para este andar`);
      }

      console.log(`[GameService] === INIMIGO GERADO COM SUCESSO ===`);
      console.log(`[GameService] Andar: ${nextFloor}`);
      console.log(`[GameService] Inimigo: ${nextEnemy.name} (HP: ${nextEnemy.hp}/${nextEnemy.maxHp}, ATK: ${nextEnemy.attack}, DEF: ${nextEnemy.defense})`);
      console.log(`[GameService] ID do inimigo: ${nextEnemy.id}`);

      // Verificar se há evento especial (reduzido para 5% para evitar problemas)
      let specialEvent = null;
      const specialEventChance = Math.random();
      
      if (specialEventChance < 0.05) { // 5% de chance
        try {
          console.log(`[GameService] Tentando gerar evento especial para andar ${nextFloor}...`);
          const { data: eventData, error: eventError } = await supabase
            .rpc('get_special_event_for_floor', {
              p_floor: nextFloor
            });

          if (!eventError && eventData) {
            specialEvent = eventData;
            console.log(`[GameService] Evento especial gerado para andar ${nextFloor}:`, specialEvent.name);
          }
        } catch (error) {
          console.error('[GameService] Erro ao gerar evento especial (ignorando):', error);
          // Continuar sem evento especial em caso de erro
        }
      }

      // Construir novo estado com dados validados
      const newGameState: GameState = {
        ...gameState,
        mode: specialEvent ? 'special_event' : 'battle',
        player: {
          ...player,
          floor: nextFloor,
          isPlayerTurn: true,
          isDefending: false,
          potionUsedThisTurn: false,
          defenseCooldown: Math.max(0, (player.defenseCooldown || 0) - 1) // Reduzir cooldown
        },
        currentFloor: nextFloorData,
        currentEnemy: specialEvent ? null : nextEnemy,
        currentSpecialEvent: specialEvent,
        gameMessage: specialEvent 
          ? `Evento especial encontrado: ${specialEvent.name}!`
          : `Andar ${nextFloor}: ${nextFloorData.description}. Um ${nextEnemy.name} apareceu!`,
        isPlayerTurn: true,
        battleRewards: null, // CRÍTICO: Sempre limpar recompensas de batalha
        selectedSpell: null, // Limpar spell selecionado ao avançar
        highestFloor: Math.max(gameState.highestFloor || 0, nextFloor)
      };

      console.log(`[GameService] Estado do jogo atualizado para andar ${nextFloor} com sucesso`);
      console.log(`[GameService] - Modo: ${newGameState.mode}`);
      console.log(`[GameService] - Andar: ${newGameState.currentFloor?.description}`);
      console.log(`[GameService] - Inimigo: ${newGameState.currentEnemy?.name || 'N/A'}`);
      console.log(`[GameService] - Evento: ${newGameState.currentSpecialEvent?.name || 'N/A'}`);
      
      return newGameState;

    } catch (error) {
      console.error(`[GameService] Erro crítico ao avançar para andar ${nextFloor}:`, error);
      
      // FALLBACK: Tentar gerar estado mínimo funcional
      console.log(`[GameService] Tentando criar estado de fallback para andar ${nextFloor}...`);
      
      try {
        const fallbackEnemy = await this.generateEnemy(nextFloor);
        
        if (!fallbackEnemy) {
          throw new Error(`Não foi possível gerar inimigo para o andar ${nextFloor}`);
        }
        
        const fallbackFloor = {
          floorNumber: nextFloor,
          type: 'common' as FloorType,
          isCheckpoint: nextFloor % 10 === 0,
          minLevel: Math.max(1, Math.floor(nextFloor / 5)),
          description: `Andar ${nextFloor} - Área Desconhecida`
        };
        
        console.log(`[GameService] Estado de fallback criado para andar ${nextFloor}`);
        
        return {
          ...gameState,
          player: {
            ...player,
            floor: nextFloor,
            isPlayerTurn: true,
            isDefending: false,
            potionUsedThisTurn: false
          },
          currentFloor: fallbackFloor,
          currentEnemy: fallbackEnemy,
          currentSpecialEvent: null,
          gameMessage: `Andar ${nextFloor}: ${fallbackFloor.description}. Um ${fallbackEnemy.name} apareceu!`,
          isPlayerTurn: true,
          battleRewards: null,
          mode: 'battle',
          selectedSpell: null
        };
      } catch (fallbackError) {
        console.error(`[GameService] Falha ao criar estado de fallback:`, fallbackError);
        
        // Último recurso: retornar estado de erro
        return {
          ...gameState,
          gameMessage: `Erro crítico ao avançar para o andar ${nextFloor}: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Retorne ao hub e tente novamente.`
        };
      }
    }
  }

  /**
   * Processar interação com evento especial
   * @param gameState Estado atual do jogo
   * @param characterId ID do personagem
   * @returns Novo estado do jogo após processar o evento
   */
  static async processSpecialEventInteraction(
    gameState: GameState,
  ): Promise<GameState> {
    const { currentSpecialEvent, player } = gameState;
    
    if (!currentSpecialEvent) {
      return gameState;
    }

    console.log(`[GameService] Processando evento especial: ${currentSpecialEvent.name}`);

    // Aplicar efeitos do evento
    let newHp = player.hp;
    let newMana = player.mana;
    let newGold = player.gold;
    let message = '';

    switch (currentSpecialEvent.type) {
      case 'magic_fountain':
        newHp = player.max_hp;
        newMana = player.max_mana;
        message = `Você encontrou uma fonte mágica! HP e Mana foram restaurados completamente.`;
        break;
        
      case 'treasure_chest':
        const goldGain = Math.floor(Math.random() * 50) + 25; // 25-75 gold
        newGold += goldGain;
        message = `Você encontrou um baú do tesouro! Ganhou ${goldGain} de ouro.`;
        break;
        
      case 'bonfire':
        const hpRestore = Math.floor(player.max_hp * 0.5); // Restaura 50% do HP
        newHp = Math.min(player.max_hp, player.hp + hpRestore);
        message = `Você descansou numa fogueira acolhedora! Recuperou ${hpRestore} HP.`;
        break;
        
      default:
        message = `Você explorou o evento ${currentSpecialEvent.name}.`;
    }

    return {
      ...gameState,
      player: {
        ...player,
        hp: newHp,
        mana: newMana,
        gold: newGold
      },
      gameMessage: message,
      currentSpecialEvent: null, // Remove o evento após interação
      mode: 'battle' // Volta para modo de batalha
    };
  }

  /**
   * Carregar personagem com todos os dados necessários para o jogo
   */
  static async loadPlayerForGame(characterId: string): Promise<GamePlayer> {
    try {
      // Usar o novo método que retorna stats detalhados com bônus de equipamentos
      const characterResponse = await CharacterService.getCharacterForGame(characterId);
      
      if (!characterResponse.success || !characterResponse.data) {
        throw new Error(characterResponse.error || 'Personagem não encontrado');
      }

      const character = characterResponse.data;

      // Carregar magias do personagem
      const { data: spells } = await supabase
        .from('character_spells')
        .select(`
          spell_id,
          current_cooldown,
          spell:spells(
            id,
            name,
            description,
            mana_cost,
            cooldown,
            effect_type,
            effect_value,
            target_type,
            element,
            unlocked_at_level
          )
        `)
        .eq('character_id', characterId);

      // Converter para PlayerSpell[]
      const playerSpells: PlayerSpell[] = (spells || []).map((cs: CharacterSpell) => ({
        id: cs.spell[0].id,
        name: cs.spell[0].name,
        description: cs.spell[0].description,
        mana_cost: cs.spell[0].mana_cost,
        cooldown: cs.spell[0].cooldown,
        current_cooldown: cs.current_cooldown,
        effect_type: cs.spell[0].effect_type as SpellEffectType,
        effect_value: cs.spell[0].effect_value,
        duration: 0,
        unlocked_at_level: cs.spell[0].unlocked_at_level || 1
      }));

      // Carregar consumíveis (se necessário)
      const consumablesResponse = await ConsumableService.getCharacterConsumables(characterId);
      const consumables = consumablesResponse.success ? consumablesResponse.data || [] : [];

      // Retornar GamePlayer completo com todos os dados
      return {
        ...character,
        spells: playerSpells,
        consumables,
        active_effects: {
          buffs: [],
          debuffs: [],
          dots: [],
          hots: []
        }
      };
    } catch (error) {
      console.error('Erro ao carregar personagem para o jogo:', error);
      throw error;
    }
  }
} 