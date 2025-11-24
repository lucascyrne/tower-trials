# Tower Trials - Game Design Document

## 📋 Visão Geral

**Tower Trials** é um roguelike progressivo com sistema de **permadeath** real. Os jogadores exploram uma torre com 20 andares, cada um mais desafiador que o anterior, enfrentando 100+ monstros únicos e coletando drops para progredir.

**Lore Implícita:**
A torre é uma dimensão misteriosa que testa os mortais. Cada morte é aprendizado. A verdadeira vitória não é o topo, mas a jornada e o crescimento pessoal.

---

## 🏰 Estrutura da Torre

### Andares 1-5: Os Primeiros Passos
- **Dificuldade:** Fácil
- **Monstros:** Slime Verde/Azul, Rato Gigante, Goblin, Kobold, Esqueleto, Lobo Selvagem, Aranha Venenosa
- **Recompensas:** 20-45 XP, 10-40 Gold
- **Objetivo:** Aprender mecânicas

### Andares 6-10: Intermediário
- **Dificuldade:** Médio
- **Monstros:** Orc, Zumbi, Harpia, Golem de Pedra, Mago Corrompido, Lobo Alpha, Basilisco, Morcego Vampírico, Armadura Animada, Druida Corrompido
- **Recompensas:** 60-140 XP, 50-150 Gold
- **Desafio:** Primeiros obstáculos significativos

### Andares 11-15: Avançado
- **Dificuldade:** Difícil
- **Monstros:** Ogro, Quimera, Hidra, Dragão Jovem, Lich, Troll da Montanha, Elemental de Fogo/Gelo, Golem de Cristal, Necromante
- **Recompensas:** 140-280 XP, 130-340 Gold
- **Desafio:** Crunch point - muitos jogadores morrem aqui

### Andares 16-20: End-Game
- **Dificuldade:** Extremo
- **Monstros:** Dragão Adulto, Titã de Pedra, Demônio Alado, Golem Ancestral, Dragão Ancião, Imp, Golem de Lava, Cavaleiro da Morte, Wyrm Glacial, Dragão Elemental
- **Recompensas:** 300-800 XP, 200-800 Gold
- **Desafio:** Apenas para os melhores

---

## ⚔️ Sistema de Combate

### Ações Disponíveis
1. **Ataque:** Dano = ATK ± 20% (variação aleatória)
2. **Defender:** DEF +50% por 1 turno, reduz dano significativamente
3. **Magia:** Custa Mana, baseado em tipo de spell
4. **Consumível:** 1x por turno máximo, efeitos variados

### Cálculo de Dano
```
Dano = Atacante ATK - Defensor DEF
Crítico = 30% chance (baseado em SPD)
Crítico Multiplier = 1.5x-2.0x
```

### Atributos Essenciais
- **HP:** Saúde. 0 = Morte permanente
- **ATK:** Dano causado em ataques físicos
- **DEF:** Reduz dano. Máx 100 = Imunidade total
- **MANA:** Energia para spells. Regenera naturalmente
- **SPD:** Chance crítica e ordem de ação

---

## 🎖️ Sistema de Progressão

### Fórmula de Experiência
```
XP Necessário = 50 × (Nível²)

Exemplos:
- Nível 1→2: 150 XP
- Nível 5→6: 1,300 XP
- Nível 10→11: 5,050 XP
- Nível 20→21: 20,550 XP
```

### Slots de Personagem
- **Nível 1:** 1 slot (limitado)
- **Nível 5:** 2 slots (permadeath força estratégia)
- **Nível 10:** 3 slots (mais segurança)
- **Nível 20:** ∞ slots (master reached)

### Desbloques por Nível
| Nível | Desbloqueio |
|-------|------------|
| 1 | Bola de Fogo, começar aventura |
| 2 | Cura Menor |
| 5 | Slot de Personagem #2, equipamentos Uncommon |
| 10 | Slot #3, equipamentos Rare |
| 15 | Slot #4, equipamentos Epic |
| 20 | Slots infinitos, equipamentos Legendary |

---

## 🎒 Sistema de Equipamento

### 8 Slots Disponíveis
1. **Weapon** → +ATK
2. **Shield** → +DEF (opcional)
3. **Armor (Chest)** → +DEF
4. **Helmet** → +DEF
5. **Legs** → +DEF
6. **Ring** → Bônus variado
7. **Necklace** → Bônus variado
8. **Boots** → +SPD

### Raridades (5 tiers)
| Raridade | Qualidade | Fórmula | Andares |
|----------|-----------|---------|---------|
| Common | Básico | 50-100% preço base | 1-5 |
| Uncommon | Bom | 100-150% preço base | 5-8 |
| Rare | Forte | 150-250% preço base | 10-13 |
| Epic | Muito Forte | 250-400% preço base | 15-18 |
| Legendary | Supremo | 400-500% preço base | 20 |

---

## ✨ Sistema de Spells

### 50+ Magias Únicas
Divididas em 6 tipos:

#### Damage Spells (Ofensa)
- Bola de Fogo (Nível 1): 30 dano
- Meteoro (Nível 16): 120 dano
- Apocalipse (Nível 36): 250 dano

#### Heal Spells (Cura)
- Cura Menor (Nível 2): 25 HP
- Cura Maior (Nível 17): 100 HP
- Ressurreição Completa (Nível 43): 350 HP

