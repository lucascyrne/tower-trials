import { createFileRoute, useNavigate, Outlet, useLocation } from '@tanstack/react-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useGameStateStore } from '@/stores/useGameStateStore';
import { useCharacterHubOperations } from '@/hooks/useCharacterOperations';
import { CharacterService } from '@/services/character.service';
import type { Character } from '@/models/character.model';
import { toast } from 'sonner';
import { MapModal } from '@/features/hub/MapModal';
import { CharacterInfoCard } from '@/features/character/CharacterInfoCard';
import { ActionMenuGrid } from '@/features/hub/ActionMenuGrid';
import { HubNotifications } from '@/features/hub/HubNotifications';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/game/play/hub')({
  component: GameHubLayoutPage,
  validateSearch: search => ({
    character: search.character as string,
  }),
});

function GameHubLayoutPage() {
  const location = useLocation();
  const { character: characterId } = Route.useSearch();

  // Se estamos exatamente na rota /game/play/hub, mostrar o hub principal
  // Caso contrário, mostrar o Outlet com as páginas do jogo
  if (location.pathname === '/game/play/hub') {
    return <GameHubMainPage characterId={characterId} />;
  }

  // Para rotas filhas como /game/play/hub/shop, /game/play/hub/inventory, etc.
  return <Outlet />;
}

// Componente de loading melhorado
function LoadingScreen({ message = 'Carregando personagem...' }: { message?: string }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="text-center text-white space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-lg font-medium">
          {message}
          <span className="inline-block w-8 text-left">{dots}</span>
        </p>
        <div className="w-64 bg-slate-800 rounded-full h-2 mx-auto">
          <div
            className="bg-blue-500 h-2 rounded-full animate-pulse"
            style={{ width: '60%' }}
          ></div>
        </div>
      </div>
    </div>
  );
}

