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
  // Removido: Estado para controlar processamento assíncrono de derrota não é mais necessário

  // Adicionar flag para evitar duplicação de mensagens
  const messageProcessedRef = useRef(false);

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
                ...newCharacter.data!,
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
              gameMessage: `Bem-vindo à sua primeira aventura, ${newCharacter.data!.name}! Você está no ${initialFloor.description}.`,
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
      
      // Obter magias disponíveis
      console.log(`[GameProvider] Buscando magias disponíveis para nível ${character.level}`);
      const spellsResponse = await SpellService.getAvailableSpells(character.level);
      const availableSpells = spellsResponse.success && spellsResponse.data
        ? spellsResponse.data.map(spell => ({ ...spell, current_cooldown: 0 }))
        : [];
      console.log(`[GameProvider] ${availableSpells.length} magias carregadas`);

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
      
      console.log(`[GameProvider] Definindo estado do jogo para batalha`);
      
      const newGameState = {
        ...initialGameState,
        mode: 'battle' as const,
        player: {
          ...character,
          isPlayerTurn: true,
          specialCooldown: 0,
          defenseCooldown: 0,
          isDefending: false,
          floor: currentFloor,
          spells: availableSpells,
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
      
      // Apenas carregar dados básicos do personagem para exibição no hub
      setState(prev => ({
        ...prev,
        gameState: {
          ...initialGameState,
          mode: 'hub', // Modo específico para hub
          player: {
            ...character,
            isPlayerTurn: true,
            specialCooldown: 0,
            defenseCooldown: 0,
            isDefending: false,
            floor: character.floor || 1,
            spells: [],
            consumables: [],
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
      
      console.log(`[GameProvider] Personagem ${character.name} carregado para o hub sem chamadas desnecessárias`);
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
    
    loadingRef.current = true;
    updateLoading('performAction', true);
    
    setState(prev => {
      try {
        // CRÍTICO: Processar ação 'continue' ANTES de qualquer outra validação
        if (action === 'continue') {
          console.log('[game-provider] === INÍCIO DA TRANSIÇÃO ===');
          console.log('[game-provider] Processando ação continue - verificando pré-condições');
          console.log('[game-provider] Estado atual:', {
            hasRewards: !!prev.gameState.battleRewards,
            currentFloor: prev.gameState.player.floor,
            hasEnemy: !!prev.gameState.currentEnemy,
            enemyName: prev.gameState.currentEnemy?.name,
            enemyHp: prev.gameState.currentEnemy?.hp
          });
          
          // Verificar se temos recompensas de batalha para processar
          if (!prev.gameState.battleRewards) {
            console.warn('[game-provider] Tentativa de continuar sem recompensas de batalha');
            loadingRef.current = false;
            updateLoading('performAction', false);
            return prev;
          }
          
          console.log('[game-provider] Pré-condições OK - iniciando transição para próximo andar');
          
          const currentFloor = prev.gameState.player.floor;
          const nextFloor = currentFloor + 1;
          
          console.log(`[game-provider] Transição: ${currentFloor} → ${nextFloor}`);
          
          // CRÍTICO: Executar transição de forma assíncrona mas controlada
          (async () => {
            console.log(`[game-provider] === EXECUTANDO TRANSIÇÃO ASYNC ===`);
            
            try {
              console.log(`[game-provider] Iniciando advanceToNextFloor para andar ${nextFloor}`);
              console.log(`[game-provider] Estado atual do andar: ${prev.gameState.player.floor}`);
              console.log(`[game-provider] Inimigo atual: ${prev.gameState.currentEnemy?.name || 'NENHUM'}`);
              
              // Limpar cache do jogo ANTES de avançar
              GameService.clearAllCaches();
              console.log(`[game-provider] Cache limpo - avançando para próximo andar...`);
              
              // Avançar para o próximo andar
              const updatedState = await GameService.advanceToNextFloor(prev.gameState);
              
              console.log(`[game-provider] === RESULTADO DA TRANSIÇÃO ===`);
              console.log(`[game-provider] advanceToNextFloor concluído - novo andar: ${updatedState.player.floor}`);
              console.log(`[game-provider] Novo inimigo: ${updatedState.currentEnemy?.name || 'NENHUM'}`);
              console.log(`[game-provider] Modo atual: ${updatedState.mode}`);
              console.log(`[game-provider] Has currentFloor: ${!!updatedState.currentFloor}`);
              console.log(`[game-provider] Floor description: ${updatedState.currentFloor?.description}`);
              
              // CRÍTICO: Verificar se realmente temos todos os dados necessários
              if (!updatedState.currentEnemy && updatedState.mode === 'battle') {
                console.error('[game-provider] ERRO: Estado inválido - modo battle sem inimigo');
                console.error('[game-provider] Dados do estado:', updatedState);
                throw new Error('Falha crítica ao gerar inimigo para o próximo andar');
              }
              
              console.log(`[game-provider] === ATUALIZANDO ESTADO ===`);
              
              // Atualizar o estado do jogo com dados completos
              setState(currentState => {
                console.log(`[game-provider] setState callback executado`);
                const newState = {
                  ...currentState,
                  gameState: {
                    ...updatedState,
                    battleRewards: null, // Garantir que recompensas sejam limpas
                    isPlayerTurn: true
                  }
                };
                
                console.log(`[game-provider] Novo estado será:`, {
                  mode: newState.gameState.mode,
                  hasEnemy: !!newState.gameState.currentEnemy,
                  enemyName: newState.gameState.currentEnemy?.name,
                  floor: newState.gameState.player.floor,
                  message: newState.gameState.gameMessage
                });
                
                return newState;
              });
              
              console.log(`[game-provider] === TRANSIÇÃO CONCLUÍDA COM SUCESSO ===`);
              
            } catch (error) {
              console.error('[game-provider] === ERRO NA TRANSIÇÃO ===');
              console.error('[game-provider] Erro ao processar transição:', error);
              
              setState(currentState => ({
                ...currentState,
                gameState: {
                  ...currentState.gameState,
                  currentEnemy: null,
                  battleRewards: null,
                  mode: 'battle',
                  gameMessage: `Erro ao avançar para o próximo andar: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Tente novamente.`
                }
              }));
            } finally {
              loadingRef.current = false;
              updateLoading('performAction', false);
              console.log(`[game-provider] === LIMPEZA FINALIZADA ===`);
            }
          })();
          
          // Retornar estado intermediário indicando carregamento
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
          console.log('[game-provider] Processando interação com evento especial');
          
          if (prev.gameState.mode !== 'special_event' || !prev.gameState.currentSpecialEvent) {
            console.warn('[game-provider] Tentativa de interagir com evento especial sem evento atual');
            loadingRef.current = false;
            return prev;
          }
          
          // Processar evento de forma assíncrona
          setTimeout(async () => {
            try {
              console.log(`[game-provider] Processando evento especial: ${prev.gameState.currentSpecialEvent?.name}`);
              
              const updatedState = await GameService.processSpecialEventInteraction(
                prev.gameState
              );
              
              // Atualizar stats do personagem no banco se houve mudanças
              if (selectedCharacter && updatedState.player) {
                // Atualizar HP e Mana se mudaram
                if (updatedState.player.hp !== prev.gameState.player.hp || 
                    updatedState.player.mana !== prev.gameState.player.mana) {
                  await CharacterService.updateCharacterHpMana(
                    selectedCharacter.id,
                    updatedState.player.hp,
                    updatedState.player.mana
                  );
                }
                
                // Atualizar gold se ganhou
                const goldGained = updatedState.player.gold - prev.gameState.player.gold;
                if (goldGained > 0) {
                  await CharacterService.grantSecureGold(selectedCharacter.id, goldGained, 'combat');
                }
              }
              
              setState(currentState => ({
                ...currentState,
                gameState: updatedState
              }));
              
              console.log(`[game-provider] Evento especial processado com sucesso`);
              
              // Após 3 segundos, permitir continuar para o próximo andar
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
                  gameMessage: 'Erro ao processar evento especial. Tente novamente.'
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

        // Processar ação do jogador de forma assíncrona
        setTimeout(async () => {
          try {
            const actionResult = await GameService.processPlayerAction(
              action, 
              prev.gameState,
              spellId,
              consumableId
            );

            const { newState, skipTurn, message, skillXpGains, skillMessages } = actionResult;
            
            console.log(`[game-provider] processPlayerAction retornou - skipTurn: ${skipTurn}, message: "${message}"`);
            
            // Processar XP de habilidades se houver
            if (skillXpGains && skillXpGains.length > 0 && selectedCharacter) {
              try {
                console.log('[game-provider] Aplicando XP de habilidades:', skillXpGains);
                
                for (const skillGain of skillXpGains) {
                  await CharacterService.addSkillXp(
                    selectedCharacter.id,
                    skillGain.skill,
                    skillGain.xp
                  );
                }
                
                // Adicionar mensagens de habilidade ao log
                if (skillMessages) {
                  skillMessages.forEach(skillMsg => {
                    addGameLogMessage(skillMsg, 'skill_xp');
                  });
                }
              } catch (error) {
                console.error('[game-provider] Erro ao aplicar XP de habilidades:', error);
                // Continuar sem XP de habilidades em caso de erro
              }
            }
            
            // CRÍTICO: Detectar se um consumível foi usado e propagar a atualização
            if (action === 'consumable' && !skipTurn && newState.player.consumables) {
              console.log('[game-provider] Ação de consumível processada - atualizando estado dos consumáveis');
              
              // Forçar re-render criando nova referência do array de consumáveis
              newState.player.consumables = [...newState.player.consumables];
            }
            
            if (skipTurn) {
              loadingRef.current = false;
              updateLoading('performAction', false);
              
              // Se a fuga foi bem-sucedida, processar fora do setState
              if (action === 'flee' && message.includes('conseguiu fugir')) {
                // Processar fuga de forma assíncrona
                setTimeout(async () => {
                  try {
                    console.log('[game-provider] Fuga bem-sucedida - atualizando andar para 1');
                    if (selectedCharacter) {
                      await CharacterService.updateCharacterFloor(selectedCharacter.id, 1);
                    }
                    // Redirecionar para o hub
                    window.location.href = `/game/play/hub?character=${selectedCharacter.id}`;
                  } catch (error) {
                    console.error('[game-provider] Erro ao processar fuga:', error);
                    toast.error('Erro ao processar fuga');
                  }
                }, 100);
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

            // Verificar se o inimigo foi derrotado
            if (newState.currentEnemy && newState.currentEnemy.hp <= 0) {
              console.log('[game-provider] === INIMIGO DERROTADO ===');
              console.log('[game-provider] Processando derrota do inimigo...');
              
              try {
                // Processar a derrota e obter recompensas
                const updatedState = await GameService.processEnemyDefeat(newState);
                
                console.log('[game-provider] Recompensas processadas:', {
                  hasBattleRewards: !!updatedState.battleRewards,
                  xp: updatedState.battleRewards?.xp,
                  gold: updatedState.battleRewards?.gold
                });
                
                // Atualizar última atividade
                if (selectedCharacter) {
                  await CharacterService.updateLastActivity(selectedCharacter.id);
                }
                
                // Atualizar estado com recompensas
                setState(prev => ({
                  ...prev,
                  gameState: updatedState
                }));
                
                console.log('[game-provider] === PROCESSAMENTO DE DERROTA CONCLUÍDO ===');
                
              } catch (error) {
                console.error('[game-provider] Erro ao processar derrota do inimigo:', error);
              }
              
              loadingRef.current = false;
              updateLoading('performAction', false);
              return;
            }

            // Se não há inimigo atual, não processar ações de combate
            if (!newState.currentEnemy) {
              console.log('[game-provider] Nenhum inimigo atual - ignorando ação de combate');
              setState(currentState => ({
                ...currentState,
                gameState: {
                  ...currentState.gameState,
                  gameMessage: message
                }
              }));
              
              loadingRef.current = false;
              updateLoading('performAction', false);
              return;
            }

            const updatedState = {
              ...newState,
              isPlayerTurn: false,
              gameMessage: message,
            };
            
            // Processar turno do inimigo
            setTimeout(async () => {
              try {
                const enemyActionResult = await GameService.processEnemyAction(
                  updatedState,
                  action === 'defend'
                );

                const { newState: enemyActionState, skillXpGains: enemySkillXpGains, skillMessages: enemySkillMessages } = enemyActionResult;

                // Processar XP de habilidades do turno do inimigo (defesa)
                if (enemySkillXpGains && enemySkillXpGains.length > 0 && selectedCharacter) {
                  try {
                    console.log('[game-provider] Aplicando XP de defesa do turno do inimigo:', enemySkillXpGains);
                    
                    for (const skillGain of enemySkillXpGains) {
                      await CharacterService.addSkillXp(
                        selectedCharacter.id,
                        skillGain.skill,
                        skillGain.xp
                      );
                    }
                    
                    // Adicionar mensagens de habilidade ao log
                    if (enemySkillMessages) {
                      enemySkillMessages.forEach(skillMsg => {
                        addGameLogMessage(skillMsg, 'skill_xp');
                      });
                    }
                  } catch (error) {
                    console.error('[game-provider] Erro ao aplicar XP de defesa:', error);
                    // Continuar sem XP de habilidades em caso de erro
                  }
                }

                // CRÍTICO: Verificar se o personagem morreu e redirecionar imediatamente
                if (enemyActionState.mode === 'gameover') {
                  console.log('[game-provider] Personagem morreu durante turno do inimigo');
                  
                  // Atualizar estado com a morte
                  setState(prev => ({
                    ...prev,
                    gameState: enemyActionState
                  }));
                  
                  loadingRef.current = false;
                  updateLoading('performAction', false);
                  // O redirecionamento será feito pelo useEffect que monitora characterDeleted
                  return;
                }

                // Se o inimigo foi derrotado por efeitos ao longo do tempo, processar a vitória
                if (enemyActionState.currentEnemy && enemyActionState.currentEnemy.hp <= 0) {
                  console.log('[game-provider] Inimigo derrotado por efeitos ao longo do tempo - processando vitória');
                  
                  // Processar derrota de forma síncrona para garantir que tenhamos as recompensas
                  const defeatState = await GameService.processEnemyDefeat(enemyActionState);
                  
                  // Atualizar estado com recompensas
                  setState(prev => ({
                    ...prev,
                    gameState: defeatState
                  }));
                  
                  loadingRef.current = false;
                  updateLoading('performAction', false);
                  return;
                }

                // Atualizar HP e Mana do personagem
                if (selectedCharacter) {
                  await CharacterService.updateCharacterHpMana(
                    selectedCharacter.id,
                    enemyActionState.player.hp,
                    enemyActionState.player.mana
                  );
                }

                // Adicionar mensagem da ação do inimigo ao log
                if (enemyActionState.gameMessage && enemyActionState.gameMessage.trim() !== '') {
                  // Determinar o tipo de mensagem baseado no conteúdo
                  let messageType: 'enemy_action' | 'damage' | 'healing' = 'enemy_action';
                  
                  if (enemyActionState.gameMessage.includes('causou') && enemyActionState.gameMessage.includes('dano')) {
                    messageType = 'damage';
                  } else if (enemyActionState.gameMessage.includes('recuperou') && enemyActionState.gameMessage.includes('HP')) {
                    messageType = 'healing';
                  }
                  
                  addGameLogMessage(enemyActionState.gameMessage, messageType);
                }

                setState(prev => ({
                  ...prev,
                  gameState: enemyActionState
                }));
              } catch (error) {
                console.error('Erro ao processar turno do inimigo:', error);
                toast.error('Erro ao processar turno do inimigo');
              } finally {
                loadingRef.current = false;
                updateLoading('performAction', false);
              }
            }, 1000);

            // Atualizar estado inicial
            setState(currentState => ({
              ...currentState,
              gameState: updatedState,
            }));

            // Quando o jogador ataca, adicionar mensagem de forma mais controlada
            if (action === 'attack' && prev.gameState.currentEnemy) {
              const enemyName = prev.gameState.currentEnemy.name;
              const attackMessage = `${prev.gameState.player.name} atacou ${enemyName}.`;
              
              // Verificar se esta mensagem já existe no log recente
              const recentLogs = prev.gameLog.slice(-3);
              const isDuplicate = recentLogs.some(log => log.text === attackMessage);
              
              if (!isDuplicate) {
                addGameLogMessage(attackMessage, 'battle');
              }
            }

            // Adicionar mensagem específica para defesa
            if (action === 'defend' && !message.includes('cooldown')) {
              addGameLogMessage('Você assume uma postura defensiva! O próximo ataque receberá 85% menos dano.', 'battle');
            }

            // Ao processar mensagens de ação, evitar duplicações
            if (message && message.trim() !== '' && !messageProcessedRef.current) {
              messageProcessedRef.current = true;
              
              // Filtrar mensagens que não queremos mostrar no log
              if (!message.includes('conseguiu fugir') && 
                  !message.includes('Nenhum consumível') && 
                  !message.includes('insuficiente') &&
                  !message.includes('assume uma postura defensiva')) { // Evitar duplicação da mensagem de defesa
                
                // Verificar se é uma mensagem duplicada
                const recentLogs = prev.gameLog.slice(-3);
                const isDuplicate = recentLogs.some(log => log.text === message);
                
                if (!isDuplicate) {
                  addGameLogMessage(message, 'battle');
                }
              }
              
              // Resetar a flag após um curto período
              setTimeout(() => {
                messageProcessedRef.current = false;
              }, 300); // Aumentar o tempo para garantir que não processe a mesma mensagem múltiplas vezes
            }
          } catch (error) {
            console.error('Erro ao processar ação:', error instanceof Error ? error.message : 'Erro desconhecido');
            loadingRef.current = false;
            updateLoading('performAction', false);
            
            setState(currentState => ({
              ...currentState,
              error: error instanceof Error ? error.message : 'Erro ao processar ação',
            }));
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