import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/resources/auth/auth-hook';
import {
  type LoginFormValues,
  type RegisterFormValues,
  type SignUpDTO,
} from '@/resources/auth/auth-model';
import { LoginForm, RegisterForm } from '@/features/auth/auth-forms';
import { AuthCard } from '@/components/ui/auth-card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const Route = createFileRoute('/_public/auth')({
  component: AuthPage,
  validateSearch: search => ({
    auth: (search.auth as string) || '',
  }),
});

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { signInWithEmail, signUpWithEmail, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { auth } = Route.useSearch();

  useEffect(() => {
    // Redirecionar se já estiver autenticado
    if (isAuthenticated) {
      let redirectTo = '/game';

      // Decodificar o parâmetro auth se existir e for válido
      if (auth && typeof auth === 'string' && auth.trim() !== '' && auth !== 'true') {
        try {
          const decodedPath = decodeURIComponent(auth);
          // Validar se é um path válido
          if (
            decodedPath &&
            decodedPath.startsWith('/') &&
            !decodedPath.includes('[object') &&
            !decodedPath.startsWith('/auth')
          ) {
            redirectTo = decodedPath;
          }
        } catch (error) {
          console.warn('Erro ao decodificar parâmetro auth:', error);
          redirectTo = '/game';
        }
      }

      navigate({ to: redirectTo });
    }
  }, [isAuthenticated, auth, navigate]);

  const handleLogin = async (data: LoginFormValues) => {
    try {
      const result = await signInWithEmail(data);

      if (!result.success) {
        toast.error('Erro ao fazer login', {
          description: result.error || 'Ocorreu um erro inesperado',
        });
      }
    } catch (error) {
      toast.error('Erro ao fazer login', {
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado',
      });
    }
  };

  const handleRegister = async (formData: RegisterFormValues) => {
    try {
      const signUpData: SignUpDTO = {
        email: formData.email,
        password: formData.password,
        username: formData.email.split('@')[0],
      };

      const result = await signUpWithEmail(signUpData);

      if (result.success) {
        toast.success('Conta criada com sucesso', {
          description: 'Por favor, verifique seu e-mail para confirmar sua conta.',
        });
        navigate({ to: '/auth/verify-email', search: { auth: 'true' } });
      } else if (result.error && result.error.includes('Email rate limit')) {
        toast.success('Conta criada com sucesso', {
          description: 'Por favor, verifique seu e-mail para confirmar sua conta.',
        });
        navigate({ to: '/auth/verify-email', search: { auth: 'true' } });
      } else {
        toast.error('Erro ao criar conta', {
          description: result.error || 'Ocorreu um erro inesperado',
        });
      }
    } catch (error) {
      toast.error('Erro ao criar conta', {
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-background/95 to-background/90 transition-colors duration-300">
      <AuthCard className="w-full max-w-md">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {isLogin ? 'Login' : 'Criar Conta'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLogin
                ? 'Entre com suas credenciais para acessar o sistema'
                : 'Preencha os dados abaixo para criar sua conta'}
            </p>
          </div>

          {isLogin ? (
            <LoginForm onSubmit={handleLogin} isLoading={loading.signIn} />
          ) : (
            <RegisterForm onSubmit={handleRegister} isLoading={loading.signUp} />
          )}

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setIsLogin(!isLogin)}
            disabled={loading.signIn || loading.signUp}
          >
            {isLogin ? 'Não tem uma conta? Criar conta' : 'Já tem uma conta? Fazer login'}
          </Button>
        </div>
      </AuthCard>
    </div>
  );
}
