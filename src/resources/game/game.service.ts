'use client';

import { Enemy, GameResponse, GameState, Floor, FloorType, ActionType, GamePlayer, BattleRewards } from './game-model';
import { supabase } from '@/lib/supabase';
import { SkillXpService, SkillXpGain } from './skill-xp.service';
import { EquipmentSlots } from './models/equipment.model';
import { SpellService } from './spell.service';
import { MonsterService } from './monster.service';
import { InitiativeData, SpeedComparison } from './models/game-battle.model';
import { ConsumableService } from './consumable.service';
import { CharacterService } from './character.service';
import { CemeteryService } from './cemetery.service';
import { EquipmentService } from './equipment.service';
import {
  decideEnemyAction,
  getFallbackSpecialBehavior,
} from './domain/enemy-action.domain';

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

/**
 * Regras de servidor/cliente para combate, andares e eventos.
 * Domínios: (1) andar/monstro — getFloorData, generateEnemy, advanceToNextFloor;
 * (2) turnos — processPlayerAction, processEnemyAction*, processEnemyDefeat;
 * (3) progresso — save/load, eventos especiais. Extração em módulos menores pode seguir esses eixos.
 */
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
    this.floorCache.clear();
    this.floorCacheExpiry.clear();
    MonsterService.clearCache();
  }

  /**
   * Gerar inimigo para o andar especificado
   * @param floor Número do andar
   * @returns Inimigo gerado ou null se falhar
   */
  static async generateEnemy(floor: number): Promise<Enemy | null> {
    try {
      // Buscar monstro do serviço (dados reais do banco) com retry curto para instabilidades transitórias.
      let result = await MonsterService.getMonsterForFloor(floor);
      if (!result.success || !result.data) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        result = await MonsterService.getMonsterForFloor(floor);
      }
      const { data: monsterData, error, success } = result;
      
      if (!success || error || !monsterData) {
        console.error(`[GameService] Erro ao buscar monstro para andar ${floor}:`, error);
        throw new Error(`Nenhum monstro encontrado para o andar ${floor}: ${error}`);
      }

      const hp = Number(monsterData.hp);
      const atk = Number(monsterData.atk);
      const def = Number(monsterData.def);
      const level = Number(monsterData.level);
      const speed = Number(monsterData.speed);
      const mana = Number(monsterData.mana);

      // Validar dados essenciais do monstro
      if (
        !monsterData.name ||
        !Number.isFinite(hp) ||
        !Number.isFinite(atk) ||
        !Number.isFinite(def) ||
        hp <= 0 ||
        atk <= 0 ||
        def < 0
      ) {
        console.error(`[GameService] Dados de monstro incompletos para andar ${floor}:`, monsterData);
        throw new Error(`Dados de monstro incompletos para o andar ${floor}`);
      }

      // Converter para Enemy - todos os dados vêm do banco
      const enemy: Enemy = {
        id: monsterData.id,
        name: monsterData.name,
        level: Number.isFinite(level) ? Math.max(1, Math.floor(level)) : Math.max(1, Math.floor(floor / 5) + 1),
        hp: Math.max(1, Math.floor(hp)),
        maxHp: Math.max(1, Math.floor(hp)),
        attack: Math.max(1, Math.floor(atk)),
        defense: Math.max(0, Math.floor(def)),
        speed: Number.isFinite(speed) ? Math.max(1, Math.floor(speed)) : 10,
        image: monsterData.image || '👾',
        behavior: monsterData.behavior || 'balanced',
        mana: Number.isFinite(mana) ? Math.max(0, Math.floor(mana)) : 0,
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

      const norm = this.normalizeRewardBase(
        enemy.reward_xp,
        enemy.reward_gold,
        enemy.level,
        enemy.tier ?? 1
      );
      enemy.reward_xp = norm.baseXP;
      enemy.reward_gold = norm.baseGold;

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
   * @param attackerDexterity Destreza do atacante (para cálculo de duplo ataque)
   * @param attackerSpeed Velocidade do atacante (para cálculo de duplo ataque)
   * @returns Objeto com informações do dano
   */
  static calculateDamage(
    attackerAttack: number, 
    defenderDefense: number,
    criticalChance: number = 0,
    criticalDamage: number = 110,
    doubleAttackChance: number = 0,
    attackerDexterity: number = 10,
    attackerSpeed: number = 10,
    /** Resistência a crítico do defensor (0–1), ex.: `enemy.critical_resistance`. */
    defenderCriticalResistance: number = 0
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
    const critRes = Math.min(0.85, Math.max(0, Number(defenderCriticalResistance) || 0));
    
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
    
    const baseDamage = Math.max(1, Math.floor(safeAttack - (safeDefense * 0.55)));
    
    const effectiveCritChance = Math.max(0, criticalChance * (1 - critRes));
    const critRoll = Math.random() * 100;
    const isCritical = critRoll < effectiveCritChance;
    
    const enhancedDoubleAttackChance =
      doubleAttackChance +
      Math.floor((attackerDexterity - 10) * 0.25) +
      Math.floor((attackerSpeed - 10) * 0.15);
    const doubleRoll = Math.random() * 100;
    const isDoubleAttack = doubleRoll < Math.min(18, Math.max(0, enhancedDoubleAttackChance));
    
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
      damageBreakdown += ` → Duplo Ataque (DEX: ${attackerDexterity}, SPD: ${attackerSpeed}): ${finalDamage}`;
    }
    
    return {
      damage: finalDamage,
      isCritical,
      isDoubleAttack,
      totalAttacks,
      damageBreakdown
    };
  }

  /** Dano mágico após resistência/vulnerabilidade do alvo (0–1 e multiplicador). */
  static applyMagicalDamageMitigation(rawDamage: number, enemy: Enemy): number {
    const res = enemy.magical_resistance ?? 0;
    const vuln = enemy.magical_vulnerability ?? 1;
    return Math.max(1, Math.floor(rawDamage * (1 - res) * vuln));
  }

  /**
   * Resolve um turno do jogador (ataque, defesa, magia, item, fuga).
   * Pré: `gameState.mode === 'battle'` e `currentEnemy` definido (exceto fuga tratada à parte).
   * Pós: retorna cópia mutável do estado com HP/mana/efeitos atualizados; pode definir `skipTurn` ou inimigo morto (HP≤0).
   * Persistência: não grava no banco — quem persiste é o GameProvider (HP/mana, XP de skill, ouro) após este retorno.
   */
  static async processPlayerAction(
    action: ActionType, 
    gameState: GameState,
    spellId?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    consumableId?: string
  ): Promise<{ 
    newState: GameState;
    skipTurn: boolean;
    message: string;
    skillXpGains?: SkillXpGain[];
    skillMessages?: string[];
    gameLogMessages?: { message: string; type: 'player_action' | 'damage' | 'system' | 'skill_xp' }[];
  }> {
    const newState = { ...gameState };
    const gameLogMessages: { message: string; type: 'player_action' | 'damage' | 'system' | 'skill_xp' }[] = [];
    const skillXpGains: SkillXpGain[] = [];
    const skillMessages: string[] = [];
    let skipTurn = false;
    let message = "";
    let totalDamage = 0; // Para calcular skill XP

    switch (action) {
      case 'attack':
        if (newState.currentEnemy && newState.currentEnemy.hp > 0) {
          // Obter equipamentos do jogador para skill XP
          const playerEquipment = await this.getPlayerEquipmentSlots(newState.player.id);
          
          // Calcular dano com todos os modificadores
          const damageResult = this.calculateDamage(
            newState.player.atk,
            newState.currentEnemy.defense,
            newState.player.critical_chance || 0,
            newState.player.critical_damage || 110,
            newState.player.double_attack_chance || 0,
            newState.player.dexterity || 10,
            newState.player.speed || 10,
            newState.currentEnemy.critical_resistance ?? 0
          );

          totalDamage = damageResult.damage;
          const isCritical = damageResult.isCritical;
          const isDoubleAttack = damageResult.isDoubleAttack;

          // Aplicar dano ao inimigo
          newState.currentEnemy.hp = Math.max(0, newState.currentEnemy.hp - totalDamage);
          
          // Resetar defesa do jogador se estava defendendo
          if (newState.player.isDefending) {
            newState.player.isDefending = false;
          }

          // Criar mensagem de ataque
          let attackMessage = `${newState.player.name} atacou ${newState.currentEnemy.name}`;
          if (isDoubleAttack) {
            attackMessage += ` com ataque duplo`;
          }
          if (isCritical) {
            attackMessage += ` CRITICAMENTE`;
          }
          attackMessage += ` causando ${totalDamage} de dano!`;

          gameLogMessages.push({
            message: attackMessage,
            type: 'player_action'
          });

          // CORRIGIDO: Calcular e aplicar skill XP imediatamente após o ataque
          if (playerEquipment) {
            const attackSkillXp = SkillXpService.calculateAttackSkillXp(
              playerEquipment,
              totalDamage
            );

            if (attackSkillXp.length > 0) {
              skillXpGains.push(...attackSkillXp);
              
              // Aplicar skill XP imediatamente
              try {
                const { messages: xpMessages } = await SkillXpService.applySkillXp(
                  newState.player.id,
                  attackSkillXp
                );

                // CRÍTICO: Adicionar mensagens de skill XP APÓS a ação de ataque
                for (const xpMessage of xpMessages) {
                  gameLogMessages.push({
                    message: xpMessage,
                    type: 'skill_xp'
                  });
                }

                skillMessages.push(...xpMessages);

              } catch (error) {
                console.error('[GameService] Erro ao aplicar skill XP de ataque:', error);
              }
            }
          }

          // Verificar se inimigo foi derrotado
          if (newState.currentEnemy.hp <= 0) {
            gameLogMessages.push({
              message: `${newState.currentEnemy.name} foi derrotado!`,
              type: 'system'
            });
            message = `Você derrotou ${newState.currentEnemy.name}!`;
          } else {
            message = attackMessage;
          }
        }
        break;

      case 'defend':
        if (newState.player.defenseCooldown === 0) {
          newState.player.isDefending = true;
          newState.player.defenseCooldown = 3; // 3 turnos de cooldown
          
          const defendMessage = `${newState.player.name} assumiu postura defensiva.`;
          gameLogMessages.push({
            message: defendMessage,
            type: 'player_action'
          });

          // NOVO: Aplicar skill XP de defesa
          const playerEquipment = await this.getPlayerEquipmentSlots(newState.player.id);
          if (playerEquipment) {
            const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(playerEquipment, 0);
            
            if (defenseSkillXp.length > 0) {
              skillXpGains.push(...defenseSkillXp);
              
              try {
                const { messages: xpMessages } = await SkillXpService.applySkillXp(
                  newState.player.id,
                  defenseSkillXp
                );

                for (const xpMessage of xpMessages) {
                  gameLogMessages.push({
                    message: xpMessage,
                    type: 'skill_xp'
                  });
                }

                skillMessages.push(...xpMessages);
              } catch (error) {
                console.error('[GameService] Erro ao aplicar skill XP de defesa:', error);
              }
            }
          }

          message = defendMessage;
        } else {
          message = `Defesa está em cooldown por mais ${newState.player.defenseCooldown} turnos.`;
          skipTurn = true;
        }
        break;

      case 'spell':
        if (spellId) {
          const spell = newState.player.spells.find(s => s.id === spellId);
          if (spell && newState.player.mana >= spell.mana_cost && spell.current_cooldown === 0) {
            // Reduzir mana do jogador
            newState.player.mana = Math.max(0, newState.player.mana - spell.mana_cost);
            
            // Aplicar cooldown na magia
            spell.current_cooldown = spell.cooldown;
            
            let spellResult = '';
            let actualSpellValue = 0;

            if (spell.effect_type === 'damage' && newState.currentEnemy) {
              const scaled = SpellService.calculateScaledSpellDamage(spell.effect_value, newState.player);
              const magicDamage = GameService.applyMagicalDamageMitigation(
                scaled,
                newState.currentEnemy
              );

              actualSpellValue = magicDamage;
              newState.currentEnemy.hp = Math.max(0, newState.currentEnemy.hp - magicDamage);
              
              spellResult = `causando ${magicDamage} de dano mágico`;
              
              if (newState.currentEnemy.hp <= 0) {
                spellResult += ` e derrotando ${newState.currentEnemy.name}`;
              }
            } else if (spell.effect_type === 'heal') {
              const healAmount = SpellService.calculateScaledSpellHealing(
                spell.effect_value,
                newState.player
              );

              actualSpellValue = healAmount;
              newState.player.hp = Math.min(newState.player.max_hp, newState.player.hp + healAmount);
              spellResult = `restaurando ${healAmount} de vida`;
            }

            const spellMessage = `${newState.player.name} lançou ${spell.name} ${spellResult}!`;
            gameLogMessages.push({
              message: spellMessage,
              type: 'player_action'
            });

            // CORRIGIDO: Aplicar skill XP de magia
            const playerEquipment = await this.getPlayerEquipmentSlots(newState.player.id);
            const magicSkillXp = SkillXpService.calculateMagicSkillXp(
              spell.mana_cost,
              spell.effect_type === 'damage' ? actualSpellValue : 0,
              actualSpellValue,
              playerEquipment // Passar equipamento para verificar varinhas
            );

            if (magicSkillXp.length > 0) {
              skillXpGains.push(...magicSkillXp);
              
              try {
                const { messages: xpMessages } = await SkillXpService.applySkillXp(
                  newState.player.id,
                  magicSkillXp
                );

                for (const xpMessage of xpMessages) {
                  gameLogMessages.push({
                    message: xpMessage,
                    type: 'skill_xp'
                  });
                }

                skillMessages.push(...xpMessages);
              } catch (error) {
                console.error('[GameService] Erro ao aplicar skill XP de magia:', error);
              }
            }

            message = spellMessage;
          } else {
            message = 'Não é possível usar esta magia agora.';
            skipTurn = true;
          }
        }
        break;

      case 'flee':
        const playerSpeed = newState.player.speed || 10;
        const enemySpeed = newState.currentEnemy?.speed || 10;
        
        const speedDifference = playerSpeed - enemySpeed;
        const speedModifier = Math.floor(speedDifference * 1);
        let fleeChance = 48 + speedModifier;
        
        fleeChance = Math.max(12, Math.min(72, fleeChance));
        
        const fleeRoll = Math.random() * 100;
        const fleeSuccess = fleeRoll < fleeChance;
        
        if (fleeSuccess) {
          // CRÍTICO: Estado limpo e consistente para fuga bem-sucedida
          newState.fleeSuccessful = true;
          newState.currentEnemy = null;
          newState.mode = 'fled';
          newState.battleRewards = null;
          newState.isPlayerTurn = true;
          
          message = `${newState.player.name} fugiu da batalha com sucesso!`;
          skipTurn = true; // CRÍTICO: Não há turno do inimigo após fuga bem-sucedida
          
          // Adicionar ao log do jogo
          gameLogMessages.push({
            message: `Fuga bem-sucedida! (${fleeChance}% de chance)`,
            type: 'system'
          });
          
        } else {
          // Fuga falhou - jogador toma dano e inimigo pode atacar
          const fleeFailDamage = Math.floor((newState.currentEnemy?.attack || 10) * 0.45);
          newState.player.hp = Math.max(0, newState.player.hp - fleeFailDamage);
          
          // Verificar se jogador morreu na tentativa de fuga
          if (newState.player.hp <= 0) {
            newState.mode = 'gameover';
            newState.characterDeleted = true;
            message = `💀 Você morreu tentando fugir! O personagem foi perdido permanentemente.`;
            skipTurn = true;
            
            return {
              newState,
              skipTurn,
              message,
              skillXpGains: [],
              gameLogMessages: [{
                message: 'Morte permanente por falha na fuga!',
                type: 'system'
              }]
            };
          }
          
          // CRÍTICO: Fuga falhou, jogador toma dano mas inimigo pode atacar
          message = `${newState.player.name} tentou fugir mas falhou! Sofreu ${fleeFailDamage} de dano.`;
          skipTurn = false; // Inimigo DEVE atacar após fuga falhada
          
          // Limpar flag de fuga bem-sucedida
          newState.fleeSuccessful = false;
          
          // Adicionar ao log de batalha
          gameLogMessages.push({
            message: `Fuga falhou (${fleeRoll.toFixed(1)}% vs ${fleeChance}%) - ${fleeFailDamage} de dano`,
            type: 'damage'
          });
          
        }
        
        break;

      default:
        message = 'Ação não reconhecida.';
        skipTurn = true;
        break;
    }

    // Reduzir cooldown de defesa se necessário
    if (newState.player.defenseCooldown > 0) {
      newState.player.defenseCooldown--;
    }

    // Resetar flag de poção usada no turno (será resetada no próximo turno)
    newState.player.potionUsedThisTurn = false;

    return {
      newState,
      skipTurn,
      message,
      skillXpGains,
      skillMessages,
      gameLogMessages
    };
  }

  // NOVO: Função auxiliar para obter slots de equipamento do jogador
  private static async getPlayerEquipmentSlots(playerId: string): Promise<EquipmentSlots | null> {
    try {
      const { EquipmentService } = await import('./equipment.service');
      const equipmentSlots = await EquipmentService.getEquippedItems(playerId);
      return equipmentSlots;
    } catch (error) {
      console.error('[GameService] Erro ao obter equipamentos do jogador:', error);
      return null;
    }
  }

  /**
   * Obter dados do andar
   * @param floorNumber Número do andar
   * @returns Dados do andar ou null se falhar
   */
  static async getFloorData(floorNumber: number): Promise<Floor | null> {
    
    // Verificar cache primeiro
    const now = Date.now();
    const cachedFloor = this.floorCache.get(floorNumber);
    const cacheExpiry = this.floorCacheExpiry.get(floorNumber);
    
    if (cachedFloor && cacheExpiry && now < cacheExpiry) {
      return cachedFloor;
    }

    try {
      
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
  /**
   * Coagir recompensas vindas do PostgREST/JSON: evita `"0"` (truthy em `||`) e valores não numéricos.
   */
  static normalizeRewardBase(
    rewardXp: unknown,
    rewardGold: unknown,
    level: number,
    tier: number
  ): { baseXP: number; baseGold: number } {
    const lv = Math.max(1, level);
    const ti = Math.max(1, tier);
    const fallbackXp = Math.floor(5 + lv * 2 + ti * 2);
    const fallbackGold = Math.floor(3 + lv + ti);
    const x = Number(rewardXp);
    const g = Number(rewardGold);
    return {
      baseXP: Number.isFinite(x) && x > 0 ? Math.floor(x) : fallbackXp,
      baseGold: Number.isFinite(g) && g > 0 ? Math.floor(g) : fallbackGold,
    };
  }

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
      xp: Math.max(1, Math.floor(baseXP * multiplier)),
      gold: Math.max(1, Math.floor(baseGold * multiplier)),
    };
  }

  /**
   * Calcula recompensas (XP, ouro, drops) e atualiza o jogador em memória após HP do inimigo ≤ 0.
   * Pré: inimigo derrotado; idempotente se `battleRewards` já existir (retorna estado atual).
   * Pós: preenche `battleRewards`, pode subir nível; inimigo pode ser removido conforme fluxo interno.
   * Persistência: chama CharacterService / RPCs conforme implementação interna (XP, ouro, inventário).
   */
  static async processEnemyDefeat(gameState: GameState): Promise<GameState> {
    try {
      
      const { player, currentEnemy, currentFloor } = gameState;
      
      if (!currentEnemy || !currentFloor) {
        console.warn('[GameService] Estado inválido para processar derrota do inimigo');
        return gameState;
      }

      // CRÍTICO: Evitar processamento duplicado verificando se já temos recompensas
      if (gameState.battleRewards) {
        console.warn('[GameService] Tentativa de processar derrota de inimigo que já possui recompensas - ignorando');
        console.warn('[GameService] Estado atual do battleRewards:', {
          xp: gameState.battleRewards.xp,
          gold: gameState.battleRewards.gold,
          leveledUp: gameState.battleRewards.leveledUp,
          dropsCount: gameState.battleRewards.drops?.length || 0
        });
        return gameState;
      }

      const { baseXP, baseGold } = this.normalizeRewardBase(
        currentEnemy.reward_xp,
        currentEnemy.reward_gold,
        currentEnemy.level,
        currentEnemy.tier ?? 1
      );

      const { xp, gold } = this.calculateFloorRewards(baseXP, baseGold, currentFloor.type);
      console.info('[GameService] Recompensa calculada para derrota:', {
        floor: currentFloor.floorNumber,
        floorType: currentFloor.type,
        enemyLevel: currentEnemy.level,
        baseXP,
        finalXP: xp,
        baseGold,
        finalGold: gold,
        source: 'combat'
      });

      // XP é crítico para progressão, mas não deve bloquear a vitória (anti-softlock).
      const xpResult = await CharacterService.grantSecureXP(player.id, xp, 'combat');
      let xpGranted = xp;
      let xpData = {
        leveled_up: false,
        new_level: player.level,
        new_xp: player.xp,
      };
      let xpErrorMessage: string | null = null;
      if (!xpResult.success || !xpResult.data) {
        xpGranted = 0;
        xpErrorMessage = xpResult.error || 'erro desconhecido';
        console.error('[GameService] Erro ao conceder XP (mantendo fluxo de vitória):', {
          error: xpErrorMessage,
          floor: currentFloor.floorNumber,
          floorType: currentFloor.type,
          enemyLevel: currentEnemy.level,
          requestedXP: xp,
          source: 'combat'
        });
      } else {
        xpData = xpResult.data;
      }

      // CRÍTICO: Persistir Gold no banco de dados
      const goldResult = await CharacterService.grantSecureGold(player.id, gold, 'combat');
      if (!goldResult.success) {
        console.error('[GameService] Erro ao conceder gold:', goldResult.error);
        throw new Error(`Falha ao conceder gold: ${goldResult.error}`);
      }
      
      const newGoldTotal = goldResult.data!;

      // CRÍTICO: Processar drops reais do monstro usando o sistema completo
      
      let drops: { name: string; quantity: number }[] = [];
      let dropsObtidos: { drop_id: string; quantity: number }[] = [];
      
      if (currentEnemy.possible_drops && currentEnemy.possible_drops.length > 0) {
        
        // Usar o sistema real de drops do ConsumableService
        dropsObtidos = ConsumableService.processMonsterDrops(
          currentEnemy.level,
          currentEnemy.possible_drops,
          currentFloor.type === 'boss' ? 1.5 : 1.0 // Boss tem chance aumentada
        );
        
        
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
            
          } else {
            console.error(`[GameService] Erro ao buscar informações dos drops:`, dropInfoResponse.error);
            // Fallback: usar IDs como nomes
            drops = dropsObtidos.map(d => ({
              name: `Item ${d.drop_id.substring(0, 8)}...`,
              quantity: d.quantity
            }));
          }
          
          // CRÍTICO: Persistir drops no inventário do personagem usando função segura
          const addDropsResult = await ConsumableService.addDropsToInventory(player.id, dropsObtidos);
          
          if (!addDropsResult.success) {
            console.error(`[GameService] Erro ao persistir drops:`, addDropsResult.error);
            throw new Error(`Falha ao persistir drops: ${addDropsResult.error}`);
          }
          
        }
      } else {
      }

      // Criar objeto de recompensas baseado nos dados persistidos
      const battleRewards: BattleRewards = {
        xp: xpGranted,
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


      // CORRIGIDO: NÃO remover currentEnemy aqui - será removido apenas no avanço
      return {
        ...gameState,
        player: updatedPlayer,
        battleRewards,
        // currentEnemy mantido para permitir exibição do modal
        isPlayerTurn: true,
        gameMessage: xpErrorMessage
          ? `Inimigo derrotado! +${gold} Gold. XP não concedido nesta batalha: ${xpErrorMessage}`
          : `Inimigo derrotado! +${xpGranted} XP, +${gold} Gold${battleRewards.leveledUp ? ` - LEVEL UP!` : ''}`
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
   * Executa o turno do inimigo (dano ao jogador, efeitos) após um atraso visual.
   * Pré: `currentEnemy` vivo; estado já com `isPlayerTurn: false` conforme passado pelo provider.
   * Pós: HP/mana do jogador atualizados; pode retornar `mode: 'gameover'`.
   * Persistência: não grava — o provider chama `updateCharacterHpMana` após o retorno.
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
    
    // CORRIGIDO: Verificar se o inimigo ainda está vivo antes de processar
    if (!gameState.currentEnemy || gameState.currentEnemy.hp <= 0) {
      return { newState: gameState };
    }
    
    // Calcular delay aleatório entre 1.5 e 2.5 segundos se não especificado
    const finalDelay = delayMs ?? (1500 + Math.random() * 1000); // 1500-2500ms
    
    // Aguardar o delay antes de processar
    await new Promise(resolve => setTimeout(resolve, finalDelay));
    
    // CORRIGIDO: Verificar novamente após o delay se o inimigo ainda está vivo
    if (!gameState.currentEnemy || gameState.currentEnemy.hp <= 0) {
      return { newState: gameState };
    }
    
    
    // Processar ação do inimigo normalmente
    return this.processEnemyAction(gameState, playerDefendAction);
  }

  private static async resolvePlayerDefeat(
    gameState: GameState,
    enemyName: string,
    baseMessage: string,
    stateOverrides?: Partial<GameState>
  ): Promise<{ newState: GameState }> {
    const { player } = gameState;

    const buildGameOverState = (characterDeleted: boolean, suffix: string) => ({
      ...gameState,
      ...stateOverrides,
      player: {
        ...player,
        hp: 0,
        isDefending: false,
      },
      mode: 'gameover' as const,
      isPlayerTurn: true,
      gameMessage: `${baseMessage} ${suffix}`,
      ...(characterDeleted ? { characterDeleted: true } : {}),
    });

    try {
      const deathResult = await CemeteryService.killCharacter(
        player.id,
        'Battle defeat',
        enemyName
      );

      if (deathResult.success) {
        return {
          newState: buildGameOverState(
            true,
            'Você foi derrotado! Seu personagem foi perdido permanentemente.'
          ),
        };
      }
    } catch {
      // fallback tratado abaixo
    }

    return {
      newState: buildGameOverState(false, 'Você foi derrotado!'),
    };
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

    const { actionType } = decideEnemyAction(enemy);

    // LOG: Ação escolhida

    let message = '';
    let damage = 0;
    let actualDamage = 0;

    switch (actionType) {
      case 'attack':
        
        // Inimigos também podem ter críticos e duplo ataque baseado em seus stats
        const enemyDamageResult = this.calculateDamage(
          enemy.attack, 
          player.def,
          enemy.critical_chance || 0,
          enemy.critical_damage || 110,
          0, // Duplo ataque do inimigo baseado em velocidade seria implementado separadamente
          enemy.dexterity || 10,
          enemy.speed || 10
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
          } catch (error) {
            console.warn('[processEnemyAction] Erro ao calcular XP de defesa passiva:', error);
          }
        }
        
        // Aplicar dano
        const newHp = Math.max(0, player.hp - actualDamage);
        
        // CRÍTICO: Verificar se o jogador morreu e processar permadeath
        if (newHp <= 0) {
          return this.resolvePlayerDefeat(gameState, enemy.name, message);
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
        return { newState: updatedResultState, skillXpGains, skillMessages };

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
          return this.resolvePlayerDefeat(gameState, enemy.name, message, {
            currentEnemy: {
              ...enemy,
              mana: Math.max(0, enemy.mana - spellCost),
            },
          });
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
          const fallbackBehavior = getFallbackSpecialBehavior(enemy);
          if (fallbackBehavior.kind === 'heal') {
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
              gameMessage: fallbackBehavior.message.replace('{heal}', String(healAmount))
            };
            const updatedDefensiveHealState = SpellService.updateSpellCooldowns(defensiveHealState);
            return { newState: updatedDefensiveHealState };
          }

          damage = Math.floor(enemy.attack * (fallbackBehavior.multiplier || 1.3));
          actualDamage = player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
          message = fallbackBehavior.message.replace('{damage}', String(actualDamage));
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
          return this.resolvePlayerDefeat(gameState, enemy.name, message);
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
        return { newState: updatedSpecialResultState, skillXpGains, skillMessages: specialSkillMessages };

      default:
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
   * Próximo andar após vitória: persiste `floor` no banco, gera piso e novo inimigo.
   * Pré: recompensas já aplicadas ao jogador; chamado tipicamente após ação `continue` no provider.
   * Pós: `player.floor` incrementado, novo `currentFloor` e `currentEnemy`, `battleRewards` limpo pelo caller.
   * Persistência: CharacterService.updateCharacterFloor e leituras subsequentes de monstro/andar.
   */
  static async advanceToNextFloor(gameState: GameState): Promise<GameState> {
    const { player } = gameState;
    const nextFloor = player.floor + 1;
    

    try {
      // Limpar todos os caches antes de começar
      this.clearAllCaches();
      MonsterService.clearCache();

      // Atualizar andar no banco de dados ANTES de gerar novos dados
      
      const updateResult = await CharacterService.updateCharacterFloor(player.id, nextFloor);
      if (!updateResult.success) {
        console.error(`[GameService] ERRO ao atualizar andar:`, updateResult.error);
        throw new Error(updateResult.error || 'Erro ao atualizar andar do personagem');
      }

      // Obter dados do próximo andar
      const nextFloorData = await this.getFloorData(nextFloor);
      if (!nextFloorData) {
        throw new Error(`Erro ao gerar dados do andar ${nextFloor}`);
      }


      // Gerar novo inimigo para o próximo andar
      
      const nextEnemy = await this.generateEnemy(nextFloor);
      
      // Verificar se conseguiu gerar inimigo
      if (!nextEnemy) {
        console.error(`[GameService] Falha ao gerar inimigo para andar ${nextFloor}`);
        throw new Error(`Falha ao gerar inimigo para o andar ${nextFloor}`);
      }


      // Verificar se há evento especial (5% de chance)
      let specialEvent = null;
      const specialEventChance = Math.random();
      
      if (specialEventChance < 0.05) {
        try {
          const { data: eventData, error: eventError } = await supabase
            .rpc('get_special_event_for_floor', {
              p_floor: nextFloor
            });

          if (!eventError && eventData) {
            specialEvent = eventData;
          }
        } catch (error) {
          console.error('[GameService] Erro ao gerar evento especial (ignorando):', error);
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
        highestFloor: Math.max(gameState.highestFloor || 0, nextFloor)
      };

      
      return newGameState;

    } catch (error) {
      console.error(`[GameService] Erro crítico ao avançar para andar ${nextFloor}:`, error);
      
      // FALLBACK: Tentar gerar estado mínimo funcional
      
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

    const updatedPlayer = {
      ...player,
      hp: newHp,
      mana: newMana,
      gold: newGold,
    };

    const floorNum = updatedPlayer.floor;
    let currentFloor = gameState.currentFloor;
    if (!currentFloor || currentFloor.floorNumber !== floorNum) {
      currentFloor = (await this.getFloorData(floorNum)) ?? {
        floorNumber: floorNum,
        type: 'event' as FloorType,
        isCheckpoint: floorNum % 10 === 0,
        minLevel: Math.max(1, Math.floor(floorNum / 5)),
        description: `Andar ${floorNum}`,
      };
    }

    const enemy = await this.generateEnemy(floorNum);
    if (!enemy) {
      return {
        ...gameState,
        player: updatedPlayer,
        currentFloor,
        currentEnemy: null,
        currentSpecialEvent: null,
        mode: 'battle',
        gameMessage: `${message} Não foi possível gerar um inimigo para o andar ${floorNum}. Volte ao hub ou tente novamente.`,
        isPlayerTurn: true,
        battleRewards: null,
      };
    }

    return {
      ...gameState,
      player: updatedPlayer,
      currentFloor,
      currentEnemy: enemy,
      currentSpecialEvent: null,
      mode: 'battle',
      gameMessage: `${message} Um ${enemy.name} aparece!`,
      isPlayerTurn: true,
      battleRewards: null,
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