import { useCallback, useRef } from 'react';
import { type Character } from '@/resources/character/character.model';
import { CharacterService } from '@/resources/character/character.service';
import { useGameStateStore } from '@/stores/useGameStateStore';
import { useGameLog } from '@/stores/useLogStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { toast } from 'sonner';

/**
 * Hook para operações de carregamento no hub
 */
export function useCharacterHubOperations() {
  const setGameState = useGameStateStore(state => state.setGameState);
  const selectCharacter = useCharacterStore(state => state.selectCharacter);

  const loadingRef = useRef(false);

  const loadCharacterForHub = useCallback(
    async (character: Character) => {
      if (loadingRef.current) {
        return;
      }

      try {
        loadingRef.current = true;

        const gamePlayerResponse = await CharacterService.getCharacterForGame(
          character.id,
          false,
          true
        );

        if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
          throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
        }

        const gamePlayer = gamePlayerResponse.data;
        selectCharacter(character.id, character.name);

        const newGameState = {
          mode: 'hub' as const,
          player: gamePlayer,
          currentFloor: null,
          currentEnemy: null,
          isPlayerTurn: true,
          gameMessage: `Bem-vindo ao hub, ${gamePlayer.name}!`,
          highestFloor: Math.max(1, gamePlayer.floor),
          selectedSpell: null,
          battleRewards: null,
          fleeSuccessful: false,
          characterDeleted: false,
        };

        setGameState(newGameState);
      } catch (error) {
        console.error('[useCharacterHubOperations] Erro ao carregar personagem para o hub:', error);
        toast.error('Erro', {
          description: error instanceof Error ? error.message : 'Erro ao carregar personagem',
        });
        throw error;
      } finally {
        loadingRef.current = false;
      }
    },
    [setGameState, selectCharacter]
  );

  return { loadCharacterForHub };
}

/**
 * Hook para operações de batalha
 */
export function useCharacterBattleOperations() {
  const setGameState = useGameStateStore(state => state.setGameState);
  const selectCharacter = useCharacterStore(state => state.selectCharacter);
  const { addGameLogMessage } = useGameLog();

  const initializingRef = useRef(false);
  const lastBattleKeyRef = useRef<string | null>(null);

  const initializeBattle = useCallback(
    async (character: Character, battleKey: string) => {
      if (initializingRef.current && lastBattleKeyRef.current === battleKey) {
        return;
      }

      initializingRef.current = true;
      lastBattleKeyRef.current = battleKey;

      try {
        // Invalidar cache para forçar dados atualizados
        CharacterService.invalidateCharacterCache(character.id);

        // Carregar dados atualizados com auto-heal
        const freshCharacterResponse = await CharacterService.getCharacterForGame(
          character.id,
          true,
          true
        );

        if (!freshCharacterResponse.success || !freshCharacterResponse.data) {
          throw new Error(
            freshCharacterResponse.error || 'Erro ao carregar dados atualizados do personagem'
          );
        }

        const freshGamePlayer = freshCharacterResponse.data;

        // Criar character atualizado para BattleInitializationService
        const updatedCharacter: Character = {
          ...character,
          hp: freshGamePlayer.hp,
          max_hp: freshGamePlayer.max_hp,
          mana: freshGamePlayer.mana,
          max_mana: freshGamePlayer.max_mana,
          gold: freshGamePlayer.gold,
          xp: freshGamePlayer.xp,
          level: freshGamePlayer.level,
        };

        const { BattleInitializationService } = await import(
          '@/resources/battle/battle-initialization.service'
        );
        const result = await BattleInitializationService.initializeBattle(updatedCharacter);

        if (!result.success) {
          throw new Error(result.error || 'Falha na inicialização');
        }

        if (!result.gameState) {
          throw new Error('Estado de jogo não foi gerado');
        }

        // Garantir que player tenha dados atualizados
        result.gameState.player = {
          ...result.gameState.player,
          hp: freshGamePlayer.hp,
          max_hp: freshGamePlayer.max_hp,
          mana: freshGamePlayer.mana,
          max_mana: freshGamePlayer.max_mana,
        };

        // Validar se há inimigo quando necessário
        if (result.gameState.mode === 'battle' && !result.gameState.currentEnemy) {
          console.error('[useCharacterBattleOperations] ERRO: Estado sem inimigo em modo battle');
          throw new Error('Estado de jogo inválido: sem inimigo quando necessário');
        }

        selectCharacter(character.id, character.name);
        setGameState(result.gameState);

        const logMessage = `Andar ${result.gameState.player.floor} - ${result.gameState.currentEnemy?.name || 'Combate'} iniciado!`;
        addGameLogMessage(logMessage, 'system');
      } catch (error) {
        console.error('[useCharacterBattleOperations] Erro na inicialização:', error);
        toast.error('Falha ao inicializar batalha', {
          description: error instanceof Error ? error.message : 'Erro ao inicializar batalha',
          duration: 5000,
        });
        lastBattleKeyRef.current = null;
        throw error;
      } finally {
        initializingRef.current = false;
      }
    },
    [setGameState, addGameLogMessage, selectCharacter]
  );

  return { initializeBattle };
}

/**
 * Hook para operações básicas de personagem
 */
export function useCharacterBasicOperations() {
  const gameState = useGameStateStore(state => state.gameState);
  const setGameState = useGameStateStore(state => state.setGameState);
  const selectCharacter = useCharacterStore(state => state.selectCharacter);
  const { addGameLogMessage } = useGameLog();

  const selectCharacterCallback = useCallback(
    async (character: Character) => {
      try {
        console.log(
          `[useCharacterBasicOperations] Carregando stats derivados para ${character.name}...`
        );

        const gamePlayerResponse = await CharacterService.getCharacterForGame(
          character.id,
          false,
          true
        );

        if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
          throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
        }

        const gamePlayer = gamePlayerResponse.data;
        selectCharacter(character.id, character.name);

        setGameState({
          mode: 'menu',
          player: gamePlayer,
          currentFloor: null,
          currentEnemy: null,
          isPlayerTurn: true,
          gameMessage: '',
          highestFloor: gamePlayer.floor,
          selectedSpell: null,
          battleRewards: null,
          fleeSuccessful: false,
          characterDeleted: false,
        });

        addGameLogMessage(`${character.name} selecionado!`);
      } catch (error) {
        console.error('[useCharacterBasicOperations] Erro ao selecionar personagem:', error);
        toast.error('Erro', {
          description: error instanceof Error ? error.message : 'Erro ao selecionar personagem',
        });
      }
    },
    [setGameState, addGameLogMessage, selectCharacter]
  );

  const updatePlayerStats = useCallback(
    (hp: number, mana: number) => {
      console.log(
        `🩺 [useCharacterBasicOperations] updatePlayerStats chamado: HP ${hp}, Mana ${mana}`
      );

      setGameState({
        ...gameState,
        player: {
          ...gameState.player,
          hp: Math.floor(hp),
          mana: Math.floor(mana),
        },
      });
    },
    [gameState, setGameState]
  );

  return {
    selectCharacter: selectCharacterCallback,
    updatePlayerStats,
  };
}
