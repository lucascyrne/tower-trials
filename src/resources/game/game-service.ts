'use client';

import { createBrowserClient } from '@supabase/ssr';
import { ActionType, Enemy, GameResponse, GameState, GamePlayer, Floor, FloorType } from './game-model';
import { defaultPlayer } from './game-context';
import { MonsterService } from './monster.service';
import { Monster } from './models/monster.model';
import { SpellService } from './spell.service';

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
  private static supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  /**
   * Converter monstro para inimigo
   * @param monster Monstro do banco de dados
   * @returns Inimigo formatado para o jogo
   */
  private static monsterToEnemy(monster: Monster): Enemy {
    return {
      id: parseInt(monster.id),
      name: monster.name,
      level: monster.min_floor,
      hp: monster.hp,
      maxHp: monster.hp,
      attack: monster.atk,
      defense: monster.def,
      image: '👾',
      behavior: monster.behavior,
      mana: monster.mana,
      reward_xp: monster.reward_xp,
      reward_gold: monster.reward_gold,
      active_effects: {
        buffs: [],
        debuffs: [],
        dots: [],
        hots: []
      }
    };
  }

  /**
   * Gerar inimigo para o andar atual
   * @param floor Andar atual
   * @returns Inimigo gerado
   */
  static async generateEnemy(floor: number): Promise<Enemy | null> {
    const response = await MonsterService.getMonsterForFloor(floor);
    if (response.success && response.data) {
      return this.monsterToEnemy(response.data);
    }
    return null;
  }

  /**
   * Salvar o progresso do jogo
   * @param gameState Estado atual do jogo
   * @param userId ID do usuário
   * @returns Resultado da operação
   */
  static async saveGameProgress(gameState: GameState, userId: string): Promise<GameResponse> {
    try {
      if (!userId) {
        return { success: false, error: 'Usuário não autenticado' };
      }

      // Verificar se o usuário está autenticado e corresponde ao ID fornecido
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user || user.id !== userId) {
        return { success: false, error: 'Usuário não autenticado ou ID inválido' };
      }

      const { player, highestFloor } = gameState;
      
      const saveData: SaveProgressData = {
        user_id: userId,
        player_name: player.name,
        current_floor: player.floor,
        hp: player.hp,
        max_hp: player.max_hp,
        attack: player.atk,
        defense: player.def,
        highest_floor: highestFloor,
      };

      // Verificar se já existe um progresso para este usuário
      const { data: existingProgress, error: queryError } = await this.supabase
        .from('game_progress')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (queryError && queryError.code !== 'PGRST116') { // PGRST116 = not found
        throw queryError;
      }

      // Upsert - atualiza se existir, cria se não existir
      const { error } = await this.supabase
        .from('game_progress')
        .upsert({
          id: existingProgress?.id,
          ...saveData,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      
      // Salvar também no ranking para preservar o recorde histórico
      if (highestFloor > 0) {
        await this.saveHighScore(player.name, highestFloor, userId);
      }
      
      return { success: true, data: { message: 'Progresso salvo com sucesso' } };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Erro ao salvar progresso:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Erro desconhecido ao salvar progresso' };
    }
  }
  
  /**
   * Salva o recorde de andar mais alto no ranking
   * @private
   */
  private static async saveHighScore(playerName: string, highestFloor: number, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('game_rankings')
        .insert({
          player_name: playerName,
          highest_floor: highestFloor,
          user_id: userId
        });
      
      if (error) {
        console.error('Erro ao salvar no ranking:', error.message);
      }
    } catch (error) {
      console.error('Erro ao salvar no ranking:', error instanceof Error ? error.message : 'Erro desconhecido');
    }
  }

  /**
   * Carregar o progresso do jogo
   * @param userId ID do usuário
   * @returns Resultado da operação com os dados do progresso
   */
  static async loadGameProgress(userId: string): Promise<GameResponse> {
    try {
      if (!userId) {
        return { success: false, error: 'Usuário não autenticado' };
      }

      const { data, error } = await this.supabase
        .from('game_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Usando maybeSingle() em vez de single()

      if (error) throw error;
      
      if (!data) {
        // Retorna dados iniciais quando o jogador não tem progresso salvo
        return { 
          success: true, 
          data: {
            player: defaultPlayer,
            highestFloor: 0
          }
        };
      }

      const progress = data as GameProgressEntry;
      
      // Converter o progresso do banco para o formato do jogo
      const player: GamePlayer = {
        id: progress.id,
        user_id: progress.user_id,
        name: progress.player_name,
        level: progress.level,
        xp: progress.xp,
        xp_next_level: progress.xp_next_level,
        gold: progress.gold,
        hp: progress.hp,
        max_hp: progress.max_hp,
        mana: progress.mana,
        max_mana: progress.max_mana,
        atk: progress.atk,
        def: progress.def,
        speed: progress.speed,
        created_at: progress.created_at,
        updated_at: progress.updated_at,
        isPlayerTurn: true,
        specialCooldown: 0,
        floor: progress.current_floor,
        spells: [],
        active_effects: {
          buffs: [],
          debuffs: [],
          dots: [],
          hots: []
        }
      };

      return { 
        success: true, 
        data: {
          player,
          highestFloor: progress.highest_floor
        }
      };
    } catch (error: unknown) {
      console.error('Erro ao carregar progresso:', error instanceof Error ? error.message : 'Erro desconhecido');
      return { 
        success: true, // Mudando para success=true com dados padrão para evitar mostrar erro
        data: {
          player: defaultPlayer,
          highestFloor: 0
        }
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
    return Math.max(0, attackerAttack - defenderDefense / 2);
  }

  /**
   * Processar ação do jogador
   * @param action Tipo de ação
   * @param gameState Estado atual do jogo
   * @param spellId ID da magia (opcional)
   * @returns Novo estado do jogo e resultado da ação
   */
  static processPlayerAction(
    action: ActionType, 
    gameState: GameState,
    spellId?: string
  ): { 
    newState: GameState;
    skipTurn: boolean;
    message: string;
  } {
    const { player, currentEnemy } = gameState;
    
    // Garantir que currentEnemy não é null
    if (!currentEnemy) {
      return {
        newState: gameState,
        skipTurn: true,
        message: 'Nenhum inimigo encontrado'
      };
    }
    
    let damage = 0;
    let message = '';
    const newState = { ...gameState };
    let skipTurn = false;
    
    // Processar a ação do jogador
    switch (action) {
      case 'attack':
        damage = this.calculateDamage(player.atk, currentEnemy.defense);
        currentEnemy.hp = Math.max(0, currentEnemy.hp - damage);
        message = `Você atacou e causou ${damage} de dano!`;
        break;
      
      case 'defend':
        player.def += 5;
        message = 'Você entrou em postura defensiva!';
        break;
      
      case 'special':
        if (player.specialCooldown === 0) {
          damage = player.atk * 2;
          currentEnemy.hp = Math.max(0, currentEnemy.hp - damage);
          player.specialCooldown = 3;
          message = `Você usou uma habilidade especial e causou ${damage} de dano!`;
        } else {
          message = `Habilidade especial em cooldown: ${player.specialCooldown} turnos restantes.`;
          skipTurn = true; // Não gasta o turno
        }
        break;

      case 'spell':
        if (!spellId) {
          message = 'Nenhuma magia selecionada!';
          skipTurn = true;
          break;
        }

        const spell = player.spells.find(s => s.id === spellId);
        if (!spell) {
          message = 'Magia não encontrada!';
          skipTurn = true;
          break;
        }

        if (spell.current_cooldown > 0) {
          message = `Magia em cooldown: ${spell.current_cooldown} turnos restantes.`;
          skipTurn = true;
          break;
        }

        const spellResult = SpellService.applySpellEffect(spell, player, currentEnemy);
        if (!spellResult.success) {
          message = spellResult.message;
          skipTurn = true;
          break;
        }

        // Atualizar cooldown da magia
        spell.current_cooldown = spell.cooldown;
        message = spellResult.message;
        break;
    }
    
    return { newState, skipTurn, message };
  }

  /**
   * Obter dados do andar atual
   * @param floorNumber Número do andar
   * @returns Dados do andar formatados
   */
  static async getFloorData(floorNumber: number): Promise<Floor | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_floor_data', { p_floor_number: floorNumber })
        .single();

      if (error) throw error;
      if (!data) return null;

      const floorData = data as {
        floor_number: number;
        type: FloorType;
        is_checkpoint: boolean;
        min_level: number;
        description: string;
      };

      return {
        floorNumber: floorData.floor_number,
        type: floorData.type,
        isCheckpoint: floorData.is_checkpoint,
        minLevel: floorData.min_level,
        description: floorData.description
      };
    } catch (error) {
      console.error('Erro ao obter dados do andar:', error instanceof Error ? error.message : error);
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
    const multipliers = {
      common: 1,
      elite: 1.5,
      event: 2,
      boss: 3
    };

    const multiplier = multipliers[floorType];
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
    const { player, currentEnemy, currentFloor } = gameState;
    const nextFloorNumber = player.floor + 1;
    
    // Atualizar o recorde se necessário
    const highestFloor = Math.max(gameState.highestFloor, nextFloorNumber - 1);
    
    // Obter dados do próximo andar
    const nextFloor = await this.getFloorData(nextFloorNumber);
    if (!nextFloor) {
      return {
        ...gameState,
        mode: 'gameover',
        gameMessage: 'Erro ao gerar próximo andar. Você venceu o jogo!',
        highestFloor
      };
    }

    // Verificar nível mínimo recomendado
    if (player.level < nextFloor.minLevel) {
      const warningMessage = `Atenção: Nível recomendado para o próximo andar é ${nextFloor.minLevel}!`;
      console.warn(warningMessage);
    }

    // Gerar próximo inimigo
    const nextEnemy = await this.generateEnemy(nextFloorNumber);
    if (!nextEnemy) {
      return {
        ...gameState,
        mode: 'gameover',
        gameMessage: 'Erro ao gerar próximo inimigo. Você venceu o jogo!',
        highestFloor
      };
    }

    // Calcular recompensas baseadas no tipo do andar
    let rewards = { xp: currentEnemy!.reward_xp, gold: currentEnemy!.reward_gold };
    if (currentFloor) {
      rewards = this.calculateFloorRewards(rewards.xp, rewards.gold, currentFloor.type);
    }

    // Recuperação de HP baseada no tipo do andar
    const hpRecovery = {
      common: 20,
      elite: 30,
      event: 40,
      boss: 50
    }[nextFloor.type];

    // Verificar se subiu de nível e atualizar magias disponíveis
    const oldLevel = player.level;
    const newXp = player.xp + rewards.xp;
    const leveledUp = newXp >= player.xp_next_level;

    let updatedSpells = [...player.spells];
    if (leveledUp) {
      const spellsResponse = await SpellService.getAvailableSpells(oldLevel + 1);
      if (spellsResponse.success && spellsResponse.data) {
        const newSpells = spellsResponse.data
          .filter(spell => !player.spells.some(ps => ps.id === spell.id))
          .map(spell => ({ ...spell, current_cooldown: 0 }));
        updatedSpells = [...player.spells, ...newSpells];
      }
    }
    
    return {
      ...gameState,
      player: {
        ...player,
        floor: nextFloorNumber,
        hp: Math.min(player.max_hp, player.hp + hpRecovery),
        xp: newXp,
        gold: player.gold + rewards.gold,
        spells: updatedSpells
      },
      currentEnemy: nextEnemy,
      currentFloor: nextFloor,
      isPlayerTurn: true,
      gameMessage: `Você derrotou o inimigo e avançou para o ${nextFloor.description}!`,
      highestFloor,
    };
  }

  /**
   * Processar ação do inimigo
   * @param gameState Estado atual do jogo
   * @param playerDefendAction Indica se o jogador usou a ação de defesa
   * @returns Novo estado do jogo após a ação do inimigo
   */
  static processEnemyAction(gameState: GameState, playerDefendAction: boolean): GameState {
    const { player, currentEnemy } = gameState;
    
    if (!currentEnemy) {
      return {
        ...gameState,
        isPlayerTurn: true,
      };
    }

    // Processar efeitos ao longo do tempo no inimigo
    const enemyEffectMessages = SpellService.processOverTimeEffects(currentEnemy);
    if (currentEnemy.hp <= 0) {
      return {
        ...gameState,
        gameMessage: 'O inimigo foi derrotado pelos efeitos ao longo do tempo!',
        isPlayerTurn: true,
      };
    }

    // Processar efeitos ao longo do tempo no jogador
    const playerEffectMessages = SpellService.processOverTimeEffects(player);
    
    const enemyDamage = MonsterService.calculateDamage(
      currentEnemy as unknown as Monster,
      currentEnemy.attack,
      player.def
    );
    
    player.hp = Math.max(0, player.hp - enemyDamage);
    
    if (playerDefendAction) {
      player.def = defaultPlayer.def;
    }
    
    // Atualizar cooldowns das magias
    const updatedState = SpellService.updateSpellCooldowns(gameState);
    
    if (player.hp <= 0) {
      return {
        ...updatedState,
        mode: 'gameover',
        gameMessage: `Você foi derrotado no Andar ${player.floor}!`,
        player,
        isPlayerTurn: true,
      };
    }
    
    if (player.specialCooldown > 0) {
      player.specialCooldown -= 1;
    }

    const effectMessages = [...enemyEffectMessages, ...playerEffectMessages];
    const effectMessage = effectMessages.length > 0 ? effectMessages.join(' ') + ' ' : '';
    
    return {
      ...updatedState,
      gameMessage: `${effectMessage}O inimigo atacou e causou ${enemyDamage} de dano!`,
      player,
      isPlayerTurn: true,
    };
  }
} 