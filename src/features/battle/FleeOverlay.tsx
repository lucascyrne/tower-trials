import { useEffect, useState } from 'react';

interface FleeOverlayProps {
  isVisible: boolean;
  isSuccess: boolean;
  playerName: string;
  enemyName?: string;
  onComplete: () => void;
}

export const FleeOverlay: React.FC<FleeOverlayProps> = ({
  isVisible,
  isSuccess,
  playerName,
  enemyName,
  onComplete,
}) => {
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    console.log(
      `[FleeOverlay] 🎭 Overlay ativado - Sucesso: ${isSuccess}, Jogador: ${playerName}, Inimigo: ${enemyName}`
    );

    // Animação de progresso
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const increment = isSuccess ? 2.5 : 3.3; // Sucesso: 3s, Falha: 2.5s
        return Math.min(prev + increment, 100);
      });
    }, 50);

    // Timer para completar o overlay
    const timer = setTimeout(
      () => {
        console.log(`[FleeOverlay] ⏰ Tempo esgotado - Chamando onComplete`);
        onComplete();
      },
      isSuccess ? 3000 : 2500
    ); // 3s para sucesso, 2.5s para falha

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, [isVisible, isSuccess, playerName, enemyName, onComplete]);

  if (!mounted || !isVisible) return null;

  const getMessage = () => {
    if (isSuccess) {
      return {
        emoji: '🏃‍♂️',
        title: 'Fuga Bem-Sucedida!',
        subtitle: 'Redirecionando para o hub...',
        description: enemyName
          ? `${playerName} conseguiu fugir de ${enemyName}!`
          : `${playerName} conseguiu escapar!`,
        bgColor: 'bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20',
        borderColor: 'border-green-500/30',
        textColor: 'text-green-400',
        accentColor: 'border-green-400',
      };
    } else {
      return {
        emoji: '⚔️',
        title: 'Fuga Falhou!',
        subtitle: 'Prepare-se para o contra-ataque...',
        description: enemyName
          ? `${enemyName} impediu a fuga de ${playerName}!`
          : `O inimigo impediu a fuga de ${playerName}!`,
        bgColor: 'bg-gradient-to-r from-red-500/20 via-orange-500/20 to-yellow-500/20',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-400',
        accentColor: 'border-red-400',
      };
    }
  };

  const message = getMessage();

  return (
    <div className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40"></div>

      <div
        className={`relative ${message.bgColor} border ${message.borderColor} rounded-2xl p-8 shadow-2xl max-w-md mx-4 transform transition-all duration-500 animate-in zoom-in-95 fade-in-0`}
      >
        {/* Título com emoji animado */}
        <div className="text-center space-y-4">
          <div
            className={`text-6xl ${
              isSuccess ? 'animate-bounce' : 'animate-pulse'
            } transition-all duration-300`}
          >
            {message.emoji}
          </div>

          <div className={`font-bold text-2xl ${message.textColor}`}>{message.title}</div>

          <div className="text-muted-foreground text-base">{message.subtitle}</div>

          {/* Barra de progresso animada */}
          <div className="w-full bg-background/30 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ease-out ${
                isSuccess ? 'bg-green-400' : 'bg-red-400'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Descrição personalizada */}
          <div className="text-sm text-muted-foreground/90 leading-relaxed px-2">
            {message.description}
          </div>

          {/* Indicador de processamento */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <div
              className={`animate-spin rounded-full h-5 w-5 border-2 border-t-transparent ${message.accentColor}`}
            ></div>
            <span className={`text-sm font-medium ${message.textColor}`}>
              {isSuccess ? 'Redirecionando...' : 'Retornando...'}
            </span>
          </div>
        </div>

        {/* Efeito visual de borda */}
        <div
          className={`absolute inset-0 rounded-2xl border-2 ${message.borderColor} animate-pulse pointer-events-none`}
        ></div>
      </div>
    </div>
  );
};
