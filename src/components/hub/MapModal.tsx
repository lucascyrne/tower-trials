import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CharacterService } from '@/resources/game/character.service';
import { type Character } from '@/resources/game/models/character.model';
import { toast } from 'sonner';
import { Map, Play, Crown, Check } from 'lucide-react';

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  onStartFromCheckpoint: (checkpointFloor: number) => void;
}

interface Checkpoint {
  floor: number;
  description: string;
}

export const MapModal: React.FC<MapModalProps> = ({
  isOpen,
  onClose,
  character,
  onStartFromCheckpoint,
}) => {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCheckpoints();
    }
  }, [isOpen, character.id]);

  const loadCheckpoints = async () => {
    setLoading(true);
    try {
      console.log(
        `[MapModal] Carregando checkpoints para personagem ${character.name} (ID: ${character.id})`
      );
      console.log(`[MapModal] Andar atual do personagem: ${character.floor}`);

      const response = await CharacterService.getUnlockedCheckpoints(character.id);

      console.log(`[MapModal] Resposta do CharacterService:`, response);

      if (response.success && response.data) {
        console.log(`[MapModal] Checkpoints carregados:`, response.data);
        setCheckpoints(response.data);

        // Selecionar o checkpoint mais alto por padrão (normalmente o andar atual)
        if (response.data.length > 0) {
          const currentFloorCheckpoint = response.data.find(cp => cp.floor === character.floor);
          const defaultCheckpoint = currentFloorCheckpoint
            ? currentFloorCheckpoint.floor
            : response.data[response.data.length - 1].floor;
          setSelectedCheckpoint(defaultCheckpoint);
          console.log(`[MapModal] Checkpoint selecionado por padrão: ${defaultCheckpoint}`);
        }
      } else {
        console.error(`[MapModal] Erro ao carregar checkpoints:`, response.error);
        toast.error('Erro ao carregar checkpoints', {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('[MapModal] Erro ao carregar checkpoints:', error);
      toast.error('Erro ao carregar checkpoints');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAdventure = async () => {
    if (selectedCheckpoint === null) {
      toast.error('Selecione um checkpoint');
      return;
    }

    try {
      setLoading(true);
      onStartFromCheckpoint(selectedCheckpoint);
      onClose();
    } catch (error) {
      console.error('Erro ao iniciar aventura:', error);
      toast.error('Erro ao iniciar aventura');
    } finally {
      setLoading(false);
    }
  };

  const getCheckpointIcon = (floor: number) => {
    if (floor === 1) return <Play className="h-5 w-5" />;
    // Checkpoints pós-boss (11, 21, 31, etc.) são santuários seguros
    if (floor > 1 && (floor - 1) % 10 === 0) return <Crown className="h-5 w-5" />;
    return <Map className="h-5 w-5" />;
  };

  const getCheckpointColor = (floor: number) => {
    if (floor === 1) return 'bg-green-500'; // Início - verde
    // Checkpoints pós-boss são dourados (conquistados após vitória épica)
    if (floor > 1 && (floor - 1) % 10 === 0) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getCheckpointLabel = (floor: number) => {
    if (floor === 1) return 'Início da aventura';
    if (floor > 1 && (floor - 1) % 10 === 0) return 'Santuário Pós-Boss';
    return 'Checkpoint';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Map className="h-6 w-6" />
            Mapa da Torre - Checkpoints Desbloqueados
          </DialogTitle>
          <DialogDescription>
            Escolha de qual andar você deseja iniciar sua aventura. Você só pode acessar checkpoints
            que já alcançou antes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Lista de Checkpoints */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {checkpoints.map(checkpoint => (
                  <Card
                    key={checkpoint.floor}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedCheckpoint === checkpoint.floor
                        ? 'ring-2 ring-primary bg-primary/5'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedCheckpoint(checkpoint.floor)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div
                          className={`p-1 rounded-full text-white ${getCheckpointColor(checkpoint.floor)}`}
                        >
                          {getCheckpointIcon(checkpoint.floor)}
                        </div>
                        {checkpoint.description}
                        {selectedCheckpoint === checkpoint.floor && (
                          <Check className="h-4 w-4 text-primary ml-auto" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-xs text-muted-foreground">
                        {getCheckpointLabel(checkpoint.floor)}
                      </div>
                      {character.floor === checkpoint.floor && (
                        <div className="text-xs text-green-600 font-medium mt-1">Posição Atual</div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Informações do personagem */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Andar Atual:</span>
                    <span className="font-bold">{character.floor}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span>Checkpoints Desbloqueados:</span>
                    <span className="font-bold">{checkpoints.length}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Botões de ação */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleStartAdventure}
                  className="flex-1"
                  disabled={loading || selectedCheckpoint === null}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Iniciar Aventura
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
