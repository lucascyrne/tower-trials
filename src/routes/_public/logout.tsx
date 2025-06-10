import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '@/resources/auth/auth-hook';
import { useNavigate } from '@tanstack/react-router';
import LoadingSpin from '@/components/ui/loading-sping';
import { toast } from 'sonner';

export const Route = createFileRoute('/_public/logout')({
  component: LogoutPage,
});

function LogoutPage() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleLogout = async () => {
      if (user) {
        toast.info('Encerrando sessão...');
        await signOut();
      }

      // Aguardar um momento para garantir que o logout foi processado
      setTimeout(() => {
        navigate({ to: '/auth', search: { auth: 'true' } });
      }, 1000);
    };

    handleLogout();
  }, [signOut, navigate, user]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <LoadingSpin />
        <p className="text-muted-foreground">Encerrando sessão...</p>
      </div>
    </div>
  );
}
