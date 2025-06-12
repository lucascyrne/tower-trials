import { useState, useEffect, useRef, useCallback } from 'react';
import { AssetManager } from '@/utils/asset-utils';

interface OptimizedCharacterAnimationProps {
  character: string;
  animation: string;
  frameNumber: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onFrameChange?: (frameNumber: number) => void;
  transitionDuration?: number; // em ms
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export function OptimizedCharacterAnimation({
  character,
  animation,
  frameNumber,
  size = 'md',
  className = '',
  onFrameChange,
  transitionDuration = 100,
}: OptimizedCharacterAnimationProps) {
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [currentDisplayFrame, setCurrentDisplayFrame] = useState(frameNumber);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousFrameRef = useRef<number>(frameNumber);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pré-carregar animação na primeira renderização
  useEffect(() => {
    const preloadAnimation = async () => {
      try {
        await AssetManager.preloadCharacterAnimation(character, animation, 3);
        setIsPreloaded(true);
      } catch (error) {
        console.warn(
          `[OptimizedCharacterAnimation] Erro ao pré-carregar animação ${character}-${animation}:`,
          error
        );
        setIsPreloaded(true); // Continuar mesmo com erro
      }
    };

    preloadAnimation();
  }, [character, animation]);

  // Renderizar frame atual no canvas com transição suave
  const renderFrame = useCallback(
    (frameNum: number) => {
      if (!canvasRef.current || !isPreloaded) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Obter imagem pré-carregada
      const preloadedImage = AssetManager.getPreloadedAnimationFrame(
        character,
        animation,
        frameNum
      );

      if (preloadedImage) {
        // Usar imagem pré-carregada para renderização instantânea
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(preloadedImage, 0, 0, canvas.width, canvas.height);
      } else {
        // Fallback: usar src diretamente (menos otimizado)
        const imagePath = AssetManager.getCharacterAnimationFrame(character, animation, frameNum);
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = imagePath;
      }
    },
    [character, animation, isPreloaded]
  );

  // Gerenciar mudanças de frame com transição suave
  useEffect(() => {
    if (frameNumber === previousFrameRef.current) return;

    previousFrameRef.current = frameNumber;

    // Limpar timeout anterior se existir
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Se transição está desabilitada ou é a primeira renderização, renderizar imediatamente
    if (transitionDuration <= 0 || currentDisplayFrame === frameNumber) {
      setCurrentDisplayFrame(frameNumber);
      renderFrame(frameNumber);
      onFrameChange?.(frameNumber);
      return;
    }

    // Aplicar transição suave
    setCurrentDisplayFrame(frameNumber);

    // Pequeno delay para permitir que o CSS processe a mudança
    transitionTimeoutRef.current = setTimeout(() => {
      renderFrame(frameNumber);
      onFrameChange?.(frameNumber);
    }, transitionDuration / 2);
  }, [frameNumber, currentDisplayFrame, renderFrame, onFrameChange, transitionDuration]);

  // Renderizar frame inicial quando pré-carregamento completar
  useEffect(() => {
    if (isPreloaded) {
      renderFrame(currentDisplayFrame);
    }
  }, [isPreloaded, renderFrame, currentDisplayFrame]);

  // Limpeza de efeitos
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  if (!isPreloaded) {
    // Loading state com placeholder
    return (
      <div
        className={`${sizeClasses[size]} ${className} bg-slate-700/50 animate-pulse rounded flex items-center justify-center`}
        aria-label="Carregando animação..."
      >
        <div className="text-slate-500 text-xs">...</div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`${sizeClasses[size]} ${className} transition-opacity duration-${transitionDuration}`}
      width={64}
      height={64}
      style={{
        imageRendering: 'pixelated', // Para pixel art
        // imageRendering: 'crisp-edges',
      }}
      aria-label={`${character} ${animation} animation - frame ${frameNumber}`}
    />
  );
}
