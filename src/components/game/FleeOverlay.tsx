'use client';

import React, { useEffect, useState } from 'react';

interface FleeOverlayProps {
  isVisible: boolean;
  isSuccess: boolean;
  playerName: string;
  enemyName?: string;
  onComplete: () => void;
}

export const FleeOverlay: React.FC<FleeOverlayProps> = ({
  isVisible,
  isSuccess,
  enemyName,
  onComplete
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    // Timer para completar o overlay
    const timer = setTimeout(() => {
      onComplete();
    }, isSuccess ? 3000 : 2500); // 3s para sucesso, 2.5s para falha

    return () => clearTimeout(timer);
  }, [isVisible, isSuccess, onComplete]);

  if (!mounted || !isVisible) return null;

  const getMessage = () => {
    if (isSuccess) {
      return {
        emoji: '🏃‍♂️',
        title: 'Fuga Bem-Sucedida!',
        subtitle: 'Redirecionando para o hub...',
        description: enemyName ? `Você conseguiu fugir de ${enemyName}` : 'Você conseguiu escapar!'
      };
    } else {
      return {
        emoji: '⚔️',
        title: 'Fuga Falhou!',
        subtitle: 'Retornando à batalha...',
        description: enemyName ? `${enemyName} impediu sua fuga` : 'O inimigo impediu sua fuga!'
      };
    }
  };

  const message = getMessage();

  return (
    <div className={`absolute inset-0 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl ${
      isSuccess ? 'bg-green-500/20' : 'bg-red-500/20'
    }`}>
      <div className="text-center space-y-3">
        <div className={`text-2xl ${
          isSuccess ? 'animate-bounce text-green-400' : 'animate-pulse text-red-400'
        }`}>
          {message.emoji}
        </div>
        <div className={`font-bold text-lg ${
          isSuccess ? 'text-green-400' : 'text-red-400'
        }`}>
          {message.title}
        </div>
        <div className="text-muted-foreground text-sm">
          {message.subtitle}
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className={`animate-spin rounded-full h-4 w-4 border-2 border-t-transparent ${
            isSuccess ? 'border-green-400' : 'border-red-400'
          }`}></div>
          <span className={`text-sm ${
            isSuccess ? 'text-green-400' : 'text-red-400'
          }`}>
            Processando...
          </span>
        </div>
        {/* Descrição adicional */}
        <div className="text-xs text-muted-foreground/80 max-w-xs">
          {message.description}
        </div>
      </div>
    </div>
  );
}; 