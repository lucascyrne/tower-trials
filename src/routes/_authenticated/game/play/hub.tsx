import { createFileRoute, useNavigate, Outlet, useLocation } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { useGame } from '@/resources/game/game-hook';
import { CharacterService } from '@/resources/game/character.service';
import type { Character } from '@/resources/game/character.model';
import { toast } from 'sonner';
import { MapModal } from '@/components/hub/MapModal';
import { CharacterInfoCard } from '@/components/hub/CharacterInfoCard';
import { ActionMenuGrid } from '@/components/hub/ActionMenuGrid';
import { HubNotifications } from '@/components/hub/HubNotifications';
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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
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
  const location = useLocation();
  const gameContext = useGame();
  const { gameState, loadCharacterForHub } = gameContext;
  const { player } = gameState;

  const [loadingState, setLoadingState] = useState<'initial' | 'loading' | 'loaded' | 'error'>(
    'initial'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  // Estados removidos - funcionalidade de cura será reativada depois se necessário
  const showHealNotification = false;
  const healInfo = null;

  // Refs para controle
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const lastLoadedCharacterRef = useRef<string | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Limpar refs quando o componente for desmontado
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Lógica de carregamento melhorada
  useEffect(() => {
    const loadCharacter = async () => {
      // Debug logging para identificar o problema
      console.log('[GameHub] Debug Info:', {
        characterId: characterId,
        characterIdLength: characterId?.length,
        characterIdType: typeof characterId,
        pathname: location.pathname,
        search: location.search,
        player: player?.id,
        gameMode: gameState.mode,
      });

      // Verificar se temos um personagem válido no contexto
      if (player?.id && player?.name && gameState.mode === 'hub') {
        console.log('[GameHub] Personagem já disponível no contexto:', player.name);

        // Se o characterId da URL é diferente do player atual, usar o da URL
        if (characterId && characterId !== player.id) {
          console.log('[GameHub] Character ID da URL difere do contexto, recarregando...');
        } else {
          // Se não temos characterId na URL mas temos player válido, definir como loaded
          if (!characterId) {
            console.log('[GameHub] Usando personagem do contexto');
            setLoadingState('loaded');
            return;
          }
          // Se o characterId coincide com o player atual, já está carregado
          if (characterId === player.id) {
            console.log('[GameHub] Personagem já carregado corretamente');
            setLoadingState('loaded');
            return;
          }
        }
      }

      // Verificações básicas mais específicas
      if (!characterId || characterId.trim() === '' || !mountedRef.current) {
        console.warn('[GameHub] characterId inválido:', {
          characterId,
          isEmpty: !characterId,
          isEmptyString: characterId === '',
          isMounted: mountedRef.current,
        });

        // Se não temos characterId, tentar redirecionar para seleção
        if (mountedRef.current && (!characterId || characterId.trim() === '')) {
          console.log('[GameHub] Redirecionando para seleção de personagem');
          navigate({ to: '/game/play' });
          return;
        }
        return;
      }

      // Evitar carregamentos duplicados
      if (loadingRef.current && lastLoadedCharacterRef.current === characterId) {
        console.log('[GameHub] Já carregando este personagem, aguardando...');
        return;
      }

      // Verificar se já está no hub com o personagem correto
      if (
        gameState.mode === 'hub' &&
        player.id === characterId &&
        player.name &&
        lastLoadedCharacterRef.current === characterId &&
        loadingState !== 'loaded'
      ) {
        console.log('[GameHub] Personagem já carregado no hub:', player.name);
        setLoadingState('loaded');
        return;
      }

      // Iniciar carregamento
      console.log('[GameHub] Iniciando carregamento do personagem:', characterId);
      loadingRef.current = true;
      lastLoadedCharacterRef.current = characterId;
      setLoadingState('loading');
      setErrorMessage(null);

      // Timeout para detectar erro real (não apenas carregamento lento)
      errorTimeoutRef.current = setTimeout(() => {
        if (loadingRef.current && mountedRef.current) {
          console.warn('[GameHub] Timeout no carregamento - possível erro');
          setLoadingState('error');
          setErrorMessage('Timeout ao carregar personagem. Tente novamente.');
          loadingRef.current = false;
        }
      }, 10000); // 10 segundos timeout

      try {
        // Buscar dados do personagem
        const response = await CharacterService.getCharacterForGame(characterId);

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Erro ao carregar personagem');
        }

        const characterData = response.data;
        console.log('[GameHub] Dados do personagem obtidos:', characterData.name);

        // Carregar para o hub
        console.log('[GameHub] Chamando loadCharacterForHub...');
        await loadCharacterForHub(characterData as Character);
        console.log('[GameHub] loadCharacterForHub concluído com sucesso');

        if (mountedRef.current) {
          setLoadingState('loaded');
          if (errorTimeoutRef.current) {
            clearTimeout(errorTimeoutRef.current);
            errorTimeoutRef.current = null;
          }
        }
      } catch (error) {
        console.error('[GameHub] Erro ao carregar personagem:', error);
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
        console.log('[GameHub] Carregamento finalizado');
      }
    };

    loadCharacter();
  }, [characterId, gameState.mode, player.id, player.name, loadCharacterForHub]);

  // Effect para detectar quando o estado do hub for atualizado
  useEffect(() => {
    if (
      gameState.mode === 'hub' &&
      player.id === characterId &&
      player.name &&
      (loadingState === 'loading' || loadingState === 'initial')
    ) {
      console.log('[GameHub] Hub atualizado, finalizando loading');
      setLoadingState('loaded');
    }
  }, [gameState.mode, player.id, player.name, characterId, loadingState]);

  // Estados de loading
  if (loadingState === 'initial' || loadingState === 'loading') {
    return <LoadingScreen message="Carregando personagem..." />;
  }

  // Estado de erro real
  if (loadingState === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
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

  // Se chegamos até aqui com loadingState 'loaded', significa que o carregamento foi bem-sucedido
  // Não precisamos fazer verificações adicionais que podem criar loops

  // Função para iniciar sempre do andar 1
  const handleStartFromBeginning = async () => {
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4">
      <div className="w-full max-w-7xl mx-auto space-y-4">
        {/* Header padronizado */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/game/play' })}
              className="self-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Trocar Personagem</span>
              <span className="sm:hidden">Trocar</span>
            </Button>

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
