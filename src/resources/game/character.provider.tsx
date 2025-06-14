import { type ReactNode, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { type Character } from './character.model';
import { CharacterService } from './character.service';
import { useAuth } from '../auth/auth-hook';
import { useGameState } from './game-state-hook';
import { useGameLog } from './log.provider';
import { toast } from 'sonner';

import { CharacterContext, type CharacterContextType } from './character-context';

interface CharacterProviderProps {
  children: ReactNode;
}

export function CharacterProvider({ children }: CharacterProviderProps) {
  // DEBUGGING: Contador de renders
  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log(`[CharacterProvider] Render #${renderCount.current}`);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [hasLoadedCharacters, setHasLoadedCharacters] = useState(false);

  const { user } = useAuth();
  const { gameState, setGameState, updateLoading } = useGameState();
  const { addGameLogMessage, setGameMessage } = useGameLog();

  // Refs para evitar loops
  const loadingCharactersRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // NOVO: Controle de inicialização de batalha
  const initializingBattleRef = useRef(false);
  const lastBattleInitRef = useRef<string | null>(null);

  // Controle para loadCharacterForHub evitar execuções duplicadas
  const loadingForHubRef = useRef(false);
  const lastHubCharacterRef = useRef<string | null>(null);

  // Logs diretos sem useEffect para evitar re-renders
  console.log(
    `[CharacterProvider] Estado atual - gameState.mode: ${gameState.mode}, player: ${gameState.player.name || 'N/A'}, selectedCharacter: ${selectedCharacter?.name || 'N/A'}`
  );

  // Limpar refs quando desmontado
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Carregar personagens do usuário - APENAS UMA VEZ
  useEffect(() => {
    // Verificar se usuário mudou
    if (lastUserIdRef.current !== user?.id) {
      lastUserIdRef.current = user?.id || null;
      setCharacters([]);
      setSelectedCharacter(null);
      setHasLoadedCharacters(false);
      loadingCharactersRef.current = false;
    }

    // Só carregar se usuário existe, não carregou ainda e não está carregando
    if (!user?.id || hasLoadedCharacters || loadingCharactersRef.current) return;

    const loadCharacters = async () => {
      // Dupla verificação para evitar execuções em Strict Mode
      if (loadingCharactersRef.current || !mountedRef.current) {
        return;
      }

      try {
        console.log('[CharacterProvider] Carregando personagens pela primeira vez para:', user.id);
        loadingCharactersRef.current = true;
        updateLoading('loadProgress', true);

        const response = await CharacterService.getUserCharacters(user.id);

        // Verificar se ainda está montado
        if (!mountedRef.current) {
          return;
        }

        if (response.success && response.data) {
          setCharacters(response.data);
          setHasLoadedCharacters(true);

          if (response.data.length > 0) {
            setGameMessage('Selecione um personagem para jogar!');
          } else {
            setGameMessage('Você ainda não tem personagens. Crie um para começar!');
          }
        } else if (response.error) {
          console.error('[CharacterProvider] Erro ao carregar personagens:', response.error);
          if (mountedRef.current) {
            toast.error('Erro', {
              description: response.error,
            });
          }
        }
      } catch (error) {
        console.error(
          '[CharacterProvider] Erro ao carregar personagens:',
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
        if (mountedRef.current) {
          toast.error('Erro', {
            description: error instanceof Error ? error.message : 'Erro ao carregar personagens',
          });
        }
      } finally {
        updateLoading('loadProgress', false);
        loadingCharactersRef.current = false;
      }
    };

    loadCharacters();
  }, [user?.id, hasLoadedCharacters, updateLoading, setGameMessage]);

  // Criar novo personagem
  const createCharacter = useCallback(
    async (name: string) => {
      if (!user?.id) {
        toast.error('Erro', {
          description: 'Você precisa estar logado para criar um personagem.',
        });
        return;
      }

      updateLoading('startGame', true);

      try {
        const response = await CharacterService.createCharacter({
          user_id: user.id,
          name,
        });

        if (response.success && response.data) {
          // Adicionar o novo personagem à lista atual ao invés de recarregar
          const newCharacter = await CharacterService.getCharacter(response.data.id);

          if (newCharacter.success && newCharacter.data) {
            // Adicionar o novo personagem à lista existente
            setCharacters(prev => [...prev, newCharacter.data!]);
            setSelectedCharacter(newCharacter.data);

            toast.success('Sucesso', {
              description: 'Personagem criado com sucesso!',
            });

            addGameLogMessage(`${newCharacter.data.name} foi criado!`);
          }
        } else if (response.error) {
          throw new Error(response.error);
        }
      } catch (error) {
        console.error(
          '[CharacterProvider] Erro ao criar personagem:',
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
        toast.error('Erro', {
          description: error instanceof Error ? error.message : 'Erro ao criar personagem',
        });
      } finally {
        updateLoading('startGame', false);
      }
    },
    [user?.id, updateLoading, addGameLogMessage]
  );

  // Selecionar personagem
  const selectCharacter = useCallback(
    async (character: Character) => {
      try {
        setSelectedCharacter(character);

        console.log(`[CharacterProvider] Carregando stats derivados para ${character.name}...`);
        const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);

        if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
          throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
        }

        const gamePlayer = gamePlayerResponse.data;

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
        console.error(
          '[CharacterProvider] Erro ao selecionar personagem:',
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
        toast.error('Erro', {
          description: error instanceof Error ? error.message : 'Erro ao selecionar personagem',
        });
      }
    },
    [setGameState, addGameLogMessage]
  );

  // Carregar personagem apenas para o hub - OTIMIZADO
  const loadCharacterForHub = useCallback(
    async (character: Character) => {
      console.log(`[CharacterProvider] loadCharacterForHub chamado para: ${character.name}`);

      // Evitar múltiplas execuções simultâneas apenas
      if (loadingForHubRef.current) {
        console.log(
          `[CharacterProvider] Carregamento em andamento, aguardando para ${character.name}`
        );
        return;
      }

      try {
        console.log(
          `[CharacterProvider] Carregando personagem para o hub: ${character.name} (ID: ${character.id})`
        );

        loadingForHubRef.current = true;
        lastHubCharacterRef.current = character.id;

        // Sempre usar getCharacterForGame para garantir dados atualizados e completos
        console.log(`[CharacterProvider] Carregando stats derivados via getCharacterForGame...`);
        const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);

        if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
          throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
        }

        let gamePlayer = gamePlayerResponse.data;

        // Aplicar cura automática apenas no hub (não na batalha)
        try {
          console.log(`[CharacterProvider] Aplicando cura automática para ${gamePlayer.name}`);
          const healResult = await CharacterService.applyAutoHeal(character.id);

          if (healResult.success && healResult.data && healResult.data.healed) {
            console.log(
              `[CharacterProvider] ${gamePlayer.name} curado: ${healResult.data.oldHp} -> ${healResult.data.newHp} HP`
            );
            // Atualizar com dados curados
            gamePlayer = {
              ...gamePlayer,
              hp: healResult.data.newHp,
              mana: healResult.data.character.mana,
            };
          }
        } catch (healError) {
          console.warn('[CharacterProvider] Erro na cura automática (não crítico):', healError);
        }

        console.log(`[CharacterProvider] Dados do gamePlayer:`, {
          name: gamePlayer.name,
          level: gamePlayer.level,
          gold: gamePlayer.gold,
          floor: gamePlayer.floor,
          hp: gamePlayer.hp,
          max_hp: gamePlayer.max_hp,
          atk: gamePlayer.atk,
          def: gamePlayer.def,
        });

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

        console.log(`[CharacterProvider] Configurando novo estado do jogo:`, newGameState);

        // BATCH de atualizações para evitar re-renders múltiplos
        setSelectedCharacter(character);
        setGameState(newGameState);
        // Remover setGameMessage separado - já está no gameState

        console.log(`[CharacterProvider] Hub carregado com sucesso para ${gamePlayer.name}`);
        console.log(`[CharacterProvider] Estado final:`, {
          selectedCharacterId: character.id,
          gameStateMode: newGameState.mode,
          gameStatePlayerId: newGameState.player.id,
          gameStatePlayerName: newGameState.player.name,
        });
      } catch (error) {
        console.error(
          '[CharacterProvider] Erro ao carregar personagem para o hub:',
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
        toast.error('Erro', {
          description: error instanceof Error ? error.message : 'Erro ao carregar personagem',
        });
        throw error; // Re-lançar erro para que o hub.tsx possa tratar
      } finally {
        // Resetar controle imediatamente para permitir nova execução quando necessário
        loadingForHubRef.current = false;
      }
    },
    [] // CORRIGIDO: sem dependências para evitar recriação constante
  );

  // Função para atualizar stats do jogador
  const updatePlayerStats = useCallback((hp: number, mana: number) => {
    console.log(`[CharacterProvider] updatePlayerStats chamado: HP ${hp}, Mana ${mana}`);

    // Usar referência direta ao gameState atual - sem dependências
    setGameState({
      ...gameState,
      player: {
        ...gameState.player,
        hp: Math.floor(hp),
        mana: Math.floor(mana),
      },
    });
  }, []);

  // Função para recarregar personagens quando necessário
  const reloadCharacters = useCallback(() => {
    console.log(`[CharacterProvider] reloadCharacters chamado`);
    setHasLoadedCharacters(false);
    loadingCharactersRef.current = false;
  }, []);

  // OTIMIZADA: Inicializar batalha de forma simples
  const initializeBattle = useCallback(
    async (character: Character, battleKey: string) => {
      console.log(
        `[CharacterProvider] initializeBattle chamado para: ${character.name} (key: ${battleKey})`
      );

      // NOVO: Verificar se já estamos processando esta batalha
      if (initializingBattleRef.current && lastBattleInitRef.current === battleKey) {
        console.log(`[CharacterProvider] Batalha já sendo inicializada para key: ${battleKey}`);
        return;
      }

      // NOVO: Verificar se o personagem já está selecionado e carregado
      if (
        selectedCharacter?.id === character.id &&
        gameState.mode === 'battle' &&
        gameState.currentEnemy
      ) {
        console.log(
          `[CharacterProvider] Batalha já inicializada para ${character.name} - reutilizando estado`
        );
        return;
      }

      initializingBattleRef.current = true;
      lastBattleInitRef.current = battleKey;

      try {
        updateLoading('loadProgress', true);

        // CORRIGIDO: Só mudar selectedCharacter se realmente necessário
        if (selectedCharacter?.id !== character.id) {
          console.log(`[CharacterProvider] Selecionando novo personagem: ${character.name}`);
          setSelectedCharacter(character);
        } else {
          console.log(`[CharacterProvider] Personagem ${character.name} já selecionado - mantendo`);
        }

        const { BattleInitializationService } = await import('./battle-initialization.service');

        const result = await BattleInitializationService.initializeBattle(character);

        if (!result.success) {
          throw new Error(result.error || 'Falha na inicialização');
        }

        if (!result.gameState) {
          throw new Error('Estado de jogo não foi gerado');
        }

        // CORRIGIDO: Só atualizar gameState se houve mudança significativa
        const currentMode = gameState.mode;
        const currentEnemyId = gameState.currentEnemy?.id;
        const newEnemyId = result.gameState.currentEnemy?.id;

        if (currentMode !== 'battle' || currentEnemyId !== newEnemyId || !gameState.currentEnemy) {
          console.log(
            `[CharacterProvider] Atualizando estado de batalha - modo: ${currentMode} -> battle, inimigo: ${currentEnemyId} -> ${newEnemyId}`
          );
          setGameState(result.gameState);
        } else {
          console.log(`[CharacterProvider] Estado de batalha já correto - mantendo atual`);
        }

        const logMessage = result.gameState.currentSpecialEvent
          ? `Evento especial: ${result.gameState.currentSpecialEvent.name}`
          : `Andar ${result.gameState.player.floor} - ${result.gameState.currentEnemy?.name || 'Combate'} iniciado!`;

        addGameLogMessage(logMessage, 'system');

        console.log(`[CharacterProvider] Batalha inicializada com sucesso para ${character.name}`);
      } catch (error) {
        console.error('[CharacterProvider] Erro na inicialização:', error);

        toast.error('Falha ao inicializar batalha', {
          description: error instanceof Error ? error.message : 'Erro ao inicializar batalha',
          duration: 5000,
        });

        lastBattleInitRef.current = null;
        throw error;
      } finally {
        updateLoading('loadProgress', false);
        initializingBattleRef.current = false;
      }
    },
    [selectedCharacter, gameState, setGameState, addGameLogMessage, updateLoading]
  );

  const contextValue = useMemo<CharacterContextType>(
    () => ({
      characters,
      selectedCharacter,
      createCharacter,
      selectCharacter,
      loadCharacterForHub,
      initializeBattle,
      updatePlayerStats,
      reloadCharacters,
    }),
    [
      characters,
      selectedCharacter,
      createCharacter,
      selectCharacter,
      loadCharacterForHub,
      initializeBattle,
      updatePlayerStats,
      reloadCharacters,
    ]
  );

  return <CharacterContext.Provider value={contextValue}>{children}</CharacterContext.Provider>;
}
