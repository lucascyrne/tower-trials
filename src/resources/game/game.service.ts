'use client';

import { ActionType, Enemy, GameResponse, GameState, GamePlayer, Floor, FloorType, BattleRewards } from './game-model';
import type { InitiativeData, SpeedComparison } from './models/game-battle.model';
import { MonsterService } from './monster.service';
import { SpellService } from './spell.service';
import { ConsumableService } from './consumable.service';
import { CharacterService } from './character.service';
import { SkillXpGain, SkillXpService } from './skill-xp.service';
import { supabase } from '@/lib/supabase';
import { CemeteryService } from './cemetery.service';
import { EquipmentService } from './equipment.service';
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
          hots: [],
          attribute_modifications: []
        },
        // Campos do sistema cíclico
        tier: monsterData.tier,
        base_tier: monsterData.base_tier,
        cycle_position: monsterData.cycle_position,
        is_boss: monsterData.is_boss,
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

      console.log(`[GameService] Monstro real gerado: ${enemy.name} (Tier ${enemy.tier || 1}, Pos ${enemy.cycle_position || 'N/A'})`);
      console.log(`[GameService] Stats: HP: ${enemy.hp}/${enemy.maxHp}, ATK: ${enemy.attack}, DEF: ${enemy.defense}, Boss: ${enemy.is_boss ? 'SIM' : 'NÃO'}`);
      
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

  // =====================================
  // SISTEMA DE INICIATIVA E VELOCIDADE
  // =====================================

  /**
   * Calcular iniciativa baseada em velocidade e destreza
   */
  static calculateInitiative(speed: number, dexterity: number): number {
    // Base da iniciativa é a velocidade
    const baseInitiative = speed;
    
    // Bônus de destreza (cada ponto de dex = +0.5 iniciativa)
    const dexBonus = Math.floor(dexterity * 0.5);
    
    // Adicionar elemento aleatório (±10%)
    const randomFactor = 0.9 + (Math.random() * 0.2);
    const finalInitiative = Math.floor((baseInitiative + dexBonus) * randomFactor);
    
    return Math.max(1, finalInitiative);
  }

  /**
   * Calcular quantos turnos extras baseado na diferença de velocidade
   */
  static calculateExtraTurns(attackerSpeed: number, defenderSpeed: number): number {
    // Evitar divisão por zero
    if (defenderSpeed <= 0) return 2;
    
    // Calcular diferença percentual de velocidade
    const speedDifference = attackerSpeed / defenderSpeed;
    
    let extraTurns = 0;
    
    // Sistema de turnos extras baseado em diferença:
    // 1.8x+ velocidade = 1 turno extra
    // 2.5x+ velocidade = 2 turnos extras  
    // 3.5x+ velocidade = 3 turnos extras (máximo)
    if (speedDifference >= 3.5) {
      extraTurns = 3;
    } else if (speedDifference >= 2.5) {
      extraTurns = 2;
    } else if (speedDifference >= 1.8) {
      extraTurns = 1;
    }
    
    // Adicionar pequeno elemento aleatório (20% chance de +1 turno extra)
    if (extraTurns < 3 && Math.random() < 0.2) {
      extraTurns += 1;
    }
    
    return Math.min(extraTurns, 3); // Máximo de 3 turnos extras
  }

  /**
   * Comparar velocidades e determinar vantagens
   */
  static compareSpeed(playerSpeed: number, enemySpeed: number): SpeedComparison {
    const speedDifference = playerSpeed / enemySpeed;
    const playerAdvantage = playerSpeed > enemySpeed;
    const extraTurns = playerAdvantage ? 
      this.calculateExtraTurns(playerSpeed, enemySpeed) : 
      this.calculateExtraTurns(enemySpeed, playerSpeed);
    
    let description = '';
    if (speedDifference >= 3.5 || (1/speedDifference) >= 3.5) {
      description = playerAdvantage ? 
        'Sua velocidade é dominante! Você pode agir múltiplas vezes!' :
        'O inimigo é extremamente rápido! Cuidado com ataques consecutivos!';
    } else if (speedDifference >= 2.5 || (1/speedDifference) >= 2.5) {
      description = playerAdvantage ?
        'Você tem grande vantagem de velocidade!' :
        'O inimigo tem grande vantagem de velocidade!';
    } else if (speedDifference >= 1.8 || (1/speedDifference) >= 1.8) {
      description = playerAdvantage ?
        'Você é mais rápido e pode agir primeiro!' :
        'O inimigo é mais rápido!';
    } else {
      description = 'Velocidades similares. A iniciativa será disputada!';
    }

    return {
      playerSpeed,
      enemySpeed,
      speedDifference,
      playerAdvantage,
      extraTurns,
      description
    };
  }

  /**
   * Calcular ordem de turnos baseada em iniciativa
   */
  static calculateTurnOrder(
    playerSpeed: number, 
    playerDex: number, 
    enemySpeed: number, 
    enemyDex: number
  ): InitiativeData {
    const playerInitiative = this.calculateInitiative(playerSpeed, playerDex);
    const enemyInitiative = this.calculateInitiative(enemySpeed, enemyDex);
    
    const playerFirst = playerInitiative >= enemyInitiative;
    const firstActor = playerFirst ? 'player' : 'enemy';
    
    // Calcular turnos extras para quem tem vantagem de velocidade
    let playerExtraTurns = 0;
    let enemyExtraTurns = 0;
    
    if (playerFirst && playerSpeed > enemySpeed) {
      playerExtraTurns = this.calculateExtraTurns(playerSpeed, enemySpeed);
    } else if (!playerFirst && enemySpeed > playerSpeed) {
      enemyExtraTurns = this.calculateExtraTurns(enemySpeed, playerSpeed);
    }
    
    // Construir ordem de turnos
    const turnOrder: ('player' | 'enemy')[] = [];
    
    if (playerFirst) {
      turnOrder.push('player');
      for (let i = 0; i < playerExtraTurns; i++) {
        turnOrder.push('player');
      }
      if (enemyExtraTurns === 0) {
        turnOrder.push('enemy');
      }
    } else {
      turnOrder.push('enemy');
      for (let i = 0; i < enemyExtraTurns; i++) {
        turnOrder.push('enemy');
      }
      if (playerExtraTurns === 0) {
        turnOrder.push('player');
      }
    }
    
    return {
      playerInitiative,
      enemyInitiative,
      playerSpeed,
      enemySpeed,
      playerExtraTurns,
      enemyExtraTurns,
      currentTurn: firstActor,
      turnOrder,
      turnIndex: 0
    };
  }

  /**
   * Avançar para o próximo turno na ordem
   */
  static advanceTurnOrder(initiative: InitiativeData): InitiativeData {
    const nextIndex = (initiative.turnIndex + 1) % initiative.turnOrder.length;
    const nextTurn = initiative.turnOrder[nextIndex];
    
    return {
      ...initiative,
      currentTurn: nextTurn,
      turnIndex: nextIndex
    };
  }

  /**
   * Calcular o dano de ataque com críticos e duplo ataque
   * @param attackerAttack Valor de ataque do atacante
   * @param defenderDefense Valor de defesa do defensor
   * @param criticalChance Chance de crítico (0-100)
   * @param criticalDamage Multiplicador de dano crítico (110% = 1.1)
   * @param doubleAttackChance Chance de duplo ataque (0-100)
   * @returns Objeto com informações do dano
   */
  static calculateDamage(
    attackerAttack: number, 
    defenderDefense: number,
    criticalChance: number = 0,
    criticalDamage: number = 110,
    doubleAttackChance: number = 0
  ): {
    damage: number;
    isCritical: boolean;
    isDoubleAttack: boolean;
    totalAttacks: number;
    damageBreakdown: string;
  } {
    // Garantir que os valores sejam números válidos
    const safeAttack = Number(attackerAttack) || 0;
    const safeDefense = Number(defenderDefense) || 0;
    
    if (safeAttack <= 0) {
      console.warn(`[GameService] Ataque inválido: ${attackerAttack} -> usando 1`);
      return {
        damage: 1,
        isCritical: false,
        isDoubleAttack: false,
        totalAttacks: 1,
        damageBreakdown: 'Dano mínimo: 1'
      };
    }
    
    // Fórmula básica: dano = ataque - (defesa * 0.5)
    const baseDamage = Math.max(1, Math.floor(safeAttack - (safeDefense * 0.5)));
    
    // Verificar crítico
    const critRoll = Math.random() * 100;
    const isCritical = critRoll < criticalChance;
    
    // Verificar duplo ataque
    const doubleRoll = Math.random() * 100;
    const isDoubleAttack = doubleRoll < doubleAttackChance;
    
    // Calcular dano final
    let finalDamage = baseDamage;
    let damageBreakdown = `Base: ${baseDamage}`;
    
    // Aplicar crítico
    if (isCritical) {
      const critMultiplier = criticalDamage / 100;
      finalDamage = Math.floor(finalDamage * critMultiplier);
      damageBreakdown += ` → Crítico (${criticalDamage}%): ${finalDamage}`;
    }
    
    // Aplicar duplo ataque
    let totalAttacks = 1;
    if (isDoubleAttack) {
      finalDamage = finalDamage * 2;
      totalAttacks = 2;
      damageBreakdown += ` → Duplo Ataque: ${finalDamage}`;
    }
    
    console.log(`[GameService] Cálculo avançado: ATK ${safeAttack} vs DEF ${safeDefense} | ${damageBreakdown}`);
    
    return {
      damage: finalDamage,
      isCritical,
      isDoubleAttack,
      totalAttacks,
      damageBreakdown
    };
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
    gameLogMessages?: { message: string; type: 'player_action' | 'damage' | 'system' }[];
  }> {
    const { player, currentEnemy } = gameState;
    let message = '';
    let skipTurn = false;
    const skillXpGains: SkillXpGain[] = [];
    const skillMessages: string[] = [];
    const gameLogMessages: { message: string; type: 'player_action' | 'damage' | 'system' }[] = [];

    if (!currentEnemy) {
      return {
        newState: gameState,
        skipTurn: true,
        message: 'Nenhum inimigo para atacar!',
        skillXpGains,
        skillMessages,
        gameLogMessages
      };
    }

    let newState = { ...gameState };

    // Resetar flag de poção usada no início do turno
    newState.player.potionUsedThisTurn = false;

    switch (action) {
      case 'attack':
        const damageResult = this.calculateDamage(
          player.atk, 
          currentEnemy.defense,
          player.critical_chance || 0,
          player.critical_damage || 110,
          0 // Duplo ataque não se aplica a ataques manuais por enquanto
        );
        
        newState.currentEnemy!.hp = Math.max(0, currentEnemy.hp - damageResult.damage);
        
        // Mensagem detalhada baseada no tipo de ataque
        let attackMessage = `Você atacou ${currentEnemy.name}`;
        if (damageResult.isCritical) {
          attackMessage += ` com um golpe crítico`;
        }
        if (damageResult.isDoubleAttack) {
          attackMessage += ` ${damageResult.totalAttacks}x`;
        }
        attackMessage += ` e causou ${damageResult.damage} de dano!`;
        
        message = attackMessage;
        
        // Adicionar mensagens ao log de jogo
        gameLogMessages.push({
          message: `${player.name} ataca ${currentEnemy.name}!`,
          type: 'player_action'
        });
        
        let damageLogMessage = `${player.name} causou ${damageResult.damage} de dano`;
        if (damageResult.isCritical) damageLogMessage += ' (CRÍTICO)';
        if (damageResult.isDoubleAttack) damageLogMessage += ' (DUPLO ATAQUE)';
        damageLogMessage += ` em ${currentEnemy.name}`;
        
        gameLogMessages.push({
          message: damageLogMessage,
          type: 'damage'
        });
        
        // CRÍTICO: Usar o SkillXpService para calcular XP de ataque
        try {
          // Por enquanto usar null para equipmentSlots - o SkillXpService irá usar fallback
          const attackXpGains = SkillXpService.calculateAttackSkillXp(null, damageResult.damage);
          skillXpGains.push(...attackXpGains);
          
          // Bônus de XP para críticos e duplo ataque
          if (damageResult.isCritical || damageResult.isDoubleAttack) {
            const bonusMultiplier = (damageResult.isCritical ? 1.5 : 1) * (damageResult.isDoubleAttack ? 1.3 : 1);
            skillXpGains.forEach(gain => {
              gain.xp = Math.floor(gain.xp * bonusMultiplier);
            });
          }
          
          // Adicionar mensagens para cada skill que ganhou XP
          attackXpGains.forEach(gain => {
            const skillName = SkillXpService.getSkillDisplayName(gain.skill);
            let xpMessage = `+${gain.xp} XP de ${skillName}`;
            if (damageResult.isCritical || damageResult.isDoubleAttack) {
              xpMessage += ' (bônus por crítico/duplo)';
            }
            skillMessages.push(xpMessage);
          });
          
          console.log(`[GameService] XP de ataque calculado:`, attackXpGains);
        } catch (error) {
          console.error('[GameService] Erro ao calcular XP de ataque:', error);
          // Fallback para sistema básico
          const basicXpGain = Math.floor(damageResult.damage * 0.1);
          if (basicXpGain > 0) {
            skillXpGains.push({
              skill: SkillType.SWORD_MASTERY,
              xp: basicXpGain,
              reason: 'combat_attack_fallback'
            });
            skillMessages.push(`+${basicXpGain} XP de Maestria com Espadas`);
          }
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
        
        // Adicionar mensagem ao log de jogo
        gameLogMessages.push({
          message: `${player.name} assume uma postura defensiva`,
          type: 'player_action'
        });
        
        // CRÍTICO: Usar o SkillXpService para calcular XP de defesa
        try {
          const defenseXpGains = SkillXpService.calculateDefenseSkillXp(null, 0);
          skillXpGains.push(...defenseXpGains);
          
          // Adicionar mensagens para cada skill que ganhou XP
          defenseXpGains.forEach(gain => {
            const skillName = SkillXpService.getSkillDisplayName(gain.skill);
            skillMessages.push(`+${gain.xp} XP de ${skillName} (${gain.reason})`);
          });
          
          console.log(`[GameService] XP de defesa calculado:`, defenseXpGains);
        } catch (error) {
          console.error('[GameService] Erro ao calcular XP de defesa:', error);
          // Fallback para sistema básico
          skillXpGains.push({
            skill: SkillType.DEFENSE_MASTERY,
            xp: 5,
            reason: 'combat_defense_fallback'
          });
          skillMessages.push(`+5 XP de Maestria Defensiva`);
        }
        break;

      case 'flee':
        // SISTEMA DE FUGA MELHORADO - Baseado em velocidade
        console.log(`[GameService] === PROCESSANDO FUGA ===`);
        console.log(`[GameService] Velocidade do jogador: ${player.speed}`);
        console.log(`[GameService] Velocidade do inimigo: ${currentEnemy.speed}`);
        
        // Calcular chance de fuga baseada na diferença de velocidade
        const baseFleeChance = 0.8; // 80% de chance base (mais alta que antes)
        
        // Bônus/penalidade baseado na velocidade relativa
        const speedRatio = player.speed / Math.max(1, currentEnemy.speed);
        let speedBonus = 0;
        
        if (speedRatio >= 1.5) {
          speedBonus = 0.3; // +30% se for 50%+ mais rápido
        } else if (speedRatio >= 1.2) {
          speedBonus = 0.2; // +20% se for 20%+ mais rápido
        } else if (speedRatio >= 1.0) {
          speedBonus = 0.1; // +10% se for igual ou um pouco mais rápido
        } else if (speedRatio >= 0.8) {
          speedBonus = 0; // Sem bônus/penalidade se estiver próximo
        } else if (speedRatio >= 0.6) {
          speedBonus = -0.1; // -10% se for mais lento
        } else {
          speedBonus = -0.2; // -20% se for muito mais lento
        }
        
        // Bônus adicional de destreza (cada 10 pontos = +5% chance)
        const dexterityBonus = Math.floor((player.dexterity || 10) / 10) * 0.05;
        
        // Penalidade se estiver com pouco HP (mais difícil fugir ferido)
        const hpRatio = player.hp / player.max_hp;
        const hpPenalty = hpRatio < 0.3 ? -0.15 : hpRatio < 0.5 ? -0.1 : 0;
        
        const finalFleeChance = Math.min(0.95, Math.max(0.1, 
          baseFleeChance + speedBonus + dexterityBonus + hpPenalty
        ));
        
        console.log(`[GameService] Chance base de fuga: ${baseFleeChance * 100}%`);
        console.log(`[GameService] Bônus de velocidade (ratio ${speedRatio.toFixed(2)}): ${speedBonus * 100}%`);
        console.log(`[GameService] Bônus de destreza: ${dexterityBonus * 100}%`);
        console.log(`[GameService] Penalidade de HP baixo: ${hpPenalty * 100}%`);
        console.log(`[GameService] Chance final de fuga: ${finalFleeChance * 100}%`);
        
        const fleeRoll = Math.random();
        const fleeSuccess = fleeRoll < finalFleeChance;
        
        console.log(`[GameService] Resultado do dado: ${(fleeRoll * 100).toFixed(1)}%`);
        console.log(`[GameService] Fuga ${fleeSuccess ? 'BEM-SUCEDIDA' : 'FALHOU'}!`);
        
        if (fleeSuccess) {
          message = `Você conseguiu fugir de ${currentEnemy.name}! (${(finalFleeChance * 100).toFixed(1)}% chance)`;
          skipTurn = true;
          // Marcar o estado como fuga bem-sucedida para controle posterior
          newState.fleeSuccessful = true;
          console.log(`[GameService] Estado marcado com fleeSuccessful = true`);
          
          // Adicionar mensagem ao log de jogo
          gameLogMessages.push({
            message: `${player.name} conseguiu fugir da batalha!`,
            type: 'player_action'
          });
        } else {
          // Falha na fuga, recebe dano reduzido (era 30%, agora 20%)
          const fleeDamage = Math.floor(currentEnemy.attack * 0.2);
          newState.player.hp = Math.max(0, player.hp - fleeDamage);
          message = `Você falhou ao tentar fugir e recebeu ${fleeDamage} de dano de ${currentEnemy.name}! (${(finalFleeChance * 100).toFixed(1)}% chance)`;
          // Não pular o turno para que o inimigo possa atacar normalmente
          skipTurn = false;
          console.log(`[GameService] Fuga falhou, jogador recebeu ${fleeDamage} de dano`);
          
          // Adicionar mensagens ao log de jogo
          gameLogMessages.push({
            message: `${player.name} tentou fugir mas falhou`,
            type: 'player_action'
          });
          if (fleeDamage > 0) {
            gameLogMessages.push({
              message: `${player.name} recebeu ${fleeDamage} de dano ao tentar fugir`,
              type: 'damage'
            });
          }
        }
        break;

      case 'spell':
        if (!spellId) {
          return {
            newState: gameState,
            skipTurn: true,
            message: 'Nenhuma magia especificada!',
            skillXpGains,
            skillMessages,
            gameLogMessages
          };
        }
        
        const spell = player.spells.find(s => s.id === spellId);
        if (!spell) {
          return {
            newState: gameState,
            skipTurn: true,
            message: 'Magia não encontrada!',
            skillXpGains,
            skillMessages,
            gameLogMessages
          };
        }
        
        if (player.mana < spell.mana_cost) {
          return {
            newState: gameState,
            skipTurn: true,
            message: 'Mana insuficiente!',
            skillXpGains,
            skillMessages,
            gameLogMessages
          };
        }
        
        if (spell.current_cooldown > 0) {
          return {
            newState: gameState,
            skipTurn: true,
            message: `${spell.name} está em cooldown por ${spell.current_cooldown} turnos!`,
            skillXpGains,
            skillMessages,
            gameLogMessages
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
        
        // LOG: Debug do resultado da magia
        console.log(`[GameService] Resultado da magia ${spell.name}:`, {
          success: spellResult.success,
          effect_type: spell.effect_type,
          message: spellResult.message,
          skipTurn: !spellResult.success
        });
        
        // Adicionar mensagens ao log de jogo
        gameLogMessages.push({
          message: `${player.name} lança ${spell.name}!`,
          type: 'player_action'
        });
        
        // Adicionar mensagem específica do efeito da magia
        if (spell.effect_type === 'damage') {
          gameLogMessages.push({
            message: `${spell.name} causou dano em ${currentEnemy.name}`,
            type: 'damage'
          });
        } else if (spell.effect_type === 'heal') {
          gameLogMessages.push({
            message: `${player.name} se curou com ${spell.name}`,
            type: 'system'
          });
        }
        
        // CRÍTICO: Magias bem-sucedidas NÃO devem pular turno
        if (!spellResult.success) {
          console.log(`[GameService] Magia ${spell.name} FALHOU - pulando turno do inimigo`);
          skipTurn = true;
        } else {
          console.log(`[GameService] Magia ${spell.name} bem-sucedida - processando turno do inimigo`);
          skipTurn = false; // Garantir que não pula turno para magias bem-sucedidas
        }
        
        // Ganhar XP de maestria mágica usando o novo sistema
        // Extrair valor escalado da mensagem ou calcular baseado no spell
        let actualSpellValue = spell.effect_value;
        if (spell.effect_type === 'damage' || spell.effect_type === 'heal') {
          const scaledValue = spell.effect_type === 'damage' 
            ? SpellService.calculateScaledSpellDamage(spell.effect_value, player)
            : SpellService.calculateScaledSpellHealing(spell.effect_value, player);
          actualSpellValue = scaledValue;
        }
        
        const magicXpGains = SkillXpService.calculateMagicSkillXp(
          spell.mana_cost, 
          spell.effect_value, 
          actualSpellValue
        );
        
        skillXpGains.push(...magicXpGains);
        if (magicXpGains.length > 0) {
          skillMessages.push(`+${magicXpGains[0].xp} XP de Maestria Mágica`);
        }
        break;

      case 'consumable':
        if (!consumableId) {
          return {
            newState: gameState,
            skipTurn: true,
            message: 'Nenhum consumível especificado!',
            skillXpGains,
            skillMessages,
            gameLogMessages
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
            skillMessages,
            gameLogMessages
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
        
        // Adicionar mensagens ao log de jogo
        gameLogMessages.push({
          message: `${player.name} usou ${consumable.consumable?.name || 'Item'}`,
          type: 'player_action'
        });
        if (actualHeal > 0) {
          gameLogMessages.push({
            message: `${player.name} recuperou ${actualHeal} HP`,
            type: 'system'
          });
        }
        break;

      default:
        return {
          newState: gameState,
          skipTurn: true,
          message: 'Ação inválida!',
          skillXpGains,
          skillMessages,
          gameLogMessages
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

    // CRÍTICO: Reduzir cooldowns das magias a cada turno
    newState = SpellService.updateSpellCooldowns(newState);

    // Resetar defesa após o turno
    newState.player.isDefending = false;

    return {
      newState,
      skipTurn,
      message,
      skillXpGains,
      skillMessages,
      gameLogMessages
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

        // CRÍTICO: Persistir XP no banco de dados
      console.log(`[GameService] === PERSISTINDO XP NO BANCO ===`);
      const xpResult = await CharacterService.grantSecureXP(player.id, xp, 'combat');
      if (!xpResult.success) {
        console.error('[GameService] Erro ao conceder XP:', xpResult.error);
        throw new Error(`Falha ao conceder XP: ${xpResult.error}`);
      }
      
      const xpData = xpResult.data!;
      console.log(`[GameService] XP persistido - Level: ${xpData.new_level}, XP: ${xpData.new_xp}, Level Up: ${xpData.leveled_up}`);

      // CRÍTICO: Persistir Gold no banco de dados
      console.log(`[GameService] === PERSISTINDO GOLD NO BANCO ===`);
      const goldResult = await CharacterService.grantSecureGold(player.id, gold, 'combat');
      if (!goldResult.success) {
        console.error('[GameService] Erro ao conceder gold:', goldResult.error);
        throw new Error(`Falha ao conceder gold: ${goldResult.error}`);
      }
      
      const newGoldTotal = goldResult.data!;
      console.log(`[GameService] Gold persistido - Total: ${newGoldTotal}`);

      // CRÍTICO: Processar drops reais do monstro usando o sistema completo
      console.log(`[GameService] === PROCESSANDO DROPS REAIS ===`);
      
      let drops: { name: string; quantity: number }[] = [];
      let dropsObtidos: { drop_id: string; quantity: number }[] = [];
      
      if (currentEnemy.possible_drops && currentEnemy.possible_drops.length > 0) {
        console.log(`[GameService] Monstro ${currentEnemy.name} tem ${currentEnemy.possible_drops.length} possible_drops`);
        
        // Usar o sistema real de drops do ConsumableService
        dropsObtidos = ConsumableService.processMonsterDrops(
          currentEnemy.level,
          currentEnemy.possible_drops,
          currentFloor.type === 'boss' ? 1.5 : 1.0 // Boss tem chance aumentada
        );
        
        console.log(`[GameService] Drops obtidos: ${dropsObtidos.length} itens`);
        
        if (dropsObtidos.length > 0) {
          // Buscar informações dos drops para exibição
          const dropIds = dropsObtidos.map(d => d.drop_id);
          const dropInfoResponse = await ConsumableService.getDropInfoByIds(dropIds);
          
          if (dropInfoResponse.success && dropInfoResponse.data) {
            drops = dropsObtidos.map(dropObtido => {
              const dropInfo = dropInfoResponse.data!.find(d => d.id === dropObtido.drop_id);
              return {
                name: dropInfo?.name || `Item Desconhecido (${dropObtido.drop_id})`,
                quantity: dropObtido.quantity
              };
            });
            
            console.log(`[GameService] Drops identificados para exibição:`, drops.map(d => `${d.quantity}x ${d.name}`).join(', '));
          } else {
            console.error(`[GameService] Erro ao buscar informações dos drops:`, dropInfoResponse.error);
            // Fallback: usar IDs como nomes
            drops = dropsObtidos.map(d => ({
              name: `Item ${d.drop_id.substring(0, 8)}...`,
              quantity: d.quantity
            }));
          }
          
          // CRÍTICO: Persistir drops no inventário do personagem usando função segura
          console.log(`[GameService] === PERSISTINDO DROPS NO BANCO ===`);
          const addDropsResult = await ConsumableService.addDropsToInventory(player.id, dropsObtidos);
          
          if (!addDropsResult.success) {
            console.error(`[GameService] Erro ao persistir drops:`, addDropsResult.error);
            throw new Error(`Falha ao persistir drops: ${addDropsResult.error}`);
          }
          
          console.log(`[GameService] ${addDropsResult.data} drops persistidos com sucesso no inventário`);
        }
      } else {
        console.log(`[GameService] Monstro ${currentEnemy.name} não possui possible_drops configurados`);
      }

      // Criar objeto de recompensas baseado nos dados persistidos
      const battleRewards: BattleRewards = {
        xp,
        gold,
        drops,
        leveledUp: xpData.leveled_up,
        newLevel: xpData.leveled_up ? xpData.new_level : undefined
      };

      // Atualizar estado do jogador com dados do banco
      const updatedPlayer: GamePlayer = {
        ...player,
        xp: xpData.new_xp,
        level: xpData.new_level,
        gold: newGoldTotal,
        // Se houve level up, o HP e Mana foram restaurados pelo banco
        ...(xpData.leveled_up && {
          // Valores serão atualizados automaticamente quando o personagem for recarregado
          // mas mantemos o estado local consistente
        })
      };

      console.log(`[GameService] === DERROTA PROCESSADA COM PERSISTÊNCIA ===`);
      console.log(`[GameService] - Level: ${updatedPlayer.level} (Level Up: ${xpData.leveled_up})`);
      console.log(`[GameService] - XP: ${updatedPlayer.xp}/${xpData.new_xp_next_level}`);
      console.log(`[GameService] - Gold: ${updatedPlayer.gold}`);
      console.log(`[GameService] - Drops: ${drops.length} itens`);

      // CORRIGIDO: NÃO remover currentEnemy aqui - será removido apenas no avanço
      return {
        ...gameState,
        player: updatedPlayer,
        battleRewards,
        // currentEnemy mantido para permitir exibição do modal
        isPlayerTurn: true,
        gameMessage: `Inimigo derrotado! +${xp} XP, +${gold} Gold${battleRewards.leveledUp ? ` - LEVEL UP!` : ''}`
      };
    } catch (error) {
      console.error('[GameService] Erro ao processar derrota do inimigo:', error);
      
      // Em caso de erro, não dar recompensas para evitar exploits
      // Manter inimigo para permitir retry ou debug
      return {
        ...gameState,
        isPlayerTurn: true,
        gameMessage: `Erro ao processar derrota do inimigo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Processar ação do inimigo com delay para melhor experiência do usuário
   * @param gameState Estado atual do jogo
   * @param playerDefendAction Indica se o jogador usou a ação de defesa (DEPRECATED)
   * @param delayMs Delay em millisegundos antes de processar (padrão: 1500-2500ms aleatório)
   * @returns Promise com novo estado do jogo após a ação do inimigo
   */
  static async processEnemyActionWithDelay(
    gameState: GameState, 
    playerDefendAction: boolean,
    delayMs?: number
  ): Promise<{
    newState: GameState;
    skillXpGains?: SkillXpGain[];
    skillMessages?: string[];
  }> {
    console.log('[GameService] === PROCESSANDO TURNO DO INIMIGO ===');
    console.log('[GameService] Estado recebido:', {
      hasEnemy: !!gameState.currentEnemy,
      enemyName: gameState.currentEnemy?.name,
      enemyHp: gameState.currentEnemy?.hp,
      enemyMaxHp: gameState.currentEnemy?.maxHp,
      playerHp: gameState.player.hp,
      isPlayerTurn: gameState.isPlayerTurn,
      gameMode: gameState.mode
    });
    
    // CORRIGIDO: Verificar se o inimigo ainda está vivo antes de processar
    if (!gameState.currentEnemy || gameState.currentEnemy.hp <= 0) {
      console.log('[GameService] Inimigo morto antes do delay - cancelando ação');
      return { newState: gameState };
    }
    
    // Calcular delay aleatório entre 1.5 e 2.5 segundos se não especificado
    const finalDelay = delayMs ?? (1500 + Math.random() * 1000); // 1500-2500ms
    
    const enemyName = gameState.currentEnemy?.name || 'Inimigo';
    console.log(`[GameService] ${enemyName} está pensando... (${Math.round(finalDelay)}ms)`);
    
    // Aguardar o delay antes de processar
    await new Promise(resolve => setTimeout(resolve, finalDelay));
    
    // CORRIGIDO: Verificar novamente após o delay se o inimigo ainda está vivo
    if (!gameState.currentEnemy || gameState.currentEnemy.hp <= 0) {
      console.log('[GameService] Inimigo morto após delay - cancelando ação');
      return { newState: gameState };
    }
    
    console.log(`[GameService] ${enemyName} decidiu sua ação!`);
    
    // Processar ação do inimigo normalmente
    return this.processEnemyAction(gameState, playerDefendAction);
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
    
    // LOG: Início do processamento da ação do inimigo
    console.log(`[GameService] === PROCESSANDO AÇÃO DO INIMIGO ===`);
    console.log(`[GameService] Inimigo: ${enemy.name} (HP: ${enemy.hp}/${enemy.maxHp})`);
    
    // Processar efeitos contínuos no inimigo (DoTs, buffs, etc.)
    SpellService.processOverTimeEffects(enemy);
    
    // Se o inimigo morreu por efeitos ao longo do tempo
    if (enemy.hp <= 0) {
      console.log(`[GameService] Inimigo morreu por efeitos ao longo do tempo`);
      return {
        newState: {
          ...gameState,
          isPlayerTurn: true,
          gameMessage: `${enemy.name} foi derrotado por efeitos ao longo do tempo!`
        }
      };
    }

    // Determinar ação do inimigo com sistema especializado
    let actionType: 'attack' | 'spell' | 'special' = 'attack';
    
    // IA especializada baseada no comportamento e atributos do monstro
    const hasSpecialAbilities = enemy.special_abilities && enemy.special_abilities.length > 0;
    const isHighIntelligence = (enemy.intelligence || 10) > (enemy.strength || 10);
    
    // Probabilidades baseadas no comportamento
    let specialChance = 0.15; // Base 15%
    let spellChance = 0.20;   // Base 20%
    
    switch (enemy.behavior) {
      case 'aggressive':
        specialChance = 0.25; // Mais agressivo com especiais
        spellChance = 0.10;   // Menos uso de magia
        break;
      case 'defensive':
        specialChance = 0.30; // Muito uso de especiais defensivos
        spellChance = 0.15;   // Magia moderada
        break;
      case 'balanced':
        if (isHighIntelligence) {
          spellChance = 0.35; // Magos usam muita magia
          specialChance = 0.20;
        } else {
          spellChance = 0.20;
          specialChance = 0.20;
        }
        break;
    }
    
    // Aumentar chances de especiais se tem habilidades
    if (hasSpecialAbilities) {
      specialChance += 0.10;
    }
    
    // Decidir ação
    if (hasSpecialAbilities && Math.random() < specialChance) {
      actionType = 'special';
    } else if (enemy.mana >= 10 && Math.random() < spellChance) {
      actionType = 'spell';
    }

    // LOG: Ação escolhida
    console.log(`[GameService] Ação escolhida: ${actionType} (special: ${specialChance}, spell: ${spellChance})`);

    let message = '';
    let damage = 0;
    let actualDamage = 0;

    switch (actionType) {
      case 'attack':
        console.log(`[GameService] Executando ataque físico`);
        
        // Inimigos também podem ter críticos e duplo ataque baseado em seus stats
        const enemyDamageResult = this.calculateDamage(
          enemy.attack, 
          player.def,
          enemy.critical_chance || 0,
          enemy.critical_damage || 110,
          0 // Duplo ataque do inimigo baseado em velocidade seria implementado separadamente
        );
        
        damage = enemyDamageResult.damage;
        
        // Aplicar resistência de defesa se jogador está defendendo
        if (player.isDefending || playerDefendAction) {
          actualDamage = Math.floor(damage * 0.15); // 85% de redução
          
          let defenseMessage = `${enemy.name} atacou`;
          if (enemyDamageResult.isCritical) defenseMessage += ` com golpe crítico`;
          if (enemyDamageResult.isDoubleAttack) defenseMessage += ` ${enemyDamageResult.totalAttacks}x`;
          defenseMessage += `, mas você reduziu o dano de ${damage} para ${actualDamage} com sua defesa!`;
          message = defenseMessage;
          
          // NOVO: XP de defesa extra por bloquear efetivamente
          try {
            const blockedDamage = damage - actualDamage;
            const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(null, blockedDamage);
            skillXpGains.push(...defenseSkillXp);
            console.log(`[GameService] XP de defesa por bloqueio:`, defenseSkillXp);
          } catch (error) {
            console.warn('[processEnemyAction] Erro ao calcular XP de defesa:', error);
          }
        } else {
          actualDamage = damage;
          
          let attackMessage = `${enemy.name} atacou`;
          if (enemyDamageResult.isCritical) attackMessage += ` com golpe crítico`;
          if (enemyDamageResult.isDoubleAttack) attackMessage += ` ${enemyDamageResult.totalAttacks}x`;
          attackMessage += ` e causou ${actualDamage} de dano!`;
          message = attackMessage;
          
          // NOVO: XP de defesa menor por receber ataque (experiência passiva)
          try {
            // XP reduzido por ser um ataque não bloqueado
            const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(null, Math.floor(actualDamage * 0.3));
            skillXpGains.push(...defenseSkillXp);
            console.log(`[GameService] XP de defesa passiva:`, defenseSkillXp);
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

        // CRÍTICO: Reduzir cooldowns das magias após turno do inimigo
        const updatedResultState = SpellService.updateSpellCooldowns(resultState);
        console.log(`[GameService] Ataque processado com sucesso. Mensagem: ${message}`);
        return { newState: updatedResultState, skillXpGains, skillMessages };

      case 'spell':
        console.log(`[GameService] Executando magia`);
        // Inimigo usa magia
        const spellDamage = Math.floor(enemy.attack * 1.2);
        const spellCost = 10;
        
        // Aplicar resistência de defesa se jogador está defendendo
        if (player.isDefending || playerDefendAction) {
          actualDamage = Math.floor(spellDamage * 0.15);
          message = `${enemy.name} lançou uma magia, mas você reduziu o dano de ${spellDamage} para ${actualDamage} com sua defesa!`;
          
          // XP de defesa por bloquear magia (menor que físico)
          try {
            const equipmentSlotsResponse = await EquipmentService.getEquippedItems(player.id);
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

        // CRÍTICO: Reduzir cooldowns das magias após turno do inimigo
        const updatedSpellResultState = SpellService.updateSpellCooldowns(spellResultState);
        console.log(`[GameService] Magia processada com sucesso. Mensagem: ${message}`);
        return { newState: updatedSpellResultState, skillXpGains, skillMessages: spellSkillMessages };

      case 'special':
        // Sistema avançado de habilidades especiais
        const specialAbilities = enemy.special_abilities || [];
        
        if (specialAbilities.length > 0) {
          // Escolher habilidade aleatória
          const randomAbility = specialAbilities[Math.floor(Math.random() * specialAbilities.length)];
          const abilityName = randomAbility.split(':')[0].trim();
          
          // Processar habilidade baseada no nome/tipo
          if (randomAbility.includes('Regenera') || randomAbility.includes('Recupera') || randomAbility.includes('cura')) {
            // Habilidades de cura
            const healAmount = Math.floor(enemy.maxHp * (0.10 + Math.random() * 0.15)); // 10-25%
            const newEnemyHp = Math.min(enemy.maxHp, enemy.hp + healAmount);
            const healResultState = {
              ...gameState,
              player: {
                ...player,
                potionUsedThisTurn: false
              },
              currentEnemy: {
                ...enemy,
                hp: newEnemyHp
              },
              isPlayerTurn: true,
              gameMessage: `${enemy.name} usou ${abilityName} e recuperou ${healAmount} HP!`
            };
            // CRÍTICO: Reduzir cooldowns das magias após turno do inimigo
            const updatedHealResultState = SpellService.updateSpellCooldowns(healResultState);
            return { newState: updatedHealResultState };
          } else if (randomAbility.includes('dano') || randomAbility.includes('ATK') || randomAbility.includes('Ataque')) {
            // Habilidades de dano aumentado
            damage = Math.floor(enemy.attack * (1.3 + Math.random() * 0.7)); // 130-200%
            actualDamage = player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
            message = `${enemy.name} usou ${abilityName} e causou ${actualDamage} de dano!`;
          } else if (randomAbility.includes('crítico') || randomAbility.includes('Crítico')) {
            // Habilidades de crítico
            damage = Math.floor(enemy.attack * 2.0); // Dano crítico
            actualDamage = player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
            message = `${enemy.name} usou ${abilityName} com um golpe crítico devastador! ${actualDamage} de dano!`;
          } else if (randomAbility.includes('área') || randomAbility.includes('todos')) {
            // Habilidades em área (simulação para single-player)
            damage = Math.floor(enemy.attack * 1.2);
            actualDamage = player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
            message = `${enemy.name} usou ${abilityName} em área! ${actualDamage} de dano!`;
          } else {
            // Habilidade especial genérica
            damage = Math.floor(enemy.attack * (1.2 + Math.random() * 0.5)); // 120-170%
            actualDamage = player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
            message = `${enemy.name} usou ${abilityName}! ${actualDamage} de dano!`;
          }
        } else {
          // Fallback para comportamento antigo se não tem habilidades
          switch (enemy.behavior) {
            case 'aggressive':
              damage = Math.floor(enemy.attack * 1.5);
              actualDamage = player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
              message = `${enemy.name} usou Ataque Furioso e causou ${actualDamage} de dano!`;
              break;
            case 'defensive':
              const healAmount = Math.floor(enemy.maxHp * 0.15);
              const newEnemyHp = Math.min(enemy.maxHp, enemy.hp + healAmount);
              const defensiveHealState = {
                ...gameState,
                player: {
                  ...player,
                  potionUsedThisTurn: false
                },
                currentEnemy: {
                  ...enemy,
                  hp: newEnemyHp
                },
                isPlayerTurn: true,
                gameMessage: `${enemy.name} se concentrou e recuperou ${healAmount} HP!`
              };
              // CRÍTICO: Reduzir cooldowns das magias após turno do inimigo
              const updatedDefensiveHealState = SpellService.updateSpellCooldowns(defensiveHealState);
              return { newState: updatedDefensiveHealState };
            default:
              damage = Math.floor(enemy.attack * 1.3);
              actualDamage = player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
              message = `${enemy.name} usou uma habilidade especial e causou ${actualDamage} de dano!`;
          }
        }
        
        // XP de defesa por receber habilidade especial
        if (actualDamage > 0) {
          try {
            const equipmentSlotsResponse = await EquipmentService.getEquippedItems(player.id);
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

        // CRÍTICO: Reduzir cooldowns das magias após turno do inimigo
        const updatedSpecialResultState = SpellService.updateSpellCooldowns(specialResultState);
        console.log(`[GameService] Habilidade especial processada com sucesso. Mensagem: ${message}`);
        return { newState: updatedSpecialResultState, skillXpGains, skillMessages: specialSkillMessages };

      default:
        console.log(`[GameService] ERRO: Ação desconhecida: ${actionType}`);
        console.log(`[GameService] Este caso não deveria ser executado!`);
        const defaultState = { 
          ...gameState, 
          player: {
            ...gameState.player,
            potionUsedThisTurn: false // Resetar flag de poção quando o turno retorna ao jogador
          },
          isPlayerTurn: true
        };
        // CRÍTICO: Reduzir cooldowns das magias após turno do inimigo
        const updatedDefaultState = SpellService.updateSpellCooldowns(defaultState);
        return { newState: updatedDefaultState };
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

      // CRÍTICO: Criar nova sessão de batalha se não for evento especial
      let newBattleSession = undefined;
      if (!specialEvent && nextEnemy) {
        try {
          // Importar TurnControlService dinamicamente para evitar dependência circular
          const { TurnControlService } = await import('./turn-control.service');
          
          console.log(`[GameService] Criando nova sessão de batalha para andar ${nextFloor} com inimigo ${nextEnemy.name}`);
          TurnControlService.performCleanup(); // Limpar sessões antigas primeiro
          newBattleSession = TurnControlService.initializeBattleSession(nextFloor, nextEnemy.name);
          console.log(`[GameService] Nova sessão de batalha criada: ${newBattleSession.sessionId}`);
        } catch (error) {
          console.error('[GameService] Erro ao criar sessão de batalha, continuando sem ela:', error);
          // Continuar sem sessão - será criada posteriormente se necessário
        }
      }

      // CORRIGIDO: Construir novo estado com limpeza completa
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
        currentEnemy: specialEvent ? null : nextEnemy, // CRÍTICO: Limpar inimigo anterior e definir novo
        currentSpecialEvent: specialEvent,
        gameMessage: specialEvent 
          ? `Evento especial encontrado: ${specialEvent.name}!`
          : `Andar ${nextFloor}: ${nextFloorData.description}. Um ${nextEnemy.name} apareceu!`,
        isPlayerTurn: true,
        battleRewards: null, // CRÍTICO: Sempre limpar recompensas de batalha
        selectedSpell: null, // Limpar spell selecionado ao avançar
        characterDeleted: false, // Resetar flags de estado
        fleeSuccessful: false,
        highestFloor: Math.max(gameState.highestFloor || 0, nextFloor),
        battleSession: newBattleSession, // CRÍTICO: Incluir nova sessão no estado
        actionLocks: new Map() // Limpar locks de ações
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

      // Carregar magias equipadas do personagem (usando slots)
      const spellsResponse = await import('./spell.service').then(m => 
        m.SpellService.getCharacterEquippedSpells(characterId)
      );
      const playerSpells = spellsResponse.success && spellsResponse.data 
        ? spellsResponse.data 
        : [];

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
          hots: [],
          attribute_modifications: []
        }
      };
    } catch (error) {
      console.error('Erro ao carregar personagem para o jogo:', error);
      throw error;
    }
  }
} 