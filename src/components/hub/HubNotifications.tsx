import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type GamePlayer } from '@/resources/game/game-model';
import { X, Heart, Star, AlertCircle } from 'lucide-react';

interface HubNotificationsProps {
  player: GamePlayer;
  showHealNotification: boolean;
  healInfo: { oldHp: number; newHp: number; character: string } | null;
  onDismissHealNotification: () => void;
}

export function HubNotifications({
  player,
  showHealNotification,
  healInfo,
  onDismissHealNotification,
}: HubNotificationsProps) {
  const hasAttributePoints = player.attribute_points && player.attribute_points > 0;

  if (!showHealNotification && !hasAttributePoints) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Notificação de Pontos de Atributo */}
      {hasAttributePoints && (
        <Card className="bg-amber-950/50 border-amber-700/50 shadow-lg backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-600/20 rounded-lg">
                <Star className="h-4 w-4 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-200 text-sm">
                  Pontos de Atributo Disponíveis
                </h3>
                <div className="text-xs text-amber-300/80">
                  Você tem{' '}
                  <Badge
                    variant="outline"
                    className="mx-1 text-amber-200 bg-amber-600/20 border-amber-500/50 text-xs px-1.5 py-0.5"
                  >
                    {player.attribute_points}
                  </Badge>
                  ponto(s) para distribuir em &quot;Atributos&quot;.
                </div>
              </div>
              <AlertCircle className="h-4 w-4 text-amber-500 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notificação de Cura Automática */}
      {showHealNotification && healInfo && (
        <div className="fixed top-4 right-4 z-50 max-w-sm animate-in slide-in-from-top-2 duration-500">
          <Card className="bg-emerald-950/80 border-emerald-700/50 shadow-xl backdrop-blur-md">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600/20 rounded-lg">
                  <Heart className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-emerald-200 text-sm">
                    {healInfo.character} foi curado!
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-emerald-300">
                    <span>HP:</span>
                    <span className="font-mono bg-emerald-900/50 px-2 py-0.5 rounded text-xs">
                      {healInfo.oldHp} → {healInfo.newHp}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-emerald-300 border-emerald-500/50 bg-emerald-600/20 text-xs px-1.5 py-0.5"
                    >
                      +{healInfo.newHp - healInfo.oldHp}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismissHealNotification}
                  className="h-6 w-6 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-800/50"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
