import { type Enemy, type GameState, type GamePlayer } from '../game-model';
import { SkillXpService, type SkillXpGain } from '../skill-xp.service';
import { SpellService } from '../spell.service';
import { EquipmentService } from '../equipment.service';
import { CemeteryService } from '../cemetery.service';
import { type EquipmentSlots } from '../models/equipment.model';
import { type ActionType } from '../game-model';

export class BattleService {
  /**
   * Calcular iniciativa baseada em velocidade e destreza
   */
  static calculateInitiative(speed: number, dexterity: number): number {
    const baseInitiative = speed;
    const dexBonus = Math.floor(dexterity * 0.5);
    const randomFactor = 0.9 + Math.random() * 0.2;
    const finalInitiative = Math.floor((baseInitiative + dexBonus) * randomFactor);

    return Math.max(1, finalInitiative);
  }

  /**
   * Calcular quantos turnos extras baseado na diferença de velocidade
   */
  static calculateExtraTurns(attackerSpeed: number, defenderSpeed: number): number {
    if (defenderSpeed <= 0) return 2;

    const speedDifference = attackerSpeed / defenderSpeed;
    let extraTurns = 0;

    if (speedDifference >= 3.5) {
      extraTurns = 3;
    } else if (speedDifference >= 2.5) {
      extraTurns = 2;
    } else if (speedDifference >= 1.8) {
      extraTurns = 1;
    }

    if (extraTurns < 3 && Math.random() < 0.2) {
      extraTurns += 1;
    }

    return Math.min(extraTurns, 3);
  }

