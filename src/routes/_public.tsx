import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
}
