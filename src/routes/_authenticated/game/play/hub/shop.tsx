import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CharacterService } from '@/resources/game/character.service';
import { toast } from 'sonner';
import { GameShop } from '@/components/shop/EquipmentShop';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import type { Character } from '@/resources/game/models/character.model';

function ShopPage() {
  const navigate = useNavigate();
  const { character: characterId } = Route.useSearch();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSelectedCharacter();
  }, [characterId]);

  const loadSelectedCharacter = async () => {
    if (!characterId) {
      navigate({ to: '/game/play' });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await CharacterService.getCharacter(characterId);
      if (response.success && response.data) {
        setCharacter(response.data);
      } else {
        const errorMsg = response.error || 'Erro desconhecido ao carregar personagem';
        setError(errorMsg);
        toast.error('Erro ao carregar personagem', {
          description: errorMsg,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao carregar personagem:', error);
      setError(errorMsg);
      toast.error('Erro ao carregar personagem', {
        description: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionComplete = async (newGold: number) => {
    // Atualizar apenas o gold do personagem no estado local, sem recarregar toda a página
    if (character) {
      setCharacter(prevCharacter => ({
        ...prevCharacter!,
        gold: newGold,
      }));
    }
  };

  const handleReturnToHub = () => {
    if (characterId) {
      navigate({ to: '/game/play/hub', search: { character: characterId } });
    } else {
      navigate({ to: '/game/play' });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Carregando Loja</h2>
          <p className="text-muted-foreground">Aguarde enquanto carregamos os itens...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !character) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="w-full max-w-md text-center">
          <Card className="p-6">
            <CardHeader>
              <CardTitle className="text-red-500">Erro ao Carregar Loja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {error || 'Não foi possível carregar o personagem selecionado.'}
              </p>
              <div className="flex gap-2">
                <Button onClick={loadSelectedCharacter} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: '/game/play' })}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <div className="w-full max-w-7xl">
        {/* Header padronizado */}
        <div className="space-y-3 sm:space-y-4 mb-6">
          <div className="flex flex-col gap-3">
            <Button variant="outline" size="sm" onClick={handleReturnToHub} className="self-start">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Voltar ao Hub</span>
              <span className="sm:hidden">Voltar</span>
            </Button>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Loja</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {character.name} • Nível {character.level} • Andar {character.floor}
              </p>
            </div>
          </div>
        </div>

        <GameShop character={character} onPurchase={handleTransactionComplete} />
      </div>
    </div>
  );
}

export const Route = createFileRoute('/_authenticated/game/play/hub/shop')({
  component: ShopPage,
  validateSearch: search => ({
    character: (search.character as string) || '',
  }),
});
