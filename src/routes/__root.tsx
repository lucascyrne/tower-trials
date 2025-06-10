import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import ContextSkeleton from '../context-skeleton';
import '../index.css';

export const Route = createRootRoute({
  component: () => (
    <ContextSkeleton>
      <Outlet />
      <TanStackRouterDevtools />
    </ContextSkeleton>
  ),
});