#### DoT Spells (Dano Contínuo)
- Veneno (Nível 3): 10 dano/turno × 3 turnos
- Praga Tóxica (Nível 18): 25 dano/turno × 5 turnos

#### Buff Spells (Fortalecimento)
- Benção da Força (Nível 10): +25 ATK × 3 turnos
- Fortificação (Nível 19): +40 DEF × 4 turnos
- Transcendência (Nível 45): +35 tudo × 6 turnos

#### Debuff Spells (Enfraquecimento)
- Fraqueza (Nível 5): -20 ATK × 2 turnos
- Terror (Nível 20): -30 em tudo × 3 turnos

#### Utility Spells (Utilitário)
- Drenar Energia (Nível 14): Roubar Mana inimiga
- Vampirismo (Nível 29): Heal baseado em dano

---

## 💰 Economia & Gold

### Fontes de Renda
1. **Monstros:** Gold direto por vitória
2. **Venda de Consumíveis:** Preço × 40%
3. **Venda de Drops:** Valor direto
4. **Venda de Equipamentos:** Raridade × 30-50%

### Gastos Principais
| Item | Preço | Prioridade |
|------|-------|-----------|
| Consumíveis Básicos | 15-200 Gold | ALTA |
| Equipamentos | 80-5000 Gold | MÉDIA |
| Spells | Desbloqueados por XP | AUTO |

### Estratégia Econômica
- Manter fundo de emergência: 500-1000 Gold
- Investir em equipamento que aumenta farming
- Vender drops e consumíveis regularmente
- Comprar potions críticas antes de boss fights

---

## 🎁 Sistema de Drops

### Raridades de Drops
| Raridade | Chance | Valor | Uso |
|----------|--------|-------|-----|
| Common | 70% | 5-9 Gold | Crafting básico |
| Uncommon | 30% | 12-19 Gold | Crafting intermediário |
| Rare | 5% | 25-45 Gold | Crafting avançado |
| Epic | 0.5% | 70-105 Gold | Crafting épico |
| Legendary | 0.1% | 200-300 Gold | Crafting lendário |

### Crafting
- Combine drops para criar consumíveis
- 7 receitas principais desbloqueáveis
- Resultado: Potions + Buffs poderosos

---

## 🌟 Eventos Especiais

### Encontros Aleatórios (em certos andares)
1. **Fogueira Acolhedora:** +40% HP, +30% Mana
2. **Baú de Tesouro:** +30-500 Gold (variável)
3. **Fonte Mágica:** +100% HP, +100% Mana (restauração completa)

---

## 💀 Sistema de Permadeath

### Conceito Central
- Morte = Perda permanente do personagem
- Sem ressurreição
- Sem rollback
- Sem segunda chance

### Psicologia do Design
1. **Tensão Genuína:** Cada combate importa
2. **Consequência Real:** Vitórias são significativas
3. **Aprendizado:** Mortes ensinam
4. **Múltiplos Personagens:** Estratégias diferentes possíveis
5. **Transcendência:** A progressão continua além de um personagem

### Segurança (Slots + Checkpoints)
- Desbloqueie múltiplos slots de personagem
- Use checkpoints em andares críticos
- Crie diferentes builds para testar
- Cada novo personagem é chance de melhorar

---

## 🎯 Filosofia de Design

### O Que Tower Trials NÃO É
- ❌ Um jogo sobre vencer infinitamente
- ❌ Um jogo onde você nunca morre (sem permadeath)
- ❌ Um jogo fácil com power creep infinito

### O Que Tower Trials É
- ✅ Uma jornada de aprendizado e crescimento
- ✅ Uma exploração de estratégia e gestão de recursos
- ✅ Uma celebração da morte como mestre
- ✅ Um balance entre risco e recompensa

### O Verdadeiro Objetivo
> Não é alcançar o topo. É subir o máximo que pode, aprender com cada derrota, e tentar novamente com novo conhecimento. A jornada transcende qualquer destino final.

---

## 📊 Estatísticas Globais

| Métrica | Valor |
|---------|-------|
| Andares | 20 |
| Monstros Únicos | 100+ |
| Spells Disponíveis | 50+ |
| Equipamentos | 100+ |
| Consumíveis | 12+ |
| Eventos Especiais | 9 |
| Raridades | 5 tiers |
| Slots Máx de Personagem | ∞ |
| XP Máximo (Nível 20) | 20.550+ infinito |

---

## 🎮 Flow do Jogador Novo

1. **Login → Criar Personagem** (Nível 1)
2. **Andar 1-5:** Aprenda combate, ganhe XP/Gold
3. **Nível 5:** Desbloquei slot #2, comece a experimentar
4. **Andares 6-10:** Primeiros desafios reais
5. **Primeira Morte:** Aprenda com ela
6. **Novo Personagem:** Aplique aprendizado
7. **Andares 11+:** Domine estratégia
8. **Escalada Infinita:** Cada personagem vai um pouco mais longe

---

## 🏆 Engaging Features

✨ **Roguelike Progressivo** - Novo a cada run
💀 **Permadeath Real** - Consequências genuínas
🎪 **Eventos Aleatórios** - Surpresas e oportunidades
📈 **Múltiplos Builds** - Versatilidade estratégica
🎯 **Checkpoints** - Proteção do progresso sem remover tensão
🛍️ **Economia Profunda** - Gold matters
🔮 **50+ Spells** - Replayability extrema

---

**Última atualização:** 2025
**Status:** Documentação Completa ✅


