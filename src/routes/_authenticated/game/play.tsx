import { createFileRoute, useNavigate, Outlet, useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Skull,
  Crown,
  Swords,
  Lock,
  Plus,
  Users,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { Character, CharacterProgressionInfo } from '@/resources/game/character.model';
import { useAuth } from '@/resources/auth/auth-hook';
import { CharacterService } from '@/resources/game/character.service';
import { NameValidationService } from '@/resources/game/name-validation.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

// Definir número máximo de slots que podem ser desbloqueados
const MAX_CHARACTER_SLOTS = 20;

interface CharacterSlot {
  slotNumber: number;
  character: Character | null;
  isUnlocked: boolean;
  requiredTotalLevel: number;
}

export const Route = createFileRoute('/_authenticated/game/play')({
  component: GamePlayLayoutPage,
});

function GamePlayLayoutPage() {
  const location = useLocation();

  // Se estamos exatamente na rota /game/play, mostrar a seleção de personagem
  // Caso contrário, mostrar o Outlet com as rotas filhas (hub, shop, inventory, etc.)
  if (location.pathname === '/game/play') {
    return <GamePlaySelectionPage />;
  }

  // Para rotas filhas como /game/play/hub, /game/play/shop, etc.
  return <Outlet />;
}

function GamePlaySelectionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [progression, setProgression] = useState<CharacterProgressionInfo | null>(null);
  const [slots, setSlots] = useState<CharacterSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para criação de personagem
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [nameValidation, setNameValidation] = useState<{
    isValid: boolean;
    error?: string;
    suggestions?: string[];
  }>({ isValid: true });
  const [isCreating, setIsCreating] = useState(false);

  // Estados para seleção de personagem
  const [showPermadeathDialog, setShowPermadeathDialog] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  // Validar nome em tempo real
  useEffect(() => {
    if (newCharacterName.trim()) {
      const validation = NameValidationService.validateCharacterName(newCharacterName);

      if (validation.isValid && characters.length > 0) {
        const existingNames = characters.map(c => c.name);
        const formattedName = NameValidationService.formatCharacterName(newCharacterName);

        if (NameValidationService.isTooSimilar(formattedName, existingNames)) {
          const suggestions = NameValidationService.generateNameSuggestions(formattedName);
          setNameValidation({
            isValid: false,
            error: 'Nome muito similar a um personagem existente',
            suggestions,
          });
        } else {
          setNameValidation(validation);
        }
      } else {
        setNameValidation(validation);
      }
    } else {
      setNameValidation({ isValid: true });
    }
  }, [newCharacterName, characters]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar personagens
      const charactersResponse = await CharacterService.getUserCharacters(user!.id);
      if (charactersResponse.success && charactersResponse.data) {
        setCharacters(charactersResponse.data);
      }

      // Carregar progressão
      const progressionResponse = await CharacterService.getUserCharacterProgression(user!.id);
      if (progressionResponse.success && progressionResponse.data) {
        setProgression(progressionResponse.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados dos personagens');
    } finally {
      setLoading(false);
    }
  };

  // Calcular slots baseado na progressão
  useEffect(() => {
    if (progression && characters !== undefined) {
      const newSlots: CharacterSlot[] = [];

      for (let i = 1; i <= MAX_CHARACTER_SLOTS; i++) {
        const character =
          characters.find(c => {
            // Associar personagens aos slots pela ordem de criação
            const characterIndex = characters.indexOf(c) + 1;
            return characterIndex === i;
          }) || null;

        const isUnlocked = i <= progression.max_character_slots;
        const requiredTotalLevel = calculateRequiredTotalLevel(i);

        newSlots.push({
          slotNumber: i,
          character,
          isUnlocked,
          requiredTotalLevel,
        });
      }

      setSlots(newSlots);
    }
  }, [progression, characters]);

  const calculateRequiredTotalLevel = (slotNumber: number): number => {
    if (slotNumber <= 3) return 0; // Primeiros 3 slots são gratuitos
    return (slotNumber - 3) * 15; // Fórmula: (slot - 3) * 15
  };

  const handleCreateCharacter = async () => {
    if (!user?.id || !newCharacterName.trim() || !nameValidation.isValid) return;

    setIsCreating(true);
    try {
      const response = await CharacterService.createCharacter({
        user_id: user.id,
        name: newCharacterName.trim(),
      });

      if (response.success && response.data) {
        toast.success('Personagem criado com sucesso!', {
          description: `${NameValidationService.formatCharacterName(newCharacterName)} foi criado!`,
        });
        await loadData();
        resetCreateDialog();
      } else {
        toast.error('Erro ao criar personagem', {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('Erro ao criar personagem:', error);
      toast.error('Erro ao criar personagem');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectCharacter = (character: Character) => {
    setSelectedCharacter(character);
    setShowPermadeathDialog(true);
  };

  const handleConfirmCharacterSelect = async () => {
    if (!selectedCharacter) return;

    try {
      const response = await CharacterService.getCharacter(selectedCharacter.id);
      if (response.success && response.data) {
        navigate({ to: `/game/play/hub`, search: { character: selectedCharacter.id } });
      } else {
        toast.error('Erro ao selecionar personagem', {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('Erro ao selecionar personagem:', error);
      toast.error('Erro ao selecionar personagem');
    }
  };

  const openCreateDialog = () => {
    setShowCreateDialog(true);
  };

  const resetCreateDialog = () => {
    setShowCreateDialog(false);
    setNewCharacterName('');
    setNameValidation({ isValid: true });
  };

  const handleNameSuggestionClick = (suggestion: string) => {
    setNewCharacterName(suggestion);
  };

  const renderCharacterStats = (character: Character) => {
    const calculateCurrentLevelXpRequirement = (level: number): number => {
      return Math.floor(100 * Math.pow(1.1, level - 1));
    };

    const currentLevelXpReq = calculateCurrentLevelXpRequirement(character.level);
    const xpProgress = (character.xp / currentLevelXpReq) * 100;

    return (
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Nível:</span>
          <span className="font-medium">{character.level}</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>XP:</span>
            <span className="font-medium">
              {character.xp}/{currentLevelXpReq}
            </span>
          </div>
          <Progress value={xpProgress} className="h-2" />
        </div>
        <div className="flex justify-between">
          <span>Andar Máximo:</span>
          <span className="font-medium">{character.floor}</span>
        </div>
        <div className="flex justify-between">
          <span>Ouro:</span>
          <span className="font-medium text-yellow-600">{character.gold}</span>
        </div>
      </div>
    );
  };

  const renderSlotCard = (slot: CharacterSlot) => {
    if (!slot.isUnlocked) {
      return (
        <Card key={slot.slotNumber} className="opacity-50">
          <CardContent className="p-4 text-center">
            <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Slot {slot.slotNumber}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Requer nível total {slot.requiredTotalLevel}
            </p>
          </CardContent>
        </Card>
      );
    }

    if (!slot.character) {
      return (
        <Card key={slot.slotNumber} className="cursor-pointer hover:bg-accent/50 border-dashed">
          <CardContent className="p-4 text-center" onClick={() => openCreateDialog()}>
            <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Criar Personagem</p>
            <p className="text-xs text-muted-foreground mt-1">Slot {slot.slotNumber}</p>
          </CardContent>
        </Card>
      );
    }

    const character = slot.character;
    const isAlive = character.hp > 0;

    return (
      <Card
        key={slot.slotNumber}
        className={`cursor-pointer hover:bg-accent/50 ${!isAlive ? 'border-red-500/50 bg-red-500/5' : ''}`}
        onClick={() => isAlive && handleSelectCharacter(character)}
        style={{ cursor: isAlive ? 'pointer' : 'not-allowed' }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {character.name}
              {!isAlive && <Skull className="h-4 w-4 text-red-500" />}
              {character.floor >= 100 && <Crown className="h-4 w-4 text-yellow-500" />}
            </CardTitle>
            <div className="text-xs text-muted-foreground">Slot {slot.slotNumber}</div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {renderCharacterStats(character)}
          {!isAlive && (
            <Alert className="mt-3 border-red-500/50 bg-red-500/10">
              <Skull className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700">
                Este personagem morreu permanentemente
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Carregando personagens...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/game' })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Selecionar Personagem</h1>
            <p className="text-muted-foreground">Escolha um personagem para jogar</p>
          </div>
        </div>

        {progression && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Progressão Total</div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="font-medium">{progression.total_character_level}</span>
              <span className="text-muted-foreground">nível</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {progression.max_character_slots}/{MAX_CHARACTER_SLOTS} slots
            </div>
          </div>
        )}
      </div>

      {/* Grid de Personagens */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {slots.map(renderSlotCard)}
      </div>

      {/* Dialog de Criação de Personagem */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Personagem</DialogTitle>
            <DialogDescription>
              Escolha um nome para seu novo personagem. Lembre-se: a morte é permanente!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Input
                placeholder="Nome do personagem"
                value={newCharacterName}
                onChange={e => setNewCharacterName(e.target.value)}
                className={!nameValidation.isValid ? 'border-red-500' : ''}
              />

              {!nameValidation.isValid && nameValidation.error && (
                <Alert className="mt-2 border-red-500/50 bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-red-700">
                    {nameValidation.error}
                  </AlertDescription>
                </Alert>
              )}

              {nameValidation.suggestions && nameValidation.suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground mb-2">Sugestões:</p>
                  <div className="flex flex-wrap gap-2">
                    {nameValidation.suggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleNameSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Alert>
              <Skull className="h-4 w-4" />
              <AlertDescription>
                <strong>Aviso:</strong> Este jogo possui morte permanente (permadeath). Se seu
                personagem morrer, ele será perdido para sempre!
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetCreateDialog}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCharacter}
                disabled={!newCharacterName.trim() || !nameValidation.isValid || isCreating}
              >
                {isCreating ? 'Criando...' : 'Criar Personagem'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Seleção */}
      <Dialog open={showPermadeathDialog} onOpenChange={setShowPermadeathDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Seleção</DialogTitle>
            <DialogDescription>
              Você está prestes a jogar com {selectedCharacter?.name}
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <Swords className="h-4 w-4" />
            <AlertDescription>
              <strong>Lembrete:</strong> Este jogo possui morte permanente. Se seu personagem morrer
              durante a aventura, ele será perdido para sempre!
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPermadeathDialog(false)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmCharacterSelect} className="cursor-pointer">
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar e Jogar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
