import { createFileRoute } from '@tanstack/react-router';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import PublicFeatureWrapper from '@/components/hocs/public-feature';

export const Route = createFileRoute('/_public/guide/')({
  component: GuidePageWrapper,
});

function GuidePageWrapper() {
  return (
    <PublicFeatureWrapper>
      <GuidePage />
    </PublicFeatureWrapper>
  );
}

function GuidePage() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    combat: true,
    progression: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white">
      {/* HEADER */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Guia Completo
            </h1>
            <p className="text-slate-400 text-sm">Tower Trials - Sistema & Estratégia</p>
          </div>
          <a
            href="/home"
            className="inline-flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* TABLE OF CONTENTS */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6 text-amber-400">Índice</h2>
          <div className="grid md:grid-cols-2 gap-6 text-slate-300">
            <div>
              <a href="#combat" className="hover:text-amber-400 transition-colors cursor-pointer">
                • Sistema de Combate
              </a>
              <a
                href="#progression"
                className="hover:text-amber-400 transition-colors block mt-2 cursor-pointer"
              >
                • Progressão & Níveis
              </a>
              <a
                href="#attributes"
                className="hover:text-amber-400 transition-colors block mt-2 cursor-pointer"
              >
                • Atributos Detalhados
              </a>
              <a
                href="#equipment"
                className="hover:text-amber-400 transition-colors block mt-2 cursor-pointer"
              >
                • Sistema de Equipamento
              </a>
            </div>
            <div>
              <a href="#spells" className="hover:text-amber-400 transition-colors cursor-pointer">
                • Spells & Magias
              </a>
              <a
                href="#monsters"
                className="hover:text-amber-400 transition-colors block mt-2 cursor-pointer"
              >
                • Bestiary
              </a>
              <a
                href="#economy"
                className="hover:text-amber-400 transition-colors block mt-2 cursor-pointer"
              >
                • Economia & Gold
              </a>
              <a
                href="#tips"
                className="hover:text-amber-400 transition-colors block mt-2 cursor-pointer"
              >
                • Dicas & Estratégia
              </a>
            </div>
          </div>
        </div>

        {/* SISTEMA DE COMBATE */}
        <Section
          id="combat"
          title="Sistema de Combate"
          expanded={expandedSections.combat}
          onToggle={() => toggleSection('combat')}
        >
          <div className="space-y-6">
            <div className="bg-slate-800/30 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-amber-400">Turno a Turno</h3>
              <p className="text-slate-300 mb-4">
                O combate é baseado em turnos. Durante cada turno, você escolhe uma ação: Atacar,
                Defender, Usar Magia ou Usar Consumível. Após sua ação, o inimigo responde.
              </p>

              <div className="space-y-3">
                <ActionCard
                  title="Atacar"
                  description="Causa dano baseado em seu ATK"
                  formula="Dano = ATK ± 20% (variação)"
                  color="red"
                />
                <ActionCard
                  title="Defender"
                  description="Aumenta DEF temporariamente e reduz dano"
                  formula="DEF aumenta 50% por 1 turno"
                  color="blue"
                />
                <ActionCard
                  title="Magia"
                  description="Lança um spell consumindo Mana"
                  formula="Baseado no tipo de magia"
                  color="purple"
                />
                <ActionCard
                  title="Consumível"
                  description="Usa poção ou item especial"
                  formula="1x por turno máximo"
                  color="emerald"
                />
              </div>
            </div>

            <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-amber-400">Cálculo de Dano</h3>
              <div className="space-y-3 font-mono text-sm bg-slate-900/50 p-4 rounded">
                <div>
                  <span className="text-amber-400">Dano Base:</span> Inimigo ATK - Seu DEF
                </div>
                <div>
                  <span className="text-amber-400">Crítico:</span> 30% chance com Speed
                </div>
                <div>
                  <span className="text-amber-400">Crítico Multiplier:</span> Dano × 1.5-2.0
                </div>
                <div className="mt-3 text-slate-400">
                  Exemplo: Inimigo ATK 25, Seu DEF 10 = 15 dano base
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* PROGRESSÃO */}
        <Section
          id="progression"
          title="Progressão & Níveis"
          expanded={expandedSections.progression}
          onToggle={() => toggleSection('progression')}
        >
          <div className="space-y-6">
            <div className="bg-slate-800/30 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-amber-400">Fórmula de Progressão</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <p className="text-slate-300 mb-3 font-semibold">XP Necessário por Nível:</p>
                  <div className="font-mono text-amber-400 mb-4">50 × (Nível²)</div>
                  <div className="space-y-2 text-sm text-slate-400">
                    <div>Nível 1→2: 150 XP</div>
                    <div>Nível 5→6: 1,300 XP</div>
                    <div>Nível 10→11: 5,050 XP</div>
                    <div>Nível 20→21: 20,550 XP</div>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <p className="text-slate-300 mb-3 font-semibold">Slots de Personagem:</p>
                  <div className="space-y-2 text-sm text-slate-400">
                    <div>
                      Nível 1: <span className="text-amber-400">1 slot</span>
                    </div>
                    <div>
                      Nível 5: <span className="text-amber-400">2 slots</span>
                    </div>
                    <div>
                      Nível 10: <span className="text-amber-400">3 slots</span>
                    </div>
                    <div>
                      Nível 20: <span className="text-amber-400">∞ slots</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-amber-400">Desbloques por Nível</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                {[
                  { level: 1, unlock: 'Bola de Fogo (Spell)' },
                  { level: 2, unlock: 'Cura Menor (Spell)' },
                  { level: 5, unlock: 'Slot de Personagem #2' },
                  { level: 10, unlock: 'Slot de Personagem #3, Equipamentos Raros' },
                  { level: 15, unlock: 'Equipamentos Épicos, Slots de Personagem #4' },
                  { level: 20, unlock: 'Equipamentos Lendários, Slots Infinitos' },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <div className="text-amber-400 font-semibold">Nível {item.level}</div>
                    <div className="text-slate-400 text-xs">{item.unlock}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ATRIBUTOS */}
        <Section id="attributes" title="Atributos Detalhados">
          <div className="space-y-6">
            {[
              {
                name: 'HP (Hit Points)',
                desc: 'Saúde total. Quando chega a 0, você morre.',
                source: 'Equipamento + Nível',
              },
              {
                name: 'ATK (Attack)',
                desc: 'Dano básico causado em ataques físicos.',
                source: 'Armas + Buffs',
              },
              {
                name: 'DEF (Defense)',
                desc: 'Reduz dano recebido. Máx 100 = Imunidade.',
                source: 'Armaduras + Acessórios',
              },
              {
                name: 'MANA',
                desc: 'Energia para lançar spells. Regenera com o tempo.',
                source: 'Equipamento + Magias',
              },
              {
                name: 'SPD (Speed)',
                desc: 'Chance de ataque crítico e ordem de ação.',
                source: 'Boots + Acessórios',
              },
            ].map((attr, i) => (
              <div key={i} className="bg-slate-800/30 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-bold mb-2 text-amber-400">{attr.name}</h3>
                <p className="text-slate-300 mb-3">{attr.desc}</p>
                <div className="text-sm text-slate-400">
                  <span className="font-semibold text-slate-300">Fontes:</span> {attr.source}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* EQUIPAMENTO */}
        <Section id="equipment" title="Sistema de Equipamento">
          <div className="space-y-6">
            <div className="bg-slate-800/30 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-amber-400">8 Slots de Equipamento</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { slot: 'Weapon', bonus: '+ATK' },
                  { slot: 'Shield', bonus: '+DEF' },
                  { slot: 'Armor (Chest)', bonus: '+DEF' },
                  { slot: 'Helmet', bonus: '+DEF' },
                  { slot: 'Legs', bonus: '+DEF' },
                  { slot: 'Ring', bonus: 'Bônus Variado' },
                  { slot: 'Necklace', bonus: 'Bônus Variado' },
                  { slot: 'Boots', bonus: '+SPD' },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-900/50 p-4 rounded border border-slate-700">
                    <div className="font-semibold text-amber-400">{item.slot}</div>
                    <div className="text-slate-400 text-sm">{item.bonus}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-amber-400">Raridades & Progressão</h3>
              <div className="space-y-3">
                {[
                  {
                    rarity: 'Common',
                    color: 'text-emerald-400',
                    floors: '1-5',
                    desc: 'Básico, para iniciantes',
                  },
                  {
                    rarity: 'Uncommon',
                    color: 'text-blue-400',
                    floors: '5-8',
                    desc: 'Bom balanceamento',
                  },
                  {
                    rarity: 'Rare',
                    color: 'text-purple-400',
                    floors: '10-13',
                    desc: 'Poder significativo',
                  },
                  {
                    rarity: 'Epic',
                    color: 'text-orange-400',
                    floors: '15-18',
                    desc: 'Muito poderoso',
                  },
                  {
                    rarity: 'Legendary',
                    color: 'text-yellow-400',
                    floors: '20',
                    desc: 'Endgame supremo',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-slate-900/50 p-3 rounded"
                  >
                    <div>
                      <div className={`font-bold ${item.color}`}>{item.rarity}</div>
                      <div className="text-xs text-slate-400">{item.desc}</div>
                    </div>
                    <div className="text-right text-xs text-slate-400">{item.floors}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4 text-amber-400">Dica: Build Equilibrado</h3>
              <p className="text-slate-300 text-sm">
                Não foque apenas em ATK. Um personagem bem balanceado com DEF e HP é muito mais
                sustentável que um vidro de ataque. Considere seus stats contra cada tipo de
                inimigo.
              </p>
            </div>
          </div>
        </Section>

        {/* SPELLS & MAGIAS */}
        <Section id="spells" title="Spells & Magias">
          <div className="space-y-6">
            <div className="bg-slate-800/30 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-amber-400">Tipos de Magias (50+)</h3>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    type: 'Damage',
                    examples: 'Bola de Fogo, Meteoro, Raio',
                    desc: 'Causa dano puro ao inimigo',
                  },
                  {
                    type: 'Heal',
                    examples: 'Cura Menor, Cura Maior, Ressurreição',
                    desc: 'Restaura seu HP',
                  },
                  {
                    type: 'DoT',
                    examples: 'Veneno, Praga Tóxica, Corrosão',
                    desc: 'Dano contínuo por múltiplos turnos',
                  },
                  {
                    type: 'Buff',
                    examples: 'Força, Defesa, Transcendência',
                    desc: 'Aumenta seus stats temporariamente',
                  },
                  {
                    type: 'Debuff',
                    examples: 'Fraqueza, Silêncio, Maldição',
                    desc: 'Reduz stats do inimigo',
                  },
                  {
                    type: 'Utility',
                    examples: 'Drenar Energia, Vampirismo',
                    desc: 'Efeitos especiais únicos',
                  },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-900/50 p-4 rounded border border-slate-700">
                    <div className="font-bold text-amber-400 mb-2">{item.type}</div>
                    <p className="text-xs text-slate-300 mb-2">{item.examples}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-amber-400">Progressão de Spells</h3>
              <p className="text-slate-300 mb-4">
                Você desbloqueia novos spells ao subir de nível. Combine diferentes tipos para
                máxima efetividade:
              </p>
              <div className="space-y-2 text-sm text-slate-300">
                <div>
                  ✓ <span className="font-semibold">Nível Inicial:</span> 1-2 spells básicos
                </div>
                <div>
                  ✓ <span className="font-semibold">Níveis 5-10:</span> Mais dano, buffs e heals
                </div>
                <div>
                  ✓ <span className="font-semibold">Níveis 15-20:</span> Spells devastadores e
                  utilitários
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* BESTIARY */}
        <Section id="monsters" title="Bestiary & Monstros">
          <div className="space-y-6">
            <p className="text-slate-300">
              A torre contém 100+ monstros únicos, cada um com seus próprios stats, ataques e drops.
            </p>

            {[
              {
                tier: 'Nível 1-5: Os Primeiros Passos',
                monsters: ['Slime Verde', 'Slime Azul', 'Rato Gigante', 'Goblin', 'Kobold'],
                xp: '20-45 XP',
                gold: '10-40 Gold',
                difficulty: 'Fácil',
              },
              {
                tier: 'Nível 6-10: Intermediário',
                monsters: ['Orc', 'Zumbi', 'Harpia', 'Golem de Pedra', 'Mago Corrompido'],
                xp: '60-140 XP',
                gold: '50-150 Gold',
                difficulty: 'Médio',
              },
              {
                tier: 'Nível 11-15: Avançado',
                monsters: ['Ogro', 'Quimera', 'Hidra', 'Dragão Jovem', 'Lich'],
                xp: '140-280 XP',
                gold: '130-340 Gold',
                difficulty: 'Difícil',
              },
              {
                tier: 'Nível 16-20: End-Game',
                monsters: ['Dragão Adulto', 'Titã de Pedra', 'Demônio Alado', 'Dragão Ancião'],
                xp: '300-800 XP',
                gold: '200-800 Gold',
                difficulty: 'Extremo',
              },
            ].map((section, i) => (
              <div key={i} className="bg-slate-800/30 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-bold mb-4 text-amber-400">{section.tier}</h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Monstros:</div>
                    <div className="text-slate-300 text-sm space-y-1">
                      {section.monsters.map((m, idx) => (
                        <div key={idx}>• {m}</div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm text-slate-400">Recompensas:</div>
                      <div className="text-slate-300 text-sm">{section.xp}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Gold:</div>
                      <div className="text-slate-300 text-sm">{section.gold}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Dificuldade:</div>
                      <div
                        className={`text-sm font-semibold ${
                          section.difficulty === 'Fácil'
                            ? 'text-emerald-400'
                            : section.difficulty === 'Médio'
                              ? 'text-yellow-400'
                              : section.difficulty === 'Difícil'
                                ? 'text-orange-400'
                                : 'text-red-400'
                        }`}
                      >
                        {section.difficulty}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ECONOMIA */}
        <Section id="economy" title="Economia & Gold">
          <div className="space-y-6">
            <div className="bg-slate-800/30 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-amber-400">Fórmula de Venda</h3>
              <div className="space-y-3">
                <div className="bg-slate-900/50 p-4 rounded">
                  <div className="font-semibold text-amber-400 mb-2">Consumíveis</div>
                  <div className="font-mono text-sm text-slate-300">Preço × 40%</div>
                  <div className="text-xs text-slate-400 mt-1">Ex: Poção de 100 Gold = 40 Gold</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded">
                  <div className="font-semibold text-amber-400 mb-2">Drops de Monstro</div>
                  <div className="font-mono text-sm text-slate-300">Valor Direto</div>
                  <div className="text-xs text-slate-400 mt-1">Ex: Drop com valor 50 = 50 Gold</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded">
                  <div className="font-semibold text-amber-400 mb-2">Equipamentos</div>
                  <div className="font-mono text-sm text-slate-300">Raridade × 30-50%</div>
                  <div className="text-xs text-slate-400 mt-1">Ex: Common 100 = 30-50 Gold</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-amber-400">Onde Gastar Gold</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { item: 'Consumíveis', price: '15-200 Gold', priority: 'Alta' },
                  { item: 'Equipamentos', price: '80-5000 Gold', priority: 'Média' },
                  { item: 'Spells', price: 'Desbloqueados por Nível', priority: 'Automática' },
                ].map((purchase, i) => (
                  <div key={i} className="bg-slate-900/50 p-4 rounded border border-slate-700">
                    <div className="font-semibold text-amber-400">{purchase.item}</div>
                    <div className="text-xs text-slate-400 mt-1">{purchase.price}</div>
                    <div
                      className={`text-xs font-semibold mt-2 ${
                        purchase.priority === 'Alta'
                          ? 'text-red-400'
                          : purchase.priority === 'Média'
                            ? 'text-yellow-400'
                            : 'text-emerald-400'
                      }`}
                    >
                      Prioridade: {purchase.priority}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-3 text-amber-400">💡 Dica Econômica</h3>
              <p className="text-slate-300 text-sm">
                Mantenha um fundo de emergência de 500-1000 Gold para consumíveis críticos. Invista
                extra em equipamentos que aumentam seu nível de poder.
              </p>
            </div>
          </div>
        </Section>

        {/* DICAS E ESTRATÉGIA */}
        <Section id="tips" title="Dicas & Estratégia">
          <div className="space-y-6">
            <div className="bg-slate-800/30 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4 text-amber-400">Estratégias Gerais</h3>
              <div className="space-y-4">
                {[
                  {
                    title: 'Conserve Consumíveis',
                    tip: 'Use apenas quando crítico. O gold de um consumível comprado é melhor gasto em equipamento.',
                  },
                  {
                    title: 'Equilíbrio é Rei',
                    tip: 'Não ignore DEF por ATK puro. Um personagem com 50/50 é melhor que 80/20.',
                  },
                  {
                    title: 'Conheça os Inimigos',
                    tip: 'Cada monstro tem padrões. Aprenda a evitá-los ou contra-atacá-los.',
                  },
                  {
                    title: 'Planeje Múltiplos Personagens',
                    tip: 'Crie diferentes builds: Tank, DPS, Mago. Cada morte ensina para o próximo.',
                  },
                  {
                    title: 'Checkpoint Estratégico',
                    tip: 'Use checkpoints em andares perigosos. Cada morte de um personagem ruim é progresso.',
                  },
                  {
                    title: 'Eventos são Presentes',
                    tip: 'Fogueiras, baús e fontes são encontrados aleatoriamente. Reconheça-os.',
                  },
                ].map((strategy, i) => (
                  <div key={i} className="bg-slate-900/50 p-4 rounded border border-slate-700">
                    <div className="font-semibold text-amber-400 mb-1">{strategy.title}</div>
                    <div className="text-slate-300 text-sm">{strategy.tip}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-3 text-amber-400">🎯 Objetivo Filosófico</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Tower Trials não é sobre vencer infinitamente. É sobre subir o máximo que pode,
                aprender do fracasso e tentar novamente com novo conhecimento. Cada morte é mentor.
                Cada vitória é conquista. A jornada transcende qualquer destino final.
              </p>
            </div>
          </div>
        </Section>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-700 mt-12 py-8 px-4 bg-slate-900/50">
        <div className="max-w-6xl mx-auto text-center text-slate-400 text-sm">
          <p>Guia Completo Tower Trials © 2025</p>
          <p className="mt-2">Última atualização: 2025</p>
        </div>
      </footer>
    </div>
  );
}

function Section({
  id,
  title,
  children,
  expanded = true,
  onToggle,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div id={id} className="mb-12">
      <button onClick={onToggle} className="w-full flex items-center justify-between mb-6 group">
        <h2 className="text-4xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          {title}
        </h2>
        {onToggle && (
          <ChevronDown
            className={`w-6 h-6 text-amber-400 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {expanded !== false && <>{children}</>}
    </div>
  );
}

function ActionCard({
  title,
  description,
  formula,
  color,
}: {
  title: string;
  description: string;
  formula: string;
  color: string;
}) {
  const colorMap = {
    red: 'border-red-500/30 bg-red-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
  };

  return (
    <div className={`border rounded-lg p-4 ${colorMap[color as keyof typeof colorMap]}`}>
      <div className="font-semibold text-slate-200 mb-1">{title}</div>
      <div className="text-slate-300 text-sm mb-2">{description}</div>
      <div className="text-xs font-mono text-slate-400">{formula}</div>
    </div>
  );
}
