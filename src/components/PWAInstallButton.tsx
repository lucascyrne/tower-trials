import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function PWAInstallButton() {
  const { installPWA, canInstall, isInstalled } = usePWAInstall();

  const handleInstall = async () => {
    const success = await installPWA();
    if (success) {
      console.log('App instalado com sucesso!');
    }
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        App Instalado
      </div>
    );
  }

  if (!canInstall) {
    return null;
  }

  return (
    <Button
      onClick={handleInstall}
      variant="outline"
      size="sm"
      className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800"
    >
      <Download className="w-4 h-4" />
      Instalar App
    </Button>
  );
}
