'use client';

import { ActionType, Enemy, GameResponse, GameState, GamePlayer, Floor, FloorType, SpecialEvent } from './game-model';
import { defaultPlayer } from './game-context';
import { MonsterService } from './monster.service';
import { Monster, MonsterDropChance } from './models/monster.model';
import { SpellService } from './spell.service';
import { ConsumableService } from './consumable.service';
import { CharacterService } from './character.service';
import { RankingService } from './ranking-service';
import { SpecialEventService } from './special-event.service';
import { SkillXpGain } from './skill-xp.service';
import { supabase } from '@/lib/supabase';

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
   * Gerar inimigo para o andar atual
   * @param floor Andar atual
   * @returns Inimigo gerado
   */
  static async generateEnemy(floor: number): Promise<Enemy | null> {
    try {
      // Validar o andar - não pode ser menor que 1
      if (floor < 1) {
        console.error(`[GameService] Tentativa de gerar inimigo para andar inválido: ${floor}, usando andar 1`);
        floor = 1; // Failsafe para garantir andar mínimo válido
      }
      
      const monsterResponse = await MonsterService.getMonsterForFloor(floor);
      
      if (!monsterResponse.success || !monsterResponse.data) {
        throw new Error(monsterResponse.error || 'Erro ao gerar monstro');
      }

      const monster = monsterResponse.data;

      // Obter drops possíveis
      const { data: possibleDrops } = await supabase
        .rpc('get_monster_drops', { p_monster_id: monster.id });

      const monsterDrops = possibleDrops ? possibleDrops.map((drop: MonsterDropChance) => ({
        drop_id: drop.drop_id,
        drop_chance: drop.drop_chance,
        min_quantity: drop.min_quantity,
        max_quantity: drop.max_quantity
      })) : [];

      return {
        id: parseInt(monster.id),
        name: monster.name,
        level: floor,
        hp: monster.hp,
        maxHp: monster.hp,
        attack: monster.atk,
        defense: monster.def,
        speed: monster.speed,
        image: '👾',
        behavior: monster.behavior,
        mana: monster.mana,
        reward_xp: monster.reward_xp,
        reward_gold: monster.reward_gold,
        possible_drops: monsterDrops,
        active_effects: {
          buffs: [],
          debuffs: [],
          dots: [],
          hots: []
        }
      };
    } catch (error) {
      console.error('Erro ao gerar inimigo:', error instanceof Error ? error.message : error);
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
    try {
      if (!userId) {
        return { success: false, error: 'Usuário não autenticado' };
      }

      // Verificar se o usuário está autenticado e corresponde ao ID fornecido
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: existingProgress, error: queryError } = await supabase
        .from('game_progress')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (queryError && queryError.code !== 'PGRST116') { // PGRST116 = not found
        throw queryError;
      }

      // Upsert - atualiza se existir, cria se não existir
      const { error } = await supabase
        .from('game_progress')
        .upsert({
          id: existingProgress?.id,
          ...saveData,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      
      // Atualizar também o andar na tabela characters
      await CharacterService.updateCharacterFloor(player.id, player.floor);
      
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
      const { error } = await supabase
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

      const { data, error } = await supabase
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
        defenseCooldown: 0,
        isDefending: false,
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
   * @param consumableId ID do consumável (opcional)
   * @returns Novo estado do jogo e resultado da ação
   */
  static processPlayerAction(
    action: ActionType, 
    gameState: GameState,
    spellId?: string,
    consumableId?: string
  ): { 
    newState: GameState;
    skipTurn: boolean;
    message: string;
    skillXpGains?: SkillXpGain[];
    skillMessages?: string[];
  } {
    const { player, currentEnemy } = gameState;
    
    console.log(`[processPlayerAction] Processando ação: '${action}'`);
    console.log(`[processPlayerAction] currentEnemy:`, currentEnemy?.name || 'null');
    console.log(`[processPlayerAction] battleRewards:`, !!gameState.battleRewards);
    
    // Verificação especial para ação 'continue' - pode ser executada sem inimigo
    if (action === 'continue') {
      console.log(`[processPlayerAction] Ação 'continue' detectada - processando...`);
      return {
        newState: gameState,
        skipTurn: true,
        message: 'Avançando para o próximo andar...'
      };
    }
    
    // Para todas as outras ações, garantir que currentEnemy não é null
    if (!currentEnemy) {
      console.warn(`[processPlayerAction] Tentativa de executar ação '${action}' sem inimigo atual`);
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
    
    // Reduzir cooldown de defesa no início do turno
    if (player.defenseCooldown > 0) {
      player.defenseCooldown--;
    }
    
    // Processar a ação do jogador
    switch (action) {
      case 'attack':
        damage = this.calculateDamage(player.atk, currentEnemy.defense);
        currentEnemy.hp = Math.max(0, currentEnemy.hp - damage);
        message = `Você atacou e causou ${damage} de dano!`;
        
        // Adicionar verificação explícita de derrota do inimigo
        if (currentEnemy.hp <= 0) {
          message = `Você atacou, causou ${damage} de dano e derrotou ${currentEnemy.name}!`;
          console.log(`[processPlayerAction] Inimigo ${currentEnemy.name} derrotado - HP: ${currentEnemy.hp}`);
        }
        break;
      
      case 'defend':
        // Verificar se a defesa está em cooldown
        if (player.defenseCooldown > 0) {
          message = `Defesa em cooldown: ${player.defenseCooldown} turnos restantes.`;
          skipTurn = true;
          break;
        }
        
        // Ativar defesa estratégica
        player.isDefending = true;
        player.defenseCooldown = 4; // Cooldown de 4 turnos
        message = 'Você assume uma postura defensiva! O próximo ataque receberá 85% menos dano.';
        break;

      case 'flee':
        // Nova fórmula de chance de fuga:
        // - Chance base de 70%
        // - Bônus de até 20% baseado na velocidade relativa
        // - Penalidade de 10% por andar de diferença (mais difícil fugir de andares muito acima)
        const baseFleeChance = 0.7;
        const speedBonus = Math.min(0.2, (player.speed / (currentEnemy.speed || 1)) * 0.2);
        const floorPenalty = Math.max(0, (currentEnemy.level - player.level) * 0.1);
        const fleeChance = Math.min(0.9, Math.max(0.4, baseFleeChance + speedBonus - floorPenalty));
        const fleeRoll = Math.random();
        
        if (fleeRoll <= fleeChance) {
          // Fuga bem sucedida - resetar para andar 1
          console.log('[processPlayerAction] Fuga bem-sucedida - resetando para andar 1');
          
          // Atualizar o estado do jogo para andar 1
          newState.player.floor = 1;
          newState.mode = 'battle';
          newState.currentEnemy = null;
          newState.gameMessage = 'Você conseguiu fugir da batalha! Voltando ao primeiro andar...';
          skipTurn = true;
          message = 'Você conseguiu fugir da batalha! Voltando ao primeiro andar...';
          
          // IMPORTANTE: A atualização do banco será feita no game-provider após esta função
        } else {
          // Fuga falhou
          message = 'Você tentou fugir, mas não conseguiu!';
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

        if (player.mana < spell.mana_cost) {
          message = 'Mana insuficiente!';
          skipTurn = true;
          break;
        }

        // Garantir que o inimigo existe antes de aplicar o efeito da magia
        if (!currentEnemy) {
          message = 'Nenhum inimigo encontrado!';
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
        const spellIndex = player.spells.findIndex(s => s.id === spellId);
        if (spellIndex !== -1) {
          player.spells[spellIndex].current_cooldown = spell.cooldown;
        }
        
        message = spellResult.message;
        break;
      
      case 'consumable':
        if (!consumableId || !player.consumables) {
          message = 'Nenhum consumível selecionado!';
          skipTurn = true;
          break;
        }

        const consumable = player.consumables.find(c => c.consumable_id === consumableId);
        if (!consumable || !consumable.consumable || consumable.quantity <= 0) {
          message = 'Consumível não encontrado ou sem unidades disponíveis!';
          skipTurn = true;
          break;
        }

        // Aplicar efeito do consumível
        switch (consumable.consumable.type) {
          case 'potion':
            // Poção de HP
            if (consumable.consumable.description.includes('HP') || 
                consumable.consumable.description.includes('Vida')) {
              const oldHp = player.hp;
              player.hp = Math.min(player.max_hp, player.hp + consumable.consumable.effect_value);
              message = `Você usou ${consumable.consumable.name} e recuperou ${player.hp - oldHp} de HP!`;
            } 
            // Poção de Mana
            else if (consumable.consumable.description.includes('Mana')) {
              const oldMana = player.mana;
              player.mana = Math.min(player.max_mana, player.mana + consumable.consumable.effect_value);
              message = `Você usou ${consumable.consumable.name} e recuperou ${player.mana - oldMana} de Mana!`;
            }
            break;
            
          case 'antidote':
            // Remover efeitos negativos
            player.active_effects.debuffs = [];
            player.active_effects.dots = [];
            message = `Você usou ${consumable.consumable.name} e removeu todos os efeitos negativos!`;
            break;
            
          case 'buff':
            // Aplicar buff temporário
            const buffValue = consumable.consumable.effect_value;
            
            // Buff de ataque
            if (consumable.consumable.description.includes('ataque') || 
                consumable.consumable.description.includes('Força')) {
              player.atk += buffValue;
              player.active_effects.buffs.push({
                type: 'buff',
                value: buffValue,
                duration: 3, // Duração reduzida para relevância em combos
                source_spell: 'elixir_strength'
              });
              message = `Você usou ${consumable.consumable.name} e aumentou seu ataque em ${buffValue} por 3 turnos!`;
            } 
            // Buff de defesa
            else if (consumable.consumable.description.includes('defesa') || 
                     consumable.consumable.description.includes('Defesa')) {
              player.def += buffValue;
              player.active_effects.buffs.push({
                type: 'buff',
                value: buffValue,
                duration: 3, // Duração reduzida para relevância em combos
                source_spell: 'elixir_defense'
              });
              message = `Você usou ${consumable.consumable.name} e aumentou sua defesa em ${buffValue} por 3 turnos!`;
            }
            break;
            
          default:
            message = 'Este tipo de consumível não pode ser usado em batalha!';
            skipTurn = true;
            break;
        }

        // Reduzir quantidade do consumível
        if (!skipTurn) {
          const consumableIndex = player.consumables.findIndex(c => c.consumable_id === consumableId);
          if (consumableIndex !== -1) {
            player.consumables[consumableIndex].quantity -= 1;
          }
        }
        break;
      
      default:
        message = 'Ação inválida';
        skipTurn = true;
    }
    
    // Após o switch, adicionar verificação explícita de inimigo derrotado (apenas se há inimigo)
    if (currentEnemy && currentEnemy.hp <= 0) {
      console.log('[processPlayerAction] Inimigo derrotado após processamento da ação');
      // Não usamos skipTurn para permitir que o processamento de derrota continue
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
      // Validar número do andar
      if (floorNumber <= 0) {
        console.error(`Tentativa de obter dados de andar inválido: ${floorNumber}`);
        return null;
      }

      console.log(`[getFloorData] Solicitando dados do andar ${floorNumber}`);

      // Verificar cache
      const now = Date.now();
      const cachedFloor = this.floorCache.get(floorNumber);
      const cacheExpiry = this.floorCacheExpiry.get(floorNumber) || 0;
      
      if (cachedFloor && now < cacheExpiry) {
        console.log(`[getFloorData] Usando dados em cache para o andar ${floorNumber}`);
        return cachedFloor;
      }

      // Buscar dados do andar no servidor
      const { data, error } = await supabase
        .rpc('get_floor_data', { p_floor_number: floorNumber })
        .single();

      if (error) {
        console.error(`[getFloorData] Erro ao obter andar ${floorNumber}:`, error.message);
        throw error;
      }
      
      if (!data) {
        console.error(`[getFloorData] Nenhum dado retornado para o andar ${floorNumber}`);
        return null;
      }

      const floorData = data as {
        floor_number: number;
        type: FloorType;
        is_checkpoint: boolean;
        min_level: number;
        description: string;
      };

      // Validar dados recebidos
      if (floorData.floor_number !== floorNumber) {
        console.warn(`[getFloorData] Discrepância no número do andar: solicitado=${floorNumber}, recebido=${floorData.floor_number}`);
      }

      const floor = {
        floorNumber: floorData.floor_number,
        type: floorData.type,
        isCheckpoint: floorData.is_checkpoint,
        minLevel: floorData.min_level,
        description: floorData.description
      };

      // Atualizar cache
      this.floorCache.set(floorNumber, floor);
      this.floorCacheExpiry.set(floorNumber, now + this.FLOOR_CACHE_DURATION);

      console.log(`[getFloorData] Obtidos dados do andar ${floorNumber}: ${floor.description}`);
      return floor;
    } catch (error) {
      console.error(`[getFloorData] Erro crítico ao obter dados do andar ${floorNumber}:`, error instanceof Error ? error.message : error);
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
    // Ajustes de balanceamento: reduzir apenas 20% do XP para manter progressão
    const reductionXpFactor = 0.8; // Reduzido de 0.6 para 0.8
    const reductionGoldFactor = 1.0; // Removida redução do gold

    const multipliers = {
      common: 1,
      elite: 1.5,
      event: 2,
      boss: 3
    };

    const multiplier = multipliers[floorType];
    return {
      xp: Math.floor(baseXP * multiplier * reductionXpFactor),
      gold: Math.floor(baseGold * multiplier * reductionGoldFactor)
    };
  }

  /**
   * Processar a derrota do inimigo
   * @param gameState Estado atual do jogo
   * @returns Novo estado do jogo após a derrota do inimigo
   */
  static async processEnemyDefeat(gameState: GameState): Promise<GameState> {
    try {
      const { player, currentEnemy, currentFloor } = gameState;
      
      // Criar ID único para esta tentativa de processamento
      const defeatId = `${currentEnemy?.name}-${currentEnemy?.hp}-${player.floor}-${Date.now()}`;
      console.log(`[processEnemyDefeat] Iniciando processamento ${defeatId}`);
      
      // Validações rigorosas para evitar processamento duplicado
      if (!currentEnemy) {
        console.warn('[processEnemyDefeat] Nenhum inimigo encontrado');
        return gameState;
      }
      
      if (currentEnemy.hp > 0) {
        console.warn('[processEnemyDefeat] Tentativa de processar inimigo que ainda não foi derrotado');
        return gameState;
      }
      
      // CRÍTICO: Evitar processamento duplicado verificando se já temos recompensas
      if (gameState.battleRewards) {
        console.warn(`[processEnemyDefeat] Tentativa de processar derrota de inimigo que já possui recompensas - ignorando (${defeatId})`);
        return gameState;
      }
      
      // Atualizar o recorde se necessário
      const highestFloor = Math.max(gameState.highestFloor, player.floor);
      
      // Processar drops do monstro (se houver)
      let obtainedDrops: { name: string; quantity: number }[] = [];
      
      if (currentEnemy.possible_drops && currentEnemy.possible_drops.length > 0) {
        // Processar os drops obtidos
        const levelMultiplier = 1 + (currentEnemy.level * 0.01);
        let floorMultiplier = 1.0;
        
        if (currentFloor) {
          switch (currentFloor.type) {
            case 'elite': floorMultiplier = 1.2; break;
            case 'event': floorMultiplier = 1.3; break;
            case 'boss': floorMultiplier = 1.5; break;
            default: floorMultiplier = 1.0;
          }
        }
        
        const dropsResult = ConsumableService.processMonsterDrops(
          currentEnemy.level, 
          currentEnemy.possible_drops,
          levelMultiplier * floorMultiplier
        );
        
        // Adicionar drops ao inventário do jogador
        if (dropsResult.length > 0) {
          try {
            await ConsumableService.addDropsToInventory(player.id, dropsResult);
            const dropNames = await this.getDropNames(dropsResult);
            obtainedDrops = dropNames.map((name, index) => ({
              name,
              quantity: dropsResult[index].quantity
            }));
          } catch (error) {
            console.error('[processEnemyDefeat] Erro ao processar drops:', error);
            // Continua o fluxo mesmo se houver erro nos drops
          }
        }
      }
      
      // Calcular recompensas baseadas no tipo do andar
      let rewards = { xp: currentEnemy.reward_xp, gold: currentEnemy.reward_gold };
      if (currentFloor) {
        rewards = this.calculateFloorRewards(rewards.xp, rewards.gold, currentFloor.type);
      }
      
      // Verificar se subiu de nível
      const oldLevel = player.level;
      const newXp = player.xp + rewards.xp;
      const leveledUp = newXp >= player.xp_next_level;
      let updatedSpells = [...player.spells];

      if (leveledUp) {
        try {
          const spellsResponse = await SpellService.getAvailableSpells(oldLevel + 1);
          if (spellsResponse.success && spellsResponse.data) {
            const newSpells = spellsResponse.data
              .filter(spell => !player.spells.some(ps => ps.id === spell.id))
              .map(spell => ({ ...spell, current_cooldown: 0 }));
            updatedSpells = [...player.spells, ...newSpells];
          }
        } catch (error) {
          console.error('[processEnemyDefeat] Erro ao carregar novas magias:', error);
          // Continuar sem adicionar novas magias em caso de erro
        }
      }
      
      // Criar o estado após vitória com as recompensas
      const updatedState = {
        ...gameState,
        player: {
          ...player,
          xp: newXp,
          gold: player.gold + rewards.gold,
          spells: updatedSpells
        },
        isPlayerTurn: true,
        gameMessage: 'Inimigo derrotado! Colete suas recompensas.',
        highestFloor,
        battleRewards: {
          xp: rewards.xp,
          gold: rewards.gold,
          drops: obtainedDrops,
          leveledUp,
          newLevel: leveledUp ? oldLevel + 1 : undefined
        }
      };
      
      // Debug log para confirmar processamento
      console.log(`[processEnemyDefeat] Vitória processada com sucesso (${defeatId}) - recompensas definidas no andar ${player.floor}`);
      
      return updatedState;
    } catch (error) {
      console.error('[processEnemyDefeat] Erro não tratado:', error);
      // Retornar o estado atual com uma mensagem de erro para evitar travamento
      return {
        ...gameState,
        gameMessage: 'Ocorreu um erro ao processar a batalha. Tente novamente.',
        isPlayerTurn: true
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
    const result: string[] = [];
    
    for (const drop of drops) {
      try {
        const { data, error } = await supabase
          .from('monster_drops')
          .select('name')
          .eq('id', drop.drop_id)
          .single();
        
        if (!error && data) {
          result.push(`${data.name} (${drop.quantity})`);
        }
      } catch (error) {
        console.error('Erro ao buscar nome do drop:', error);
      }
    }
    
    return result;
  }

  /**
   * Processar ação do inimigo
   * @param gameState Estado atual do jogo
   * @param playerDefendAction Indica se o jogador usou a ação de defesa (DEPRECATED)
   * @returns Novo estado do jogo após a ação do inimigo
   */
  static async processEnemyAction(gameState: GameState, playerDefendAction: boolean): Promise<GameState> {
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
    
    // Calcular dano base do inimigo
    let enemyDamage = MonsterService.calculateDamage(
      currentEnemy as unknown as Monster,
      currentEnemy.attack,
      player.def
    );
    
    // Aplicar redução de dano se o jogador está defendendo
    if (player.isDefending) {
      const originalDamage = enemyDamage;
      enemyDamage = Math.floor(enemyDamage * 0.15); // Reduz 85% do dano
      
      // Resetar estado de defesa após o ataque
      player.isDefending = false;
      
      // Adicionar mensagem explicativa sobre a defesa
      const effectMessages = [...enemyEffectMessages, ...playerEffectMessages];
      const effectMessage = effectMessages.length > 0 ? effectMessages.join(' ') + ' ' : '';
      
      player.hp = Math.max(0, player.hp - enemyDamage);
      
      // Atualizar cooldowns das magias
      const updatedState = SpellService.updateSpellCooldowns(gameState);
      
      if (player.hp <= 0) {
        try {
          // Salvar a pontuação no ranking antes de deletar o personagem
          const rankingEntry = {
            player_name: player.name,
            highest_floor: player.floor - 1, // -1 porque o jogador morreu no andar atual
            user_id: player.user_id
          };

          await RankingService.saveScore(rankingEntry);
          await CharacterService.deleteCharacter(player.id);
        } catch (error) {
          console.error('Erro ao processar morte do personagem:', error);
        }

        return {
          ...updatedState,
          mode: 'gameover',
          gameMessage: `Você foi derrotado no Andar ${player.floor}!`,
          player,
          isPlayerTurn: true,
        };
      }
      
      return {
        ...updatedState,
        gameMessage: `${effectMessage}Sua defesa bloqueou a maior parte do ataque! O inimigo causou apenas ${enemyDamage} de dano (${originalDamage - enemyDamage} bloqueado)!`,
        player,
        isPlayerTurn: true,
      };
    }
    
    // Aplicar dano normal se não estava defendendo
    player.hp = Math.max(0, player.hp - enemyDamage);
    
    // Resetar defesa modificada (lógica antiga) - não mais usada
    if (playerDefendAction) {
      player.def = defaultPlayer.def;
    }
    
    // Atualizar cooldowns das magias
    const updatedState = SpellService.updateSpellCooldowns(gameState);
    
    if (player.hp <= 0) {
      try {
        // Salvar a pontuação no ranking antes de deletar o personagem
        const rankingEntry = {
          player_name: player.name,
          highest_floor: player.floor - 1, // -1 porque o jogador morreu no andar atual
          user_id: player.user_id
        };

        await RankingService.saveScore(rankingEntry);
        await CharacterService.deleteCharacter(player.id);
      } catch (error) {
        console.error('Erro ao processar morte do personagem:', error);
      }

      return {
        ...updatedState,
        mode: 'gameover',
        gameMessage: `Você foi derrotado no Andar ${player.floor}!`,
        player,
        isPlayerTurn: true,
      };
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

  /**
   * Avançar para o próximo andar após coletar recompensas
   * @param gameState Estado atual do jogo
   * @returns Novo estado com o próximo andar
   */
  static async advanceToNextFloor(gameState: GameState): Promise<GameState> {
    try {
      const { player } = gameState;
      const nextFloorNumber = player.floor + 1;
      
      console.log(`[advanceToNextFloor] INÍCIO - Avançando do andar ${player.floor} para ${nextFloorNumber}`);
      console.log(`[advanceToNextFloor] Player atual:`, { name: player.name, level: player.level, hp: player.hp });
      
      // Limpar cache para garantir dados atualizados
      this.clearAllCaches();
      console.log(`[advanceToNextFloor] Cache limpo`);
      
      // Obter dados do próximo andar
      console.log(`[advanceToNextFloor] Buscando dados do andar ${nextFloorNumber}`);
      const nextFloor = await this.getFloorData(nextFloorNumber);
      if (!nextFloor) {
        const errorMsg = `Não foi possível obter dados do andar ${nextFloorNumber}`;
        console.error(`[advanceToNextFloor] ERRO: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      console.log(`[advanceToNextFloor] Dados do andar ${nextFloorNumber} obtidos:`, nextFloor.description);
      
      // Verificar se deve gerar evento especial ou monstro
      let nextEnemy: Enemy | null = null;
      let nextSpecialEvent: SpecialEvent | null = null;
      let newMode: 'battle' | 'special_event' = 'battle';
      
      if (SpecialEventService.shouldGenerateSpecialEvent(nextFloor.type)) {
        // Gerar evento especial
        console.log(`[advanceToNextFloor] Gerando evento especial para andar ${nextFloorNumber}`);
        const eventResponse = await SpecialEventService.getSpecialEventForFloor(nextFloorNumber);
        
        if (eventResponse.success && eventResponse.data) {
          nextSpecialEvent = eventResponse.data;
          newMode = 'special_event';
          console.log(`[advanceToNextFloor] Evento especial gerado: ${nextSpecialEvent.name}`);
        } else {
          // Fallback para monstro se evento falhar
          console.warn(`[advanceToNextFloor] Falha ao gerar evento especial, gerando monstro`);
          nextEnemy = await this.generateEnemy(nextFloorNumber);
        }
      } else {
        // Gerar monstro normal
        console.log(`[advanceToNextFloor] Gerando monstro para o andar ${nextFloorNumber}`);
        nextEnemy = await this.generateEnemy(nextFloorNumber);
      }
      
      // Verificar se temos inimigo ou evento
      if (!nextEnemy && !nextSpecialEvent) {
        const errorMsg = `Não foi possível gerar conteúdo para o andar ${nextFloorNumber}`;
        console.error(`[advanceToNextFloor] ERRO: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      if (nextEnemy) {
        console.log(`[advanceToNextFloor] Monstro gerado: ${nextEnemy.name}`);
      }
      
      // Ajustar a recuperação de HP e mana baseada no tipo do andar
      const baseRecovery = {
        common: Math.max(10, 25 - Math.floor(nextFloorNumber / 5) * 2),
        elite: Math.max(15, 35 - Math.floor(nextFloorNumber / 5) * 2),
        event: Math.max(20, 40 - Math.floor(nextFloorNumber / 5) * 2),
        boss: Math.max(25, 50 - Math.floor(nextFloorNumber / 5) * 2)
      }[nextFloor.type];
      
      const manaRecovery = Math.max(5, Math.floor(baseRecovery / 2));
      
      console.log(`[advanceToNextFloor] Recuperação calculada - HP: +${baseRecovery}, Mana: +${manaRecovery}`);
      
      // Criar mensagem apropriada
      let gameMessage: string;
      if (nextSpecialEvent) {
        gameMessage = `Você chegou ao ${nextFloor.description} e encontrou algo especial...`;
      } else {
        gameMessage = `Você chegou ao ${nextFloor.description}.`;
      }
      
      // Criar o novo estado com o próximo andar
      const newState: GameState = {
        ...gameState,
        mode: newMode,
        player: {
          ...player,
          floor: nextFloorNumber,
          hp: Math.min(player.max_hp, player.hp + baseRecovery),
          mana: Math.min(player.max_mana, player.mana + manaRecovery)
        },
        currentEnemy: nextEnemy,
        currentSpecialEvent: nextSpecialEvent,
        currentFloor: nextFloor,
        isPlayerTurn: true,
        gameMessage,
        battleRewards: null // Limpar recompensas após avançar
      };
      
      console.log(`[advanceToNextFloor] SUCESSO - Transição concluída: ${player.floor} -> ${nextFloorNumber}`);
      console.log(`[advanceToNextFloor] Novo estado:`, { 
        floor: newState.player.floor, 
        mode: newState.mode,
        enemy: newState.currentEnemy?.name,
        event: newState.currentSpecialEvent?.name,
        floorDesc: newState.currentFloor?.description
      });
      
      return newState;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[advanceToNextFloor] ERRO CRÍTICO:', errorMsg);
      console.error('[advanceToNextFloor] Stack trace:', error);
      return {
        ...gameState,
        gameMessage: 'Erro ao avançar para o próximo andar. Tente novamente.',
        isPlayerTurn: true
      };
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
    characterId: string
  ): Promise<GameState> {
    try {
      const { currentSpecialEvent, player } = gameState;
      
      if (!currentSpecialEvent) {
        console.warn('[processSpecialEventInteraction] Nenhum evento especial atual');
        return {
          ...gameState,
          gameMessage: 'Nenhum evento especial disponível.'
        };
      }

      console.log(`[processSpecialEventInteraction] Processando evento: ${currentSpecialEvent.name}`);
      
      // Processar evento no servidor
      const eventResponse = await SpecialEventService.processSpecialEvent(
        characterId, 
        currentSpecialEvent.id
      );
      
      if (!eventResponse.success || !eventResponse.data) {
        throw new Error(eventResponse.error || 'Erro ao processar evento especial');
      }
      
      const result = eventResponse.data;
      
      // Atualizar estado do jogador com os benefícios do evento
      const updatedPlayer = {
        ...player,
        hp: Math.min(player.max_hp, player.hp + result.hp_restored),
        mana: Math.min(player.max_mana, player.mana + result.mana_restored),
        gold: player.gold + result.gold_gained
      };
      
      console.log(`[processSpecialEventInteraction] Evento processado com sucesso: +${result.hp_restored} HP, +${result.mana_restored} Mana, +${result.gold_gained} Gold`);
      
      // Retornar estado atualizado - ainda em modo evento para mostrar resultados
      return {
        ...gameState,
        player: updatedPlayer,
        gameMessage: result.message,
        isPlayerTurn: true
      };
    } catch (error) {
      console.error('[processSpecialEventInteraction] Erro ao processar evento especial:', error);
      return {
        ...gameState,
        gameMessage: 'Erro ao interagir com o evento especial. Tente novamente.',
        isPlayerTurn: true
      };
    }
  }
} 