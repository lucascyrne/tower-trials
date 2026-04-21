'use client';

import AuthenticatedOnlyFeature from '@/components/hocs/authenticated-only-feature';
import { EmailVerifiedOnlyFeature } from '@/components/hocs/email-verified-only-feature';
import Footer from '@/components/core/footer';
import { useAuth } from '@/resources/auth/auth-hook';
import { Header } from '@/components/core/header';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isBattleLandscapeMobile, setIsBattleLandscapeMobile] = useState(false);

  useEffect(() => {
    const checkBattleLandscapeMobile = () => {
      const isBattleRoute = pathname?.startsWith('/game/play/battle');
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobileLike = window.innerWidth <= 1024 || coarsePointer;
      setIsBattleLandscapeMobile(Boolean(isBattleRoute && isMobileLike && isLandscape));
    };

    checkBattleLandscapeMobile();
    window.addEventListener('resize', checkBattleLandscapeMobile);
    window.addEventListener('orientationchange', checkBattleLandscapeMobile);
    return () => {
      window.removeEventListener('resize', checkBattleLandscapeMobile);
      window.removeEventListener('orientationchange', checkBattleLandscapeMobile);
    };
  }, [pathname]);

  return (
    <div className={isBattleLandscapeMobile ? 'h-screen w-screen overflow-hidden' : 'flex min-h-screen flex-col'}>
      {!isBattleLandscapeMobile && <Header userName={user?.username || 'Usuário'} />}
      <main className={isBattleLandscapeMobile ? 'h-screen w-screen overflow-hidden' : 'flex-1'}>{children}</main>
      {!isBattleLandscapeMobile && <Footer />}
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
