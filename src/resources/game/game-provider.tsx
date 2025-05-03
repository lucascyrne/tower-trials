'use client';

import React, { ReactNode, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ActionType, GameContextState, GameLoadingState } from './game-model';
import { GameContext, GameContextType, initialContextState, initialGameState } from './game-context';
import { GameService } from './game-service';
import { CharacterService } from './character.service';
import { Character } from './models/character.model';
import { useAuth } from '../auth/auth-hook';
import { toast } from 'sonner';
import { SpellService } from './spell.service';

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, setState] = useState<GameContextState>({
    ...initialContextState,
    gameMessage: 'Bem-vindo ao Tower Trials! Crie um personagem para iniciar sua aventura.'
  });
  const { user } = useAuth();
  const loadingRef = useRef(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

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
              gameMessage: 'Selecione um personagem para jogar!',
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
    setSelectedCharacter(character);
    
    // Obter magias disponíveis
    const spellsResponse = await SpellService.getAvailableSpells(character.level);
    const availableSpells = spellsResponse.success && spellsResponse.data
      ? spellsResponse.data.map(spell => ({ ...spell, current_cooldown: 0 }))
      : [];

    // Obter dados do primeiro andar
    const initialFloor = await GameService.getFloorData(1);
    if (!initialFloor) {
      toast.error('Erro', {
        description: 'Erro ao gerar andar inicial. Tente novamente.',
      });
      return;
    }

    // Gerar inimigo inicial
    const initialEnemy = await GameService.generateEnemy(1);
    if (!initialEnemy) {
      toast.error('Erro', {
        description: 'Erro ao gerar inimigo inicial. Tente novamente.',
      });
      return;
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
  }, []);

  // Realizar ação do jogador
  const performAction = useCallback(async (action: ActionType) => {
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
          prev.gameState
        );
        
        if (skipTurn) {
          return {
            ...prev,
            gameState: {
              ...prev.gameState,
              gameMessage: message,
            },
          };
        }

        if (newState.currentEnemy && newState.currentEnemy.hp <= 0) {
          // Processar derrota do inimigo de forma assíncrona
          GameService.processEnemyDefeat(newState).then(updatedState => {
            // Atualizar XP e Gold do personagem
            CharacterService.updateCharacterStats(selectedCharacter.id, {
              xp: updatedState.currentEnemy!.reward_xp,
              gold: updatedState.currentEnemy!.reward_gold,
            });
            
            setState(prev => ({
              ...prev,
              gameState: updatedState,
            }));
          });
          
          return prev;
        }

        const updatedState = {
          ...newState,
          isPlayerTurn: false,
          gameMessage: message,
        };
        
        setTimeout(() => {
          loadingRef.current = false;
          if (updatedState.mode === 'battle') {
            setState(current => {
              const enemyActionState = GameService.processEnemyAction(
                current.gameState, 
                action === 'defend'
              );
              
              // Atualizar HP e Mana do personagem
              if (selectedCharacter) {
                CharacterService.updateCharacterStats(selectedCharacter.id, {
                  hp: enemyActionState.player.hp,
                  mana: enemyActionState.player.mana,
                });
              }
              
              return {
                ...current,
                gameState: enemyActionState,
              };
            });
          }
        }, 1000);

        return {
          ...prev,
          gameState: updatedState,
        };
      } catch (error) {
        console.error('Erro ao processar ação:', error instanceof Error ? error.message : 'Erro desconhecido');
        return {
          ...prev,
          error: error instanceof Error ? error.message : 'Erro ao processar ação',
        };
      } finally {
        updateLoading('performAction', false);
      }
    });
  }, [selectedCharacter]);

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
      gameMessage: state.gameMessage,
      characters,
      selectedCharacter,
      startGame: createCharacter,
      selectCharacter,
      performAction,
      returnToMenu,
      resetError,
      saveProgress: async () => {}
    }),
    [
      state.gameState,
      state.loading,
      state.error,
      state.gameMessage,
      characters,
      selectedCharacter,
      createCharacter,
      selectCharacter,
      performAction,
      returnToMenu,
      resetError
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
} 