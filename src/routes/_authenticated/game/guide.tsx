import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/game/guide')({
  component: GuidePage,
});

function GuidePage() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header padronizado */}
      <div className="space-y-3 sm:space-y-4 mb-6">
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: '/game' })}
            className="self-start"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Voltar ao Menu</span>
            <span className="sm:hidden">Voltar</span>
          </Button>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Guia do Tower Trials</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Aprenda tudo sobre o jogo</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="basics" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="basics">Básico</TabsTrigger>
          <TabsTrigger value="combat">Combate</TabsTrigger>
          <TabsTrigger value="progression">Progressão</TabsTrigger>
          <TabsTrigger value="items">Itens</TabsTrigger>
        </TabsList>

        <TabsContent value="basics">
          <Card className="p-6">
            <ScrollArea className="h-[600px] pr-4">
              <section className="space-y-4">
                <h2 className="text-2xl font-bold">Conceitos Básicos</h2>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Sobre o Jogo</h3>
                  <p>
                    Tower Trials é um jogo de RPG roguelike onde você sobe uma torre misteriosa,
                    enfrentando monstros cada vez mais fortes a cada andar. Sua missão é subir o
                    máximo possível, fortalecendo seu personagem e coletando equipamentos poderosos.
                  </p>

                  <h3 className="text-xl font-semibold">Personagens</h3>
                  <p>
                    Cada jogador pode ter até 3 personagens ativos. Quando um personagem morre, ele
                    é permanentemente deletado (sistema Permadeath). Os personagens possuem os
                    seguintes atributos base:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>HP (Pontos de Vida):</strong> Determina quanto dano você pode receber
                    </li>
                    <li>
                      <strong>Mana:</strong> Recurso usado para lançar magias
                    </li>
                    <li>
                      <strong>ATK (Ataque):</strong> Determina o dano base dos seus ataques
                    </li>
                    <li>
                      <strong>DEF (Defesa):</strong> Reduz o dano recebido
                    </li>
                    <li>
                      <strong>Speed (Velocidade):</strong> Afeta suas chances de fuga e ordem de
                      ações
                    </li>
                  </ul>

                  <h3 className="text-xl font-semibold">A Torre</h3>
                  <p>A torre é dividida em andares com diferentes características:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Andares Comuns:</strong> Encontros normais com monstros
                    </li>
                    <li>
                      <strong>Andares de Elite (a cada 5 andares):</strong> Monstros mais fortes com
                      melhores recompensas
                    </li>
                    <li>
                      <strong>Andares de Evento (a cada 7 andares):</strong> Eventos especiais e
                      encontros únicos
                    </li>
                    <li>
                      <strong>Andares de Chefe (a cada 10 andares):</strong> Batalhas desafiadoras
                      contra chefes poderosos
                    </li>
                  </ul>
                </div>
              </section>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="combat">
          <Card className="p-6">
            <ScrollArea className="h-[600px] pr-4">
              <section className="space-y-4">
                <h2 className="text-2xl font-bold">Sistema de Combate</h2>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Ações de Combate</h3>
                  <p>Durante o combate, você pode realizar as seguintes ações:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Ataque:</strong> Causa dano baseado no seu ATK menos a DEF do inimigo
                    </li>
                    <li>
                      <strong>Defesa:</strong> Aumenta temporariamente sua DEF por um turno
                    </li>
                    <li>
                      <strong>Magias:</strong> Efeitos variados que consomem Mana
                    </li>
                    <li>
                      <strong>Itens:</strong> Usar poções e outros consumíveis
                    </li>
                    <li>
                      <strong>Fuga:</strong> Tenta escapar do combate (chance baseada na velocidade)
                    </li>
                  </ul>

                  <h3 className="text-xl font-semibold">Sistema de Magias</h3>
                  <p>As magias são divididas em diferentes tipos de efeito:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Dano (Damage):</strong> Causa dano direto ao inimigo
                    </li>
                    <li>
                      <strong>Cura (Heal):</strong> Recupera HP
                    </li>
                    <li>
                      <strong>Buff:</strong> Aumenta temporariamente seus atributos
                    </li>
                    <li>
                      <strong>Debuff:</strong> Reduz temporariamente os atributos do inimigo
                    </li>
                    <li>
                      <strong>DoT (Damage over Time):</strong> Causa dano ao longo do tempo
                    </li>
                    <li>
                      <strong>HoT (Heal over Time):</strong> Cura ao longo do tempo
                    </li>
                  </ul>

                  <h3 className="text-xl font-semibold">Comportamento dos Monstros</h3>
                  <p>Os monstros possuem diferentes padrões de comportamento:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Agressivo:</strong> Foca em causar dano
                    </li>
                    <li>
                      <strong>Defensivo:</strong> Alterna entre ataques e defesa
                    </li>
                    <li>
                      <strong>Balanceado:</strong> Mistura diferentes estratégias
                    </li>
                  </ul>
                </div>
              </section>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="progression">
          <Card className="p-6">
            <ScrollArea className="h-[600px] pr-4">
              <section className="space-y-4">
                <h2 className="text-2xl font-bold">Progressão</h2>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Sistema de Níveis</h3>
                  <p>
                    Ao derrotar monstros, você ganha XP. A quantidade de XP necessária para subir de
                    nível aumenta em 50% a cada nível. Ao subir de nível:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Seus atributos base aumentam</li>
                    <li>HP e Mana são completamente restaurados</li>
                    <li>Você pode desbloquear novas magias</li>
                  </ul>

                  <h3 className="text-xl font-semibold">Recompensas</h3>
                  <p>Ao derrotar monstros, você pode receber:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Gold:</strong> Usado para comprar equipamentos e consumíveis
                    </li>
                    <li>
                      <strong>Drops:</strong> Itens que podem ser usados para crafting
                    </li>
                    <li>
                      <strong>XP:</strong> Para subir de nível
                    </li>
                  </ul>

                  <h3 className="text-xl font-semibold">Checkpoints</h3>
                  <p>
                    A cada 10 andares existe um checkpoint. Estes são pontos seguros onde você pode:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Salvar seu progresso</li>
                    <li>Retornar ao hub para comprar itens</li>
                    <li>Reorganizar seu equipamento</li>
                  </ul>
                </div>
              </section>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <Card className="p-6">
            <ScrollArea className="h-[600px] pr-4">
              <section className="space-y-4">
                <h2 className="text-2xl font-bold">Itens e Equipamentos</h2>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Equipamentos</h3>
                  <p>Os equipamentos são divididos em três categorias:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Armas (Weapons):</strong> Aumentam principalmente ATK
                    </li>
                    <li>
                      <strong>Armaduras (Armor):</strong> Aumentam principalmente DEF
                    </li>
                    <li>
                      <strong>Acessórios (Accessory):</strong> Efeitos variados
                    </li>
                  </ul>

                  <p>E em cinco raridades:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Comum (Common):</strong> Equipamentos básicos
                    </li>
                    <li>
                      <strong>Incomum (Uncommon):</strong> Melhorias moderadas
                    </li>
                    <li>
                      <strong>Raro (Rare):</strong> Requer pergaminho especial para desbloquear
                    </li>
                    <li>
                      <strong>Épico (Epic):</strong> Requer pergaminho épico para desbloquear
                    </li>
                    <li>
                      <strong>Lendário (Legendary):</strong> Os mais poderosos do jogo
                    </li>
                  </ul>

                  <h3 className="text-xl font-semibold">Consumíveis</h3>
                  <p>Existem diferentes tipos de consumíveis:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Poções:</strong> Recuperam HP ou Mana
                    </li>
                    <li>
                      <strong>Antídotos:</strong> Removem efeitos negativos
                    </li>
                    <li>
                      <strong>Elixires:</strong> Proporcionam buffs temporários
                    </li>
                    <li>
                      <strong>Pergaminhos:</strong> Desbloqueiam equipamentos especiais
                    </li>
                  </ul>

                  <h3 className="text-xl font-semibold">Sistema de Crafting</h3>
                  <p>
                    Você pode criar itens usando materiais obtidos como drops dos monstros. Alguns
                    consumíveis e equipamentos só podem ser obtidos através de crafting.
                  </p>
                </div>
              </section>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
