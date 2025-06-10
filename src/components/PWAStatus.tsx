import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Download, Smartphone, Wifi, WifiOff } from 'lucide-react';

export function PWAStatus() {
  const { isInstalled, canInstall } = usePWAInstall();
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Verificar status online/offline
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Verificar se está rodando como PWA
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
      setIsStandalone(isStandaloneMode || isFullscreen);
    };

    checkStandalone();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const features = [
    {
      name: 'Modo Offline',
      status: 'serviceWorker' in navigator,
      icon: isOnline ? Wifi : WifiOff,
      description: isOnline ? 'Online' : 'Offline',
    },
    {
      name: 'PWA Instalado',
      status: isInstalled,
      icon: isInstalled ? CheckCircle : Download,
      description: isInstalled ? 'Instalado' : canInstall ? 'Disponível' : 'Não disponível',
    },
    {
      name: 'Modo Tela Cheia',
      status: isStandalone,
      icon: Smartphone,
      description: isStandalone ? 'Ativo' : 'Navegador',
    },
    {
      name: 'Service Worker',
      status: 'serviceWorker' in navigator,
      icon: 'serviceWorker' in navigator ? CheckCircle : XCircle,
      description: 'serviceWorker' in navigator ? 'Suportado' : 'Não suportado',
    },
  ];

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Status PWA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {features.map(feature => {
          const Icon = feature.icon;
          return (
            <div key={feature.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${feature.status ? 'text-green-500' : 'text-red-500'}`} />
                <span className="text-sm font-medium">{feature.name}</span>
              </div>
              <Badge variant={feature.status ? 'default' : 'secondary'}>
                {feature.description}
              </Badge>
            </div>
          );
        })}

        {!isOnline && (
          <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-md">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              🌐 Você está offline! O jogo ainda pode funcionar com recursos em cache.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
