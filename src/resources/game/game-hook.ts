'use client';

import { useContext } from 'react';
import { GameContext } from './game-context';

export function useGame() {
  const context = useContext(GameContext);
  
  if (!context) {
    throw new Error('useGame deve ser usado dentro de um GameProvider');
  }
  
  return context;
} 