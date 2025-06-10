import { Environment } from '@/config/env';
import { getCurrentEnvironment, isLocalEnvironment } from '@/lib/supabase';

export function EnvironmentIndicator() {
  const environment = getCurrentEnvironment();
  const isLocal = isLocalEnvironment();

  // Não mostrar em produção
  if (environment === Environment.PROD) {
    return null;
  }

  const getEnvironmentConfig = () => {
    switch (environment) {
      case Environment.LOCAL:
        return {
          label: 'LOCAL',
          color: 'bg-blue-500',
          icon: '🐳',
          description: 'Docker',
        };
      case Environment.DEV:
        return {
          label: 'DEV',
          color: 'bg-yellow-500',
          icon: '🌐',
          description: 'Remoto',
        };
      default:
        return {
          label: 'UNKNOWN',
          color: 'bg-red-500',
          icon: '❓',
          description: 'Desconhecido',
        };
    }
  };

  const config = getEnvironmentConfig();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`${config.color} text-white px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1 shadow-lg`}
        title={`Ambiente: ${config.label} (${config.description})`}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
        {isLocal && <span className="text-xs opacity-75">🐳</span>}
      </div>
    </div>
  );
}
