'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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
  playerName,
  enemyName,
  onComplete
}) => {
  const [mounted, setMounted] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    // Fase de entrada
    setAnimationPhase('enter');
    
    // Fase de exibição
    const showTimer = setTimeout(() => {
      setAnimationPhase('show');
    }, 200);

    // Fase de saída e callback
    const exitTimer = setTimeout(() => {
      setAnimationPhase('exit');
      setTimeout(() => {
        onComplete();
      }, 300);
    }, isSuccess ? 4000 : 3000); // 4s para sucesso, 3s para falha

    return () => {
      clearTimeout(showTimer);
      clearTimeout(exitTimer);
    };
  }, [isVisible, isSuccess]);

  if (!mounted || !isVisible) return null;

  const getBackgroundGradient = () => {
    if (isSuccess) {
      return 'bg-gradient-to-br from-green-900/95 via-green-800/90 to-green-700/85';
    } else {
      return 'bg-gradient-to-br from-red-900/95 via-red-800/90 to-red-700/85';
    }
  };

  const getEmoji = () => isSuccess ? '🏃‍♂️' : '😵';
  
  const getMessage = () => {
    if (isSuccess) {
      return {
        title: 'Fuga Bem-Sucedida!',
        subtitle: `${playerName} escapou da batalha!`,
        description: enemyName ? `Você conseguiu fugir de ${enemyName}` : 'Você conseguiu escapar!'
      };
    } else {
      return {
        title: 'Fuga Falhou!',
        subtitle: `${playerName} não conseguiu escapar!`,
        description: enemyName ? `${enemyName} impediu sua fuga` : 'O inimigo impediu sua fuga!'
      };
    }
  };

  const message = getMessage();

  const overlayContent = (
    <div
      className={`
        fixed inset-0 z-[9999] flex items-center justify-center
        ${getBackgroundGradient()}
        transition-all duration-300 ease-out
        ${animationPhase === 'enter' ? 'opacity-0 scale-95' : ''}
        ${animationPhase === 'show' ? 'opacity-100 scale-100' : ''}
        ${animationPhase === 'exit' ? 'opacity-0 scale-105' : ''}
      `}
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      {/* Efeito de partículas/ruído de fundo */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_1px,_transparent_1px)] bg-[length:50px_50px] animate-pulse"></div>
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10 text-center px-8 max-w-md mx-auto">
        {/* Emoji animado */}
        <div 
          className={`
            text-8xl mb-6 transition-all duration-500 ease-out
            ${animationPhase === 'show' ? (isSuccess ? 'animate-bounce' : 'animate-pulse') : 'scale-0'}
          `}
        >
          {getEmoji()}
        </div>

        {/* Título principal */}
        <h1 
          className={`
            text-4xl font-bold mb-3 transition-all duration-500 delay-100
            ${isSuccess ? 'text-green-100' : 'text-red-100'}
            ${animationPhase === 'show' ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
          `}
        >
          {message.title}
        </h1>

        {/* Subtítulo */}
        <p 
          className={`
            text-xl mb-2 transition-all duration-500 delay-200
            ${isSuccess ? 'text-green-200' : 'text-red-200'}
            ${animationPhase === 'show' ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
          `}
        >
          {message.subtitle}
        </p>

        {/* Descrição */}
        <p 
          className={`
            text-base opacity-80 mb-6 transition-all duration-500 delay-300
            ${isSuccess ? 'text-green-300' : 'text-red-300'}
            ${animationPhase === 'show' ? 'translate-y-0 opacity-80' : 'translate-y-4 opacity-0'}
          `}
        >
          {message.description}
        </p>

        {/* Indicador de progresso */}
        <div 
          className={`
            w-64 h-1 mx-auto rounded-full bg-white/20 overflow-hidden transition-all duration-500 delay-400
            ${animationPhase === 'show' ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
          `}
        >
          <div 
            className={`
              h-full rounded-full transition-all ease-linear
              ${isSuccess ? 'bg-green-300' : 'bg-red-300'}
            `}
            style={{
              width: '100%',
              animation: `progressBar ${isSuccess ? '4000' : '3000'}ms linear forwards`
            }}
          />
        </div>

        {/* Mensagem adicional */}
        <p 
          className={`
            text-sm mt-4 opacity-60 transition-all duration-500 delay-500
            ${isSuccess ? 'text-green-400' : 'text-red-400'}
            ${animationPhase === 'show' ? 'translate-y-0 opacity-60' : 'translate-y-4 opacity-0'}
          `}
        >
          {isSuccess ? 'Redirecionando para o hub...' : 'Retornando à batalha...'}
        </p>
      </div>

      <style jsx>{`
        @keyframes progressBar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );

  // Usar portal para renderizar no body e garantir que cubra tudo
  return createPortal(overlayContent, document.body);
}; 