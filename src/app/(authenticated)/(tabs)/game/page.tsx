'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/resources/auth/auth-hook';
import Link from 'next/link';
import { Info, X, Skull } from 'lucide-react';
import GameInfo from '@/components/game/game-info';

export default function GamePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [showInfo, setShowInfo] = useState(false);

  const handlePlayClick = () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    router.push('/game/play');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <div className="w-full max-w-md text-center mb-8">
        <h1 className="text-4xl font-bold text-primary mb-2">Tower Trials</h1>
        <p className="text-foreground/80">
          Suba a torre mágica, derrote inimigos e alcance o andar mais alto possível!
        </p>
      </div>

      {showInfo ? (
        <div className="w-full max-w-md mb-4">
          <div className="flex justify-end mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-8 w-8"
              onClick={() => setShowInfo(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <GameInfo />
        </div>
      ) : (
        <Card className="w-full max-w-md mb-4">
          <CardHeader>
            <CardTitle className="text-center">Menu Principal</CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Button 
              onClick={handlePlayClick}
              className="w-full py-6 text-lg" 
              size="lg"
            >
              {user ? 'Jogar' : 'Entrar para Jogar'}
            </Button>
            
            <Button 
              onClick={() => router.push('/game/ranking')}
              className="w-full py-6 text-lg" 
              variant="outline" 
              size="lg"
            >
              Ranking
            </Button>

            {user && (
              <Button 
                onClick={() => router.push('/game/cemetery')}
                className="w-full py-4 text-base border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300" 
                variant="ghost"
                size="lg"
              >
                <Skull className="h-5 w-5 mr-2" />
                Cemitério
              </Button>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => setShowInfo(true)}
            >
              <Info className="h-4 w-4" />
              <span>Como Jogar</span>
            </Button>

            {user ? (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{user.username || user.email}</span> | 
                <Link href="/logout" className="text-primary ml-1 hover:underline">
                  Sair
                </Link>
              </div>
            ) : (
              <Link href="/auth">
                <Button variant="ghost" size="sm">
                  Entrar / Criar Conta
                </Button>
              </Link>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
} 