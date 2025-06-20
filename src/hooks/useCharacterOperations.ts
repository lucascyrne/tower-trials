import { useCallback, useRef } from 'react';
import { type Character } from '@/models/character.model';
import { CharacterService } from '@/services/character.service';
import { useGameStateStore } from '@/stores/useGameStateStore';
import { useGameLog } from '@/stores/useLogStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { toast } from 'sonner';

/**
 * Hook para operações de carregamento no hub
 */
export function useCharacterHubOperations() {
  // Usar seletores diretos para evitar recriações
  const setGameState = useGameStateStore(state => state.setGameState);
  const selectCharacter = useCharacterStore(state => state.selectCharacter);
  const { addGameLogMessage } = useGameLog();

  const loadingRef = useRef(false);

  const loadCharacterForHub = useCallback(
    async (character: Character) => {
      console.log(
        `[useCharacterHubOperations] loadCharacterForHub chamado para: ${character.name}`
      );

      if (loadingRef.current) {
        console.log(
          `[useCharacterHubOperations] Carregamento em andamento, aguardando para ${character.name}`
        );
        return;
      }

      try {
        console.log(
          `[useCharacterHubOperations] Carregando personagem para o hub: ${character.name}`
        );
        loadingRef.current = true;

        // Carregar dados completos do personagem
        const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);

        if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
          throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
        }

        let gamePlayer = gamePlayerResponse.data;

        // Aplicar cura automática no hub
        try {
          console.log(
            `[useCharacterHubOperations] Aplicando cura automática para ${gamePlayer.name}`
          );
          const healResult = await CharacterService.applyAutoHeal(character.id);

          if (healResult.success && healResult.data && healResult.data.healed) {
            console.log(
              `[useCharacterHubOperations] ${gamePlayer.name} curado: ${healResult.data.oldHp} -> ${healResult.data.newHp} HP`
            );
            gamePlayer = {
              ...gamePlayer,
              hp: healResult.data.newHp,
              mana: healResult.data.character.mana,
            };
          }
        } catch (healError) {
          console.warn(
            '[useCharacterHubOperations] Erro na cura automática (não crítico):',
            healError
          );
        }

        // Atualizar seleção no contexto específico
        selectCharacter(character.id, character.name);

        const newGameState = {
          mode: 'hub' as const,
          player: gamePlayer,
          currentFloor: null,
          currentEnemy: null,
          currentSpecialEvent: null,
          isPlayerTurn: true,
          gameMessage: `Bem-vindo ao hub, ${gamePlayer.name}!`,
          highestFloor: Math.max(1, gamePlayer.floor),
          selectedSpell: null,
          battleRewards: null,
          fleeSuccessful: false,
          characterDeleted: false,
        };

        setGameState(newGameState);
        console.log(
          `[useCharacterHubOperations] Hub carregado com sucesso para ${gamePlayer.name}`
        );
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
    [setGameState, selectCharacter, addGameLogMessage]
  );

  return { loadCharacterForHub };
}

/**
 * Hook para operações de batalha
 */
