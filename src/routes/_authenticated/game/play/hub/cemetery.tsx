import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Cemetery } from '@/features/cemitery/Cemetery';

export const Route = createFileRoute('/_authenticated/game/play/hub/cemetery')({
  component: CemeteryPage,
});

function CemeteryPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate({ to: '/game/play' })}
              className="w-fit"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar à Seleção
            </Button>

            <div className="text-center sm:text-left mt-2 sm:mt-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                Cemitério do Tower Trials
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Honre a memória dos bravos aventureiros que caíram nas trevas da torre
              </p>
            </div>
          </div>
        </div>

        {/* Cemitério */}
        <Cemetery className="w-full" showHeader={false} collapsible={false} />
      </div>
    </div>
  );
}
