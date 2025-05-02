import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';

interface ErrorAlertProps {
  error: string | null;
}

interface InviteAlertProps {
  teamName: string;
}

interface SuccessAlertProps {
  message: string;
  description?: string;
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  if (!error) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Erro</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

export function InviteAlert({ teamName }: InviteAlertProps) {
  return (
    <Alert className="mb-4">
      <Info className="h-4 w-4" />
      <AlertTitle>Convite recebido</AlertTitle>
      <AlertDescription>
        Após fazer login ou se registrar, você será automaticamente adicionado à equipe {teamName}.
      </AlertDescription>
    </Alert>
  );
}

export function SuccessAlert({ message, description }: SuccessAlertProps) {
  return (
    <Alert className="mb-4" variant="default">
      <Info className="h-4 w-4" />
      <AlertTitle>{message}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
    </Alert>
  );
}
