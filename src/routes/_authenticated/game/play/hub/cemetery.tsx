import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Cemetery } from '@/components/game/Cemetery';

export const Route = createFileRoute('/_authenticated/game/play/hub/cemetery')({
  component: CemeteryPage,
});

function CemeteryPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate({ to: '/game/play' })} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar à Seleção de Personagens
          </Button>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              Cemitério do Tower Trials
            </h1>
            <p className="text-muted-foreground">
              Honre a memória dos bravos aventureiros que caíram nas trevas da torre
            </p>
          </div>
        </div>

        {/* Cemitério */}
        <Cemetery className="w-full" showHeader={false} collapsible={false} />
      </div>
    </div>
  );
}