  /**
   * Calcular o dano de ataque com críticos e duplo ataque
   */
  static calculateDamage(
    attackerAttack: number,
    defenderDefense: number,
    criticalChance: number = 0,
    criticalDamage: number = 110,
    doubleAttackChance: number = 0,
    attackerDexterity: number = 10,
    attackerSpeed: number = 10
  ): {
    damage: number;
    isCritical: boolean;
    isDoubleAttack: boolean;
    totalAttacks: number;
    damageBreakdown: string;
  } {
    const safeAttack = Number(attackerAttack) || 0;
    const safeDefense = Number(defenderDefense) || 0;

    if (safeAttack <= 0) {
      return {
        damage: 1,
        isCritical: false,
        isDoubleAttack: false,
        totalAttacks: 1,
        damageBreakdown: 'Dano mínimo: 1',
      };
    }

    const baseDamage = Math.max(1, Math.floor(safeAttack - safeDefense * 0.5));
    const critRoll = Math.random() * 100;
    const isCritical = critRoll < criticalChance;

    const enhancedDoubleAttackChance =
      doubleAttackChance +
      Math.floor((attackerDexterity - 10) * 0.5) +
      Math.floor((attackerSpeed - 10) * 0.3);
    const doubleRoll = Math.random() * 100;
    const isDoubleAttack = doubleRoll < Math.min(35, enhancedDoubleAttackChance);

    let finalDamage = baseDamage;
    let damageBreakdown = `Base: ${baseDamage}`;

    if (isCritical) {
      const critMultiplier = criticalDamage / 100;
      finalDamage = Math.floor(finalDamage * critMultiplier);
      damageBreakdown += ` → Crítico (${criticalDamage}%): ${finalDamage}`;
    }

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
      damageBreakdown,
    };
  }

  /**
   * Processar ação do jogador
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
    gameLogMessages?: {
      message: string;
      type: 'player_action' | 'damage' | 'system' | 'skill_xp';
    }[];
  }> {
    console.log(`[BattleService] Processando ação do jogador: ${action}`);
    const newState = { ...gameState };
    const gameLogMessages: {
      message: string;
      type: 'player_action' | 'damage' | 'system' | 'skill_xp';
    }[] = [];
    const skillXpGains: SkillXpGain[] = [];
    const skillMessages: string[] = [];
    let skipTurn = false;
    let message = '';
    let totalDamage = 0;

    switch (action) {
      case 'attack':
        if (newState.currentEnemy && newState.currentEnemy.hp > 0) {
          const playerEquipment = await this.getPlayerEquipmentSlots(newState.player.id);

          const damageResult = this.calculateDamage(
            newState.player.atk,
            newState.currentEnemy.defense,
            newState.player.critical_chance || 0,
            newState.player.critical_damage || 110,
            newState.player.double_attack_chance || 0,
            newState.player.dexterity || 10,
            newState.player.speed || 10
          );

          totalDamage = damageResult.damage;
          const isCritical = damageResult.isCritical;
          const isDoubleAttack = damageResult.isDoubleAttack;

          newState.currentEnemy.hp = Math.max(0, newState.currentEnemy.hp - totalDamage);

          if (newState.player.isDefending) {
            newState.player.isDefending = false;
          }

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
            type: 'player_action',
          });

          if (playerEquipment) {
            console.log(`[BattleService] Calculando skill XP para ataque com dano ${totalDamage}`);
            const attackSkillXp = SkillXpService.calculateAttackSkillXp(
              playerEquipment,
              totalDamage
            );

            if (attackSkillXp.length > 0) {
              skillXpGains.push(...attackSkillXp);

              try {
                const { messages: xpMessages, skillLevelUps } = await SkillXpService.applySkillXp(
                  newState.player.id,
                  attackSkillXp
                );

                for (const xpMessage of xpMessages) {
                  gameLogMessages.push({
                    message: xpMessage,
                    type: 'skill_xp',
                  });
                }

                skillMessages.push(...xpMessages);

                for (const levelUp of skillLevelUps) {
                  console.log(
                    `[BattleService] Skill level up: ${levelUp.skill} -> ${levelUp.newLevel}`
                  );
                }
              } catch (error) {
                console.error('[BattleService] Erro ao aplicar skill XP de ataque:', error);
              }
            }
          }

          if (newState.currentEnemy.hp <= 0) {
            gameLogMessages.push({
              message: `${newState.currentEnemy.name} foi derrotado!`,
              type: 'system',
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
          newState.player.defenseCooldown = 3;

          const defendMessage = `${newState.player.name} assumiu postura defensiva.`;
          gameLogMessages.push({
            message: defendMessage,
            type: 'player_action',
          });

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
                    type: 'skill_xp',
                  });
                }

                skillMessages.push(...xpMessages);
              } catch (error) {
                console.error('[BattleService] Erro ao aplicar skill XP de defesa:', error);
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
            newState.player.mana = Math.max(0, newState.player.mana - spell.mana_cost);
            spell.current_cooldown = spell.cooldown;

            let spellResult = '';
            let actualSpellValue = 0;

            if (spell.effect_type === 'damage' && newState.currentEnemy) {
              let magicDamage = spell.effect_value;

              if (newState.player.magic_attack) {
                magicDamage += Math.floor(newState.player.magic_attack * 0.5);
              }

              if (newState.player.magic_mastery && newState.player.magic_mastery > 1) {
                const masteryBonus = Math.floor(
                  magicDamage * (newState.player.magic_mastery - 1) * 0.1
                );
                magicDamage += masteryBonus;
              }

              actualSpellValue = magicDamage;
              newState.currentEnemy.hp = Math.max(0, newState.currentEnemy.hp - magicDamage);

              spellResult = `causando ${magicDamage} de dano mágico`;

              if (newState.currentEnemy.hp <= 0) {
                spellResult += ` e derrotando ${newState.currentEnemy.name}`;
              }
            } else if (spell.effect_type === 'heal') {
              let healAmount = spell.effect_value;

              if (newState.player.magic_attack) {
                healAmount += Math.floor(newState.player.magic_attack * 0.3);
              }

              if (newState.player.magic_mastery && newState.player.magic_mastery > 1) {
                const masteryBonus = Math.floor(
                  healAmount * (newState.player.magic_mastery - 1) * 0.1
                );
                healAmount += masteryBonus;
              }

              actualSpellValue = healAmount;
              newState.player.hp = Math.min(
                newState.player.max_hp,
                newState.player.hp + healAmount
              );
              spellResult = `restaurando ${healAmount} de vida`;
            }

            const spellMessage = `${newState.player.name} lançou ${spell.name} ${spellResult}!`;
            gameLogMessages.push({
              message: spellMessage,
              type: 'player_action',
            });

            const playerEquipment = await this.getPlayerEquipmentSlots(newState.player.id);
            const magicSkillXp = SkillXpService.calculateMagicSkillXp(
              spell.mana_cost,
              spell.effect_type === 'damage' ? actualSpellValue : 0,
              actualSpellValue,
              playerEquipment
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
                    type: 'skill_xp',
                  });
                }

                skillMessages.push(...xpMessages);
              } catch (error) {
                console.error('[BattleService] Erro ao aplicar skill XP de magia:', error);
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
        return this.processFleeResult(gameState);

      case 'consumable':
        if (consumableId) {
          try {
            const { ConsumableService } = await import('../consumable.service');
            const useResult = await ConsumableService.consumeItem(
              newState.player.id,
              consumableId,
              newState.player
            );

            if (useResult.success && useResult.data) {
              message = useResult.data.message;

              gameLogMessages.push({
                message: useResult.data.message,
                type: 'player_action',
              });

              // Poções NÃO encerram o turno - skipTurn = false
              skipTurn = false;
            } else {
              message = useResult.error || 'Erro ao usar item consumível.';
              skipTurn = true;
            }
          } catch (error) {
            console.error('[BattleService] Erro ao usar consumível:', error);
            message = 'Erro ao usar item consumível.';
            skipTurn = true;
          }
        } else {
          message = 'Item consumível não especificado.';
          skipTurn = true;
        }
        break;

      case 'special':
        // Ação especial do personagem (se implementada)
        message = 'Habilidade especial ainda não implementada.';
        skipTurn = true;
        break;

      case 'continue':
        // Avançar para o próximo andar
        try {
          console.log('[BattleService] Processando ação de continuar para próximo andar');
          const { GameService } = await import('../game.service');
          const updatedState = await GameService.advanceToNextFloor(newState);

          // CRÍTICO: Atualizar o estado com o resultado do avanço
          Object.assign(newState, updatedState);

          message = updatedState.gameMessage || 'Avançando para o próximo andar...';
          console.log(
            `[BattleService] Avanço processado - novo andar: ${updatedState.player.floor}`
          );
          skipTurn = false;
        } catch (error) {
          console.error('[BattleService] Erro ao avançar para próximo andar:', error);
          message = 'Erro ao avançar para o próximo andar';
          skipTurn = true;
        }
        break;

      case 'interact_event':
        // CORRIGIDO: Processar evento especial de verdade
        try {
          console.log('[BattleService] Processando interação com evento especial');
          const { GameService } = await import('../game.service');
          const updatedState = await GameService.processSpecialEventInteraction(newState);

          // CRÍTICO: Atualizar o estado com o resultado do evento
          Object.assign(newState, updatedState);

          message = updatedState.gameMessage || 'Evento especial processado com sucesso!';

          console.log(
            `[BattleService] Evento especial processado - novo modo: ${updatedState.mode}`
          );

          // Se o evento foi processado com sucesso, não pular turno para continuar o fluxo
          skipTurn = false;
        } catch (error) {
          console.error('[BattleService] Erro ao processar evento especial:', error);
          message = 'Erro ao processar evento especial';
          skipTurn = true;
        }
        break;

      default:
        message = 'Ação não reconhecida.';
        skipTurn = true;
        break;
    }

    if (newState.player.defenseCooldown > 0) {
      newState.player.defenseCooldown--;
    }

    newState.player.potionUsedThisTurn = false;

    console.log(`[BattleService] Ação processada: ${action}, mensagem: ${message}`);
    console.log(`[BattleService] skipTurn FINAL: ${skipTurn}`);
    console.log(`[BattleService] Skill XP gains:`, skillXpGains.length);
    console.log(`[BattleService] Game log messages:`, gameLogMessages.length);

    return {
      newState,
      skipTurn,
      message,
      skillXpGains,
      skillMessages,
      gameLogMessages,
    };
  }

  /**
   * Processar resultado da fuga
   */
  private static async processFleeResult(gameState: GameState): Promise<{
    newState: GameState;
    skipTurn: boolean;
    message: string;
    skillXpGains?: SkillXpGain[];
    skillMessages?: string[];
    gameLogMessages?: {
      message: string;
      type: 'player_action' | 'damage' | 'system' | 'skill_xp';
    }[];
  }> {
    const fleeResult = await this.processFleeAttempt(gameState);
    return {
      newState: fleeResult,
      skipTurn: fleeResult.fleeSuccessful || false,
      message: fleeResult.gameMessage || 'Tentativa de fuga processada',
      skillXpGains: [],
      skillMessages: [],
      gameLogMessages: [],
    };
  }

  /**
   * Função auxiliar para obter slots de equipamento do jogador
   */
  private static async getPlayerEquipmentSlots(playerId: string): Promise<EquipmentSlots | null> {
    try {
      const equipmentSlots = await EquipmentService.getEquippedItems(playerId);
      return equipmentSlots;
    } catch (error) {
      console.error('[BattleService] Erro ao obter equipamentos do jogador:', error);
      return null;
    }
  }

  /**
   * Processar morte do jogador
   */
  static async processPlayerDeath(
    gameState: GameState,
    player: GamePlayer,
    enemy: Enemy,
    deathMessage: string
  ): Promise<GameState> {
    try {
      const deathResult = await CemeteryService.killCharacter(
        player.id,
        'Battle defeat',
        enemy.name
      );

      if (deathResult.success) {
        return {
          ...gameState,
          player: {
            ...player,
            hp: 0,
            isDefending: false,
          },
          mode: 'gameover',
          isPlayerTurn: true,
          gameMessage: `${deathMessage} Você foi derrotado! Seu personagem foi perdido permanentemente.`,
          characterDeleted: true,
        };
      } else {
        return {
          ...gameState,
          player: {
            ...player,
            hp: 0,
            isDefending: false,
          },
          mode: 'gameover',
          isPlayerTurn: true,
          gameMessage: `${deathMessage} Você foi derrotado!`,
        };
      }
    } catch (error) {
      console.error(`[BattleService] Erro crítico ao processar morte:`, error);
      return {
        ...gameState,
        player: {
          ...player,
          hp: 0,
          isDefending: false,
        },
        mode: 'gameover',
        isPlayerTurn: true,
        gameMessage: `${deathMessage} Você foi derrotado!`,
      };
    }
  }

  /**
   * Processar tentativa de fuga
   */
  static async processFleeAttempt(gameState: GameState): Promise<GameState> {
    const { player, currentEnemy } = gameState;

    if (!currentEnemy) {
      return gameState;
    }

    const playerSpeed = player.speed || 10;
    const enemySpeed = currentEnemy.speed || 10;

    const speedDifference = playerSpeed - enemySpeed;
    const speedModifier = Math.floor(speedDifference * 2);
    let fleeChance = 70 + speedModifier;

    fleeChance = Math.max(15, Math.min(95, fleeChance));

    const fleeRoll = Math.random() * 100;
    const fleeSuccess = fleeRoll < fleeChance;

    if (fleeSuccess) {
      return {
        ...gameState,
        fleeSuccessful: true,
        currentEnemy: null,
        mode: 'fled',
        battleRewards: null,
        isPlayerTurn: true,
        gameMessage: `${player.name} fugiu da batalha com sucesso!`,
      };
    } else {
      const fleeFailDamage = Math.floor((currentEnemy.attack || 10) * 0.3);
      const newHp = Math.max(0, player.hp - fleeFailDamage);

      if (newHp <= 0) {
        return this.processPlayerDeath(
          gameState,
          player,
          currentEnemy,
          `${player.name} tentou fugir mas falhou!`
        );
      }

      return {
        ...gameState,
        player: {
          ...player,
          hp: newHp,
        },
        fleeSuccessful: false,
        gameMessage: `${player.name} tentou fugir mas falhou! Sofreu ${fleeFailDamage} de dano.`,
      };
    }
  }

  /**
   * Processar ação do inimigo
   */
  static async processEnemyAction(
    gameState: GameState,
    playerDefendAction: boolean
  ): Promise<{
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

    console.log(`[BattleService] === PROCESSANDO AÇÃO DO INIMIGO ===`);
    console.log(`[BattleService] Inimigo: ${enemy.name} (HP: ${enemy.hp}/${enemy.maxHp})`);

    SpellService.processOverTimeEffects(enemy);

    if (enemy.hp <= 0) {
      console.log(`[BattleService] Inimigo morreu por efeitos ao longo do tempo`);
      return {
        newState: {
          ...gameState,
          isPlayerTurn: true,
          gameMessage: `${enemy.name} foi derrotado por efeitos ao longo do tempo!`,
        },
      };
    }

    let actionType: 'attack' | 'spell' | 'special' = 'attack';

    const hasSpecialAbilities = enemy.special_abilities && enemy.special_abilities.length > 0;
    const isHighIntelligence = (enemy.intelligence || 10) > (enemy.strength || 10);

    let specialChance = 0.15;
    let spellChance = 0.2;

    switch (enemy.behavior) {
      case 'aggressive':
        specialChance = 0.25;
        spellChance = 0.1;
        break;
      case 'defensive':
        specialChance = 0.3;
        spellChance = 0.15;
        break;
      case 'balanced':
        if (isHighIntelligence) {
          spellChance = 0.35;
          specialChance = 0.2;
        } else {
          spellChance = 0.2;
          specialChance = 0.2;
        }
        break;
    }

    if (hasSpecialAbilities) {
      specialChance += 0.1;
    }

    if (hasSpecialAbilities && Math.random() < specialChance) {
      actionType = 'special';
    } else if (enemy.mana >= 10 && Math.random() < spellChance) {
      actionType = 'spell';
    }

    console.log(
      `[BattleService] Ação escolhida: ${actionType} (special: ${specialChance}, spell: ${spellChance})`
    );

    let message = '';
    let damage = 0;
    let actualDamage = 0;

    switch (actionType) {
      case 'attack': {
        console.log(`[BattleService] Executando ataque físico`);

        const enemyDamageResult = this.calculateDamage(
          enemy.attack,
          player.def,
          enemy.critical_chance || 0,
          enemy.critical_damage || 110,
          0,
          enemy.dexterity || 10,
          enemy.speed || 10
        );

        damage = enemyDamageResult.damage;

        if (player.isDefending || playerDefendAction) {
          actualDamage = Math.floor(damage * 0.15);

          let defenseMessage = `${enemy.name} atacou`;
          if (enemyDamageResult.isCritical) defenseMessage += ` com golpe crítico`;
          if (enemyDamageResult.isDoubleAttack)
            defenseMessage += ` ${enemyDamageResult.totalAttacks}x`;
          defenseMessage += `, mas você reduziu o dano de ${damage} para ${actualDamage} com sua defesa!`;
          message = defenseMessage;

          try {
            const blockedDamage = damage - actualDamage;
            const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(null, blockedDamage);
            skillXpGains.push(...defenseSkillXp);
            console.log(`[BattleService] XP de defesa por bloqueio:`, defenseSkillXp);
          } catch (error) {
            console.warn('[BattleService] Erro ao calcular XP de defesa:', error);
          }
        } else {
          actualDamage = damage;

          let attackMessage = `${enemy.name} atacou`;
          if (enemyDamageResult.isCritical) attackMessage += ` com golpe crítico`;
          if (enemyDamageResult.isDoubleAttack)
            attackMessage += ` ${enemyDamageResult.totalAttacks}x`;
          attackMessage += ` e causou ${actualDamage} de dano!`;
          message = attackMessage;

          try {
            const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(
              null,
              Math.floor(actualDamage * 0.3)
            );
            skillXpGains.push(...defenseSkillXp);
            console.log(`[BattleService] XP de defesa passiva:`, defenseSkillXp);
          } catch (error) {
            console.warn('[BattleService] Erro ao calcular XP de defesa passiva:', error);
          }
        }

        const newHp = Math.max(0, player.hp - actualDamage);

        if (newHp <= 0) {
          console.log(
            `[BattleService] Jogador ${player.name} morreu - iniciando processo de permadeath`
          );
          return {
            newState: await this.processPlayerDeath(gameState, player, enemy, message),
          };
        }

        const resultState = {
          ...gameState,
          player: {
            ...player,
            hp: newHp,
            isDefending: false,
            potionUsedThisTurn: false,
          },
          isPlayerTurn: true,
          gameMessage: message,
        };

        const skillMessages =
          skillXpGains.length > 0
            ? skillXpGains.map(
                gain => `+${gain.xp} XP em ${SkillXpService.getSkillDisplayName(gain.skill)}`
              )
            : undefined;

        const updatedResultState = SpellService.updateSpellCooldowns(resultState);
        console.log(`[BattleService] Ataque processado com sucesso. Mensagem: ${message}`);
        return { newState: updatedResultState, skillXpGains, skillMessages };
      }

      case 'spell': {
        console.log(`[BattleService] Executando magia`);
        const spellDamage = Math.floor(enemy.attack * 1.2);
        const spellCost = 10;

        if (player.isDefending || playerDefendAction) {
          actualDamage = Math.floor(spellDamage * 0.15);
          message = `${enemy.name} lançou uma magia, mas você reduziu o dano de ${spellDamage} para ${actualDamage} com sua defesa!`;

          try {
            const equipmentSlotsResponse = await EquipmentService.getEquippedItems(player.id);
            const equipmentSlots = equipmentSlotsResponse || null;
            const blockedDamage = Math.floor((spellDamage - actualDamage) * 0.5);

            const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(
              equipmentSlots,
              blockedDamage
            );
            skillXpGains.push(...defenseSkillXp);
          } catch (error) {
            console.warn('[BattleService] Erro ao calcular XP de defesa mágica:', error);
          }
        } else {
          actualDamage = spellDamage;
          message = `${enemy.name} lançou uma magia e causou ${actualDamage} de dano mágico!`;
        }

        const newSpellHp = Math.max(0, player.hp - actualDamage);

        if (newSpellHp <= 0) {
          console.log(
            `[BattleService] Jogador ${player.name} morreu por magia - iniciando processo de permadeath`
          );
          return {
            newState: await this.processPlayerDeath(gameState, player, enemy, message),
          };
        }

        const spellResultState = {
          ...gameState,
          player: {
            ...player,
            hp: newSpellHp,
            isDefending: false,
            potionUsedThisTurn: false,
          },
          currentEnemy: {
            ...enemy,
            mana: Math.max(0, enemy.mana - spellCost),
          },
          isPlayerTurn: true,
          gameMessage: message,
        };

        const spellSkillMessages =
          skillXpGains.length > 0
            ? skillXpGains.map(
                gain => `+${gain.xp} XP em ${SkillXpService.getSkillDisplayName(gain.skill)}`
              )
            : undefined;

        const updatedSpellResultState = SpellService.updateSpellCooldowns(spellResultState);
        console.log(`[BattleService] Magia processada com sucesso. Mensagem: ${message}`);
        return {
          newState: updatedSpellResultState,
          skillXpGains,
          skillMessages: spellSkillMessages,
        };
      }

      case 'special': {
        const specialAbilities = enemy.special_abilities || [];

        if (specialAbilities.length > 0) {
          const randomAbility =
            specialAbilities[Math.floor(Math.random() * specialAbilities.length)];
          const abilityName = randomAbility.split(':')[0].trim();

          if (
            randomAbility.includes('Regenera') ||
            randomAbility.includes('Recupera') ||
            randomAbility.includes('cura')
          ) {
            const healAmount = Math.floor(enemy.maxHp * (0.1 + Math.random() * 0.15));
            const newEnemyHp = Math.min(enemy.maxHp, enemy.hp + healAmount);
            const healResultState = {
              ...gameState,
              player: {
                ...player,
                potionUsedThisTurn: false,
              },
              currentEnemy: {
                ...enemy,
                hp: newEnemyHp,
              },
              isPlayerTurn: true,
              gameMessage: `${enemy.name} usou ${abilityName} e recuperou ${healAmount} HP!`,
            };
            const updatedHealResultState = SpellService.updateSpellCooldowns(healResultState);
            return { newState: updatedHealResultState };
          } else if (
            randomAbility.includes('dano') ||
            randomAbility.includes('ATK') ||
            randomAbility.includes('Ataque')
          ) {
            damage = Math.floor(enemy.attack * (1.3 + Math.random() * 0.7));
            actualDamage =
              player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
            message = `${enemy.name} usou ${abilityName} e causou ${actualDamage} de dano!`;
          } else if (randomAbility.includes('crítico') || randomAbility.includes('Crítico')) {
            damage = Math.floor(enemy.attack * 2.0);
            actualDamage =
              player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
            message = `${enemy.name} usou ${abilityName} com um golpe crítico devastador! ${actualDamage} de dano!`;
          } else if (randomAbility.includes('área') || randomAbility.includes('todos')) {
            damage = Math.floor(enemy.attack * 1.2);
            actualDamage =
              player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
            message = `${enemy.name} usou ${abilityName} em área! ${actualDamage} de dano!`;
          } else {
            damage = Math.floor(enemy.attack * (1.2 + Math.random() * 0.5));
            actualDamage =
              player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
            message = `${enemy.name} usou ${abilityName}! ${actualDamage} de dano!`;
          }
        } else {
          switch (enemy.behavior) {
            case 'aggressive': {
              damage = Math.floor(enemy.attack * 1.5);
              actualDamage =
                player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
              message = `${enemy.name} usou Ataque Furioso e causou ${actualDamage} de dano!`;
              break;
            }
            case 'defensive': {
              const healAmount = Math.floor(enemy.maxHp * 0.15);
              const newEnemyHp = Math.min(enemy.maxHp, enemy.hp + healAmount);
              const defensiveHealState = {
                ...gameState,
                player: {
                  ...player,
                  potionUsedThisTurn: false,
                },
                currentEnemy: {
                  ...enemy,
                  hp: newEnemyHp,
                },
                isPlayerTurn: true,
                gameMessage: `${enemy.name} se concentrou e recuperou ${healAmount} HP!`,
              };
              const updatedDefensiveHealState =
                SpellService.updateSpellCooldowns(defensiveHealState);
              return { newState: updatedDefensiveHealState };
            }
            default: {
              damage = Math.floor(enemy.attack * 1.3);
              actualDamage =
                player.isDefending || playerDefendAction ? Math.floor(damage * 0.15) : damage;
              message = `${enemy.name} usou uma habilidade especial e causou ${actualDamage} de dano!`;
            }
          }
        }

        if (actualDamage > 0) {
          try {
            const equipmentSlotsResponse = await EquipmentService.getEquippedItems(player.id);
            const equipmentSlots = equipmentSlotsResponse || null;

            if (player.isDefending || playerDefendAction) {
              const blockedDamage = damage - actualDamage;
              const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(
                equipmentSlots,
                blockedDamage
              );
              skillXpGains.push(...defenseSkillXp);
            } else {
              const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(
                equipmentSlots,
                Math.floor(actualDamage * 0.2)
              );
              skillXpGains.push(...defenseSkillXp);
            }
          } catch (error) {
            console.warn('[BattleService] Erro ao calcular XP de defesa especial:', error);
          }
        }

        const newSpecialHp = Math.max(0, player.hp - actualDamage);

        if (newSpecialHp <= 0) {
          console.log(
            `[BattleService] Jogador ${player.name} morreu por habilidade especial - iniciando processo de permadeath`
          );
          return {
            newState: await this.processPlayerDeath(gameState, player, enemy, message),
          };
        }

        const specialResultState = {
          ...gameState,
          player: {
            ...player,
            hp: newSpecialHp,
            isDefending: false,
            potionUsedThisTurn: false,
          },
          isPlayerTurn: true,
          gameMessage: message,
        };

        const specialSkillMessages =
          skillXpGains.length > 0
            ? skillXpGains.map(
                gain => `+${gain.xp} XP em ${SkillXpService.getSkillDisplayName(gain.skill)}`
              )
            : undefined;

        const updatedSpecialResultState = SpellService.updateSpellCooldowns(specialResultState);
        console.log(
          `[BattleService] Habilidade especial processada com sucesso. Mensagem: ${message}`
        );
        return {
          newState: updatedSpecialResultState,
          skillXpGains,
          skillMessages: specialSkillMessages,
        };
      }

      default: {
        console.log(`[BattleService] ERRO: Ação desconhecida: ${actionType}`);
        const defaultState = {
          ...gameState,
          player: {
            ...gameState.player,
            potionUsedThisTurn: false,
          },
          isPlayerTurn: true,
        };
        const updatedDefaultState = SpellService.updateSpellCooldowns(defaultState);
        return { newState: updatedDefaultState };
      }
    }
  }
}
