import { useState, useEffect } from 'react';
import { OptimizedCharacterAnimation } from '@/components/ui/optimized-character-animation';

interface ThiefIdleAnimationProps {
  className?: string;
  size?: number;
}

export function ThiefIdleAnimation({ className = '', size = 64 }: ThiefIdleAnimationProps) {
  const [currentFrame, setCurrentFrame] = useState(1);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev % 3) + 1);
    }, 600); // Troca de frame a cada 600ms para uma animação suave

    return () => clearInterval(interval);
  }, [isAnimating]);

  const handleFrameChange = (frameNumber: number) => {
    // Callback opcional para debug ou efeitos adicionais
    console.debug(`[ThiefIdleAnimation] Frame changed to: ${frameNumber}`);
  };

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      onMouseEnter={() => setIsAnimating(true)}
      onMouseLeave={() => setIsAnimating(true)} // Manter sempre animando
    >
      <OptimizedCharacterAnimation
        character="thief"
        animation="idle"
        frameNumber={currentFrame}
        size="xl"
        className="w-full h-full object-contain"
        onFrameChange={handleFrameChange}
        transitionDuration={150} // Transição suave de 150ms
      />
    </div>
  );
}
