import { useState, useEffect } from 'react';
import { CharacterAnimation } from '@/components/ui/AssetImage';

interface ThiefIdleAnimationProps {
  className?: string;
  size?: number;
}

export function ThiefIdleAnimation({ className = '', size = 64 }: ThiefIdleAnimationProps) {
  const [currentFrame, setCurrentFrame] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev % 3) + 1);
    }, 600); // Troca de frame a cada 600ms para uma animação suave

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <CharacterAnimation
        character="thief"
        animation="idle"
        frameNumber={currentFrame}
        className="object-contain w-full h-full"
      />
    </div>
  );
}
