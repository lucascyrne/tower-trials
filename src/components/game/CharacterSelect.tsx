import { useEffect, useState } from 'react';
import { Character } from '@/resources/game/models/character.model';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/resources/auth/auth-hook';
import { CharacterService } from '@/resources/game/character.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function CharacterSelect() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
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
    try {
      const response = await CharacterService.getCharacter(character.id);
      if (response.success && response.data) {
        router.push(`/game/play?character=${character.id}`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Seus Personagens</h1>
          {characters.length < 3 && (
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Criar Novo Personagem
            </Button>
          )}
        </div>
        
        {characters.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">Você ainda não tem personagens</p>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Criar Seu Primeiro Personagem
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {characters.map((character) => (
              <div
                key={character.id}
                className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors cursor-pointer border-2 border-purple-500"
                onClick={() => handleSelectCharacter(character)}
              >
                <h2 className="text-xl font-bold mb-2">{character.name}</h2>
                <div className="space-y-2 text-gray-300">
                  <p>Nível {character.level}</p>
                  <p>HP: {character.max_hp}</p>
                  <p>Ataque: {character.atk}</p>
                  <p>Defesa: {character.def}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Personagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Nome do personagem"
              value={newCharacterName}
              onChange={(e) => setNewCharacterName(e.target.value)}
              disabled={isCreating}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCharacter}
                disabled={!newCharacterName.trim() || isCreating}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isCreating ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 