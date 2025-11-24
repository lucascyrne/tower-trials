import { createFileRoute } from '@tanstack/react-router';
import { Sword, Zap, Heart } from 'lucide-react';
import PublicFeatureWrapper from '@/components/hocs/public-feature';

export const Route = createFileRoute('/_public/home')({
  component: HomePageWrapper,
});

function HomePageWrapper() {
  return (
    <PublicFeatureWrapper>
      <HomePage />
    </PublicFeatureWrapper>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-20 pb-32 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/20 to-transparent"></div>
        <div className="relative max-w-6xl mx-auto text-center">
          <h1 className="text-6xl font-black mb-6 bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent">
            Tower Trials
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Um jogo roguelike desafiador onde cada morte importa. Ascenda pela torre, enfrente
            monstros mortais e conquiste a glória eternal.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/auth"
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg font-bold hover:shadow-lg hover:shadow-amber-500/50 transition"
            >
              Começar Aventura
            </a>
            <a
              href="/guide"
              className="px-8 py-3 border-2 border-amber-500 rounded-lg font-bold hover:bg-amber-900/30 transition"
            >
              Ver Guia
            </a>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-black text-center mb-16 text-amber-400">Características</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 border border-amber-900/50 rounded-lg p-8 hover:border-amber-500/50 transition">
              <Sword className="w-12 h-12 text-amber-400 mb-4" />
              <h3 className="text-xl font-bold mb-3">Combat Desafiador</h3>
              <p className="text-slate-300">
                Sistema de combate tático com múltiplas habilidades, estratégias e inimigos únicos
                em cada andar.
              </p>
            </div>
            <div className="bg-slate-800/50 border border-amber-900/50 rounded-lg p-8 hover:border-amber-500/50 transition">
              <Heart className="w-12 h-12 text-amber-400 mb-4" />
              <h3 className="text-xl font-bold mb-3">Permadeath</h3>
              <p className="text-slate-300">
                Cada morte é permanente. Prepare-se, escolha suas estratégias e enfrente as
                consequências.
              </p>
            </div>
            <div className="bg-slate-800/50 border border-amber-900/50 rounded-lg p-8 hover:border-amber-500/50 transition">
              <Zap className="w-12 h-12 text-amber-400 mb-4" />
              <h3 className="text-xl font-bold mb-3">Progressão Dinâmica</h3>
              <p className="text-slate-300">
                Múltiplas personagens, classes, habilidades e equipamentos para explorar diferentes
                estratégias.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* GAMEPLAY SECTION */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-black text-center mb-16 text-amber-400">Como Jogar</h2>
          <div className="space-y-12">
            <div className="flex gap-8 items-start">
              <div className="text-4xl font-black text-amber-500">01</div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Crie Seu Personagem</h3>
                <p className="text-slate-300">
                  Escolha entre diferentes classes com habilidades únicas. Cada personagem tem seu
                  próprio caminho e estilo de jogo.
                </p>
              </div>
            </div>
            <div className="flex gap-8 items-start">
              <div className="text-4xl font-black text-amber-500">02</div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Suba a Torre</h3>
                <p className="text-slate-300">
                  Enfrente andar após andar, cada um com inimigos mais poderosos e recompensas
                  valiosas. Adapte sua estratégia.
                </p>
              </div>
            </div>
            <div className="flex gap-8 items-start">
              <div className="text-4xl font-black text-amber-500">03</div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Colete Equipamentos</h3>
                <p className="text-slate-300">
                  Armas, armaduras e itens especiais deixados pelos inimigos vencidos. Planeje suas
                  compras na loja com cuidado.
                </p>
              </div>
            </div>
            <div className="flex gap-8 items-start">
              <div className="text-4xl font-black text-amber-500">04</div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Enfrente o Destino</h3>
                <p className="text-slate-300">
                  Alcance o topo, derrote o boss final e inscreva seu nome na história. Ou morra
                  tentando.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROGRESSION SECTION */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-black text-center mb-16 text-amber-400">
            Sistema de Progressão
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-800/50 rounded-lg p-8 border border-amber-900/50">
              <h3 className="text-xl font-bold text-amber-400 mb-4">Atributos</h3>
              <p className="text-slate-300 mb-4">
                Aumente vida, mana, força, inteligência e defesa conforme você progride. Cada
                escolha afeta seu estilo de jogo.
              </p>
              <ul className="text-slate-300 space-y-2">
                <li>• Vida: Resistência ao dano</li>
                <li>• Mana: Combustível para habilidades</li>
                <li>• Força: Dano físico aumentado</li>
                <li>• Inteligência: Dano mágico aumentado</li>
              </ul>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-8 border border-amber-900/50">
              <h3 className="text-xl font-bold text-amber-400 mb-4">Habilidades</h3>
              <p className="text-slate-300 mb-4">
                Aprenda novas habilidades e aperfeiçoe as existentes. Cada classe tem seu árbol de
                habilidades único.
              </p>
              <ul className="text-slate-300 space-y-2">
                <li>• Ataques físicos potentes</li>
                <li>• Magias devastadoras</li>
                <li>• Suportes defensivos</li>
                <li>• Utilitários estratégicos</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ECONOMY SECTION */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-black text-center mb-16 text-amber-400">
            Sistema Econômico
          </h2>
          <div className="bg-gradient-to-r from-amber-900/20 to-orange-900/20 border border-amber-900/50 rounded-lg p-12">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-black text-amber-400 mb-2">Ouro</div>
                <p className="text-slate-300">
                  Moeda principal. Obtenha dos inimigos, venda itens e compre equipamentos e
                  consumíveis.
                </p>
              </div>
              <div className="border-l border-r border-amber-900/50">
                <div className="text-3xl font-black text-amber-400 mb-2">Drops</div>
                <p className="text-slate-300">
                  Itens raros deixados por inimigos. Equipamentos, cristais mágicos e materiais
                  valiosos.
                </p>
              </div>
              <div>
                <div className="text-3xl font-black text-amber-400 mb-2">Loja</div>
                <p className="text-slate-300">
                  Compre consumíveis para heal, potências e outros itens. Use sua moeda com
                  sabedoria.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-32 px-4 bg-gradient-to-b from-transparent to-amber-900/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-black mb-6 text-amber-400">Pronto para a Aventura?</h2>
          <p className="text-xl text-slate-300 mb-8">
            A Tower Trials aguarda. Você tem o que é preciso para chegar ao topo?
          </p>
          <a
            href="/auth"
            className="inline-block px-12 py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg font-bold text-lg hover:shadow-lg hover:shadow-amber-500/50 transition"
          >
            Começar Agora
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-slate-400 text-sm">
          <p>© 2024 Tower Trials. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
