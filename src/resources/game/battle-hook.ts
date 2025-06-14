import { useContext } from 'react';
import { BattleContext, type BattleContextType } from './battle.provider';

export function useBattle(): BattleContextType {
  const context = useContext(BattleContext);

  if (!context) {
    throw new Error('useBattle deve ser usado dentro de um BattleProvider');
  }

  return context;
}
