import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/resources/game/game-hook';

interface FloorTransitionProps {
  children?: React.ReactNode;
}

export function withFloorTransition<T>(Component: React.ComponentType<T>) {
  return function WithFloorTransition(props: T & FloorTransitionProps) {
    const { gameState, addGameLogMessage } = useGame();
    const [showTransition, setShowTransition] = useState(false);
    const [transitionData, setTransitionData] = useState<{
      sourceFloor: number;
      targetFloor: number;
      description: string | null;
    } | null>(null);
    
    const isTransitioning = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastPlayerFloorRef = useRef<number | null>(null);
    
    // Inicializar o andar de referência na primeira renderização
    useEffect(() => {
      if (lastPlayerFloorRef.current === null) {
        lastPlayerFloorRef.current = gameState.player.floor;
      }
    }, [gameState.player.floor]);
    
    // Efeito para monitorar mudanças de andar
    useEffect(() => {
      // Garantir que temos uma referência de andar válida
      if (lastPlayerFloorRef.current === null) {
        lastPlayerFloorRef.current = gameState.player.floor;
        return;
      }
      
      // Verificar se o andar mudou e se não estamos em transição
      const currentFloor = gameState.player.floor;
      const lastFloor = lastPlayerFloorRef.current;
      
      if (currentFloor !== lastFloor && !isTransitioning.current) {
        console.log(`Iniciando transição: ${lastFloor} -> ${currentFloor}`);
        
        // Evitar múltiplas transições
        isTransitioning.current = true;
        
        // Capturar os dados necessários para a transição
        setTransitionData({
          sourceFloor: lastFloor,
          targetFloor: currentFloor,
          description: gameState.currentFloor?.description || null
        });
        
        // Registrar a mudança no log apenas se for para um andar maior (avanço)
        if (currentFloor > lastFloor) {
          addGameLogMessage(`Mudando do Andar ${lastFloor} para o Andar ${currentFloor}...`, 'system');
        }
        
        // Mostrar a transição
        setShowTransition(true);
        
        // Configurar os timers
        setupTimers();
        
        // Atualizar a referência de andar
        lastPlayerFloorRef.current = currentFloor;
      }
    }, [gameState.player.floor, gameState.currentFloor]);
    
    // Configurar timers para a transição
    const setupTimers = () => {
      // Limpar timers existentes por segurança
      clearTimers();
      
      // Timer de segurança (4 segundos)
      safetyTimerRef.current = setTimeout(() => {
        console.log('Safety timeout triggered for floor transition');
        finishTransition();
      }, 4000);
      
      // Timer padrão (2 segundos)
      timerRef.current = setTimeout(() => {
        finishTransition();
      }, 2000);
    };
    
    // Função para limpar os timers
    const clearTimers = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
    };
    
    // Função para finalizar a transição
    const finishTransition = () => {
      // Limpar timers
      clearTimers();
      
      // Ocultar a interface de transição
      setShowTransition(false);
      
      // Permitir novas transições
      isTransitioning.current = false;
      
      // Debug log
      console.log(`Transição concluída para o andar ${gameState.player.floor}`);
    };
    
    // Limpar timers ao desmontar
    useEffect(() => {
      return () => {
        clearTimers();
      };
    }, []);
    
    return (
      <>
        {showTransition && transitionData ? (
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
              <h1 className="text-4xl font-bold mb-4">
                Andar {transitionData.targetFloor}
              </h1>
              <p className="text-xl text-muted-foreground">
                {transitionData.description || 'Avançando para o próximo andar...'}
              </p>
              
              {/* Botão para prosseguir caso haja algum problema */}
              <motion.button
                className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                onClick={finishTransition}
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