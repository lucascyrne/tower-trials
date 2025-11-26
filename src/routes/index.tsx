import { createFileRoute } from '@tanstack/react-router';
import RootRedirectWrapper from '@/components/hocs/root-redirect';

export const Route = createFileRoute('/')({
  component: RootComponent,
});

/**
 * Componente raiz ("/") que redireciona automaticamente baseado no estado de autenticação:
 * - Usuário autenticado → /game (área de jogo)
 * - Usuário não autenticado → /home (página inicial)
 */
function RootComponent() {
  return <RootRedirectWrapper />;
}
