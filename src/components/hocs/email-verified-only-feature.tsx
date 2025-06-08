import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/resources/auth/auth-hook';

export function EmailVerifiedOnlyFeature({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !user.email_confirmed_at) {
      navigate({ to: '/auth/verify-email', search: { auth: location.pathname + location.search } });
    }
  }, [user, navigate]);

  if (!user || !user.email_confirmed_at) {
    return null;
  }

  return <>{children}</>;
}
