import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sword, Shield, Zap, ArrowUp, Castle } from 'lucide-react';

export default function GameInfo() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Castle className="h-5 w-5 text-primary" />
          Sobre Tower Trials
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Um jogo de aventura em que você sobe uma torre mágica, enfrentando inimigos cada vez mais
          fortes em cada andar. Quanto mais alto você chegar, melhor será sua posição no ranking.
        </p>

        <div className="grid grid-cols-1 gap-3 mt-4">
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
            <div className="mt-1">
              <ArrowUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Progressão na Torre</h3>
              <p className="text-sm text-muted-foreground">
                Cada andar apresenta um inimigo mais forte. A dificuldade aumenta conforme você
                sobe, mas você recupera um pouco de HP a cada inimigo derrotado.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
            <div className="mt-1">
              <Sword className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Ataque</h3>
              <p className="text-sm text-muted-foreground">
                Ataque direto ao inimigo, causando dano baseado no seu valor de ataque menos a
                defesa do inimigo.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
            <div className="mt-1">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Defesa</h3>
              <p className="text-sm text-muted-foreground">
                Aumenta temporariamente sua defesa, reduzindo o dano recebido no próximo ataque do
                inimigo.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
            <div className="mt-1">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Habilidade Especial</h3>
              <p className="text-sm text-muted-foreground">
                Causa o dobro do seu dano de ataque, mas tem um cooldown de 3 turnos antes de poder
                ser usada novamente.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
