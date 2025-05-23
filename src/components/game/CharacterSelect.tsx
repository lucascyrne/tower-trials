import { useEffect, useState } from 'react';
import { Character } from '@/resources/game/models/character.model';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/resources/auth/auth-hook';
import { CharacterService } from '@/resources/game/character.service';
import { NameValidationService } from '@/resources/game/name-validation.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Skull, Crown, Swords, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function CharacterSelect() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPermadeathDialog, setShowPermadeathDialog] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [nameValidation, setNameValidation] = useState<{ isValid: boolean; error?: string; suggestions?: string[] }>({ isValid: true });
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      loadCharacters();
    }
  }, [user]);

  // Validar nome em tempo real
  useEffect(() => {
    if (newCharacterName.trim()) {
      const validation = NameValidationService.validateCharacterName(newCharacterName);
      
      // Se o nome for válido, verificar se não é muito similar aos existentes
      if (validation.isValid && characters.length > 0) {
        const existingNames = characters.map(c => c.name);
        const formattedName = NameValidationService.formatCharacterName(newCharacterName);
        
        if (NameValidationService.isTooSimilar(formattedName, existingNames)) {
          const suggestions = NameValidationService.generateNameSuggestions(formattedName);
          setNameValidation({
            isValid: false,
            error: 'Nome muito similar a um personagem existente',
            suggestions
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
    
    // Validação final antes de criar
    if (!nameValidation.isValid) {
      toast.error('Nome inválido', {
        description: nameValidation.error
      });
      return;
    }
    
    setIsCreating(true);
    try {
      const response = await CharacterService.createCharacter({
        user_id: user.id,
        name: newCharacterName.trim()
      });

      if (response.success && response.data) {
        toast.success('Personagem criado com sucesso!', {
          description: `${NameValidationService.formatCharacterName(newCharacterName)} foi criado!`
        });
        await loadCharacters();
        setShowCreateDialog(false);
        setNewCharacterName('');
        setNameValidation({ isValid: true });
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

  const handleNameSuggestionClick = (suggestion: string) => {
    setNewCharacterName(suggestion);
  };

  const resetCreateDialog = () => {
    setShowCreateDialog(false);
    setNewCharacterName('');
    setNameValidation({ isValid: true });
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
      <Dialog open={showCreateDialog} onOpenChange={resetCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Personagem</DialogTitle>
            <DialogDescription>
              Digite o nome do seu novo personagem. Siga as regras para um nome válido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder="Nome do personagem (3-20 caracteres)"
                  value={newCharacterName}
                  onChange={(e) => setNewCharacterName(e.target.value)}
                  className={`pr-10 ${
                    newCharacterName.trim() 
                      ? nameValidation.isValid 
                        ? 'border-green-500 focus:border-green-500' 
                        : 'border-red-500 focus:border-red-500'
                      : ''
                  }`}
                  maxLength={20}
                />
                {newCharacterName.trim() && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {nameValidation.isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              
              {/* Preview do nome formatado */}
              {newCharacterName.trim() && nameValidation.isValid && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Nome formatado:</span> {NameValidationService.formatCharacterName(newCharacterName)}
                </div>
              )}
              
              {/* Mensagem de erro */}
              {newCharacterName.trim() && !nameValidation.isValid && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {nameValidation.error}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Sugestões de nomes */}
              {nameValidation.suggestions && nameValidation.suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Sugestões de nomes:</p>
                  <div className="flex flex-wrap gap-2">
                    {nameValidation.suggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleNameSuggestionClick(suggestion)}
                        className="text-xs"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Regras de validação */}
              {!newCharacterName.trim() && (
                <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                  <p className="font-medium mb-2">Regras para o nome:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Entre 3 e 20 caracteres</li>
                    <li>Deve começar com uma letra</li>
                    <li>Apenas letras, números, espaços, hífen e apostrofe</li>
                    <li>Não pode ser apenas números</li>
                    <li>Não pode conter palavras ofensivas</li>
                    <li>Máximo 2 números consecutivos</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={resetCreateDialog}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCharacter}
              disabled={!newCharacterName.trim() || !nameValidation.isValid || isCreating}
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