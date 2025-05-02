'use client';

import AuthenticatedOnlyFeature from '@/components/hocs/authenticated-only-feature';
import { EmailVerifiedOnlyFeature } from '@/components/hocs/email-verified-only-feature';
import Footer from '@/components/core/footer';
import { useAuth } from '@/resources/auth/auth-hook';
import { Header } from '@/components/core/header';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header userName={user?.username || 'Usuário'} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function AuthenticatedLayoutWrapper({ children }: AuthenticatedLayoutProps) {
  return (
    <AuthenticatedOnlyFeature>
      <EmailVerifiedOnlyFeature>
        <AuthenticatedLayout>{children}</AuthenticatedLayout>
      </EmailVerifiedOnlyFeature>
    </AuthenticatedOnlyFeature>
  );
}
