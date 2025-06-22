import { createFileRoute, Outlet } from '@tanstack/react-router';
import AuthenticatedOnlyFeature from '@/components/hocs/authenticated-only-feature';
import { EmailVerifiedOnlyFeature } from '@/components/hocs/email-verified-only-feature';
import Footer from '@/components/core/footer';
import { useAuth } from '@/resources/auth/auth-hook';
import { Header } from '@/components/core/header';
import { useLocation } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
});

function AuthenticatedLayoutInner() {
  const { user } = useAuth();
  const location = useLocation();

  // Omitir header e footer nas páginas de jogo
  const isGamePage = location.pathname.startsWith('/game');

  if (isGamePage) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <main className="flex-1 w-full pt-0 pb-0 md:pt-6 md:pb-6">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header userName={user?.username || 'Usuário'} />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function AuthenticatedLayout() {
  return (
    <AuthenticatedOnlyFeature>
      <EmailVerifiedOnlyFeature>
        <AuthenticatedLayoutInner />
      </EmailVerifiedOnlyFeature>
    </AuthenticatedOnlyFeature>
  );
}
