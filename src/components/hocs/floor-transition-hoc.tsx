import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/resources/game/game-hook';

const isDev = process.env.NODE_ENV === 'development';
function logFloorTransition(...args: unknown[]) {
  if (isDev) console.log(...args);
}

interface FloorTransitionProps {
  children?: React.ReactNode;
}

export function withFloorTransition<T>(Component: React.ComponentType<T>) {
  return function WithFloorTransition(props: T & FloorTransitionProps) {
    const { gameState } = useGame();
    const [showTransition, setShowTransition] = useState(false);
    const [transitionData, setTransitionData] = useState<{
      sourceFloor: number;
      targetFloor: number;
      description: string | null;
    } | null>(null);

    const lastPlayerFloorRef = useRef<number | null>(null);
    const isTransitioningRef = useRef(false);
    const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (lastPlayerFloorRef.current === null) {
        lastPlayerFloorRef.current = gameState.player.floor;
        logFloorTransition(`[FloorTransition] Andar inicial: ${gameState.player.floor}`);
      }
    }, [gameState.player.floor]);

    const skipTransition = useCallback(() => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
      setShowTransition(false);
      isTransitioningRef.current = false;
      logFloorTransition('[FloorTransition] Transição pulada pelo usuário');
    }, []);

    useEffect(() => {
      const currentFloor = gameState.player.floor;
      const lastFloor = lastPlayerFloorRef.current;

      logFloorTransition(
        `[FloorTransition] Verificando mudança: último=${lastFloor}, atual=${currentFloor}, inTransição=${isTransitioningRef.current}`,
      );

      if (lastFloor === null || currentFloor === lastFloor) {
        return;
      }

      if (currentFloor <= lastFloor || isTransitioningRef.current) {
        logFloorTransition(
          `[FloorTransition] Ignorando mudança: retrocesso=${currentFloor <= lastFloor}, emTransição=${isTransitioningRef.current}`,
        );
        return;
      }

      logFloorTransition(`[FloorTransition] Detectada mudança válida de andar: ${lastFloor} → ${currentFloor}`);

      isTransitioningRef.current = true;

      setTransitionData({
        sourceFloor: lastFloor,
        targetFloor: currentFloor,
        description: gameState.currentFloor?.description || `Andar ${currentFloor}`,
      });

      setShowTransition(true);

      transitionTimerRef.current = setTimeout(() => {
        setShowTransition(false);
        isTransitioningRef.current = false;
        logFloorTransition(`[FloorTransition] Transição automática concluída para andar ${currentFloor}`);
      }, 3000);

      lastPlayerFloorRef.current = currentFloor;
    }, [gameState.player.floor, gameState.currentFloor?.description]);

    useEffect(() => {
      return () => {
        if (transitionTimerRef.current) {
          clearTimeout(transitionTimerRef.current);
        }
      };
    }, []);

    return (
      <>
        {showTransition && transitionData ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/95"
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center"
            >
              <h1 className="mb-4 text-4xl font-bold">Andar {transitionData.targetFloor}</h1>
              <p className="mb-6 text-xl text-muted-foreground">{transitionData.description}</p>

              <motion.button
                className="rounded-md bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                onClick={skipTransition}
              >
                Continuar
              </motion.button>
            </motion.div>
          </motion.div>
        ) : (
          <Component {...props} />
        )}
      </>
    );
  };
}
