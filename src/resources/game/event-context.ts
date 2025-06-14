import { createContext } from 'react';

export interface EventContextType {
  interactWithEvent: () => Promise<void>;
}

export const EventContext = createContext<EventContextType | null>(null);
