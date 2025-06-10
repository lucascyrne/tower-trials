import { type ReactNode, createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { type Character } from '../models/character.model';
import { CharacterService } from '../character.service';
import { useAuth } from '../../auth/auth-hook';
import { useGameState } from './game-state.provider';
import { useGameLog } from './log.provider';
import { toast } from 'sonner';

interface CharacterContextType {
  characters: Character[];
  selectedCharacter: Character | null;
  createCharacter: (name: string) => Promise<void>;
  selectCharacter: (character: Character) => Promise<void>;
  loadCharacterForHub: (character: Character) => Promise<void>;
  updatePlayerStats: (hp: number, mana: number) => void;
  reloadCharacters: () => void;
}

const CharacterContext = createContext<CharacterContextType | null>(null);

interface CharacterProviderProps {
  children: ReactNode;
}

export function CharacterProvider({ children }: CharacterProviderProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [hasLoadedCharacters, setHasLoadedCharacters] = useState(false);
  
  const { user } = useAuth();
  const { gameState, setGameState, updateLoading } = useGameState();
  const { addGameLogMessage, setGameMessage } = useGameLog();
  
  // Refs para evitar loops
  const loadingCharactersRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

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
      try {
        console.log('[CharacterProvider] Carregando personagens pela primeira vez para:', user.id);
        loadingCharactersRef.current = true;
        updateLoading('loadProgress', true);
        
        const response = await CharacterService.getUserCharacters(user.id);
        
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
          toast.error('Erro', {
            description: response.error,
          });
        }
      } catch (error) {
        console.error('[CharacterProvider] Erro ao carregar personagens:', error instanceof Error ? error.message : 'Erro desconhecido');
        toast.error('Erro', {
          description: error instanceof Error ? error.message : 'Erro ao carregar personagens',
        });
      } finally {
        updateLoading('loadProgress', false);
        loadingCharactersRef.current = false;
      }
    };

    loadCharacters();
  }, [user?.id, hasLoadedCharacters]);

  // Criar novo personagem
  const createCharacter = useCallback(async (name: string) => {
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
      console.error('[CharacterProvider] Erro ao criar personagem:', error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao criar personagem',
      });
    } finally {
      updateLoading('startGame', false);
    }
  }, [user?.id]);

  // Selecionar personagem
  const selectCharacter = useCallback(async (character: Character) => {
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
        characterDeleted: false
      });
      
      addGameLogMessage(`${character.name} selecionado!`);
      
    } catch (error) {
      console.error('[CharacterProvider] Erro ao selecionar personagem:', error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao selecionar personagem',
      });
    }
  }, []);

  // Carregar personagem apenas para o hub
  const loadCharacterForHub = useCallback(async (character: Character) => {
    try {
      console.log(`[CharacterProvider] Carregando personagem para o hub: ${character.name} (ID: ${character.id})`);
      setSelectedCharacter(character);
      
      // Sempre usar getCharacterForGame para garantir dados atualizados e completos
      console.log(`[CharacterProvider] Carregando stats derivados via getCharacterForGame...`);
      const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);
      
      if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
        throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
      }
      
      const gamePlayer = gamePlayerResponse.data;
      
      console.log(`[CharacterProvider] Dados do gamePlayer:`, {
        name: gamePlayer.name,
        level: gamePlayer.level,
        gold: gamePlayer.gold,
        floor: gamePlayer.floor,
        hp: gamePlayer.hp,
        max_hp: gamePlayer.max_hp,
        atk: gamePlayer.atk,
        def: gamePlayer.def
      });
      
      const newGameState = {
        mode: 'hub' as const,
        player: gamePlayer,
        currentFloor: null,
        currentEnemy: null,
        currentSpecialEvent: null,
        isPlayerTurn: true,
        gameMessage: '',
        highestFloor: Math.max(1, gamePlayer.floor),
        selectedSpell: null,
        battleRewards: null,
        fleeSuccessful: false,
        characterDeleted: false
      };
      
      console.log(`[CharacterProvider] Configurando novo estado do jogo:`, newGameState);
      setGameState(newGameState);
      
      setGameMessage(`Bem-vindo ao hub, ${gamePlayer.name}!`);
      
      console.log(`[CharacterProvider] Hub carregado com sucesso para ${gamePlayer.name}`);
      
    } catch (error) {
      console.error('[CharacterProvider] Erro ao carregar personagem para o hub:', error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao carregar personagem',
      });
    }
  }, [setGameState, setGameMessage]);

  // Função para atualizar stats do jogador
  const updatePlayerStats = useCallback((hp: number, mana: number) => {
    console.log(`[CharacterProvider] Atualizando stats do jogador: HP ${hp}, Mana ${mana}`);
    
    setGameState({
      ...gameState,
      player: {
        ...gameState.player,
        hp: Math.floor(hp),
        mana: Math.floor(mana),
      }
    });
  }, [gameState]);

  // Função para recarregar personagens quando necessário
  const reloadCharacters = useCallback(() => {
    setHasLoadedCharacters(false);
    loadingCharactersRef.current = false;
  }, []);

  const contextValue = useMemo<CharacterContextType>(
    () => ({
      characters,
      selectedCharacter,
      createCharacter,
      selectCharacter,
      loadCharacterForHub,
      updatePlayerStats,
      reloadCharacters,
    }),
    [characters, selectedCharacter]
  );

  return (
    <CharacterContext.Provider value={contextValue}>
      {children}
    </CharacterContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export function useCharacter() {
  const context = useContext(CharacterContext);
  
  if (!context) {
    throw new Error('useCharacter deve ser usado dentro de um CharacterProvider');
  }
  
  return context;
} 