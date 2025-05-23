'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CharacterService } from '@/resources/game/character.service';
import { toast } from 'sonner';
import { GameShop } from '@/components/game/EquipmentShop';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Character } from '@/resources/game/models/character.model';

export default function ShopPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSelectedCharacter();
  }, [searchParams.get('character')]);

  const loadSelectedCharacter = async () => {
    const characterId = searchParams.get('character');
    if (!characterId) {
      router.push('/game/play');
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
          description: errorMsg
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao carregar personagem:', error);
      setError(errorMsg);
      toast.error('Erro ao carregar personagem', {
        description: errorMsg
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionComplete = async () => {
    // Recarregar o personagem para atualizar o gold
    await loadSelectedCharacter();
  };

  const handleReturnToHub = () => {
    const characterId = searchParams.get('character');
    if (characterId) {
      router.push(`/game/play/hub?character=${characterId}`);
    } else {
      router.push('/game/play');
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
                <Button
                  onClick={loadSelectedCharacter}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/game/play')}
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
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleReturnToHub}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Hub
          </Button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary mb-1">
              Loja de {character.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Nível {character.level} • Andar {character.floor}
            </p>
          </div>
          
          <div className="w-[120px]"></div> {/* Spacer para centralizar o título */}
        </div>

        <Card>
          <CardContent className="p-6">
            <GameShop 
              character={character} 
              onPurchase={handleTransactionComplete} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 