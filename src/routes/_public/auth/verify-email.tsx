import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/resources/auth/auth-hook';

export const Route = createFileRoute('/_public/auth/verify-email')({
  component: VerifyEmailPage,
  validateSearch: search => ({
    auth: (search.auth as string) || '',
  }),
});

function VerifyEmailPage() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Mail className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Verifique seu Email</CardTitle>
              <CardDescription>Enviamos um link de confirmação para seu email</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="mb-2">
              Olá <span className="font-semibold">{user?.email}</span>,
            </p>
            <p className="mb-2">
              Para sua segurança, enviamos um email de confirmação para o endereço fornecido.
            </p>
            <p>Por favor, siga estas etapas:</p>
            <ol className="ml-4 mt-2 list-decimal space-y-1">
              <li>Verifique sua caixa de entrada</li>
              <li>Clique no link de confirmação no email</li>
              <li>Retorne aqui para fazer login</li>
            </ol>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Não recebeu o email? Verifique sua pasta de spam ou aguarde alguns minutos.</p>
          </div>

          <div className="flex flex-col space-y-2">
            <Link to="/auth" search={{ auth: 'true' }}>
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
