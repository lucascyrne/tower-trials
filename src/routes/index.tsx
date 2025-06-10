import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // Esta verificação será feita no contexto de autenticação
    // Por enquanto, vamos redirecionar para o jogo (se autenticado) ou auth (se não)
    throw redirect({
      to: '/game',
    });
  },
});
