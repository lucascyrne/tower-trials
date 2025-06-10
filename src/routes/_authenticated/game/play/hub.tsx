import { createFileRoute, useNavigate, Outlet, useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useGame } from '@/resources/game/game-hook';
import { CharacterService } from '@/resources/game/character.service';
import type { Character } from '@/resources/game/models/character.model';
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
  const [characterLoaded, setCharacterLoaded] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showHealNotification, setShowHealNotification] = useState(false);
  const [healInfo, setHealInfo] = useState<{
    oldHp: number;
    newHp: number;
    character: string;
  } | null>(null);

  // Debug: Log do estado atual do player e contexto
  console.log('[GameHub] Estado atual completo:', {
    player: {
      id: player.id,
      name: player.name,
      level: player.level,
      gold: player.gold,
      floor: player.floor,
      hp: player.hp,
      max_hp: player.max_hp,
    },
    characterId: characterId,
    gameMode: gameState.mode,
    hasLoadCharacterForHub: typeof loadCharacterForHub === 'function',
    gameContextKeys: Object.keys(gameContext),
  });

  // Carregar personagem selecionado - apenas uma vez
  useEffect(() => {
    const loadSelectedCharacter = async () => {
      if (!characterId) {
        console.log('[GameHub] Sem characterId, redirecionando...');
        navigate({ to: '/game/play' });
        return;
      }

      // Evitar carregamentos duplicados
      if (characterLoaded && player.id === characterId && player.name && player.level > 0) {
        console.log('[GameHub] Personagem já carregado corretamente:', player.name);
        setIsLoading(false);
        return;
      }

      try {
        console.log('[GameHub] Carregando personagem:', characterId);
        setIsLoading(true);

        // Usar o método que retorna dados completos para o jogo
        const response = await CharacterService.getCharacterForGame(characterId);

        if (response.success && response.data) {
          console.log('[GameHub] Personagem carregado com sucesso:', {
            name: response.data.name,
            level: response.data.level,
            gold: response.data.gold,
            floor: response.data.floor,
            hp: response.data.hp,
            max_hp: response.data.max_hp,
          });

          // Verificar se houve cura significativa comparando com cache anterior
          const cachedPlayer = sessionStorage.getItem(`player_${characterId}`);
          if (cachedPlayer) {
            try {
              const previousPlayer = JSON.parse(cachedPlayer);
              const healAmount = response.data.hp - previousPlayer.hp;
              const healPercent = (healAmount / response.data.max_hp) * 100;

              // Se foi curado significativamente (mais de 5% do HP máximo)
              if (healAmount > 0 && healPercent >= 5) {
                setHealInfo({
                  oldHp: previousPlayer.hp,
                  newHp: response.data.hp,
                  character: response.data.name,
                });
                setShowHealNotification(true);

                // Esconder notificação após 5 segundos
                setTimeout(() => {
                  setShowHealNotification(false);
                }, 5000);
              }
            } catch (cacheError) {
              console.warn('[GameHub] Erro ao processar cache:', cacheError);
            }
          }

          // Salvar estado atual para comparação futura
          sessionStorage.setItem(`player_${characterId}`, JSON.stringify(response.data));

          // Carregar para o hub usando os dados completos
          await loadCharacterForHub(response.data as Character);
          setCharacterLoaded(true);

          console.log(
            '[GameHub] loadCharacterForHub executado, estado após carregamento:',
            gameState.player
          );
        } else {
          console.error('[GameHub] Erro na resposta do serviço:', response.error);
          toast.error('Erro ao carregar personagem', {
            description: response.error,
          });
          navigate({ to: '/game/play' });
        }
      } catch (error) {
        console.error('[GameHub] Erro ao carregar personagem:', error);
        toast.error('Erro ao carregar personagem');
        navigate({ to: '/game/play' });
      } finally {
        setIsLoading(false);
      }
    };

    loadSelectedCharacter();
  }, [characterId]); // Simplificar dependências para evitar loops

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-500"></div>
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
          onDismissHealNotification={() => setShowHealNotification(false)}
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
