import { useEffect, useState } from 'react';
import { Character } from '@/resources/game/models/character.model';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/resources/auth/auth-hook';
import { CharacterService } from '@/resources/game/character.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Skull, Crown, Swords } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

export function CharacterSelect() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPermadeathDialog, setShowPermadeathDialog] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      loadCharacters();
    }
  }, [user]);

  const loadCharacters = async () => {
    try {
      const response = await CharacterService.getUserCharacters(user!.id);
      if (response.success && response.data) {
        setCharacters(response.data);
      } else if (response.error) {
        toast.error('Erro ao carregar personagens', {
          description: response.error
        });
      }
    } catch (error) {
      console.error('Erro ao carregar personagens:', error);
      toast.error('Erro ao carregar personagens');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCharacter = async () => {
    if (!user?.id || !newCharacterName.trim()) return;
    
    setIsCreating(true);
    try {
      const response = await CharacterService.createCharacter({
        user_id: user.id,
        name: newCharacterName.trim()
      });

      if (response.success && response.data) {
        toast.success('Personagem criado com sucesso!');
        await loadCharacters();
        setShowCreateDialog(false);
        setNewCharacterName('');
      } else {
        toast.error('Erro ao criar personagem', {
          description: response.error
        });
      }
    } catch (error) {
      console.error('Erro ao criar personagem:', error);
      toast.error('Erro ao criar personagem');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectCharacter = async (character: Character) => {
    setSelectedCharacter(character);
    setShowPermadeathDialog(true);
  };

  const handleConfirmCharacterSelect = async () => {
    if (!selectedCharacter) return;
    
    try {
      const response = await CharacterService.getCharacter(selectedCharacter.id);
      if (response.success && response.data) {
        router.push(`/game/play/hub?character=${selectedCharacter.id}`);
      } else {
        toast.error('Erro ao selecionar personagem', {
          description: response.error
        });
      }
    } catch (error) {
      console.error('Erro ao selecionar personagem:', error);
      toast.error('Erro ao selecionar personagem');
    }
  };

  const renderCharacterStats = (character: Character) => {
    const xpProgress = (character.xp / character.xp_next_level) * 100;
    const hpProgress = (character.hp / character.max_hp) * 100;
    const manaProgress = (character.mana / character.max_mana) * 100;

    return (
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>HP: {character.hp}/{character.max_hp}</span>
            <span>{Math.round(hpProgress)}%</span>
          </div>
          <Progress value={hpProgress} className="h-2 bg-red-500" />
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Mana: {character.mana}/{character.max_mana}</span>
            <span>{Math.round(manaProgress)}%</span>
          </div>
          <Progress value={manaProgress} className="h-2 bg-blue-500" />
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>XP: {character.xp}/{character.xp_next_level}</span>
            <span>{Math.round(xpProgress)}%</span>
          </div>
          <Progress value={xpProgress} className="h-2 bg-yellow-500" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-gray-700 p-2 rounded">
            <span>Ataque: {character.atk}</span>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <span>Defesa: {character.def}</span>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <span>Velocidade: {character.speed}</span>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <span>Gold: {character.gold}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Seus Personagens</h1>
        <Button onClick={() => setShowCreateDialog(true)}>Criar Personagem</Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : characters.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">Você ainda não tem personagens</p>
          <Button onClick={() => setShowCreateDialog(true)}>Criar Primeiro Personagem</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map(character => (
            <Card key={character.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className={`h-5 w-5 ${character.level >= 10 ? 'text-yellow-500' : 'text-gray-400'}`} />
                  {character.name}
                  <span className="text-sm text-muted-foreground ml-auto">Nível {character.level}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderCharacterStats(character)}
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handleSelectCharacter(character)}
                >
                  <Swords className="h-4 w-4 mr-2" />
                  Selecionar
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de Criação de Personagem */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Personagem</DialogTitle>
            <DialogDescription>
              Digite o nome do seu novo personagem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Nome do personagem"
              value={newCharacterName}
              onChange={(e) => setNewCharacterName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCharacter}
              disabled={!newCharacterName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Criando...
                </>
              ) : (
                'Criar Personagem'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Aviso de Permadeath */}
      <Dialog open={showPermadeathDialog} onOpenChange={setShowPermadeathDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Skull className="h-6 w-6" />
              Aviso de Permadeath
            </DialogTitle>
            <DialogDescription className="text-base">
              Você está prestes a entrar em uma aventura perigosa!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg space-y-3">
              <p className="text-sm">
                <strong>O que é Permadeath?</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Neste jogo, a morte é permanente. Se seu personagem morrer durante a aventura:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>O personagem será permanentemente deletado</li>
                <li>Todo o progresso será perdido</li>
                <li>Equipamentos e itens serão destruídos</li>
                <li>A pontuação será registrada no ranking</li>
              </ul>
            </div>
            
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Dicas de Sobrevivência:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Use magias sabiamente e gerencie sua mana</li>
                <li>Mantenha seus pontos de vida sempre altos</li>
                <li>Fuja de batalhas muito difíceis</li>
                <li>Compre equipamentos para aumentar suas chances</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPermadeathDialog(false)}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCharacterSelect}
            >
              <Skull className="h-4 w-4 mr-2" />
              Aceitar e Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 