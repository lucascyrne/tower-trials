import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/resources/game/game-hook';

interface FloorTransitionProps {
  children?: React.ReactNode;
}

export function withFloorTransition<T>(Component: React.ComponentType<T>) {
  return React.memo(function WithFloorTransition(props: T & FloorTransitionProps) {
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

    // Memoizar dados do player para evitar re-renderizações desnecessárias
    const playerData = useMemo(
      () => ({
        floor: gameState.player.floor,
        floorDescription: gameState.currentFloor?.description,
      }),
      [gameState.player.floor, gameState.currentFloor?.description]
    );

    // Inicializar o andar de referência na primeira renderização
    useEffect(() => {
      if (lastPlayerFloorRef.current === null && playerData.floor) {
        lastPlayerFloorRef.current = playerData.floor;
        console.log(`[FloorTransition] Andar inicial: ${playerData.floor}`);
      }
    }, [playerData.floor]);

    // Memoizar função de pular transição
    const skipTransition = useCallback(() => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      setShowTransition(false);
      isTransitioningRef.current = false;
      console.log('[FloorTransition] Transição pulada pelo usuário');
    }, []);

    // Monitorar mudanças de andar - otimizado
    useEffect(() => {
      const currentFloor = playerData.floor;
      const lastFloor = lastPlayerFloorRef.current;

      // Ignorar se ainda não temos referência ou se não houve mudança real
      if (lastFloor === null || currentFloor === lastFloor) {
        return;
      }

      // Ignorar retrocessos ou se já estamos em transição
      if (currentFloor <= lastFloor || isTransitioningRef.current) {
        console.log(
          `[FloorTransition] Ignorando mudança: retrocesso=${currentFloor <= lastFloor}, emTransição=${isTransitioningRef.current}`
        );
        return;
      }

      console.log(
        `[FloorTransition] Detectada mudança válida de andar: ${lastFloor} → ${currentFloor}`
      );

      // Iniciar transição
      isTransitioningRef.current = true;

      // Configurar dados da transição
      setTransitionData({
        sourceFloor: lastFloor,
        targetFloor: currentFloor,
        description: playerData.floorDescription || `Andar ${currentFloor}`,
      });

      // Mostrar transição
      setShowTransition(true);

      // Timer para ocultar transição automaticamente
      transitionTimerRef.current = setTimeout(() => {
        setShowTransition(false);
        isTransitioningRef.current = false;
        console.log(`[FloorTransition] Transição automática concluída para andar ${currentFloor}`);
      }, 3000);

      // Atualizar referência
      lastPlayerFloorRef.current = currentFloor;
    }, [playerData.floor, playerData.floorDescription]);

    // Cleanup
    useEffect(() => {
      return () => {
        if (transitionTimerRef.current) {
          clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = null;
        }
      };
    }, []);

    // Memoizar componente de transição
    const transitionComponent = useMemo(() => {
      if (!showTransition || !transitionData) return null;

      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-50 bg-background/95"
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <h1 className="text-4xl font-bold mb-4">Andar {transitionData.targetFloor}</h1>
            <p className="text-xl text-muted-foreground mb-6">{transitionData.description}</p>

            <motion.button
              className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              onClick={skipTransition}
            >
              Continuar
            </motion.button>
          </motion.div>
        </motion.div>
      );
    }, [showTransition, transitionData, skipTransition]);

    return (
      <>
        {transitionComponent}
        {!showTransition && <Component {...props} />}
      </>
    );
  });
}
