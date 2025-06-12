import { useEffect, useState } from 'react';
import { AssetManager } from '@/utils/asset-utils';

interface AssetPreloadState {
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  progress: number; // 0-100
}

interface UseAssetPreloaderOptions {
  preloadCritical?: boolean;
  preloadAnimations?: Array<{
    character: string;
    animation: string;
    frameCount?: number;
  }>;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useAssetPreloader(options: UseAssetPreloaderOptions = {}) {
  const {
    preloadCritical = true,
    preloadAnimations = [],
    onProgress,
    onComplete,
    onError,
  } = options;

  const [state, setState] = useState<AssetPreloadState>({
    isLoading: false,
    hasLoaded: false,
    error: null,
    progress: 0,
  });

  useEffect(() => {
    if (!preloadCritical && preloadAnimations.length === 0) return;

    let isMounted = true;
    let totalTasks = 0;
    let completedTasks = 0;

    const updateProgress = () => {
      if (!isMounted) return;

      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      setState(prev => ({ ...prev, progress }));
      onProgress?.(progress);

      if (completedTasks >= totalTasks) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          hasLoaded: true,
          progress: 100,
        }));
        onComplete?.();
      }
    };

    const preloadAssets = async () => {
      if (!isMounted) return;

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        // Calcular total de tarefas
        if (preloadCritical) totalTasks++;
        totalTasks += preloadAnimations.length;

        // Pré-carregar assets críticos
        if (preloadCritical) {
          try {
            await AssetManager.preloadCriticalAssets();
            if (isMounted) {
              completedTasks++;
              updateProgress();
            }
          } catch (error) {
            console.warn('Erro ao pré-carregar assets críticos:', error);
            if (isMounted) {
              completedTasks++; // Continuar mesmo com erro
              updateProgress();
            }
          }
        }

        // Pré-carregar animações específicas
        for (const animConfig of preloadAnimations) {
          if (!isMounted) break;

          try {
            await AssetManager.preloadCharacterAnimation(
              animConfig.character,
              animConfig.animation,
              animConfig.frameCount || 3
            );

            if (isMounted) {
              completedTasks++;
              updateProgress();
            }
          } catch (error) {
            console.warn(
              `Erro ao pré-carregar animação ${animConfig.character}-${animConfig.animation}:`,
              error
            );
            if (isMounted) {
              completedTasks++; // Continuar mesmo com erro
              updateProgress();
            }
          }
        }
      } catch (error) {
        if (isMounted) {
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: errorMessage,
          }));
          onError?.(errorMessage);
        }
      }
    };

    preloadAssets();

    return () => {
      isMounted = false;
    };
  }, [preloadCritical, preloadAnimations, onProgress, onComplete, onError]);

  return {
    ...state,
    retry: () => {
      setState({
        isLoading: false,
        hasLoaded: false,
        error: null,
        progress: 0,
      });
    },
  };
}
