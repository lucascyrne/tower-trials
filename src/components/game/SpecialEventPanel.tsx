import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGame } from '@/resources/game/game-hook';
import { SpecialEventService } from '@/resources/game/special-event.service';

export default function SpecialEventPanel() {
  const { gameState, performAction, loading } = useGame();
  const { currentSpecialEvent, player } = gameState;

  if (!currentSpecialEvent) {
    return null;
  }

  const handleInteract = () => {
    performAction('interact_event');
  };

  const eventIcon = SpecialEventService.getEventIcon(currentSpecialEvent.type);
  const eventColor = SpecialEventService.getEventColor(currentSpecialEvent.type);

  // Calcular preview dos benefícios
  const hpRestore = Math.ceil((player.max_hp * currentSpecialEvent.hp_restore_percent) / 100);
  const manaRestore = Math.ceil((player.max_mana * currentSpecialEvent.mana_restore_percent) / 100);
  const goldRange = currentSpecialEvent.gold_reward_max > 0 
    ? `${currentSpecialEvent.gold_reward_min}-${currentSpecialEvent.gold_reward_max}`
    : '0';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <div className="w-full max-w-4xl">
        {/* Cabeçalho do Evento */}
        <div className="text-center mb-8">
          <div className={`text-8xl mb-4 ${eventColor}`}>
            {eventIcon}
          </div>
          <h1 className="text-4xl font-bold mb-2">
            {currentSpecialEvent.name}
          </h1>
          <p className="text-xl text-muted-foreground">
            Andar {player.floor}
          </p>
        </div>

        {/* Card do Evento */}
        <Card className="overflow-hidden border-2 border-primary/20 shadow-xl">
          <CardHeader className="bg-primary/10 text-center">
            <CardTitle className="text-2xl">Evento Especial</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {/* Descrição do Evento */}
            <div className="text-center mb-8">
              <p className="text-lg leading-relaxed">
                {currentSpecialEvent.description}
              </p>
            </div>

            {/* Preview dos Benefícios */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {currentSpecialEvent.hp_restore_percent > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                  <div className="text-2xl text-green-500 mb-2">❤️</div>
                  <div className="font-semibold text-green-600">Restauração de HP</div>
                  <div className="text-sm text-muted-foreground">
                    Até {hpRestore} HP ({currentSpecialEvent.hp_restore_percent}%)
                  </div>
                </div>
              )}

              {currentSpecialEvent.mana_restore_percent > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
                  <div className="text-2xl text-blue-500 mb-2">💧</div>
                  <div className="font-semibold text-blue-600">Restauração de Mana</div>
                  <div className="text-sm text-muted-foreground">
                    Até {manaRestore} Mana ({currentSpecialEvent.mana_restore_percent}%)
                  </div>
                </div>
              )}

              {currentSpecialEvent.gold_reward_max > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                  <div className="text-2xl text-yellow-500 mb-2">💰</div>
                  <div className="font-semibold text-yellow-600">Recompensa de Gold</div>
                  <div className="text-sm text-muted-foreground">
                    {goldRange} Gold
                  </div>
                </div>
              )}
            </div>

            {/* Status Atual do Jogador */}
            <div className="bg-card border rounded-lg p-4 mb-8">
              <h3 className="font-semibold mb-3 text-center">Status Atual</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl text-red-500">❤️</div>
                  <div className="text-sm font-medium">HP</div>
                  <div className="text-sm text-muted-foreground">
                    {player.hp}/{player.max_hp}
                  </div>
                </div>
                <div>
                  <div className="text-2xl text-blue-500">💧</div>
                  <div className="text-sm font-medium">Mana</div>
                  <div className="text-sm text-muted-foreground">
                    {player.mana}/{player.max_mana}
                  </div>
                </div>
                <div>
                  <div className="text-2xl text-yellow-500">💰</div>
                  <div className="text-sm font-medium">Gold</div>
                  <div className="text-sm text-muted-foreground">
                    {player.gold}
                  </div>
                </div>
                <div>
                  <div className="text-2xl text-purple-500">🏢</div>
                  <div className="text-sm font-medium">Andar</div>
                  <div className="text-sm text-muted-foreground">
                    {player.floor}
                  </div>
                </div>
              </div>
            </div>

            {/* Ação */}
            <div className="text-center">
              <Button
                onClick={handleInteract}
                disabled={loading.performAction}
                size="lg"
                className="px-8 py-3 text-lg"
              >
                {loading.performAction ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    {eventIcon} Interagir
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Mensagem do Jogo */}
        {gameState.gameMessage && (
          <div className="mt-6 text-center">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-lg">{gameState.gameMessage}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 