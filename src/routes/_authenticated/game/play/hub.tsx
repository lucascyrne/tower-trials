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
    character: (search.character as string) || '',
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

function GameHubMainPage({ characterId }: { characterId: string }) {
  const navigate = useNavigate();
  const gameContext = useGame();
  const { gameState, loadCharacterForHub } = gameContext;
  const { player } = gameState;

  const [isLoading, setIsLoading] = useState(true);
  const [showMapModal, setShowMapModal] = useState(false);
  // Estados removidos - funcionalidade de cura será reativada depois se necessário
  const showHealNotification = false;
  const healInfo = null;

  // Refs simples para controle
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const lastLoadedCharacterRef = useRef<string | null>(null);

  // Limpar refs quando o componente for desmontado
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // SIMPLIFICADO: Lógica de carregamento mais direta
  useEffect(() => {
    const loadCharacter = async () => {
      // Verificações básicas
      if (!characterId || !mountedRef.current) {
        console.log('[GameHub] characterId não fornecido ou componente desmontado');
        setIsLoading(false);
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
        lastLoadedCharacterRef.current === characterId
      ) {
        console.log('[GameHub] Personagem já carregado no hub:', player.name);
        setIsLoading(false);
        return;
      }

      // Iniciar carregamento
      console.log('[GameHub] Iniciando carregamento do personagem:', characterId);
      loadingRef.current = true;
      lastLoadedCharacterRef.current = characterId;
      setIsLoading(true);

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
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[GameHub] Erro ao carregar personagem:', error);
        if (mountedRef.current) {
          toast.error('Erro ao carregar personagem', {
            description: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          navigate({ to: '/game/play' });
        }
      } finally {
        loadingRef.current = false;
        console.log('[GameHub] Carregamento finalizado');
      }
    };

    loadCharacter();
  }, [characterId, gameState.mode, player.id, player.name, loadCharacterForHub]);

  // EFFECT para detectar quando o estado do hub for atualizado
  useEffect(() => {
    if (gameState.mode === 'hub' && player.id === characterId && player.name && isLoading) {
      console.log('[GameHub] Hub atualizado, finalizando loading');
      setIsLoading(false);
    }
  }, [gameState.mode, player.id, player.name, characterId, isLoading]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-500"></div>
      </div>
    );
  }

  // CORRIGIDO: Validação de estado mais robusta
  // Verificar se temos dados suficientes para renderizar o hub
  const hasValidPlayerData = player && player.id && player.name;
  const isCorrectCharacter = player.id === characterId;
  const isInHubMode = gameState.mode === 'hub';

  if (!hasValidPlayerData || !isCorrectCharacter || !isInHubMode) {
    // Se chegamos aqui, algo deu errado no carregamento
    console.warn('[GameHub] Estado inválido:', {
      hasValidPlayerData,
      isCorrectCharacter,
      isInHubMode,
      playerId: player?.id,
      characterId,
      gameMode: gameState.mode,
      playerName: player?.name,
    });

    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center text-white">
          <p>Erro ao carregar dados do personagem</p>
          <Button onClick={() => navigate({ to: '/game/play' })} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

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
