'use client';

import React, { ReactNode, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ActionType, GameContextState, GameLoadingState, GameState } from './game-model';
import { GameContext, GameContextType, initialGameState } from './game-context';
import { GameService } from './game-service';
import { CharacterService } from './character.service';
import { Character } from './models/character.model';
import { useAuth } from '../auth/auth-hook';
import { toast } from 'sonner';
import { SpellService } from './spell.service';
import { ConsumableService } from './consumable.service';

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
  const addGameLogMessage = useCallback((message: string, type: 'system' | 'battle' | 'lore' = 'system') => {
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
          
          // Verificar se há um personagem na URL
          const urlParams = new URLSearchParams(window.location.search);
          const characterId = urlParams.get('character');
          
          if (characterId) {
            const selectedChar = response.data.find(char => char.id === characterId);
            if (selectedChar) {
              // Só carrega o personagem se não houver um estado de jogo ativo
              if (!state.gameState.player.id) {
                await selectCharacter(selectedChar);
              } else {
                setSelectedCharacter(selectedChar);
              }
            }
          }
          
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

    loadCharacters();
  }, [user]);

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
                floor: 1,
                spells: initialSpells,
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
      setSelectedCharacter(character);
      
      // Obter magias disponíveis
      const spellsResponse = await SpellService.getAvailableSpells(character.level);
      const availableSpells = spellsResponse.success && spellsResponse.data
        ? spellsResponse.data.map(spell => ({ ...spell, current_cooldown: 0 }))
        : [];

      // Obter consumíveis do personagem
      const consumablesResponse = await ConsumableService.getCharacterConsumables(character.id);
      const characterConsumables = consumablesResponse.success && consumablesResponse.data
        ? consumablesResponse.data
        : [];

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
            ...character,
            isPlayerTurn: true,
            specialCooldown: 0,
            floor: 1,
            spells: availableSpells,
            consumables: characterConsumables,
            active_effects: {
              buffs: [],
              debuffs: [],
              dots: [],
              hots: []
            }
          },
          currentEnemy: initialEnemy,
          currentFloor: initialFloor,
          gameMessage: `Bem-vindo de volta, ${character.name}! Você está no ${initialFloor.description}.`,
        },
      }));
    } catch (error) {
      console.error('Erro ao selecionar personagem:', error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao selecionar personagem',
      });
    }
  }, []);

  // Realizar ação do jogador
  const performAction = useCallback(async (action: ActionType, spellId?: string, consumableId?: string) => {
    if (!selectedCharacter || loadingRef.current) return;
    loadingRef.current = true;
    updateLoading('performAction', true);
    
    setState(prev => {
      try {
        if (prev.gameState.mode !== 'battle' || !prev.gameState.currentEnemy) {
          return prev;
        }

        const { newState, skipTurn, message } = GameService.processPlayerAction(
          action, 
          prev.gameState,
          spellId,
          consumableId
        );
        
        if (skipTurn) {
          loadingRef.current = false;
          
          // Se a fuga foi bem-sucedida, redirecionar para o HUD
          if (action === 'flee' && message.includes('conseguiu fugir')) {
            window.location.href = `/game/play/hub?character=${selectedCharacter.id}`;
          }
          
          return {
            ...prev,
            gameState: {
              ...prev.gameState,
              gameMessage: message,
            },
          };
        }

        if (action === 'continue') {
          loadingRef.current = false;
          
          // Adicionar mensagem de log para o próximo andar (apenas uma vez)
          const nextFloor = prev.gameState.player.floor;
          const floorMessage = `Avançando para o Andar ${nextFloor}...`;
          
          // Verificar se esta mensagem já existe no log
          const recentLogs = prev.gameLog.slice(-5);
          const isDuplicate = recentLogs.some(log => log.text === floorMessage);
          
          if (!isDuplicate) {
            addGameLogMessage(floorMessage, 'system');
          }
          
          // Ao continuar para o próximo andar, garantir que o estado seja sincronizado imediatamente
          const currentState = {
            ...prev.gameState,
            // Garantir que o andar esteja correto e bloqueando múltiplas chamadas
            player: {
              ...prev.gameState.player,
              // O andar já deve estar atualizado pelo processEnemyDefeat
            },
            isPlayerTurn: true,
            battleRewards: null // Remover imediatamente as recompensas ao continuar
          };
          
          // Debug log
          console.log(`Avançando para o andar ${nextFloor}`);
          
          // Atualizar o estado imediatamente para evitar problemas de sincronização
          return {
            ...prev,
            gameState: currentState,
          };
        }

        if (newState.currentEnemy && newState.currentEnemy.hp <= 0) {
          // Processar derrota do inimigo de forma assíncrona
          GameService.processEnemyDefeat(newState).then(async updatedState => {
            // Verificar se o personagem subiu de nível
            const response = await CharacterService.updateCharacterStats(selectedCharacter.id, {
              xp: updatedState.currentEnemy!.reward_xp,
              gold: updatedState.currentEnemy!.reward_gold,
            });
            
            // Atualizar o estado com o novo nível e XP se subiu de nível
            if (response.success && response.data?.leveled_up) {
              // Recarregar o personagem para obter os novos stats
              const updatedCharacter = await CharacterService.getCharacter(selectedCharacter.id);
              if (updatedCharacter.success && updatedCharacter.data) {
                updatedState.player = {
                  ...updatedState.player,
                  level: updatedCharacter.data.level,
                  xp: updatedCharacter.data.xp,
                  xp_next_level: updatedCharacter.data.xp_next_level,
                  max_hp: updatedCharacter.data.max_hp,
                  max_mana: updatedCharacter.data.max_mana,
                  hp: updatedCharacter.data.hp,
                  mana: updatedCharacter.data.mana,
                  atk: updatedCharacter.data.atk,
                  def: updatedCharacter.data.def,
                  speed: updatedCharacter.data.speed
                };
              }
            }
            
            setState(prev => ({
              ...prev,
              gameState: updatedState,
            }));
            loadingRef.current = false;
          });
          
          return {
            ...prev,
            gameState: {
              ...prev.gameState,
              gameMessage: 'Você derrotou o inimigo!'
            }
          };
        }

        const updatedState = {
          ...newState,
          isPlayerTurn: false,
          gameMessage: message,
        };
        
        const processEnemyTurn = async (currentState: GameState) => {
          try {
            const enemyActionState = await GameService.processEnemyAction(
              currentState,
              action === 'defend'
            );

            // Atualizar HP e Mana do personagem
            if (selectedCharacter) {
              await CharacterService.updateCharacterStats(selectedCharacter.id, {
                hp: enemyActionState.player.hp,
                mana: enemyActionState.player.mana,
              });
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
          }
        };

        setTimeout(() => {
          if (updatedState.mode === 'battle') {
            processEnemyTurn(updatedState);
          } else {
            loadingRef.current = false;
          }
        }, 1000);

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

        // Ao processar mensagens de ação, evitar duplicações
        if (message && message.trim() !== '' && !messageProcessedRef.current) {
          messageProcessedRef.current = true;
          
          // Filtrar mensagens que não queremos mostrar no log
          if (!message.includes('conseguiu fugir') && 
              !message.includes('Nenhum consumível') && 
              !message.includes('insuficiente')) {
            
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

        return {
          ...prev,
          gameState: updatedState,
        };
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
  }, [selectedCharacter, addGameLogMessage]);

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
      performAction,
      returnToMenu,
      resetError,
      addGameLogMessage,
      saveProgress: async () => {}
    }),
    [
      state.gameState,
      state.loading,
      state.error,
      state.gameMessage,
      state.gameLog,
      characters,
      selectedCharacter,
      createCharacter,
      selectCharacter,
      performAction,
      returnToMenu,
      resetError,
      addGameLogMessage
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
} 