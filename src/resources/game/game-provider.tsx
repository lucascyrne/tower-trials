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

  // OTIMIZADO: Sistema de debounce para performAction
  const performActionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActionRef = useRef<{
    action: ActionType;
    timestamp: number;
    spellId?: string;
    consumableId?: string;
  } | null>(null);
  const ACTION_DEBOUNCE_MS = 300; // 300ms de debounce

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
                  hots: []
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
            hots: []
          }
        },
        currentEnemy: currentEnemy,
        currentFloor: floorData,
        gameMessage: `Bem-vindo de volta, ${character.name}! Você está no ${floorData.description}.`,
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
              hots: []
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
    // OTIMIZADO: Sistema de debounce para evitar chamadas duplicadas
    const currentTime = Date.now();
    const lastAction = lastActionRef.current;
    
    // Verificar se é uma ação duplicada muito próxima
    if (lastAction && 
        lastAction.action === action && 
        lastAction.spellId === spellId && 
        lastAction.consumableId === consumableId &&
        (currentTime - lastAction.timestamp) < ACTION_DEBOUNCE_MS) {
      console.warn(`[game-provider] Ação '${action}' BLOQUEADA - debounce (${currentTime - lastAction.timestamp}ms < ${ACTION_DEBOUNCE_MS}ms)`);
      return;
    }
    
    // Atualizar última ação
    lastActionRef.current = {
      action,
      spellId,
      consumableId,
      timestamp: currentTime
    };
    
    console.log(`[game-provider] === PERFORMACTION INÍCIO ===`);
    console.log(`[game-provider] performAction chamado com ação: '${action}'`);
    console.log(`[game-provider] selectedCharacter:`, selectedCharacter?.name);
    console.log(`[game-provider] loadingRef.current:`, loadingRef.current);
    console.log(`[game-provider] gameState.mode:`, state.gameState.mode);
    console.log(`[game-provider] gameState.battleRewards:`, !!state.gameState.battleRewards);
    
    if (!selectedCharacter) {
      console.warn(`[game-provider] Ação '${action}' BLOQUEADA - selectedCharacter é null`);
      return;
    }
    
    if (loadingRef.current) {
      console.warn(`[game-provider] Ação '${action}' BLOQUEADA - loadingRef.current é true`);
      return;
    }
    
    // CRÍTICO: Bloquear todas as ações se o personagem está morto
    if (state.gameState.mode === 'gameover') {
      console.warn(`[game-provider] Ação '${action}' BLOQUEADA - personagem está morto`);
      return;
    }
    
    console.log(`[game-provider] Todas as validações passaram, processando ação '${action}'`);
    
    // OTIMIZADO: Cancelar timeout anterior se existir
    if (performActionTimeoutRef.current) {
      clearTimeout(performActionTimeoutRef.current);
      performActionTimeoutRef.current = null;
    }
    
    loadingRef.current = true;
    updateLoading('performAction', true);
    
    setState(prev => {
      try {
        // CRÍTICO: Processar ação 'continue' ANTES de qualquer outra validação
        if (action === 'continue') {
          console.log('[game-provider] === INÍCIO DA TRANSIÇÃO ===');
          
          // Verificar se temos recompensas de batalha para processar
          if (!prev.gameState.battleRewards) {
            console.warn('[game-provider] Tentativa de continuar sem recompensas de batalha');
            loadingRef.current = false;
            updateLoading('performAction', false);
            return prev;
          }
          
          const currentFloor = prev.gameState.player.floor;
          const nextFloor = currentFloor + 1;
          
          // Executar transição de forma assíncrona
          (async () => {
            try {
              GameService.clearAllCaches();
              const updatedState = await GameService.advanceToNextFloor(prev.gameState);
              
              setState(currentState => ({
                ...currentState,
                gameState: {
                  ...updatedState,
                  battleRewards: null,
                  isPlayerTurn: true
                }
              }));
            } catch (error) {
              console.error('[game-provider] Erro na transição:', error);
              setState(currentState => ({
                ...currentState,
                gameState: {
                  ...currentState.gameState,
                  currentEnemy: null,
                  battleRewards: null,
                  mode: 'battle',
                  gameMessage: `Erro ao avançar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
                }
              }));
            } finally {
              loadingRef.current = false;
              updateLoading('performAction', false);
            }
          })();
          
          return {
            ...prev,
            gameState: {
              ...prev.gameState,
              battleRewards: null,
              gameMessage: `Avançando para o Andar ${nextFloor}...`
            }
          };
        }
        
        // Processar interação com evento especial
        if (action === 'interact_event') {
          if (prev.gameState.mode !== 'special_event' || !prev.gameState.currentSpecialEvent) {
            loadingRef.current = false;
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
              loadingRef.current = false;
              updateLoading('performAction', false);
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
          loadingRef.current = false;
          return prev;
        }

        // NOVA LÓGICA UNIFICADA: Processar turno completo (jogador + inimigo) de uma só vez
        setTimeout(async () => {
          try {
            console.log(`[game-provider] === PROCESSANDO TURNO COMPLETO ===`);
            console.log(`[game-provider] Ação do jogador: ${action}`);
            
            // 1. Processar ação do jogador
            const playerActionResult = await GameService.processPlayerAction(
              action, 
              prev.gameState,
              spellId,
              consumableId
            );

            const { newState: playerActionState, skipTurn, message, skillXpGains, skillMessages } = playerActionResult;
            
            console.log(`[game-provider] Ação do jogador processada - skipTurn: ${skipTurn}`);
            
            // Processar XP de habilidades do jogador se houver
            if (skillXpGains && skillXpGains.length > 0 && selectedCharacter) {
              try {
                for (const skillGain of skillXpGains) {
                  await CharacterService.addSkillXp(selectedCharacter.id, skillGain.skill, skillGain.xp);
                }
                
                if (skillMessages) {
                  skillMessages.forEach(skillMsg => addGameLogMessage(skillMsg, 'skill_xp'));
                }
              } catch (error) {
                console.error('[game-provider] Erro ao aplicar XP de habilidades do jogador:', error);
              }
            }
            
            // Se a ação do jogador pula o turno (fuga, erro, etc.)
            if (skipTurn) {
              loadingRef.current = false;
              updateLoading('performAction', false);
              
              // OTIMIZADO: Verificar fuga bem-sucedida usando a propriedade do estado
              if (action === 'flee' && playerActionState.fleeSuccessful) {
                console.log('[game-provider] Fuga bem-sucedida, preparando redirecionamento...');
                
                // Atualizar estado para indicar fuga bem-sucedida
                setState(currentState => ({
                  ...currentState,
                  gameState: {
                    ...currentState.gameState,
                    gameMessage: message,
                    mode: 'fled', // Modo especial para indicar fuga bem-sucedida
                    currentEnemy: null,
                    fleeSuccessful: true // Manter para que o componente possa reagir
                  },
                }));
                
                // Processar fuga de forma assíncrona
                setTimeout(async () => {
                  try {
                    if (selectedCharacter) {
                      // Atualizar andar para 1 (volta ao início)
                      await CharacterService.updateCharacterFloor(selectedCharacter.id, 1);
                      console.log('[game-provider] Andar do personagem atualizado para 1');
                    }
                  } catch (error) {
                    console.error('[game-provider] Erro ao processar fuga:', error);
                    toast.error('Erro ao processar fuga');
                  }
                }, 100);
                
                return;
              }
              
              setState(currentState => ({
                ...currentState,
                gameState: {
                  ...currentState.gameState,
                  gameMessage: message,
                },
              }));
              return;
            }

            // 2. Verificar se o inimigo foi derrotado pela ação do jogador
            if (playerActionState.currentEnemy && playerActionState.currentEnemy.hp <= 0) {
              console.log('[game-provider] === INIMIGO DERROTADO PELA AÇÃO DO JOGADOR ===');
              
              try {
                const defeatedState = await GameService.processEnemyDefeat(playerActionState);
                
                if (selectedCharacter) {
                  await CharacterService.updateLastActivity(selectedCharacter.id);
                }
                
                setState(prev => ({
                  ...prev,
                  gameState: defeatedState
                }));
                
                console.log('[game-provider] === DERROTA PROCESSADA COM SUCESSO ===');
              } catch (error) {
                console.error('[game-provider] Erro ao processar derrota:', error);
              }
              
              loadingRef.current = false;
              updateLoading('performAction', false);
              return;
            }

            // 3. Se o inimigo não foi derrotado, processar turno do inimigo COM DELAY
            // CRÍTICO: NÃO processar turno do inimigo se a fuga foi bem-sucedida
            if (playerActionState.currentEnemy && !playerActionState.fleeSuccessful) {
              console.log('[game-provider] === PROCESSANDO TURNO DO INIMIGO COM DELAY ===');
              
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
              
              const enemyActionResult = await GameService.processEnemyActionWithDelay(
                {
                  ...playerActionState,
                  isPlayerTurn: false,
                  gameMessage: message
                },
                action === 'defend'
              );

              const { newState: finalState, skillXpGains: enemySkillXpGains, skillMessages: enemySkillMessages } = enemyActionResult;
              
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
                
                loadingRef.current = false;
                updateLoading('performAction', false);
                return;
              }

              // CRÍTICO: Verificar se o inimigo morreu por DoT/efeitos (SEM REPROCESSAR RECOMPENSAS)
              if (finalState.currentEnemy && finalState.currentEnemy.hp <= 0) {
                console.log('[game-provider] === INIMIGO MORREU POR EFEITOS - SEM REPROCESSAR ===');
                
                // Apenas limpar o inimigo sem dar recompensas duplicadas
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
                
                loadingRef.current = false;
                updateLoading('performAction', false);
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
            }

          } catch (error) {
            console.error('[game-provider] Erro no processamento do turno:', error);
            setState(currentState => ({
              ...currentState,
              error: error instanceof Error ? error.message : 'Erro ao processar turno',
            }));
          } finally {
            loadingRef.current = false;
            updateLoading('performAction', false);
          }
        }, 100);

        return prev;
      } catch (error) {
        console.error('Erro ao processar ação:', error instanceof Error ? error.message : 'Erro desconhecido');
        loadingRef.current = false;
        return {
          ...prev,
          error: error instanceof Error ? error.message : 'Erro ao processar ação',
        };
      } finally {
        updateLoading('performAction', false);
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