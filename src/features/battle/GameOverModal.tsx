import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, Skull, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useMobileLandscape } from '@/hooks/useMediaQuery';
import { CharacterService } from '@/resources/character/character.service';
import { formatLargeNumber } from '@/utils/number-utils';
import { useNavigate } from '@tanstack/react-router';

interface GameOverModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: {
    id: string;
    name: string;
    level: number;
    floor: number;
    hp: number;
    max_hp: number;
    xp: number;
    gold: number;
  };
  gameMessage?: string;
  highestFloor?: number;
  isCharacterDeleted?: boolean;
  onReturnToCharacterSelect: () => void;
  onViewCemetery?: () => void;
}

export function GameOverModal({
  isOpen,
  onClose,
  player,
  gameMessage = `${player.name} foi derrotado no Andar ${player.floor}...`,
  highestFloor = player.floor,
  isCharacterDeleted = false,
  onReturnToCharacterSelect,
  onViewCemetery,
}: GameOverModalProps) {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detectar mobile landscape
  const isMobileLandscape = useMobileLandscape();

  const handleFinalizeGameOver = async () => {
    if (!player.id) return;

    try {
      setIsSaving(true);
      setIsDeleting(true);

      // ✅ PERMADEATH: Marcar personagem como morto
      // Isso encapsula: salvamento no ranking + marcação no BD + invalidação de caches
      if (!isCharacterDeleted) {
        const { error: deathError } = await CharacterService.markCharacterDead(player.id);
        if (deathError) {
          throw new Error(deathError);
        }
      }

      toast.success('Fim de jogo', {
        description:
          'Personagem perdido permanentemente. Suas estatísticas foram salvas no ranking.',
      });

      onReturnToCharacterSelect();
    } catch (error: unknown) {
      toast.error('Erro ao finalizar jogo', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
      console.error('Erro ao finalizar jogo:', error);
    } finally {
      setIsSaving(false);
      setIsDeleting(false);
    }
  };

  const handleViewCemetery = () => {
    if (onViewCemetery) {
      onViewCemetery();
    } else {
      navigate({ to: '/game/play/hub/cemetery', search: { character: player.id } });
    }
  };

  const handleViewRanking = () => {
    navigate({ to: '/game/ranking' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`overflow-hidden ${
          isMobileLandscape ? 'max-w-[95vw] max-h-[95vh] w-[95vw] p-3' : 'sm:max-w-md'
        }`}
      >
        <DialogHeader className={`text-center ${isMobileLandscape ? 'pb-2' : ''}`}>
          <DialogTitle
            className={`flex items-center justify-center gap-2 ${
              isMobileLandscape ? 'text-lg' : 'text-2xl'
            }`}
          >
            <Skull className={`text-red-500 ${isMobileLandscape ? 'h-5 w-5' : 'h-8 w-8'}`} />
            {isCharacterDeleted ? 'Permadeath - Personagem Perdido' : 'Fim de Jogo'}
          </DialogTitle>
        </DialogHeader>

        <div
          className={`${
            isMobileLandscape ? 'space-y-2 max-h-[calc(95vh-140px)] overflow-y-auto' : 'space-y-4'
          }`}
        >
          {/* Resumo */}
          <div className="text-center">
            <p className={`mb-2 ${isMobileLandscape ? 'text-sm' : 'text-lg'}`}>{gameMessage}</p>
            <div
              className={`flex items-center justify-center gap-2 mb-2 ${
                isMobileLandscape ? 'mb-2' : 'mb-4'
              }`}
            >
              <Trophy className={`text-yellow-500 ${isMobileLandscape ? 'h-4 w-4' : 'h-6 w-6'}`} />
              <span className={`font-bold ${isMobileLandscape ? 'text-lg' : 'text-2xl'}`}>
                Andar {player.floor - 1}
              </span>
            </div>
            <p className={`text-muted-foreground ${isMobileLandscape ? 'text-xs' : 'text-sm'}`}>
              Seu recorde atual: Andar {highestFloor}
            </p>
          </div>

          {/* Container adaptativo para layout landscape */}
          <div className={isMobileLandscape ? 'grid grid-cols-2 gap-2' : 'space-y-3'}>
            {/* Estatísticas Finais */}
            <div className={`bg-muted rounded-lg ${isMobileLandscape ? 'p-2' : 'p-4'}`}>
              <h3 className={`font-medium mb-2 ${isMobileLandscape ? 'text-sm' : ''}`}>
                Estatísticas Finais
              </h3>
              <div
                className={`grid grid-cols-2 gap-1 ${
                  isMobileLandscape ? 'text-xs' : 'gap-2 text-sm'
                }`}
              >
                <div>Personagem:</div>
                <div className="font-medium truncate">{player.name}</div>

                <div>Andares:</div>
                <div className="font-medium">{player.floor - 1}</div>

                <div>HP final:</div>
                <div className="font-medium">
                  {player.hp}/{player.max_hp}
                </div>

                <div>Nível:</div>
                <div className="font-medium">{player.level}</div>

                <div>Gold:</div>
                <div className="font-medium">{formatLargeNumber(player.gold)}</div>

                <div>XP total:</div>
                <div className="font-medium">{formatLargeNumber(player.xp)}</div>
              </div>
            </div>

            {/* Aviso de Permadeath */}
            <div
              className={`bg-red-500/10 border border-red-500/20 rounded-lg ${
                isMobileLandscape ? 'p-2' : 'p-4'
              }`}
            >
              <div className={`flex items-center gap-2 mb-2 ${isMobileLandscape ? 'mb-1' : ''}`}>
                <AlertTriangle
                  className={`text-red-400 ${isMobileLandscape ? 'h-3 w-3' : 'h-5 w-5'}`}
                />
                <span
                  className={`font-medium text-red-400 ${
                    isMobileLandscape ? 'text-xs' : 'text-sm'
                  }`}
                >
                  Aviso de Permadeath
                </span>
              </div>

              <p className={`text-red-400 mb-2 ${isMobileLandscape ? 'text-xs mb-1' : 'text-sm'}`}>
                {isCharacterDeleted
                  ? 'Este personagem foi permanentemente deletado.'
                  : 'Este personagem será permanentemente deletado ao continuar.'}
              </p>

              <p className={`text-red-300 ${isMobileLandscape ? 'text-xs' : 'text-xs'}`}>
                Suas estatísticas serão salvas no ranking para comparação.
              </p>
            </div>
          </div>

          {/* Estatísticas da Jornada - Apenas se foi deletado */}
          {isCharacterDeleted && (
            <div
              className={`bg-blue-500/10 border border-blue-500/20 rounded-lg ${
                isMobileLandscape ? 'p-2' : 'p-3'
              }`}
            >
              <div className={`text-blue-400 ${isMobileLandscape ? 'text-xs' : 'text-xs'}`}>
                💀 <strong>Estatísticas da Jornada:</strong>
                <br />
                <div className={`mt-1 ${isMobileLandscape ? 'grid grid-cols-2 gap-1' : ''}`}>
                  <div>• Nível alcançado: {player.level}</div>
                  <div>• Andar mais alto: {player.floor}</div>
                  <div>• Gold acumulado: {player.gold}</div>
                  <div>• XP total: {player.xp}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botões responsivos */}
        <div className={`flex gap-2 ${isMobileLandscape ? 'flex-row pt-2' : 'flex-col pt-4'}`}>
          {isCharacterDeleted && (
            <Button
              variant="outline"
              onClick={handleViewCemetery}
              className={`border-blue-500/30 text-blue-400 hover:bg-blue-500/10 ${
                isMobileLandscape ? 'flex-1 text-xs h-8' : 'w-full'
              }`}
              disabled={isSaving || isDeleting}
            >
              <Eye className={`mr-1 ${isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4 mr-2'}`} />
              {isMobileLandscape ? 'Cemitério' : 'Ver Cemitério'}
            </Button>
          )}

          <Button
            variant="destructive"
            onClick={handleFinalizeGameOver}
            disabled={isSaving || isDeleting}
            className={`${isMobileLandscape ? 'flex-1 text-xs h-8' : 'w-full'}`}
          >
            {isSaving || isDeleting ? (
              <span className="flex items-center gap-1">
                <div
                  className={`animate-spin rounded-full border-t-2 border-b-2 border-white ${
                    isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'
                  }`}
                ></div>
                {isMobileLandscape ? 'Finalizando...' : 'Finalizando...'}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Skull className={`${isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'}`} />
                {isMobileLandscape
                  ? 'Aceitar Derrota'
                  : isCharacterDeleted
                    ? 'Criar Novo Personagem'
                    : 'Aceitar Derrota e Salvar'}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={handleViewRanking}
            className={`${isMobileLandscape ? 'flex-1 text-xs h-8' : 'w-full'}`}
            disabled={isSaving || isDeleting}
          >
            <Trophy className={`mr-1 ${isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4 mr-2'}`} />
            {isMobileLandscape ? 'Ranking' : 'Ver Ranking'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
