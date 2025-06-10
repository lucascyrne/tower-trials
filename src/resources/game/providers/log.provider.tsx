import { type ReactNode, createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { GameLogEntry, GameLogType } from '../game-model';

interface LogContextType {
  gameMessage: string;
  gameLog: GameLogEntry[];
  addGameLogMessage: (message: string, type?: GameLogType) => void;
  setGameMessage: (message: string) => void;
}

const LogContext = createContext<LogContextType | null>(null);

interface LogProviderProps {
  children: ReactNode;
}

export function LogProvider({ children }: LogProviderProps) {
  const [gameMessage, setGameMessage] = useState<string>('');
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);

  // Função para adicionar mensagens ao log do jogo
  const addGameLogMessage = useCallback((message: string, type: GameLogType = 'system') => {
    setGameLog(prev => {
      const recentLogs = prev.slice(-5);
      const isDuplicate = recentLogs.some(log => log.text === message && log.type === type);
      
      if (isDuplicate) {
        return prev;
      }
      
      return [...prev, { text: message, type }];
    });
  }, []);

  const contextValue = useMemo<LogContextType>(
    () => ({
      gameMessage,
      gameLog,
      addGameLogMessage,
      setGameMessage,
    }),
    [gameMessage, gameLog, addGameLogMessage, setGameMessage]
  );

  return (
    <LogContext.Provider value={contextValue}>
      {children}
    </LogContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export function useGameLog() {
  const context = useContext(LogContext);
  
  if (!context) {
    throw new Error('useGameLog deve ser usado dentro de um LogProvider');
  }
  
  return context;
} 