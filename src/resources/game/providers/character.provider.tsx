import { type ReactNode, createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
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
}

const CharacterContext = createContext<CharacterContextType | null>(null);

interface CharacterProviderProps {
  children: ReactNode;
}

export function CharacterProvider({ children }: CharacterProviderProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  
  const { user } = useAuth();
  const { gameState, setGameState, updateLoading } = useGameState();
  const { addGameLogMessage, setGameMessage } = useGameLog();

  // Carregar personagens do usuário
  useEffect(() => {
    if (!user?.id) return;

    const loadCharacters = async () => {
      try {
        updateLoading('loadProgress', true);
        
        const response = await CharacterService.getUserCharacters(user.id);
        
        if (response.success && response.data) {
          setCharacters(response.data);
          
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
      }
    };

    loadCharacters();
  }, [user?.id, setGameMessage, updateLoading]);

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
        const newCharacter = await CharacterService.getCharacter(response.data.id);
        
        if (newCharacter.success && newCharacter.data) {
          setCharacters(prev => [newCharacter.data!, ...prev]);
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
  }, [user, updateLoading, addGameLogMessage]);

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
        ...gameState,
        player: gamePlayer,
      });
      
      addGameLogMessage(`${character.name} selecionado!`);
      
    } catch (error) {
      console.error('[CharacterProvider] Erro ao selecionar personagem:', error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao selecionar personagem',
      });
    }
  }, [gameState, setGameState, addGameLogMessage]);

  // Carregar personagem apenas para o hub
  const loadCharacterForHub = useCallback(async (character: Character) => {
    try {
      setSelectedCharacter(character);
      
      console.log(`[CharacterProvider] Carregando stats derivados para ${character.name}...`);
      const gamePlayerResponse = await CharacterService.getCharacterForGame(character.id);
      
      if (!gamePlayerResponse.success || !gamePlayerResponse.data) {
        throw new Error(gamePlayerResponse.error || 'Erro ao carregar dados do personagem');
      }
      
      const gamePlayer = gamePlayerResponse.data;
      
      setGameState({
        ...gameState,
        mode: 'hub',
        player: gamePlayer,
      });
      
      setGameMessage(`Bem-vindo ao hub, ${character.name}!`);
      
    } catch (error) {
      console.error('[CharacterProvider] Erro ao carregar personagem para o hub:', error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao carregar personagem',
      });
    }
  }, [gameState, setGameState, setGameMessage]);

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
  }, [gameState, setGameState]);

  const contextValue = useMemo<CharacterContextType>(
    () => ({
      characters,
      selectedCharacter,
      createCharacter,
      selectCharacter,
      loadCharacterForHub,
      updatePlayerStats,
    }),
    [characters, selectedCharacter, createCharacter, selectCharacter, loadCharacterForHub, updatePlayerStats]
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