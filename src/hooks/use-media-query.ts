import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Para versões mais antigas do Safari
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      media.addListener(listener);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query]);

  return matches;
}

// Hook específico para detectar mobile landscape (inclui iPhone XR e similares)
export function useMobileLandscape(): boolean {
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMobileLandscape = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Detectar mobile landscape baseado em:
      // 1. Largura maior que altura (landscape)
      // 2. Altura menor que 500px (mobile)
      // 3. Largura menor que 1024px (não desktop)
      const isLandscape = width > height;
      const isMobileHeight = height <= 500;
      const isNotDesktop = width <= 1024;

      setIsMobileLandscape(isLandscape && isMobileHeight && isNotDesktop);
    };

    checkMobileLandscape();

    window.addEventListener('resize', checkMobileLandscape);
    window.addEventListener('orientationchange', () => {
      // Delay para aguardar a mudança de orientação completar
      setTimeout(checkMobileLandscape, 100);
    });

    return () => {
      window.removeEventListener('resize', checkMobileLandscape);
      window.removeEventListener('orientationchange', checkMobileLandscape);
    };
  }, []);

  return isMobileLandscape;
}