export function useCharacterBattleOperations() {
  // Usar seletores diretos para evitar recriações
  const setGameState = useGameStateStore(state => state.setGameState);
  const selectCharacter = useCharacterStore(state => state.selectCharacter);
  const { addGameLogMessage } = useGameLog();

  const initializingRef = useRef(false);
  const lastBattleKeyRef = useRef<string | null>(null);

  const initializeBattle = useCallback(
    async (character: Character, battleKey: string) => {
      console.log(
        `[useCharacterBattleOperations] initializeBattle chamado para: ${character.name} (key: ${battleKey})`
      );

      if (initializingRef.current && lastBattleKeyRef.current === battleKey) {
        console.log(
          `[useCharacterBattleOperations] Batalha já sendo inicializada para key: ${battleKey}`
        );
        return;
      }

      initializingRef.current = true;
      lastBattleKeyRef.current = battleKey;

      try {
        const { BattleInitializationService } = await import(
          '@/services/battle-initialization.service'
        );
        const result = await BattleInitializationService.initializeBattle(character);

        if (!result.success) {
          throw new Error(result.error || 'Falha na inicialização');
        }

        if (!result.gameState) {
          throw new Error('Estado de jogo não foi gerado');
        }

        // Validar se o resultado tem inimigo quando necessário
        const hasRequiredEnemy = Boolean(result.gameState.currentEnemy);
        const shouldHaveEnemy =
          result.gameState.mode === 'battle' || result.gameState.mode === 'special_event';

        if (shouldHaveEnemy && !hasRequiredEnemy) {
          console.error(
            `🚨 [useCharacterBattleOperations] ERRO CRÍTICO: Estado sem inimigo quando deveria ter!`
          );
          throw new Error('Estado de jogo inválido: sem inimigo quando necessário');
        }

        // Atualizar seleção no contexto específico
        selectCharacter(character.id, character.name);

        setGameState(result.gameState);

        const logMessage = result.gameState.currentSpecialEvent
          ? `Evento especial: ${result.gameState.currentSpecialEvent.name}`
          : `Andar ${result.gameState.player.floor} - ${result.gameState.currentEnemy?.name || 'Combate'} iniciado!`;

        addGameLogMessage(logMessage, 'system');
        console.log(
          `[useCharacterBattleOperations] Batalha inicializada com sucesso para ${character.name}`
        );
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
 * Hook para operações de eventos especiais
 */
export function useCharacterEventOperations() {
  // Usar seletores diretos para evitar recriações
  const gameState = useGameStateStore(state => state.gameState);
  const setGameState = useGameStateStore(state => state.setGameState);
  const selectCharacter = useCharacterStore(state => state.selectCharacter);
  const { addGameLogMessage } = useGameLog();

  const initializingRef = useRef(false);
  const lastEventKeyRef = useRef<string | null>(null);

  const initializeSpecialEvent = useCallback(
    async (character: Character, eventKey: string) => {
      console.log(
        `[useCharacterEventOperations] initializeSpecialEvent chamado para: ${character.name} (key: ${eventKey})`
      );

      if (initializingRef.current && lastEventKeyRef.current === eventKey) {
        console.log(
          `[useCharacterEventOperations] Evento já sendo inicializado para key: ${eventKey}`
        );
        return;
      }

      initializingRef.current = true;
      lastEventKeyRef.current = eventKey;

      try {
        // Verificar se o andar é elegível para evento especial
        const floor = character.floor;
        if (floor % 5 === 0 || floor % 10 === 0) {
          console.log(
            `[useCharacterEventOperations] Andar ${floor} não elegível para eventos especiais`
          );
          throw new Error('Andar não elegível para eventos especiais');
        }

        // Carregar evento especial
        const { SpecialEventService } = await import('@/services/event.service');
        const eventResponse = await SpecialEventService.getSpecialEventForFloor(floor);

        if (!eventResponse.success || !eventResponse.data) {
          console.log(`[useCharacterEventOperations] Nenhum evento encontrado para andar ${floor}`);
          throw new Error(eventResponse.error || 'Nenhum evento especial disponível');
        }

        const specialEvent = eventResponse.data;

        // Carregar dados do personagem atualizados
        const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);

        if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
          throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
        }

        const gamePlayer = gamePlayerResponse.data;

        // Atualizar seleção no contexto específico
        selectCharacter(character.id, character.name);

        // Carregar dados do andar
        const { FloorService } = await import('@/services/floor.service');
        const currentFloor = await FloorService.getFloorData(floor);

        const newGameState = {
          mode: 'special_event' as const,
          player: gamePlayer,
          currentFloor,
          currentEnemy: null,
          currentSpecialEvent: specialEvent,
          isPlayerTurn: true,
          gameMessage: `${specialEvent.name}: ${specialEvent.description}`,
          highestFloor: Math.max(gamePlayer.floor, gameState.highestFloor || 1),
          selectedSpell: null,
          battleRewards: null,
          fleeSuccessful: false,
          characterDeleted: false,
        };

        setGameState(newGameState);
        addGameLogMessage(`Evento especial: ${specialEvent.name}`, 'system');
        console.log(
          `[useCharacterEventOperations] Evento especial inicializado: ${specialEvent.name}`
        );
      } catch (error) {
        console.error('[useCharacterEventOperations] Erro na inicialização do evento:', error);

        // Fallback: usar BattleInitializationService diretamente
        console.log(
          '[useCharacterEventOperations] Fallback: inicializando batalha via serviço direto'
        );
        try {
          const { BattleInitializationService } = await import(
            '@/services/battle-initialization.service'
          );
          const result = await BattleInitializationService.initializeBattle(character);

          if (result.success && result.gameState) {
            setGameState(result.gameState);
            addGameLogMessage(`Andar ${character.floor} - Batalha inicializada!`, 'system');
          } else {
            throw new Error(result.error || 'Falha no fallback de batalha');
          }
        } catch (fallbackError) {
          console.error(
            '[useCharacterEventOperations] Falha no fallback de batalha:',
            fallbackError
          );
          addGameLogMessage('Erro ao carregar batalha após evento especial', 'system');
        }

        lastEventKeyRef.current = null;
      } finally {
        initializingRef.current = false;
      }
    },
    [gameState, setGameState, addGameLogMessage, selectCharacter]
  );

  return { initializeSpecialEvent };
}

/**
 * Hook para operações básicas de personagem
 */
export function useCharacterBasicOperations() {
  // Usar seletores diretos para evitar recriações
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
        const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);

        if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
          throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
        }

        const gamePlayer = gamePlayerResponse.data;

        // Atualizar seleção no contexto específico
        selectCharacter(character.id, character.name);

        setGameState({
          mode: 'menu',
          player: gamePlayer,
          currentFloor: null,
          currentEnemy: null,
          currentSpecialEvent: null,
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
