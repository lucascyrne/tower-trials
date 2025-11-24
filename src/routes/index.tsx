import { createFileRoute } from '@tanstack/react-router';
import RootRedirectWrapper from '@/components/hocs/root-redirect';

export const Route = createFileRoute('/')({
  component: RootComponent,
});

function RootComponent() {
  return <RootRedirectWrapper />;
}
