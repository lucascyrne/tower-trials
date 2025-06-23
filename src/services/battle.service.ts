import { type Enemy, type GameState, type GamePlayer } from '../models/game.model';
import { SkillXpService, type SkillXpGain } from './skill-xp.service';
import { SpellService } from './spell.service';
import { EquipmentService } from './equipment.service';
import { CemeteryService } from './cemetery.service';
import { type EquipmentSlots } from '../models/equipment.model';
import { type ActionType } from '../models/game.model';
import { NumberValidator } from '@/utils/number-validator';
import { SlotService } from './slot.service';
import { ConsumableService } from './consumable.service';
import { GameService } from './game.service';
import { useGameStateStore } from '../stores/useGameStateStore';
import { useCharacterStore } from '../stores/useCharacterStore';
import { useBattleStore } from '../stores/useBattleStore';
import { useLogStore } from '../stores/useLogStore';
import { BattleLoggerService } from './battle-logger.service';
import { LoggingUtils } from '@/utils/logging-utils';
import { CharacterStatsService } from './character-stats.service';

export class BattleService {
  /**
   * NOVO: Processar ação do jogador usando exclusivamente as stores
   * Este método demonstra como trabalhar completamente com Zustand
   */
  static async processPlayerActionFromStores(
    action: ActionType,
    spellId?: string,
    consumableId?: string
  ): Promise<boolean> {
    // const gameStateStore = useGameStateStore.getState();
    const characterStore = useCharacterStore.getState();
    const battleStore = useBattleStore.getState();

    try {
      // Iniciar o processamento usando a store de batalha
      battleStore.setProcessingAction(true);

      // Obter estado atual das stores
      // const currentGameState = gameStateStore.gameState;
      const selectedCharacter = characterStore.selectedCharacter;

      if (!selectedCharacter) {
        console.warn('[BattleService] Nenhum personagem selecionado');
        return false;
      }

      if (battleStore.isProcessingAction) {
        console.warn('[BattleService] Já processando ação');
        return false;
      }

      // Processar usando o método tradicional mas sem estado externo
      const result = await this.processPlayerAction(action, undefined, spellId, consumableId);

      // As stores já foram atualizadas dentro do método
      BattleLoggerService.log('info', 'BattleService', `Ação processada via stores: ${action}`, {
        success: true,
        skipTurn: result.skipTurn,
      });

      return true;
    } catch (error) {
      console.error('[BattleService] Erro ao processar ação via stores:', error);
      BattleLoggerService.logError('BattleService', error as Error, {
        action,
        spellId,
        consumableId,
      });
      return false;
    } finally {
      battleStore.setProcessingAction(false);
    }
  }

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
   * ✅ ATUALIZADO: Calcular o dano de ataque usando stats efetivos (incluindo buffs/debuffs)
   */
  static calculateDamage(
    attacker: GamePlayer | Enemy,
    defender: GamePlayer | Enemy,
    attackerDexterity: number = 10,
    attackerSpeed: number = 10
  ): {
    damage: number;
    isCritical: boolean;
    isDoubleAttack: boolean;
    totalAttacks: number;
    damageBreakdown: string;
  } {
    // ✅ CORREÇÃO: Usar stats efetivos incluindo modificadores temporários
    const attackerStats = CharacterStatsService.calculateEffectiveStats(attacker);
    const defenderStats = CharacterStatsService.calculateEffectiveStats(defender);

    const safeAttack = attackerStats.atk || 0;
    const safeDefense = defenderStats.def || 0;
    const criticalChance = attackerStats.critical_chance || 0;
    const criticalDamage = attackerStats.critical_damage || 110;

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

    // ✅ CORREÇÃO: Calcular double attack chance baseado nos stats efetivos
    const baseDoubleAttackChance =
      ('double_attack_chance' in attacker ? attacker.double_attack_chance : 0) || 0;
    const enhancedDoubleAttackChance =
      baseDoubleAttackChance +
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
   * ATUALIZADO: Integrado com Zustand stores para melhor controle de estado
   */
  static async processPlayerAction(
    action: ActionType,
    gameState?: GameState,
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
    // Integração com stores
    const gameStateStore = useGameStateStore.getState();
    const characterStore = useCharacterStore.getState();
    // const battleStore = useBattleStore.getState();
    const logStore = useLogStore.getState();

    // Usar estado da store se não fornecido
    const currentState = gameState || gameStateStore.gameState;

    console.log(`[BattleService] Processando ação do jogador: ${action}`);
    BattleLoggerService.logPlayerAction(action, { spellId, consumableId });

    // ✅ CORREÇÃO: Criar cópia profunda para evitar mutação de objetos read-only
    const newState = {
      ...currentState,
      player: { ...currentState.player }, // Cópia do player
      currentEnemy: currentState.currentEnemy ? { ...currentState.currentEnemy } : null, // Cópia do enemy
    };

    const gameLogMessages: {
      message: string;
      type: 'player_action' | 'damage' | 'system' | 'skill_xp';
    }[] = [];
    const skillXpGains: SkillXpGain[] = [];
    const skillMessages: string[] = [];
    let skipTurn = false;
    let message = '';
    let totalDamage = 0;

    // ✅ CORREÇÃO: Processar efeitos ao longo do tempo no INÍCIO do turno do jogador
    console.log(`[BattleService] Processando efeitos ao longo do tempo no início do turno...`);
    if (newState.player.active_effects) {
      const playerEffectMessages = SpellService.processOverTimeEffects(newState.player);
      if (playerEffectMessages.length > 0) {
        console.log(`[BattleService] Efeitos do jogador:`, playerEffectMessages);
        // Adicionar às mensagens do log se necessário
        gameLogMessages.push(
          ...playerEffectMessages.map(msg => ({ message: msg, type: 'system' as const }))
        );
      }
    }

    if (newState.currentEnemy?.active_effects) {
      const enemyEffectMessages = SpellService.processOverTimeEffects(newState.currentEnemy);
      if (enemyEffectMessages.length > 0) {
        console.log(`[BattleService] Efeitos do inimigo:`, enemyEffectMessages);
        // Adicionar às mensagens do log se necessário
        gameLogMessages.push(
          ...enemyEffectMessages.map(msg => ({ message: msg, type: 'system' as const }))
        );
      }
    }

    switch (action) {
      case 'attack':
        if (newState.currentEnemy && newState.currentEnemy.hp > 0) {
          const playerEquipment = await this.getPlayerEquipmentSlots(newState.player.id);

          const damageResult = this.calculateDamage(
            newState.player,
            newState.currentEnemy,
            newState.player.dexterity || 10,
            newState.player.speed || 10
          );

          totalDamage = damageResult.damage;
          const isCritical = damageResult.isCritical;
          const isDoubleAttack = damageResult.isDoubleAttack;
          const totalAttacks = damageResult.totalAttacks;

          newState.currentEnemy.hp = Math.max(0, newState.currentEnemy.hp - totalDamage);

          if (newState.player.isDefending) {
            newState.player.isDefending = false;
          }

          // ✅ CORREÇÃO CRÍTICA: Ataques devem processar turno do inimigo (skipTurn = false)
          skipTurn = false;

          // ✅ CORREÇÃO: Criar mensagem detalhada de ataque para o log
          let attackMessage = `${newState.player.name} atacou ${newState.currentEnemy.name}`;

          if (isDoubleAttack) {
            attackMessage += ` com duplo ataque (${totalAttacks}x)`;
          }

          if (isCritical) {
            attackMessage += ` causando dano crítico`;
          }

          attackMessage += ` causando ${totalDamage} de dano!`;

          // ✅ ADICIONAR MENSAGEM DE ATAQUE AO LOG
          gameLogMessages.push({
            message: attackMessage,
            type: 'player_action',
          });

          // ✅ ADICIONAR MENSAGEM DE DANO AO LOG
          if (isDoubleAttack && isCritical) {
            gameLogMessages.push({
              message: `💥 Duplo ataque crítico! ${totalDamage} de dano total!`,
              type: 'damage',
            });
          } else if (isDoubleAttack) {
            gameLogMessages.push({
              message: `⚔️ Duplo ataque! ${totalDamage} de dano total!`,
              type: 'damage',
            });
          } else if (isCritical) {
            gameLogMessages.push({
              message: `💥 Ataque crítico! ${totalDamage} de dano!`,
              type: 'damage',
            });
          } else {
            gameLogMessages.push({
              message: `⚔️ ${totalDamage} de dano causado`,
              type: 'damage',
            });
          }

          if (playerEquipment) {
            console.log(`[BattleService] Calculando skill XP para ataque com dano ${totalDamage}`);
            const attackSkillXp = SkillXpService.calculateAttackSkillXp(
              playerEquipment,
              totalDamage
            );

            if (attackSkillXp.length > 0) {
              skillXpGains.push(...attackSkillXp);

              // ✅ ADICIONAR MENSAGENS DE SKILL XP AO LOG
              for (const skillGain of attackSkillXp) {
                const skillDisplayName = SkillXpService.getSkillDisplayName(skillGain.skill);
                gameLogMessages.push({
                  message: `+${skillGain.xp} XP em ${skillDisplayName}${skillGain.isOffHand ? ' (off-hand)' : ''}`,
                  type: 'skill_xp',
                });
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
            // Mensagem baseada no tipo de ataque realizado
            let attackType = '';
            if (isDoubleAttack) attackType += 'duplo ';
            if (isCritical) attackType += 'crítico ';
            message = `Ataque ${attackType}realizado com sucesso!`;
          }
        }
        break;

      case 'defend':
        if (newState.player.defenseCooldown === 0) {
          newState.player.isDefending = true;
          newState.player.defenseCooldown = 3;

          // ✅ CORREÇÃO CRÍTICA: Defesa bem-sucedida deve processar turno do inimigo (skipTurn = false)
          skipTurn = false;

          const defendMessage = `${newState.player.name} assumiu postura defensiva.`;

          // ✅ ADICIONAR MENSAGEM DE DEFESA AO LOG
          gameLogMessages.push({
            message: defendMessage,
            type: 'player_action',
          });

          const playerEquipment = await this.getPlayerEquipmentSlots(newState.player.id);
          if (playerEquipment) {
            const defenseSkillXp = SkillXpService.calculateDefenseSkillXp(playerEquipment, 0);

            if (defenseSkillXp.length > 0) {
              skillXpGains.push(...defenseSkillXp);

              // ✅ ADICIONAR MENSAGENS DE SKILL XP DE DEFESA AO LOG
              for (const skillGain of defenseSkillXp) {
                const skillDisplayName = SkillXpService.getSkillDisplayName(skillGain.skill);
                gameLogMessages.push({
                  message: `+${skillGain.xp} XP em ${skillDisplayName}`,
                  type: 'skill_xp',
                });
              }
            }
          }

          message = defendMessage;
        } else {
          const cooldownMessage = `Defesa está em cooldown por mais ${newState.player.defenseCooldown} turnos.`;
          gameLogMessages.push({
            message: cooldownMessage,
            type: 'system',
          });
          message = cooldownMessage;
          skipTurn = true;
        }
        break;

      case 'spell':
        if (spellId) {
          const spell = newState.player.spells.find(s => s.id === spellId);
          if (spell && newState.player.mana >= spell.mana_cost && spell.current_cooldown === 0) {
            newState.player.mana = Math.max(0, newState.player.mana - spell.mana_cost);

            // ✅ CORREÇÃO: Deep copy para evitar erro "Cannot assign to read only property"
            newState.player.spells = newState.player.spells.map(s =>
              s.id === spellId ? { ...s, current_cooldown: s.cooldown } : { ...s }
            );

            let spellResult = '';
            let actualSpellValue = 0;

            // ✅ NOVA LÓGICA: Usar SpellService.applySpellEffect para processar todos os tipos de magia
            const target = spell.effect_type === 'damage' ? newState.currentEnemy : newState.player;

            if (target) {
              const spellEffectResult = SpellService.applySpellEffect(
                spell,
                newState.player,
                target
              );

              if (spellEffectResult.success) {
                // ✅ CORREÇÃO CRÍTICA: Corrigir lógica invertida - se endsTurn é true, devemos pular o turno
                skipTurn = spellEffectResult.endsTurn;

                spellResult = spellEffectResult.message;
                message = spellResult;

                // ✅ ADICIONAR MENSAGEM DE MAGIA AO LOG
                gameLogMessages.push({
                  message: `${newState.player.name} lançou ${spell.name}`,
                  type: 'player_action',
                });

                gameLogMessages.push({
                  message: spellResult,
                  type: spell.effect_type === 'damage' ? 'damage' : 'system',
                });

                // ✅ CALCULAR E ADICIONAR SKILL XP DE MAGIA
                const playerEquipment = await this.getPlayerEquipmentSlots(newState.player.id);
                const magicSkillXp = SkillXpService.calculateMagicSkillXp(
                  spell.mana_cost,
                  spell.effect_type === 'damage' ? spell.effect_value : 0,
                  actualSpellValue,
                  playerEquipment
                );

                if (magicSkillXp.length > 0) {
                  skillXpGains.push(...magicSkillXp);

                  // ✅ ADICIONAR MENSAGENS DE SKILL XP DE MAGIA AO LOG
                  for (const skillGain of magicSkillXp) {
                    const skillDisplayName = SkillXpService.getSkillDisplayName(skillGain.skill);
                    gameLogMessages.push({
                      message: `+${skillGain.xp} XP em ${skillDisplayName}${skillGain.isOffHand ? ' (off-hand)' : ''}`,
                      type: 'skill_xp',
                    });
                  }
                }
              } else {
                spellResult = 'A magia falhou!';
                message = spellResult;
                skipTurn = false;

                gameLogMessages.push({
                  message: `${newState.player.name} tentou lançar ${spell.name}, mas a magia falhou!`,
                  type: 'system',
                });
              }
            }
          } else {
            if (!spell) {
              message = 'Magia não encontrada!';
            } else if (newState.player.mana < spell.mana_cost) {
              message = `Mana insuficiente! Necessário: ${spell.mana_cost}, Atual: ${newState.player.mana}`;
            } else if (spell.current_cooldown > 0) {
              message = `${spell.name} está em recarga por mais ${spell.current_cooldown} turnos.`;
            }

            gameLogMessages.push({
              message: message,
              type: 'system',
            });
            skipTurn = true;
          }
        }
        break;

      case 'flee':
        return this.processFleeResult(gameState || gameStateStore.gameState);

      case 'consumable':
        if (consumableId) {
          try {
            console.log(`[BattleService] Processando consumível: ${consumableId}`);

            // NOVO: Verificar se é um slot (formato: "slot_X") ou consumível direto
            if (consumableId.startsWith('slot_')) {
              // Usar poção do slot
              const slotPosition = parseInt(consumableId.replace('slot_', ''));
              console.log(`[BattleService] Usando poção do slot ${slotPosition}`);

              const slotResult = await SlotService.consumePotionFromSlot(
                newState.player.id,
                slotPosition
              );

              if (slotResult.success && slotResult.data) {
                // CRÍTICO: Atualizar o estado do jogador com os novos valores
                newState.player = {
                  ...newState.player,
                  hp: Math.floor(Number(slotResult.data.new_hp) || newState.player.hp),
                  mana: Math.floor(Number(slotResult.data.new_mana) || newState.player.mana),
                };

                message = slotResult.data.message;

                // ✅ FONTE ÚNICA: Usar LoggingUtils para log de consumível
                LoggingUtils.logConsumableUse(
                  newState.player.name,
                  'Poção',
                  slotResult.data.message.replace(`${newState.player.name} `, ''),
                  slotPosition,
                  {
                    playerId: newState.player.id,
                    playerName: newState.player.name,
                    floorNumber: newState.player.floor,
                  }
                );

                skipTurn = false;

                console.log(
                  `[BattleService] Poção do slot usada com sucesso - HP: ${newState.player.hp}, Mana: ${newState.player.mana}`
                );
              } else {
                message = slotResult.error || 'Erro ao usar poção do slot.';
                skipTurn = true;
                console.error(`[BattleService] Erro ao usar poção do slot:`, slotResult.error);
              }
            } else {
              // Usar consumível direto do inventário
              console.log(
                `[BattleService] Usando consumível direto do inventário: ${consumableId}`
              );

              // Criar uma cópia do player para ser modificada pelo service
              const playerCopy = { ...newState.player };

              const useResult = await ConsumableService.consumeItem(
                newState.player.id,
                consumableId,
                playerCopy
              );

              if (useResult.success && useResult.data) {
                // CRÍTICO: Atualizar o estado do jogador com os valores modificados
                newState.player = {
                  ...newState.player,
                  hp: Math.floor(Number(playerCopy.hp) || newState.player.hp),
                  mana: Math.floor(Number(playerCopy.mana) || newState.player.mana),
                  // Garantir que outros valores numéricos sejam válidos
                  atk: Math.floor(Number(playerCopy.atk) || newState.player.atk),
                  def: Math.floor(Number(playerCopy.def) || newState.player.def),
                };

                message = useResult.data.message;

                // ✅ FONTE ÚNICA: Usar LoggingUtils para log de consumível direto
                LoggingUtils.logConsumableUse(
                  newState.player.name,
                  'Consumível',
                  useResult.data.message.replace(`${newState.player.name} `, ''),
                  undefined,
                  {
                    playerId: newState.player.id,
                    playerName: newState.player.name,
                    consumableId: consumableId,
                    floorNumber: newState.player.floor,
                  }
                );

                skipTurn = false;

                console.log(
                  `[BattleService] Consumível direto usado com sucesso - HP: ${newState.player.hp}, Mana: ${newState.player.mana}`
                );
              } else {
                message = useResult.error || 'Erro ao usar item consumível.';
                skipTurn = true;
              }
            }

            console.log(`[BattleService] Turno NÃO consumido para ação de consumível`);
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
        // Processar evento especial
        try {
          console.log('[BattleService] Processando interação com evento especial');
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

    if (action !== 'consumable') {
      newState.player.potionUsedThisTurn = false;
    }

    // CRÍTICO: Validar todos os valores numéricos do jogador antes de retornar
    newState.player = NumberValidator.validatePlayerStats(
      newState.player as unknown as Record<string, unknown>
    ) as unknown as typeof newState.player;

    // CRÍTICO: Validar valores do inimigo se existir
    if (newState.currentEnemy) {
      newState.currentEnemy = NumberValidator.validateEnemyStats(
        newState.currentEnemy as unknown as Record<string, unknown>
      ) as unknown as typeof newState.currentEnemy;
    }

    // NOVO: Atualizar stores diretamente se não foi fornecido estado externo
    if (!gameState) {
      gameStateStore.setGameState(newState);

      // Adicionar mensagens ao log
      gameLogMessages.forEach(logMsg => {
        logStore.addGameLogMessage(
          logMsg.message,
          logMsg.type as 'player_action' | 'damage' | 'system' | 'skill_xp'
        );
      });

      // Aplicar skill XP se houver personagem selecionado
      if (skillXpGains.length > 0 && characterStore.selectedCharacter) {
        skillXpGains.forEach(gain => {
          console.log(`[BattleService] Aplicando ${gain.xp} XP em ${gain.skill}`);
        });
      }
    }

    BattleLoggerService.log(
      'info',
      'BattleService',
      `Ação processada: ${action}, skipTurn: ${skipTurn}`,
      {
        playerHp: newState.player.hp,
        playerMana: newState.player.mana,
        skillXpGains: skillXpGains.length,
      }
    );

    console.log(`[BattleService] Ação processada: ${action}, mensagem: ${message}`);
    console.log(
      `[BattleService] Player HP: ${newState.player.hp}/${newState.player.max_hp}, Mana: ${newState.player.mana}/${newState.player.max_mana}`
    );
    console.log(`[BattleService] skipTurn FINAL: ${skipTurn} (poções nunca consomem turno)`);
    console.log(`[BattleService] Skill XP gains:`, skillXpGains.length);

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

      // ✅ CORREÇÃO: Criar nova cópia do player em vez de modificar diretamente
      const deadPlayer = {
        ...player,
        hp: 0,
        isDefending: false,
      };

      if (deathResult.success) {
        return {
          ...gameState,
          player: deadPlayer,
          mode: 'gameover',
          isPlayerTurn: true,
          gameMessage: `${deathMessage} Você foi derrotado! Seu personagem foi perdido permanentemente.`,
          characterDeleted: true,
        };
      } else {
        return {
          ...gameState,
          player: deadPlayer,
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
      // ✅ CRÍTICO: Finalizar logs da batalha em caso de fuga bem-sucedida
      LoggingUtils.logSpecialEvent('flee_success', `${player.name} fugiu da batalha com sucesso!`, {
        playerId: player.id,
        playerName: player.name,
        floorNumber: player.floor,
      });

      BattleLoggerService.endBattle('flee', {
        reason: 'Fuga bem-sucedida pelo sistema',
        playerName: player.name,
      });

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

      // ✅ CORREÇÃO: Criar nova cópia do player em vez de modificar diretamente
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

    // ✅ CORREÇÃO: Criar cópias dos objetos para evitar mutação read-only
    const enemy = { ...gameState.currentEnemy };
    const player = { ...gameState.player };
    const skillXpGains: SkillXpGain[] = [];

    console.log(`[BattleService] === PROCESSANDO AÇÃO DO INIMIGO ===`);
    console.log(`[BattleService] Inimigo: ${enemy.name} (HP: ${enemy.hp}/${enemy.maxHp})`);

    // ✅ CORREÇÃO: Processar efeitos ao longo do tempo no INÍCIO do turno do inimigo
    console.log(`[BattleService] Processando efeitos ao longo do tempo do inimigo...`);
    const enemyEffectMessages = SpellService.processOverTimeEffects(enemy);
    if (enemyEffectMessages.length > 0) {
      console.log(`[BattleService] Efeitos do inimigo:`, enemyEffectMessages);
    }

    // ✅ CORREÇÃO: Também processar efeitos do jogador no turno do inimigo
    console.log(`[BattleService] Processando efeitos ao longo do tempo do jogador...`);
    const playerEffectMessages = SpellService.processOverTimeEffects(player);
    if (playerEffectMessages.length > 0) {
      console.log(`[BattleService] Efeitos do jogador:`, playerEffectMessages);
    }

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
          enemy,
          player,
          enemy.dexterity || 10,
          enemy.speed || 10
        );

        damage = enemyDamageResult.damage;

        if (player.isDefending || playerDefendAction) {
          actualDamage = Math.floor(damage * 0.15);

          // ✅ FONTE ÚNICA: Usar LoggingUtils para log de ataque do inimigo defendido
          LoggingUtils.logEnemyAttack(enemy.name, player.name, actualDamage, true, false, {
            enemyName: enemy.name,
            playerName: player.name,
            damage: actualDamage,
            floorNumber: player.floor,
          });

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

          // ✅ FONTE ÚNICA: Usar LoggingUtils para log de ataque do inimigo normal
          LoggingUtils.logEnemyAttack(enemy.name, player.name, actualDamage, false, false, {
            enemyName: enemy.name,
            playerName: player.name,
            damage: actualDamage,
            floorNumber: player.floor,
          });

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

          // ✅ FONTE ÚNICA: Usar LoggingUtils para log de magia do inimigo defendida
          LoggingUtils.logSpellCast(enemy.name, 'Magia', player.name, actualDamage, 'damage', {
            enemyName: enemy.name,
            playerName: player.name,
            damage: actualDamage,
            floorNumber: player.floor,
          });

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

          // ✅ FONTE ÚNICA: Usar LoggingUtils para log de magia do inimigo normal
          LoggingUtils.logSpellCast(enemy.name, 'Magia', player.name, actualDamage, 'damage', {
            enemyName: enemy.name,
            playerName: player.name,
            damage: actualDamage,
            floorNumber: player.floor,
          });

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
