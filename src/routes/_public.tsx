import { createFileRoute, Outlet } from '@tanstack/react-router';
import PublicOnlyFeature from '@/components/hocs/public-only-feature';
import Footer from '@/components/core/footer';

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <PublicOnlyFeature>
      <main className="flex min-h-screen w-full flex-col">
        <div className="flex flex-1 w-full items-center justify-center p-4">
          <Outlet />
        </div>
        <Footer />
      </main>
    </PublicOnlyFeature>
  );
}
