import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

// Lazy load do componente principal
const SpellsPage = lazy(() => import('@/pages/game/SpellsPage'));

export const Route = createFileRoute('/_authenticated/game/play/hub/spells')({
  component: SpellsPage,
  validateSearch: search => ({
    character: (search.character as string) || '',
  }),
});
