'use client';

import React, { ReactNode, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ActionType, GameContextState, GameLoadingState } from './game-model';
import { GameContext, GameContextType, initialGameState } from './game-context';
import { GameService } from './game.service';
import { CharacterService } from './character.service';
import { Character } from './models/character.model';
import { useAuth } from '../auth/auth-hook';
import { toast } from 'sonner';
import { SpellService } from './spell.service';
import { ConsumableService } from './consumable.service';
import { CharacterConsumable } from './models/consumable.model';
import { TurnControlService } from './turn-control.service';



interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, setState] = useState<GameContextState>({
    gameState: initialGameState,
    loading: {
      loadProgress: false,
      startGame: false,
      performAction: false,
      saveProgress: false
    },
    error: null,
    gameMessage: 'Bem-vindo ao Tower Trials! Crie um personagem para iniciar sua aventura.',
    gameLog: [{ text: 'Bem-vindo ao Tower Trials!', type: 'system' }]
  });
  const { user } = useAuth();

  const loadingRef = useRef(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);



  // OTIMIZADO: Sistema robusto para prevenir ações duplicadas
  const performActionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionProcessingRef = useRef<boolean>(false);
  const actionIdRef = useRef<number>(0);
  const lastActionRef = useRef<{
    action: ActionType;
    timestamp: number;
    spellId?: string;
    consumableId?: string;
    actionId: number;
  } | null>(null);

  // Função auxiliar para atualizar estado de loading
  const updateLoading = useCallback((key: keyof GameLoadingState, value: boolean) => {
    setState(prev => ({
      ...prev,
      loading: {
        ...prev.loading,
        [key]: value,
      },
    }));
  }, []);

  // Função para limpar mensagens de erro
  const resetError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Função para adicionar mensagens ao log do jogo
  const addGameLogMessage = useCallback((message: string, type: 'system' | 'battle' | 'lore' | 'equipment' | 'skill_xp' | 'level_up' | 'enemy_action' | 'player_action' | 'damage' | 'healing' = 'system') => {
    // Verificar se a mensagem já existe nas últimas 5 entradas do log para evitar duplicação
    setState(prev => {
      const recentLogs = prev.gameLog.slice(-5);
      const isDuplicate = recentLogs.some(log => log.text === message && log.type === type);
      
      // Se for duplicada, não adicionar
      if (isDuplicate) {
        return prev;
      }
      
      return {
        ...prev,
        gameLog: [...prev.gameLog, { text: message, type }]
      };
    });
  }, []);

  // CRÍTICO: Monitorar morte do personagem e redirecionar imediatamente
  useEffect(() => {
    if (state.gameState.mode === 'gameover' && state.gameState.characterDeleted) {
      console.log('[GameProvider] Personagem morreu e foi deletado - redirecionando imediatamente');
      
      // Exibir toast de notificação sobre permadeath
      toast.error('Permadeath!', {
        description: `${state.gameState.player.name} foi perdido permanentemente. Redirecionando...`,
        duration: 3000
      });
      
      // Limpar estado do personagem selecionado
      setSelectedCharacter(null);
      
      // Limpar cache do personagem morto
      if (state.gameState.player.id) {
        CharacterService.invalidateCharacterCache(state.gameState.player.id);
      }
      
      // Recarregar lista de personagens
      if (user?.id) {
        CharacterService.getUserCharacters(user.id).then((response) => {
          if (response.success && response.data) {
            setCharacters(response.data);
          }
        });
      }
      
      // Redirecionamento forçado após pequeno delay para mostrar a notificação
      setTimeout(() => {
        console.log('[GameProvider] Executando redirecionamento forçado para /game/play');
        window.location.href = '/game/play';
      }, 2000);
    }
  }, [state.gameState.mode, state.gameState.characterDeleted, state.gameState.player.name, state.gameState.player.id, user?.id]);

  // Carregar personagens do usuário
  useEffect(() => {
    const loadCharacters = async () => {
      if (!user?.id || loadingRef.current) return;
      
      try {
        loadingRef.current = true;
        updateLoading('loadProgress', true);
        
        const response = await CharacterService.getUserCharacters(user.id);
        
        if (response.success && response.data) {
          setCharacters(response.data);
          
          if (response.data.length > 0) {
            setState(prev => ({
              ...prev,
              gameMessage: prev.gameState.mode === 'menu' ? 'Selecione um personagem para jogar!' : prev.gameMessage,
            }));
          } else {
            setState(prev => ({
              ...prev,
              gameMessage: 'Você ainda não tem personagens. Crie um para começar!',
            }));
          }
        } else if (response.error) {
          console.error('Erro ao carregar personagens:', response.error);
          setState(prev => ({
            ...prev,
            error: response.error,
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar personagens:', error instanceof Error ? error.message : 'Erro desconhecido');
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Erro ao carregar personagens',
        }));
      } finally {
        updateLoading('loadProgress', false);
        loadingRef.current = false;
      }
    };

    // Só carrega se realmente mudou o usuário
    loadCharacters();
  }, [user?.id]); // Só user.id como dependência

  // Criar novo personagem
  const createCharacter = useCallback(async (name: string) => {
    if (!user?.id) {
      toast.error('Erro', {
        description: 'Você precisa estar logado para criar um personagem.',
      });
      return;
    }
    
    if (loadingRef.current) return;
    loadingRef.current = true;
    updateLoading('startGame', true);
    
    try {
      const response = await CharacterService.createCharacter({
        user_id: user.id,
        name,
      });
      
      if (response.success && response.data) {
        const newCharacter = await CharacterService.getCharacter(response.data.id);
        
        if (newCharacter.success && newCharacter.data) {
          // Obter magias iniciais
          const spellsResponse = await SpellService.getAvailableSpells(1);
          const initialSpells = spellsResponse.success && spellsResponse.data
            ? spellsResponse.data.map(spell => ({ ...spell, current_cooldown: 0 }))
            : [];

          setCharacters(prev => [newCharacter.data!, ...prev]);
          setSelectedCharacter(newCharacter.data);
          
          // CRÍTICO: Usar getCharacterForGame para obter stats derivados corretos do personagem recém-criado
          console.log(`[GameProvider] Carregando stats derivados para novo personagem: ${newCharacter.data!.name}...`);
          const gamePlayerResponse = await CharacterService.getCharacterForGame(newCharacter.data!.id);
          
          if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
            throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem recém-criado');
          }
          
          const gamePlayer = gamePlayerResponse.data;
          
          console.log(`[GameProvider] Stats derivados carregados para novo personagem:`, {
            critical_chance: gamePlayer.critical_chance,
            critical_damage: gamePlayer.critical_damage,
            magic_damage_bonus: gamePlayer.magic_damage_bonus
          });
          
          // Obter dados do primeiro andar
          const initialFloor = await GameService.getFloorData(1);
          if (!initialFloor) {
            throw new Error('Erro ao gerar andar inicial');
          }

          // Gerar inimigo inicial
          const initialEnemy = await GameService.generateEnemy(1);
          if (!initialEnemy) {
            throw new Error('Erro ao gerar inimigo inicial');
          }
          
          setState(prev => ({
            ...prev,
            gameState: {
              ...initialGameState,
              mode: 'battle',
              player: {
                ...gamePlayer,
                isPlayerTurn: true,
                specialCooldown: 0,
                defenseCooldown: 0,
                isDefending: false,
                floor: 1,
                spells: initialSpells,
                potionUsedThisTurn: false,
                active_effects: {
                  buffs: [],
                  debuffs: [],
                  dots: [],
                  hots: [],
                  attribute_modifications: []
                }
              },
              currentEnemy: initialEnemy,
              currentFloor: initialFloor,
              gameMessage: `Bem-vindo à sua primeira aventura, ${gamePlayer.name}! Você está no ${initialFloor.description}.`,
            },
          }));
          
          toast.success('Sucesso', {
            description: 'Personagem criado com sucesso!',
          });
        }
      } else if (response.error) {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Erro ao criar personagem:', error instanceof Error ? error.message : 'Erro desconhecido');
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao criar personagem',
      }));
      
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao criar personagem',
      });
    } finally {
      updateLoading('startGame', false);
      loadingRef.current = false;
    }
  }, [user]);

  // Selecionar personagem
  const selectCharacter = useCallback(async (character: Character) => {
    try {
      console.log(`[GameProvider] Iniciando seleção do personagem: ${character.name} (andar: ${character.floor})`);
      
      setSelectedCharacter(character);
      
      // Obter magias equipadas do personagem (slots)
      console.log(`[GameProvider] Buscando magias equipadas para personagem: ${character.id}`);
      const spellsResponse = await SpellService.getCharacterEquippedSpells(character.id);
      const equippedSpells = spellsResponse.success && spellsResponse.data
        ? spellsResponse.data
        : [];
      console.log(`[GameProvider] ${equippedSpells.length} magias equipadas carregadas:`, equippedSpells.map(s => s.name));

      // Obter consumíveis do personagem
      console.log(`[GameProvider] Buscando consumíveis do personagem`);
      const consumablesResponse = await ConsumableService.getCharacterConsumables(character.id);
      const characterConsumables = consumablesResponse.success && consumablesResponse.data
        ? consumablesResponse.data
        : [];
      console.log(`[GameProvider] ${characterConsumables.length} consumíveis carregados`);

      // Obter dados do andar atual do personagem (usar o andar salvo, não sempre 1)
      const currentFloor = character.floor || 1;
      console.log(`[GameProvider] Carregando dados do andar ${currentFloor}`);
      
      const floorData = await GameService.getFloorData(currentFloor);
      if (!floorData) {
        console.error(`[GameProvider] Falha ao carregar dados do andar ${currentFloor}`);
        throw new Error(`Erro ao gerar dados do andar ${currentFloor}`);
      }
      console.log(`[GameProvider] Dados do andar carregados: ${floorData.description} (tipo: ${floorData.type})`);

      // Gerar inimigo para o andar atual
      console.log(`[GameProvider] Gerando inimigo para o andar ${currentFloor}`);
      const currentEnemy = await GameService.generateEnemy(currentFloor);
      if (!currentEnemy) {
        console.error(`[GameProvider] Falha ao gerar inimigo para o andar ${currentFloor}`);
        throw new Error(`Erro ao gerar inimigo para o andar ${currentFloor}`);
      }
      console.log(`[GameProvider] Inimigo gerado: ${currentEnemy.name} (HP: ${currentEnemy.hp}/${currentEnemy.maxHp})`);
      
      // Limpar todos os caches do jogo
      GameService.clearAllCaches();
      
      console.log(`[GameProvider] Carregando stats derivados para batalha: ${character.name}...`);
      
      // CRÍTICO: Usar getCharacterForGame para obter stats derivados corretos
      const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);
      
      if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
        throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem para batalha');
      }
      
      const gamePlayer = gamePlayerResponse.data;
      
      console.log(`[GameProvider] Stats derivados carregados para batalha:`, {
        critical_chance: gamePlayer.critical_chance,
        critical_damage: gamePlayer.critical_damage,
        magic_damage_bonus: gamePlayer.magic_damage_bonus
      });
      
      console.log(`[GameProvider] Definindo estado do jogo para batalha`);
      
      // NOVO: Inicializar sessão de controle de turnos
      // Primeiro, limpar qualquer sessão antiga para evitar conflitos
      TurnControlService.performCleanup();
      
      const battleSession = TurnControlService.initializeBattleSession(currentFloor, currentEnemy.name);
      console.log(`[GameProvider] Sessão de batalha inicializada: ${battleSession.sessionId}`);
      
      const newGameState = {
        ...initialGameState,
        mode: 'battle' as const,
        player: {
          ...gamePlayer,
          isPlayerTurn: true,
          specialCooldown: 0,
          defenseCooldown: 0,
          isDefending: false,
          floor: currentFloor,
          spells: equippedSpells,
          consumables: characterConsumables,
          potionUsedThisTurn: false,
          active_effects: {
            buffs: [],
            debuffs: [],
            dots: [],
            hots: [],
            attribute_modifications: []
          }
        },
        currentEnemy: currentEnemy,
        currentFloor: floorData,
        gameMessage: `Bem-vindo de volta, ${character.name}! Você está no ${floorData.description}.`,
        // NOVO: Adicionar sessão de batalha ao estado
        battleSession: battleSession,
        actionLocks: new Map()
      };
      
      setState(prev => ({
        ...prev,
        gameState: newGameState,
      }));
      
      console.log(`[GameProvider] Estado do jogo atualizado com sucesso:`);
      console.log(`- Modo: ${newGameState.mode}`);
      console.log(`- Jogador: ${newGameState.player.name} (andar: ${newGameState.player.floor})`);
      console.log(`- Inimigo: ${newGameState.currentEnemy?.name}`);
      console.log(`- Andar: ${newGameState.currentFloor?.description}`);
      
    } catch (error) {
      console.error('[GameProvider] Erro ao selecionar personagem:', error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao selecionar personagem',
      });
    }
  }, []);

  // Carregar personagem apenas para o hub (sem preparar estado de batalha)
  const loadCharacterForHub = useCallback(async (character: Character) => {
    try {
      setSelectedCharacter(character);
      
      // CRÍTICO: Usar getCharacterForGame para obter stats derivados corretos
      console.log(`[GameProvider] Carregando stats derivados para ${character.name}...`);
      const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);
      
      if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
        throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
      }
      
      const gamePlayer = gamePlayerResponse.data;
      
      console.log(`[GameProvider] Stats derivados carregados:`, {
        critical_chance: gamePlayer.critical_chance,
        critical_damage: gamePlayer.critical_damage,
        magic_damage_bonus: gamePlayer.magic_damage_bonus
      });
      
      setState(prev => ({
        ...prev,
        gameState: {
          ...initialGameState,
          mode: 'hub', // Modo específico para hub
          player: {
            ...gamePlayer,
            isPlayerTurn: true,
            specialCooldown: 0,
            defenseCooldown: 0,
            isDefending: false,
            floor: character.floor || 1,
            spells: gamePlayer.spells || [],
            consumables: gamePlayer.consumables || [],
            potionUsedThisTurn: false,
            active_effects: {
              buffs: [],
              debuffs: [],
              dots: [],
              hots: [],
              attribute_modifications: []
            }
          },
          gameMessage: `Bem-vindo ao hub, ${character.name}!`,
        },
      }));
      
      console.log(`[GameProvider] Personagem ${character.name} carregado para o hub com stats derivados corretos`);
    } catch (error) {
      console.error('Erro ao carregar personagem para o hub:', error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao carregar personagem',
      });
    }
  }, []);

  // Função para atualizar stats do jogador de forma reativa
  const updatePlayerStats = useCallback((hp: number, mana: number) => {
    console.log(`[GameProvider] Atualizando stats do jogador: HP ${hp}, Mana ${mana}`);
    
    setState(prev => ({
      ...prev,
      gameState: {
        ...prev.gameState,
        player: {
          ...prev.gameState.player,
          hp: Math.floor(hp),
          mana: Math.floor(mana),
          potionUsedThisTurn: true
        }
      }
    }));
  }, []);

  // Função para atualizar consumáveis do jogador de forma reativa
  const updatePlayerConsumables = useCallback((consumables: CharacterConsumable[]) => {
    console.log(`[GameProvider] Atualizando consumáveis do jogador:`, consumables.length);
    
    setState(prev => ({
      ...prev,
      gameState: {
        ...prev.gameState,
        player: {
          ...prev.gameState.player,
          consumables: [...consumables] // Criar nova referência para forçar re-render
        }
      }
    }));
  }, []);

  // Limpar estado de jogo quando sair da batalha
  const clearGameState = useCallback(() => {
    console.log('[GameProvider] Limpando estado de jogo');
    
    // Resetar estado para o inicial
    setState(prev => ({
      ...prev,
      gameState: initialGameState,
      gameMessage: 'Estado do jogo limpo',
      error: null
    }));
    
    // Limpar personagem selecionado se necessário
    setSelectedCharacter(null);
  }, []);

  // Realizar ação do jogador
  const performAction = useCallback(async (action: ActionType, spellId?: string, consumableId?: string) => {
    // NOVO: Sistema robusto com controle de turnos únicos
    const currentTime = Date.now();
    const currentActionId = ++actionIdRef.current;
    
    console.log(`[game-provider] === PERFORMACTION INÍCIO (ID: ${currentActionId}) ===`);
    console.log(`[game-provider] performAction chamado com ação: '${action}'`);
    console.log(`[game-provider] selectedCharacter:`, selectedCharacter?.name);
    console.log(`[game-provider] loadingRef.current:`, loadingRef.current);
    console.log(`[game-provider] gameState.mode:`, state.gameState.mode);
    console.log(`[game-provider] gameState.battleRewards:`, !!state.gameState.battleRewards);
    
    // 1. CRÍTICO: Garantir que sempre há uma sessão de batalha válida
    let battleSession = state.gameState.battleSession;
    
    // NOVO: Verificar SEMPRE se há sessão para ações de batalha
    const isBattleAction = ['attack', 'defend', 'spell', 'flee'].includes(action);
    const isBattleMode = state.gameState.mode === 'battle' && state.gameState.currentEnemy !== null;
    
         if (isBattleMode && isBattleAction && state.gameState.currentEnemy) {
       if (!battleSession) {
         console.warn(`[game-provider] CRÍTICO: Nenhuma sessão de batalha encontrada, criando emergencialmente...`);
         
         try {
           const emergencySession = TurnControlService.ensureValidSession(
             state.gameState.player.floor,
             state.gameState.currentEnemy.name
           );
          
          console.log(`[game-provider] Sessão de emergência criada: ${emergencySession.sessionId}`);
          
          battleSession = emergencySession;
          
          // Atualizar estado imediatamente
          setState(currentState => ({
            ...currentState,
            gameState: {
              ...currentState.gameState,
              battleSession: emergencySession
            }
          }));
          
          console.log(`[game-provider] Estado atualizado com sessão de emergência`);
        } catch (error) {
          console.error(`[game-provider] ERRO CRÍTICO: Não foi possível criar sessão de emergência:`, error);
          // Continuar mesmo assim - deixar o sistema tentar processar
        }
      } else {
                 // Verificar se a sessão ainda é válida
         const isValid = TurnControlService.isSessionValid(battleSession.sessionId);
         if (!isValid) {
           console.warn(`[game-provider] Sessão inválida detectada, criando nova...`);
           
           try {
             const newSession = TurnControlService.ensureValidSession(
               state.gameState.player.floor,
               state.gameState.currentEnemy!.name
             );
            
            battleSession = newSession;
            
            setState(currentState => ({
              ...currentState,
              gameState: {
                ...currentState.gameState,
                battleSession: newSession
              }
            }));
            
            console.log(`[game-provider] Sessão renovada: ${newSession.sessionId}`);
          } catch (error) {
            console.error(`[game-provider] Erro ao renovar sessão:`, error);
          }
        } else {
          console.log(`[game-provider] Usando sessão válida existente: ${battleSession.sessionId}`);
        }
      }
    } else {
      console.log(`[game-provider] Ação '${action}' não requer sessão de batalha`);
    }
    
    // Se ainda não temos sessão após tentativa de criação, bloquear
    if (!battleSession && state.gameState.mode === 'battle') {
      console.warn(`[game-provider] Ação '${action}' BLOQUEADA - não foi possível criar/encontrar sessão de batalha`);
      return;
    }
    
    // 2. Usar TurnControlService para verificar se podemos executar a ação
    if (battleSession && ['attack', 'defend', 'spell', 'flee'].includes(action)) {
      const canPerform = TurnControlService.canPerformAction(
        battleSession.sessionId,
        'player',
        action
      );
      
      if (!canPerform.canPerform) {
        console.warn(`[game-provider] Ação '${action}' BLOQUEADA pelo TurnControl - ${canPerform.reason}`);
        
        // NOVO: Para ações críticas, tentar recuperar automaticamente a sessão
        if (canPerform.reason?.includes('Sessão não encontrada') && ['attack', 'defend'].includes(action)) {
          console.warn(`[game-provider] Recuperação automática para ação crítica '${action}'...`);
          
          // Usar função de sincronização automática
          const recoveredSession = TurnControlService.ensureValidSession(
            state.gameState.player.floor,
            state.gameState.currentEnemy?.name || 'Unknown',
            battleSession.sessionId
          );
          
          // Atualizar estado com sessão recuperada
          setState(currentState => ({
            ...currentState,
            gameState: {
              ...currentState.gameState,
              battleSession: recoveredSession
            }
          }));
          
          console.log(`[game-provider] Sessão recuperada: ${recoveredSession.sessionId}, continuando...`);
          battleSession = recoveredSession; // Usar a sessão recuperada para esta execução
        } else {
          // Para outras situações, bloquear a ação
          return;
        }
      } else {
        console.log(`[game-provider] Ação '${action}' APROVADA pelo TurnControl - ID: ${canPerform.actionId}`);
      }
    }
    
    // 3. Verificar se já está processando uma ação (fallback)
    if (actionProcessingRef.current) {
      console.warn(`[game-provider] Ação '${action}' BLOQUEADA - já processando ação (fallback)`);
      return;
    }
    
    // 4. Marcar como processando ANTES de qualquer validação
    actionProcessingRef.current = true;
    
    // 5. Atualizar última ação com ID único
    lastActionRef.current = {
      action,
      spellId,
      consumableId,
      timestamp: currentTime,
      actionId: currentActionId
    };
    
    // Função para limpar estado de processamento
    const clearProcessingState = () => {
      actionProcessingRef.current = false;
      loadingRef.current = false;
      updateLoading('performAction', false);
    };
    
    // 5. Validações com limpeza automática em caso de erro
    if (!selectedCharacter) {
      console.warn(`[game-provider] Ação '${action}' BLOQUEADA - selectedCharacter é null`);
      clearProcessingState();
      return;
    }
    
    if (loadingRef.current) {
      console.warn(`[game-provider] Ação '${action}' BLOQUEADA - loadingRef.current é true`);
      clearProcessingState();
      return;
    }
    
    // CRÍTICO: Bloquear todas as ações se o personagem está morto
    if (state.gameState.mode === 'gameover') {
      console.warn(`[game-provider] Ação '${action}' BLOQUEADA - personagem está morto`);
      clearProcessingState();
      return;
    }
    
    console.log(`[game-provider] Todas as validações passaram, processando ação '${action}' (ID: ${currentActionId})`);
    
    // OTIMIZADO: Cancelar timeout anterior se existir
    if (performActionTimeoutRef.current) {
      clearTimeout(performActionTimeoutRef.current);
      performActionTimeoutRef.current = null;
    }
    
    // 6. Marcar loading apenas se ainda não está
    if (!loadingRef.current) {
    loadingRef.current = true;
    updateLoading('performAction', true);
    }
    
    setState(prev => {
      try {
        // CRÍTICO: Processar ação 'continue' ANTES de qualquer outra validação
        if (action === 'continue') {
          console.log('[game-provider] === INÍCIO DA TRANSIÇÃO ===');
          
          // Verificar se temos recompensas de batalha para processar
          if (!prev.gameState.battleRewards) {
            console.warn('[game-provider] Tentativa de continuar sem recompensas de batalha');
            clearProcessingState();
            return prev;
          }
          
          const currentFloor = prev.gameState.player.floor;
          const nextFloor = currentFloor + 1;
          
          // Executar transição de forma assíncrona - SIMPLIFICADO
          setTimeout(async () => {
            try {
              // NOVO: Limpar dados da batalha anterior antes de avançar
              if (battleSession) {
                console.log(`[game-provider] Limpando dados da batalha anterior: ${battleSession.battleId}`);
                TurnControlService.cleanupBattleData(battleSession.battleId);
              }
              
              GameService.clearAllCaches();
              const updatedState = await GameService.advanceToNextFloor(prev.gameState);
              
              setState(currentState => ({
                ...currentState,
                gameState: {
                  ...updatedState,
                  battleRewards: null, // Limpar após avanço bem-sucedido
                  battleSession: undefined, // Limpar sessão de batalha
                  isPlayerTurn: true
                }
              }));
              
              console.log('[game-provider] === TRANSIÇÃO CONCLUÍDA ===');
            } catch (error) {
              console.error('[game-provider] Erro na transição:', error);
              setState(currentState => ({
                ...currentState,
                gameState: {
                  ...currentState.gameState,
                  currentEnemy: null,
                  battleRewards: null,
                  battleSession: undefined,
                  mode: 'battle',
                  gameMessage: `Erro ao avançar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
                }
              }));
            } finally {
              clearProcessingState();
            }
          }, 100);
          
          // NÃO modificar battleRewards aqui - manter até transição completar
          return {
            ...prev,
            gameState: {
              ...prev.gameState,
              gameMessage: `Avançando para o Andar ${nextFloor}...`
            }
          };
        }
        
        // Processar interação com evento especial
        if (action === 'interact_event') {
          if (prev.gameState.mode !== 'special_event' || !prev.gameState.currentSpecialEvent) {
            clearProcessingState();
            return prev;
          }
          
          // Processar evento de forma assíncrona
          setTimeout(async () => {
            try {
              const updatedState = await GameService.processSpecialEventInteraction(prev.gameState);
              
              if (selectedCharacter && updatedState.player) {
                if (updatedState.player.hp !== prev.gameState.player.hp || 
                    updatedState.player.mana !== prev.gameState.player.mana) {
                  await CharacterService.updateCharacterHpMana(
                    selectedCharacter.id,
                    updatedState.player.hp,
                    updatedState.player.mana
                  );
                }
                
                const goldGained = updatedState.player.gold - prev.gameState.player.gold;
                if (goldGained > 0) {
                  await CharacterService.grantSecureGold(selectedCharacter.id, goldGained, 'combat');
                }
              }
              
              setState(currentState => ({
                ...currentState,
                gameState: updatedState
              }));
              
              setTimeout(() => {
                setState(currentState => ({
                  ...currentState,
                  gameState: {
                    ...currentState.gameState,
                    currentSpecialEvent: null,
                    mode: 'battle' as const,
                    gameMessage: 'Pressione "Continuar" para avançar para o próximo andar.'
                  }
                }));
              }, 3000);
              
            } catch (error) {
              console.error('[game-provider] Erro ao processar evento especial:', error);
              setState(currentState => ({
                ...currentState,
                gameState: {
                  ...currentState.gameState,
                  gameMessage: 'Erro ao processar evento especial.'
                }
              }));
            } finally {
              clearProcessingState();
            }
          }, 100);
          
          return {
            ...prev,
            gameState: {
              ...prev.gameState,
              gameMessage: 'Processando evento especial...'
            }
          };
        }

        // Para outras ações, verificar validações de batalha
        if (prev.gameState.mode !== 'battle' || !prev.gameState.currentEnemy) {
          console.log('[game-provider] Validação falhou - mode:', prev.gameState.mode, 'enemy:', !!prev.gameState.currentEnemy);
          clearProcessingState();
          return prev;
        }

        // NOVA LÓGICA UNIFICADA: Processar turno completo (jogador + inimigo) de uma só vez
        setTimeout(async () => {
          // NOVO: Variáveis para controle de turnos
          let playerActionId: string | null = null;
          let canEnemyAct: { canPerform: boolean; reason?: string; actionId?: string } | null = null;
          
          try {
            console.log(`[game-provider] === PROCESSANDO TURNO COMPLETO ===`);
            console.log(`[game-provider] Ação do jogador: ${action}`);
            
            // Inicializar variáveis de controle
            canEnemyAct = null;
            
            // 1. Processar ação do jogador
            // NOVO: Marcar início da ação do jogador se for uma ação de batalha
            if (battleSession && ['attack', 'defend', 'spell', 'flee'].includes(action)) {
              const canPerform = TurnControlService.canPerformAction(
                battleSession.sessionId,
                'player',
                action
              );
              
              if (canPerform.canPerform && canPerform.actionId) {
                TurnControlService.startAction(
                  battleSession.sessionId,
                  canPerform.actionId,
                  'player',
                  action
                );
                playerActionId = canPerform.actionId;
                console.log(`[game-provider] Ação do jogador iniciada - ID: ${playerActionId}`);
              }
            }
            
            const playerActionResult = await GameService.processPlayerAction(
              action, 
              prev.gameState,
              spellId,
              consumableId
            );

            const { newState: playerActionState, skipTurn, message, gameLogMessages } = playerActionResult;
            
            console.log(`[game-provider] Ação do jogador processada - skipTurn: ${skipTurn}`);
            
            // CORRIGIDO: Adicionar mensagens da ação do jogador ao log PRIMEIRO
            if (gameLogMessages && gameLogMessages.length > 0) {
              // Separar mensagens por tipo para manter ordem correta
              const actionMessages = gameLogMessages.filter(msg => msg.type === 'player_action' || msg.type === 'damage' || msg.type === 'system');
              const skillXpMessages = gameLogMessages.filter(msg => msg.type === 'skill_xp');
              
              // Adicionar mensagens de ação primeiro
              actionMessages.forEach(logMessage => {
                addGameLogMessage(logMessage.message, logMessage.type);
              });
              
              // Aguardar um momento antes de adicionar mensagens de skill XP
              if (skillXpMessages.length > 0) {
                setTimeout(() => {
                  skillXpMessages.forEach(logMessage => {
                    addGameLogMessage(logMessage.message, 'skill_xp');
                  });
                }, 100); // Pequeno delay para garantir ordem
              }
            }
            
            // REMOVIDO: Processamento duplicado de XP (já feito no GameService)
            // O GameService agora aplica skill XP diretamente e retorna as mensagens
            
            // CORRIGIDO: Lógica de skipTurn mais restritiva
            if (skipTurn) {
              // CRÍTICO: Apenas pular turno do inimigo em casos específicos
              
              // 1. Fuga bem-sucedida - terminar batalha
              if (action === 'flee' && playerActionState.fleeSuccessful) {
                console.log('[game-provider] Fuga bem-sucedida, terminando batalha...');
                
                setState(currentState => ({
                  ...currentState,
                  gameState: {
                    ...currentState.gameState,
                    gameMessage: message,
                    mode: 'fled',
                    currentEnemy: null,
                    fleeSuccessful: true
                  },
                }));
                
                clearProcessingState();
                return;
              }
              
              // 2. Fuga falhada - processar turno do inimigo normalmente (não pular)
              if (action === 'flee' && !playerActionState.fleeSuccessful) {
                console.log('[game-provider] Fuga falhou, processando turno do inimigo...');
                // NÃO fazer return, continuar para processamento do turno do inimigo
              }
              
              // 3. Erro de validação (mana, cooldown, etc.) - pular tudo
              else if (['spell', 'consumable'].includes(action) && 
                       (message.includes('insuficiente') || 
                        message.includes('cooldown') || 
                        message.includes('não encontrad'))) {
                console.log('[game-provider] Erro de validação, pulando turno completamente...');
                
                setState(currentState => ({
                  ...currentState,
                  gameState: {
                    ...currentState.gameState,
                    gameMessage: message,
                  },
                }));
                
                clearProcessingState();
                return;
              }
              
              // 4. Para outras situações de skipTurn, CONTINUAR para turno do inimigo
              else {
                console.log('[game-provider] skipTurn=true mas continuando para turno do inimigo...');
                // Não fazer return, continuar processamento
              }
            }

            // 2. Verificar se o inimigo foi derrotado pela ação do jogador
            if (playerActionState.currentEnemy && playerActionState.currentEnemy.hp <= 0) {
              console.log('[game-provider] === INIMIGO DERROTADO PELA AÇÃO DO JOGADOR ===');
              
              try {
                // CORRIGIDO: Processar recompensas mas manter inimigo morto para o modal
                const defeatedState = await GameService.processEnemyDefeat(playerActionState);
                
                if (selectedCharacter) {
                  await CharacterService.updateLastActivity(selectedCharacter.id);
                }
                
                // CRÍTICO: Manter currentEnemy morto para que o modal possa ser exibido
                setState(prev => ({
                  ...prev,
                  gameState: {
                    ...defeatedState,
                    currentEnemy: playerActionState.currentEnemy // Manter inimigo morto
                  }
                }));
                
                console.log('[game-provider] === RECOMPENSAS PROCESSADAS - AGUARDANDO CONFIRMAÇÃO ===');
              } catch (error) {
                console.error('[game-provider] Erro ao processar derrota:', error);
              }
              
              clearProcessingState();
              return;
            }

            // 3. Se o inimigo não foi derrotado, processar turno do inimigo COM DELAY
            // CRÍTICO: NÃO processar turno do inimigo se a fuga foi bem-sucedida
            if (playerActionState.currentEnemy && !playerActionState.fleeSuccessful) {
              console.log('[game-provider] === PROCESSANDO TURNO DO INIMIGO COM DELAY ===');
              
              // NOVO: Sistema mais robusto para controle de turnos do inimigo
              let battleSession = playerActionState.battleSession;
              
              // CRÍTICO: Se não há sessão, criar uma para garantir continuidade
              if (!battleSession) {
                console.warn(`[game-provider] Sem sessão de batalha, criando nova para turno do inimigo...`);
                try {
                  battleSession = TurnControlService.ensureValidSession(
                    playerActionState.player.floor,
                    playerActionState.currentEnemy.name
                  );
                  console.log(`[game-provider] Nova sessão criada para turno do inimigo: ${battleSession.sessionId}`);
                  
                  // Atualizar estado com nova sessão
                  playerActionState.battleSession = battleSession;
                } catch (error) {
                  console.error(`[game-provider] Erro ao criar sessão para turno do inimigo:`, error);
                  // Continuar sem sessão - o turno ainda será processado
                }
              }
              
              if (battleSession) {
                canEnemyAct = TurnControlService.canPerformAction(
                  battleSession.sessionId,
                  'enemy',
                  'enemy_turn'
                );
                
                if (!canEnemyAct.canPerform) {
                  console.warn(`[game-provider] Turno do inimigo BLOQUEADO pelo TurnControl - ${canEnemyAct.reason}`);
                  
                  // NOVO: Para turnos de inimigo, ser MUITO mais permissivo
                  const permissiveReasons = [
                    'Debounce ativo',
                    'processando',
                    'última ação muito recente',
                    'ação em progresso'
                  ];
                  
                  const shouldForceEnemyTurn = permissiveReasons.some(reason => 
                    canEnemyAct?.reason?.toLowerCase().includes(reason.toLowerCase())
                  );
                  
                  if (shouldForceEnemyTurn) {
                    console.log(`[game-provider] FORÇANDO turno do inimigo - motivo contornável: ${canEnemyAct.reason}`);
                    
                    // Gerar ID de ação de emergência
                    const emergencyActionId = `emergency-enemy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    
                    try {
                      TurnControlService.startAction(
                        battleSession.sessionId,
                        emergencyActionId,
                        'enemy',
                        'enemy_turn'
                      );
                      
                      canEnemyAct = { canPerform: true, actionId: emergencyActionId };
                      console.log(`[game-provider] Turno do inimigo FORÇADO com sucesso - ID: ${emergencyActionId}`);
                    } catch (forceError) {
                      console.error(`[game-provider] Erro ao forçar turno do inimigo:`, forceError);
                      // Continuar mesmo assim para não travar o jogo
                      canEnemyAct = { canPerform: true, actionId: emergencyActionId };
                    }
                  } else {
                    console.error(`[game-provider] Turno do inimigo bloqueado por motivo crítico: ${canEnemyAct.reason}`);
                    
                    // NOVO: Mesmo em casos críticos, tentar diagnosticar e recuperar
                    const debugStats = TurnControlService.getDebugStats();
                    console.log(`[game-provider] Debug Stats:`, debugStats);
                    
                    // Se há sessões travadas, tentar destravar
                    if (debugStats.activeSessions > 0) {
                      console.log(`[game-provider] Tentando destravar sessões para permitir turno do inimigo...`);
                      TurnControlService.forceUnlockAll();
                      
                      // Tentar novamente após destravar
                      const retryCanAct = TurnControlService.canPerformAction(
                        battleSession.sessionId,
                        'enemy',
                        'enemy_turn'
                      );
                      
                      if (retryCanAct.canPerform) {
                        console.log(`[game-provider] Turno do inimigo DESTRAVADO com sucesso - ID: ${retryCanAct.actionId}`);
                        canEnemyAct = retryCanAct;
                        
                        TurnControlService.startAction(
                          battleSession.sessionId,
                          retryCanAct.actionId!,
                          'enemy',
                          'enemy_turn'
                        );
                      } else {
                        console.error(`[game-provider] Falha ao destravar turno do inimigo, processando sem controle`);
                        // Processar sem controle de turnos para não travar o jogo
                        canEnemyAct = { canPerform: true, actionId: `bypass-${Date.now()}` };
                      }
                    } else {
                      // Se não há sessões ativas, algo está muito errado - processar mesmo assim
                      console.error(`[game-provider] Estado inconsistente detectado, processando turno do inimigo sem controle`);
                      canEnemyAct = { canPerform: true, actionId: `bypass-${Date.now()}` };
                    }
                  }
                } else {
                  // Marcar início da ação do inimigo normalmente
                  TurnControlService.startAction(
                    battleSession.sessionId,
                    canEnemyAct.actionId!,
                    'enemy',
                    'enemy_turn'
                  );
                  
                  console.log(`[game-provider] Turno do inimigo APROVADO normalmente - ID: ${canEnemyAct.actionId}`);
                }
              } else {
                console.warn(`[game-provider] Processando turno do inimigo SEM sessão de controle`);
                canEnemyAct = { canPerform: true, actionId: `no-session-${Date.now()}` };
              }
              
              // Mostrar estado intermediário antes do delay
              setState(prev => ({
                ...prev,
                gameState: {
                  ...playerActionState,
                  isPlayerTurn: false,
                  gameMessage: message
                }
              }));
              
              // Adicionar mensagem ao log indicando que o inimigo está pensando
              const enemyName = playerActionState.currentEnemy?.name || 'Inimigo';
              addGameLogMessage(`${enemyName} está pensando em sua próxima ação...`, 'system');
              
              console.log(`[game-provider] Chamando GameService.processEnemyActionWithDelay...`);
              console.log(`[game-provider] Estado antes do processamento do inimigo:`, {
                enemyName: playerActionState.currentEnemy?.name,
                enemyHp: playerActionState.currentEnemy?.hp,
                playerHp: playerActionState.player.hp,
                isPlayerTurn: playerActionState.isPlayerTurn
              });
              
              const enemyActionResult = await GameService.processEnemyActionWithDelay(
                {
                  ...playerActionState,
                  isPlayerTurn: false,
                  gameMessage: message
                },
                action === 'defend'
              );

              const { newState: finalState, skillXpGains: enemySkillXpGains, skillMessages: enemySkillMessages } = enemyActionResult;
              
              console.log(`[game-provider] Resultado do processamento do inimigo:`, {
                finalMessage: finalState.gameMessage,
                playerHpAfter: finalState.player.hp,
                isPlayerTurnAfter: finalState.isPlayerTurn
              });
              
              // Processar XP de defesa se houver
              if (enemySkillXpGains && enemySkillXpGains.length > 0 && selectedCharacter) {
                try {
                  for (const skillGain of enemySkillXpGains) {
                    await CharacterService.addSkillXp(selectedCharacter.id, skillGain.skill, skillGain.xp);
                  }
                  
                  if (enemySkillMessages) {
                    enemySkillMessages.forEach(skillMsg => addGameLogMessage(skillMsg, 'skill_xp'));
                  }
                } catch (error) {
                  console.error('[game-provider] Erro ao aplicar XP de defesa:', error);
                }
              }

              // Verificar se o jogador morreu
              if (finalState.mode === 'gameover') {
                console.log('[game-provider] === JOGADOR MORREU ===');
                
                setState(prev => ({
                  ...prev,
                  gameState: finalState
                }));
                
                clearProcessingState();
                return;
              }

              // CRÍTICO: Verificar se o inimigo morreu por DoT/efeitos
              if (finalState.currentEnemy && finalState.currentEnemy.hp <= 0) {
                console.log('[game-provider] === INIMIGO MORREU POR EFEITOS - PROCESSANDO VITÓRIA ===');
                
                try {
                  // Processar vitória normalmente se não há recompensas ainda
                  const victoryState = await GameService.processEnemyDefeat({
                    ...finalState,
                    isPlayerTurn: true
                  });
                  
                  setState(prev => ({
                    ...prev,
                    gameState: victoryState
                  }));
                  
                  addGameLogMessage(`${finalState.currentEnemy.name} foi derrotado por efeitos ao longo do tempo!`, 'system');
                  
                } catch (error) {
                  console.error('[game-provider] Erro ao processar vitória por efeitos:', error);
                  
                  // Fallback: apenas limpar o inimigo
                  const cleanedState = {
                    ...finalState,
                    currentEnemy: null,
                    isPlayerTurn: true,
                    gameMessage: `${finalState.currentEnemy.name} foi derrotado por efeitos ao longo do tempo!`
                  };
                  
                  setState(prev => ({
                    ...prev,
                    gameState: cleanedState
                  }));
                }
                
                clearProcessingState();
                return;
              }

              // Atualizar HP e Mana do personagem no banco
              if (selectedCharacter) {
                await CharacterService.updateCharacterHpMana(
                  selectedCharacter.id,
                  finalState.player.hp,
                  finalState.player.mana
                );
              }

              // Adicionar mensagem ao log se houver
              if (finalState.gameMessage && finalState.gameMessage.trim() !== '') {
                let messageType: 'enemy_action' | 'damage' | 'healing' = 'enemy_action';
                
                if (finalState.gameMessage.includes('causou') && finalState.gameMessage.includes('dano')) {
                  messageType = 'damage';
                } else if (finalState.gameMessage.includes('recuperou') && finalState.gameMessage.includes('HP')) {
                  messageType = 'healing';
                }
                
                addGameLogMessage(finalState.gameMessage, messageType);
              }

              // Estado final
              setState(prev => ({
                ...prev,
                gameState: {
                  ...finalState,
                  isPlayerTurn: true
                }
              }));
              
              // NOVO: Finalizar ação do inimigo
              if (battleSession && canEnemyAct && canEnemyAct.actionId) {
                console.log(`[game-provider] Finalizando ação do inimigo - ID: ${canEnemyAct.actionId}`);
                TurnControlService.finishAction(battleSession.sessionId, canEnemyAct.actionId);
              } else {
                console.warn(`[game-provider] Não foi possível finalizar ação do inimigo:`, {
                  hasBattleSession: !!battleSession,
                  hasCanEnemyAct: !!canEnemyAct,
                  hasActionId: !!(canEnemyAct && canEnemyAct.actionId)
                });
              }
            }

          } catch (error) {
            console.error('[game-provider] Erro no processamento do turno:', error);
            setState(currentState => ({
              ...currentState,
              error: error instanceof Error ? error.message : 'Erro ao processar turno',
            }));
          } finally {
            // NOVO: Finalizar ações pendentes
            if (battleSession && playerActionId) {
              TurnControlService.finishAction(battleSession.sessionId, playerActionId);
              console.log(`[game-provider] Ação do jogador finalizada - ID: ${playerActionId}`);
            }
            if (battleSession && canEnemyAct && canEnemyAct.actionId) {
              TurnControlService.finishAction(battleSession.sessionId, canEnemyAct.actionId);
              console.log(`[game-provider] Ação do inimigo finalizada - ID: ${canEnemyAct.actionId}`);
            }
            
            clearProcessingState();
          }
        }, 100);

        return prev;
      } catch (error) {
        console.error('Erro ao processar ação:', error instanceof Error ? error.message : 'Erro desconhecido');
        clearProcessingState();
        return {
          ...prev,
          error: error instanceof Error ? error.message : 'Erro ao processar ação',
        };
      } finally {
        // Garantir limpeza final do estado
        if (actionProcessingRef.current) {
          clearProcessingState();
        }
      }
    });
  }, [selectedCharacter, state.gameState.mode]);

  // Voltar ao menu principal
  const returnToMenu = useCallback(() => {
    setSelectedCharacter(null);
    setState(prev => ({
      ...prev,
      gameState: initialGameState,
      gameMessage: characters.length > 0 
        ? 'Selecione um personagem para jogar!' 
        : 'Você ainda não tem personagens. Crie um para começar!',
      error: null,
    }));
  }, [characters]);



  // Memoizar o valor do contexto
  const contextValue = useMemo<GameContextType>(
    () => ({
      gameState: state.gameState,
      loading: state.loading,
      error: state.error,
      gameMessage: state.gameMessage || '',
      gameLog: state.gameLog,
      characters,
      selectedCharacter,
      startGame: createCharacter,
      selectCharacter,
      loadCharacterForHub,
      clearGameState,
      performAction,
      returnToMenu,
      resetError,
      addGameLogMessage,
      saveProgress: async () => {},
      updatePlayerStats,
      updatePlayerConsumables
    }),
    [
      state.gameState,
      state.loading,
      state.error,
      state.gameMessage,
      state.gameLog,
      characters,
      selectedCharacter,
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
} 