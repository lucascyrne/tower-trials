import { useState, useEffect } from 'react';
import thiefIdle01 from '@/assets/png/thief/idle/thief-idle-01.png';
import thiefIdle02 from '@/assets/png/thief/idle/thief-idle-02.png';
import thiefIdle03 from '@/assets/png/thief/idle/thief-idle-03.png';

interface ThiefIdleAnimationProps {
  className?: string;
  size?: number;
}

export function ThiefIdleAnimation({ className = '', size = 64 }: ThiefIdleAnimationProps) {
  const [currentFrame, setCurrentFrame] = useState(1);

  const frames = [thiefIdle01, thiefIdle02, thiefIdle03];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev % 3) + 1);
    }, 600); // Troca de frame a cada 500ms para uma animação suave

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <img src={frames[currentFrame - 1]} alt="Thief Idle Animation" className="object-contain" />
    </div>
  );
}
