import { useContext } from 'react';
import { EventContext, type EventContextType } from './event-context';

export function useEvent(): EventContextType {
  const context = useContext(EventContext);

  if (!context) {
    throw new Error('useEvent deve ser usado dentro de um EventProvider');
  }

  return context;
}
