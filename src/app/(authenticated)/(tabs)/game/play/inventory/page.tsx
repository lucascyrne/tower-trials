'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGame } from '@/resources/game/game-hook';
import { CharacterService } from '@/resources/game/character.service';
import { toast } from 'sonner';
import { InventoryPanel } from '@/components/inventory/InventoryPanel';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Character } from '@/resources/game/models/character.model';

export default function InventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loadCharacterForHub } = useGame();
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [characterLoaded, setCharacterLoaded] = useState(false);

  const loadSelectedCharacter = async (showLoadingSpinner = true, skipCacheCheck = false) => {
    const characterId = searchParams.get('character');
    if (!characterId) {
      router.push('/game/play');
      return;
    }

    // Evitar carregamentos duplicados se não for um refresh manual
    if (!skipCacheCheck && characterLoaded && selectedChar?.id === characterId && !showLoadingSpinner) {
      return;
    }

    if (showLoadingSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
    setError(null);

    try {
      const response = await CharacterService.getCharacter(characterId);
      if (response.success && response.data) {
        setSelectedChar(response.data);
        await loadCharacterForHub(response.data);
        setCharacterLoaded(true);
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSelectedCharacter(true);
  }, [searchParams.get('character')]); // Só executar quando o ID do personagem mudar

  const handleInventoryChange = () => {
    // Atualizar dados sem recarregar a página completa
    loadSelectedCharacter(false, true); // true para skipCacheCheck
  };

  const handleRefresh = () => {
    loadSelectedCharacter(false, true); // true para skipCacheCheck
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
          <h2 className="text-2xl font-bold mb-2">Carregando Inventário</h2>
          <p className="text-muted-foreground">Aguarde enquanto carregamos seus itens...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !selectedChar) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="w-full max-w-md text-center">
          <Card className="p-6">
            <CardHeader>
              <CardTitle className="text-red-500">Erro ao Carregar Inventário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {error || 'Não foi possível carregar o personagem selecionado.'}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => loadSelectedCharacter()}
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
        {/* Header padronizado */}
        <div className="space-y-3 sm:space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReturnToHub}
                className="self-start"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Voltar ao Hub</span>
                <span className="sm:hidden">Voltar</span>
              </Button>
              
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Inventário</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {selectedChar.name} • Nível {selectedChar.level} • {selectedChar.gold} Gold
                </p>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="self-start sm:self-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
              <span className="sm:hidden">{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent>
            <InventoryPanel 
              character={selectedChar} 
              onEquipmentChange={handleInventoryChange} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 