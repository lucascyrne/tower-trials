'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Skull } from 'lucide-react';
import { CharacterSelect } from '@/components/game/CharacterSelect';

export default function GamePlayPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-4">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header padronizado */}
        <div className="space-y-3 sm:space-y-4 mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2 justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/game')}
                className="self-start"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Voltar ao Menu</span>
                <span className="sm:hidden">Voltar</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/game/cemetery')}
                className="self-start sm:self-end border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300"
              >
                <Skull className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Ver Cemitério</span>
                <span className="sm:hidden">Cemitério</span>
              </Button>
            </div>
            
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Selecionar Personagem</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Escolha um personagem para iniciar sua aventura
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <CharacterSelect />
        </div>
      </div>
    </div>
  );
} 