import { useCallback, useEffect, useRef, useState } from 'react';

export type TooltipPosition = 'left' | 'right' | 'bottom';

export function useTooltipPosition() {
  const elementRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>('right');

  const updatePosition = useCallback(() => {
    if (!elementRef.current) return;

    const element = elementRef.current;
    const rect = element.getBoundingClientRect();

    // Encontrar o contêiner grid (pai com classe grid)
    let gridContainer = element.parentElement;
    while (gridContainer && !gridContainer.classList.contains('grid')) {
      gridContainer = gridContainer.parentElement;
    }

    if (!gridContainer) {
      setTooltipPosition('right');
      return;
    }

    const gridRect = gridContainer.getBoundingClientRect();
    const gridWidth = gridRect.width;

    // Calcular posição relativa dentro da grid
    const elementCenterX = rect.left + rect.width / 2;
    const gridStartX = gridRect.left;
    const relativeX = elementCenterX - gridStartX;

    // Dividir a grid em 3 partes iguais
    const firstThird = gridWidth / 3;
    const secondThird = (gridWidth * 2) / 3;

    // Determinar posição baseada na localização dentro da grid
    if (relativeX < firstThird) {
      // Primeira coluna: tooltip à direita
      setTooltipPosition('right');
    } else if (relativeX > secondThird) {
      // Última coluna: tooltip à esquerda
      setTooltipPosition('left');
    } else {
      // Coluna central: tooltip abaixo
      setTooltipPosition('bottom');
    }
  }, []);

  useEffect(() => {
    updatePosition();

    const handleResize = () => updatePosition();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [updatePosition]);

  return {
    elementRef,
    tooltipPosition,
    updatePosition,
  };
}
