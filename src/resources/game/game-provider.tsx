'use client';

import React, { ReactNode, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ActionType, GameContextState, GameLoadingState, GameState } from './game-model';
import { GameContext, GameContextType, initialGameState } from './game-context';
import { GameService } from './game.service';
import { CharacterService } from './character.service';
import { Character } from './models/character.model';
import { toast } from 'sonner';
import { SpellService } from './spell.service';
import { ConsumableService } from './consumable.service';
import { CharacterConsumable } from './models/consumable.model';
import { useGamePermadeathEffect } from './game-provider-hooks/use-game-permadeath-effect';
import { useGameBootstrap } from './game-provider-hooks/use-game-bootstrap';
import { usePerformAction } from './game-provider-hooks/use-perform-action';

interface GameProviderProps {
  children: ReactNode;
  userId?: string;
}

export function GameProvider({ children, userId }: GameProviderProps) {
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

  // SISTEMA ÚNICO E ROBUSTO DE CONTROLE DE AÇÕES
  const actionControlRef = useRef<{
    isProcessing: boolean;
    currentActionId: string | null;
    actionType: ActionType | null;
    startTime: number;
    sessionId: string;
    battleId: string | null;
  }>({
    isProcessing: false,
    currentActionId: null,
    actionType: null,
    startTime: 0,
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    battleId: null
  });

  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  /** Snapshot síncrono do estado de jogo para guards e performAction (evita closure stale após await). */
  const gameStateRef = useRef<GameState>(initialGameState);
  /** Incrementado ao agendar turno do inimigo ou ao resetar batalha — callbacks atrasados ignoram atualização. */
  const enemyTurnSeqRef = useRef(0);

  useEffect(() => {
    gameStateRef.current = state.gameState;
  }, [state.gameState]);

  /** Se a derrota falhou antes (ex.: XP 0) ou houve refresh, reprocessa recompensas uma vez por par jogador+inimigo. */
  const defeatRecoveryKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const gs = state.gameState;
    if (gs.mode !== 'battle' || !gs.currentEnemy || gs.battleRewards != null) {
      defeatRecoveryKeyRef.current = null;
      return;
    }
    if (gs.currentEnemy.hp > 0) return;

    const key = `${gs.player.id}:${gs.currentEnemy.id}`;
    if (defeatRecoveryKeyRef.current === key) return;
    defeatRecoveryKeyRef.current = key;

    void GameService.processEnemyDefeat(gs).then((next) => {
      setState((prev) => ({ ...prev, gameState: next }));
    });
  }, [
    state.gameState.mode,
    state.gameState.battleRewards,
    state.gameState.currentEnemy?.id,
    state.gameState.currentEnemy?.hp,
    state.gameState.player.id,
  ]);

  /**
   * Flags de loading: loadProgress = lista de personagens / bootstrap; startGame = criar personagem;
   * performAction = mutex de turno (nunca usar para desmontar a UI da batalha).
   */
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

  // Função para adicionar mensagens ao log do jogo
  const addGameLogMessage = useCallback((message: string, type: 'system' | 'battle' | 'lore' | 'equipment' | 'skill_xp' | 'level_up' | 'enemy_action' | 'player_action' | 'damage' | 'healing' = 'system') => {
    setState(prev => {
      const recentLogs = prev.gameLog.slice(-5);
      const isDuplicate = recentLogs.some(log => log.text === message && log.type === type);
      
      if (isDuplicate) {
        return prev;
      }
      
      return {
        ...prev,
        gameLog: [...prev.gameLog, { text: message, type }]
      };
    });
  }, []);

  // Função para limpar mensagens de erro
  const resetError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  useGamePermadeathEffect({
    mode: state.gameState.mode,
    characterDeleted: state.gameState.characterDeleted,
    playerName: state.gameState.player.name,
    playerId: state.gameState.player.id,
    userId,
    setSelectedCharacter,
    setCharacters,
  });

  useGameBootstrap({
    userId,
    actionControlRef,
    updateLoading,
    setCharacters,
    setState,
  });

  // Criar novo personagem
  const createCharacter = useCallback(async (name: string) => {
    if (!userId) {
      toast.error('Erro', {
        description: 'Você precisa estar logado para criar um personagem.',
      });
      return;
    }
    
    if (actionControlRef.current.isProcessing) return;
    actionControlRef.current.isProcessing = true;
    updateLoading('startGame', true);
    
    try {
      const response = await CharacterService.createCharacter({
        user_id: userId,
        name,
      });
      
      if (response.success && response.data) {
        const newCharacter = await CharacterService.getCharacter(response.data.id);
        
        if (newCharacter.success && newCharacter.data) {
          const spellsResponse = await SpellService.getAvailableSpells(1);
          const initialSpells = spellsResponse.success && spellsResponse.data
            ? spellsResponse.data.map(spell => ({ ...spell, current_cooldown: 0 }))
            : [];

          setCharacters(prev => [newCharacter.data!, ...prev]);
          setSelectedCharacter(newCharacter.data);
          
          const gamePlayerResponse = await CharacterService.getCharacterForGame(newCharacter.data!.id);
          
          if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
            throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem recém-criado');
          }
          
          const gamePlayer = gamePlayerResponse.data;
          
          const initialFloor = await GameService.getFloorData(1);
          if (!initialFloor) {
            throw new Error('Erro ao gerar andar inicial');
          }

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
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao criar personagem',
      }));
      
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao criar personagem',
      });
    } finally {
      updateLoading('startGame', false);
      actionControlRef.current.isProcessing = false;
    }
  }, [updateLoading, userId]);

  /**
   * Monta estado de batalha para o personagem. Ignora se já estiver em combate ativo com o mesmo id
   * (evita regenerar inimigo após remount acidental da página).
   */
  const selectCharacter = useCallback(async (character: Character) => {
    const snap = gameStateRef.current;
    if (
      snap.mode === 'battle' &&
      snap.currentEnemy &&
      snap.player.id === character.id
    ) {
      setSelectedCharacter(character);
      return;
    }

    enemyTurnSeqRef.current += 1;

    try {
      setSelectedCharacter(character);
      
      actionControlRef.current.battleId = `battle-${character.floor}-${character.name.replace(/\s+/g, '_')}-${Date.now()}`;
      
      const spellsResponse = await SpellService.getCharacterEquippedSpells(character.id);
      const equippedSpells = spellsResponse.success && spellsResponse.data
        ? spellsResponse.data
        : [];

      const consumablesResponse = await ConsumableService.getCharacterConsumables(character.id);
      const characterConsumables = consumablesResponse.success && consumablesResponse.data
        ? consumablesResponse.data
        : [];

      const currentFloor = character.floor || 1;
      
      const floorData = await GameService.getFloorData(currentFloor);
      if (!floorData) {
        throw new Error(`Erro ao gerar dados do andar ${currentFloor}`);
      }

      const currentEnemy = await GameService.generateEnemy(currentFloor);
      if (!currentEnemy) {
        throw new Error(`Erro ao gerar inimigo para o andar ${currentFloor}`);
      }
      
      GameService.clearAllCaches();
      
      const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);
      
      if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
        throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem para batalha');
      }
      
      const gamePlayer = gamePlayerResponse.data;
      
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
        gameMessage: `Bem-vindo de volta, ${character.name}! Você está no ${floorData.description}.`
      };
      
      setState(prev => ({
        ...prev,
        gameState: newGameState,
      }));
      
    } catch (error) {
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao selecionar personagem',
      });
    }
  }, []);

  // Carregar personagem apenas para o hub (sem preparar estado de batalha)
  const loadCharacterForHub = useCallback(async (character: Character) => {
    try {
      setSelectedCharacter(character);
      
      const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);
      
      if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
        throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
      }
      
      const gamePlayer = gamePlayerResponse.data;
      
      setState(prev => ({
        ...prev,
        gameState: {
          ...initialGameState,
          mode: 'hub',
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
      
    } catch (error) {
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao carregar personagem',
      });
    }
  }, []);

  // Função para atualizar stats do jogador de forma reativa
  const updatePlayerStats = useCallback((hp: number, mana: number) => {
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
    setState(prev => ({
      ...prev,
      gameState: {
        ...prev.gameState,
        player: {
          ...prev.gameState.player,
          consumables: [...consumables]
        }
      }
    }));
  }, []);

  // Limpar estado de jogo quando sair da batalha
  const clearGameState = useCallback(() => {
    enemyTurnSeqRef.current += 1;
    // Resetar controle de ações
    actionControlRef.current = {
      isProcessing: false,
      currentActionId: null,
      actionType: null,
      startTime: 0,
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      battleId: null
    };
    
    setState(prev => ({
      ...prev,
      gameState: initialGameState,
      gameMessage: 'Estado do jogo limpo',
      error: null
    }));
    
    setSelectedCharacter(null);
  }, []);

  // =====================================
  // CONFIGURAÇÕES DO JOGO  
  // =====================================
  
  // Ref para controle simples de ações
  const lastActionRef = useRef<{
    timestamp: number;
    action: string;
    processing: boolean;
  }>({
    timestamp: 0,
    action: '',
    processing: false
  });

  /**
   * Orquestra turnos: delega a GameService, persiste HP/ouro/XP quando aplicável,
   * agenda turno do inimigo com cancelamento via enemyTurnSeqRef.
   */
  const performAction = usePerformAction({
    state,
    selectedCharacter,
    gameStateRef,
    enemyTurnSeqRef,
    lastActionRef,
    updateLoading,
    addGameLogMessage,
    setState,
  });

  // Voltar ao menu principal
  const returnToMenu = useCallback(() => {
    setSelectedCharacter(null);
    actionControlRef.current = {
      isProcessing: false,
      currentActionId: null,
      actionType: null,
      startTime: 0,
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      battleId: null
    };
    
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
      addGameLogMessage,
      characters,
      clearGameState,
      createCharacter,
      loadCharacterForHub,
      performAction,
      resetError,
      returnToMenu,
      selectCharacter,
      selectedCharacter,
      state.error,
      state.gameLog,
      state.gameMessage,
      state.gameState,
      state.loading,
      updatePlayerConsumables,
      updatePlayerStats,
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
} 