import { useState, useEffect } from 'react';
import { OptimizedCharacterAnimation } from '@/components/ui/optimized-character-animation';

// Import direto das imagens para garantir que o Vite as processe corretamente
import thiefIdle01 from '@/assets/characters/thief/idle/thief-idle-01.png';
import thiefIdle02 from '@/assets/characters/thief/idle/thief-idle-02.png';
import thiefIdle03 from '@/assets/characters/thief/idle/thief-idle-03.png';

interface ThiefIdleAnimationProps {
  className?: string;
  size?: number;
}

export function ThiefIdleAnimation({ className = '', size = 64 }: ThiefIdleAnimationProps) {
  const [currentFrame, setCurrentFrame] = useState(1);
  const [isAnimating, setIsAnimating] = useState(true);

  // Mapeamento dos frames para imports diretos (funciona em produção)
  const frameImages = {
    1: thiefIdle01,
    2: thiefIdle02,
    3: thiefIdle03,
  };

  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev % 3) + 1);
    }, 600); // Troca de frame a cada 600ms para uma animação suave

    return () => clearInterval(interval);
  }, [isAnimating]);

  const currentImageSrc = frameImages[currentFrame as keyof typeof frameImages];

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      onMouseEnter={() => setIsAnimating(true)}
      onMouseLeave={() => setIsAnimating(true)} // Manter sempre animando
    >
      <img
        src={currentImageSrc}
        alt={`Thief idle animation frame ${currentFrame}`}
        className="w-full h-full object-contain transition-opacity duration-150"
        style={{ imageRendering: 'pixelated' }} // Para manter qualidade pixel art
      />
    </div>
  );
}
