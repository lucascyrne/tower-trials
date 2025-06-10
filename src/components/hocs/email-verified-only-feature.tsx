import { useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/resources/auth/auth-hook';

export function EmailVerifiedOnlyFeature({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const redirectAttempted = useRef(false);
  const lastVerificationStatus = useRef<boolean | null>(null);

  // Usar useLayoutEffect para sincronizar mudanças de estado
  useLayoutEffect(() => {
    if (!user) {
      lastVerificationStatus.current = null;
      redirectAttempted.current = false;
      return;
    }

    const currentVerificationStatus = !!user.email_confirmed_at;

    // Se o status não mudou, não fazer nada
    if (lastVerificationStatus.current === currentVerificationStatus) {
      return;
    }

    lastVerificationStatus.current = currentVerificationStatus;

    // Resetar flag quando o status de verificação muda
    redirectAttempted.current = false;
  }, [user?.email_confirmed_at]);

  useEffect(() => {
    // Apenas executar no lado do cliente
    if (typeof window === 'undefined') {
      return;
    }

    // Se não há usuário, não fazer nada
    if (!user) {
      return;
    }

    // Se email não está verificado e não tentamos redirecionar ainda
    if (!user.email_confirmed_at && !redirectAttempted.current) {
      redirectAttempted.current = true;
      navigate({
        to: '/auth/verify-email',
        search: { auth: 'true' },
        replace: true,
      });
    }
  }, [user, navigate]);

  // Se não há usuário ou email não está verificado, não renderizar
  if (!user || !user.email_confirmed_at) {
    return null;
  }

  return <>{children}</>;
}