function GameHubMainPage({ characterId }: { characterId: string }) {
  const navigate = useNavigate();
  const { loadCharacterForHub } = useCharacterHubOperations();

  // Usar seletores diretos do Zustand para evitar re-renders desnecessários
  const gameMode = useGameStateStore(state => state.gameState.mode);
  const playerId = useGameStateStore(state => state.gameState.player?.id);
  const playerName = useGameStateStore(state => state.gameState.player?.name);
  const player = useGameStateStore(state => state.gameState.player);

  // Estabilizar a função loadCharacterForHub
  const stableLoadCharacterForHub = useCallback(
    async (character: Character) => {
      try {
        await loadCharacterForHub(character);
      } catch (error) {
        console.error('[GameHub] Erro no loadCharacterForHub:', error);
        throw error;
      }
    },
    [loadCharacterForHub]
  );

  const [loadingState, setLoadingState] = useState<'initial' | 'loading' | 'loaded' | 'error'>(
    'initial'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  // Estados removidos - funcionalidade de cura será reativada depois se necessário
  const showHealNotification = false;
  const healInfo = null;

  // Refs para controle - inicializar mountedRef como true
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const lastLoadedCharacterRef = useRef<string | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup effect - separado para não interferir no loading
  useEffect(() => {
    mountedRef.current = true; // Garantir que está true
    return () => {
      mountedRef.current = false;
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Lógica de carregamento simplificada
  useEffect(() => {
    const loadCharacter = async () => {
      // Verificações iniciais mais simples
      if (!characterId || characterId.trim() === '') {
        console.warn('[GameHub] characterId inválido ou vazio:', characterId);
        setLoadingState('error');
        setErrorMessage('ID do personagem inválido');
        return;
      }

      if (!mountedRef.current) {
        console.warn('[GameHub] Componente desmontado durante carregamento');
        return;
      }

      console.log('[GameHub] Verificando estado atual:', {
        characterId,
        gameMode,
        playerId,
        playerName,
        loadingState,
      });

      // Se já temos o personagem correto carregado no hub, não fazer nada
      if (
        gameMode === 'hub' &&
        playerId === characterId &&
        playerName &&
        loadingState !== 'initial'
      ) {
        console.log(`[GameHub] Personagem ${playerName} já carregado no hub`);
        if (loadingState !== 'loaded') {
          setLoadingState('loaded');
        }
        return;
      }

      // Evitar carregamentos duplicados
      if (loadingRef.current && lastLoadedCharacterRef.current === characterId) {
        console.log('[GameHub] Carregamento já em andamento para:', characterId);
        return;
      }

      // Iniciar carregamento
      console.log('[GameHub] Iniciando carregamento para:', characterId);
      loadingRef.current = true;
      lastLoadedCharacterRef.current = characterId;
      setLoadingState('loading');
      setErrorMessage(null);

      // Timeout para detectar problemas
      errorTimeoutRef.current = setTimeout(() => {
        if (loadingRef.current && mountedRef.current) {
          console.error('[GameHub] Timeout no carregamento');
          setLoadingState('error');
          setErrorMessage('Timeout ao carregar personagem. Tente novamente.');
          loadingRef.current = false;
        }
      }, 15000); // 15 segundos timeout

      try {
        // ✅ CORREÇÃO CRÍTICA: Buscar dados do personagem com auto-heal aplicado
        // Detectar se precisa forçar refresh baseado no estado atual
        const gameState = useGameStateStore.getState().gameState;
        const gameStatePlayer = gameState.player;
        const shouldForceRefresh =
          !gameStatePlayer?.id || // Não há player no game state
          gameStatePlayer.id !== characterId || // Player diferente
          gameState.mode !== 'hub'; // Não está no modo hub

        console.log(`[GameHub] Buscando dados: forceRefresh=${shouldForceRefresh}`, {
          hasGameStatePlayer: Boolean(gameStatePlayer?.id),
          gameStatePlayerId: gameStatePlayer?.id,
          targetCharacterId: characterId,
          gameMode: gameState.mode || 'undefined',
        });

        const response = await CharacterService.getCharacterForGame(
          characterId,
          shouldForceRefresh,
          true
        );

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Erro ao carregar personagem');
        }

        const characterData = response.data;

        if (!mountedRef.current) {
          console.log('[GameHub] Componente desmontado após buscar dados');
          return;
        }

        console.log('[GameHub] Dados obtidos, carregando para hub:', characterData.name);

        // Carregar personagem para o hub
        await stableLoadCharacterForHub(characterData as Character);

        if (mountedRef.current) {
          console.log('[GameHub] Carregamento concluído com sucesso');
          setLoadingState('loaded');
          if (errorTimeoutRef.current) {
            clearTimeout(errorTimeoutRef.current);
            errorTimeoutRef.current = null;
          }
        }
      } catch (error) {
        console.error('[GameHub] Erro no carregamento:', error);
        if (mountedRef.current) {
          setLoadingState('error');
          setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido');
          toast.error('Erro ao carregar personagem', {
            description: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }
      } finally {
        loadingRef.current = false;
        if (errorTimeoutRef.current) {
          clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = null;
        }
      }
    };

    loadCharacter();
  }, [characterId, stableLoadCharacterForHub]); // Dependências mínimas

  // Effect separado para detectar mudanças de estado
  useEffect(() => {
    if (
      gameMode === 'hub' &&
      playerId === characterId &&
      playerName &&
      loadingState === 'loading'
    ) {
      console.log('[GameHub] Estado atualizado para hub, finalizando loading');
      setLoadingState('loaded');
    }
  }, [gameMode, playerId, playerName, characterId, loadingState]);

  // Estados de loading
  if (loadingState === 'initial' || loadingState === 'loading') {
    return <LoadingScreen message="Carregando personagem..." />;
  }

  // Estado de erro
  if (loadingState === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="text-center text-white space-y-4 max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-red-400">Erro no Carregamento</h2>
          <p className="text-slate-300">{errorMessage || 'Erro ao carregar dados do personagem'}</p>
          <div className="space-y-2">
            <Button
              onClick={() => {
                setLoadingState('initial');
                setErrorMessage(null);
              }}
              className="w-full"
            >
              Tentar Novamente
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/game/play' })}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar à Seleção
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Verificação final de segurança
  if (!player?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="text-center text-white space-y-4 max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-yellow-400">Personagem não carregado</h2>
          <p className="text-slate-300">Os dados do personagem não puderam ser carregados.</p>
          <Button onClick={() => navigate({ to: '/game/play' })} className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar à Seleção
          </Button>
        </div>
      </div>
    );
  }

  // Função para iniciar sempre do andar 1
  const handleStartFromBeginning = async () => {
    if (!player?.id) {
      toast.error('Erro: Personagem não carregado');
      return;
    }

    try {
      // Resetar para andar 1
      await CharacterService.updateCharacterFloor(player.id, 1);
      navigate({
        to: '/game/play/hub/battle/$character',
        params: { character: player.id },
        search: { character: player.id },
      });
    } catch (error) {
      console.error('Erro ao iniciar do começo:', error);
      toast.error('Erro ao iniciar aventura');
    }
  };

  // Função para iniciar de um checkpoint
  const handleStartFromCheckpoint = async (checkpointFloor: number) => {
    if (!player?.id) {
      toast.error('Erro: Personagem não carregado');
      return;
    }

    try {
      const response = await CharacterService.startFromCheckpoint(player.id, checkpointFloor);
      if (response.success) {
        navigate({
          to: '/game/play/hub/battle/$character',
          params: { character: player.id },
          search: { character: player.id },
        });
      } else {
        toast.error('Erro ao iniciar do checkpoint', {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('Erro ao iniciar do checkpoint:', error);
      toast.error('Erro ao iniciar do checkpoint');
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 to-slate-900 p-2 md:p-4">
      <div className="w-full max-w-7xl mx-auto space-y-4">
        {/* Header padronizado */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/game/play' })}
                className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Trocar Personagem</span>
              <span className="sm:hidden">Trocar</span>
            </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: '/game' })}
                className="flex-shrink-0"
              >
                <span className="hidden sm:inline">Menu Principal</span>
                <span className="sm:hidden">Menu</span>
              </Button>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Hub de {player.name || 'Carregando...'}
              </h1>
              <p className="text-sm sm:text-base text-slate-300">
                Andar {Math.max(1, player.floor || 1)} • Nível {player.level || 1} •{' '}
                {(player.gold || 0).toLocaleString('pt-BR')} Gold
              </p>
            </div>
          </div>
        </div>

        {/* Notificações */}
        <HubNotifications
          player={player}
          showHealNotification={showHealNotification}
          healInfo={healInfo}
          onDismissHealNotification={() => {}}
        />

        {/* Layout principal mais compacto */}
        <div className="space-y-4">
          {/* Informações do Personagem */}
          <CharacterInfoCard player={player} />

          {/* Menu de Ações */}
          <ActionMenuGrid
            player={player}
            onStartAdventure={handleStartFromBeginning}
            onOpenMap={() => setShowMapModal(true)}
            onOpenCharacterStats={() =>
              (window.location.href = `/game/play/hub/character-stats?character=${player.id}`)
            }
            onOpenShop={() => (window.location.href = `/game/play/hub/shop?character=${player.id}`)}
            onOpenInventory={() =>
              (window.location.href = `/game/play/hub/inventory?character=${player.id}`)
            }
            onOpenEquipment={() =>
              (window.location.href = `/game/play/hub/equipment?character=${player.id}`)
            }
            onOpenSpells={() =>
              (window.location.href = `/game/play/hub/spells?character=${player.id}`)
            }
            onOpenCrafting={() =>
              (window.location.href = `/game/play/hub/crafting?character=${player.id}`)
            }
            onOpenCemetery={() => (window.location.href = `/game/play/hub/cemetery`)}
            onReturnToSelection={() => navigate({ to: '/game/play' })}
          />
        </div>

        {/* Modal do Mapa */}
        <MapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          character={{ id: player.id, floor: player.floor } as Character}
          onStartFromCheckpoint={handleStartFromCheckpoint}
        />
      </div>
    </div>
  );
}
