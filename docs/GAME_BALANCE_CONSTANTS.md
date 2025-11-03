# Constantes de Balanceamento - Tower Trials

## Visão Geral

Este documento consolida **todas as constantes de balanceamento** do jogo Tower Trials extraídas das 120 migrações e do seed.sql. Valores finais após múltiplos rebalanceamentos.

---

## 📊 Índice

1. [Sistema de Personagens](#sistema-de-personagens)
2. [Sistema de Combate e Monstros](#sistema-de-combate-e-monstros)
3. [Sistema de Equipamentos](#sistema-de-equipamentos)
4. [Sistema de Consumíveis](#sistema-de-consumíveis)
5. [Sistema de Progressão (XP e Níveis)](#sistema-de-progressão-xp-e-níveis)
6. [Sistema de Economia (Gold e Preços)](#sistema-de-economia-gold-e-preços)
7. [Sistema de Drops](#sistema-de-drops)
8. [Sistema de Auto-Heal](#sistema-de-auto-heal)
9. [Sistema de Slots](#sistema-de-slots)
10. [Sistema de Andares](#sistema-de-andares)

---

## Sistema de Personagens

### Atributos Base Iniciais

```
Todos os atributos começam em: 10
- Strength: 10
- Dexterity: 10
- Intelligence: 10
- Wisdom: 10
- Vitality: 10
- Luck: 10
```

### Pontos de Atributo

```
Pontos Iniciais: 5 pontos (para personalização inicial)
Pontos por Level Up: 2 pontos base
Bônus a cada 5 níveis: +1 ponto extra
Limite Máximo por Atributo: 50 pontos
```

**Exemplo de Progressão:**

- Level 2: +2 pontos
- Level 5: +3 pontos (2 base + 1 bônus)
- Level 10: +3 pontos (2 base + 1 bônus)
- Level 15: +3 pontos (2 base + 1 bônus)

---

### Fórmulas de Stats Derivados

#### HP Máximo

```
Base HP = 80 + (5 * Level)
HP Derivado = Base HP + (Vitality * 8)

Exemplo (Level 1, Vitality 10):
Base = 80 + (5 * 1) = 85
HP Total = 85 + (10 * 8) = 165 HP
```

#### Mana Máxima

```
Base Mana = 40 + (3 * Level)
Mana Derivada = Base Mana + (Intelligence * 5)

Exemplo (Level 1, Intelligence 10):
Base = 40 + (3 * 1) = 43
Mana Total = 43 + (10 * 5) = 93 Mana
```

#### Ataque (ATK)

```
Base ATK = 15 + (2 * Level)
ATK Derivado = Base ATK + (Strength * 2)

Exemplo (Level 1, Strength 10):
Base = 15 + (2 * 1) = 17
ATK Total = 17 + (10 * 2) = 37 ATK
```

#### Defesa (DEF)

```
Base DEF = 8 + Level
DEF Derivada = Base DEF + (Vitality + Wisdom)

Exemplo (Level 1, Vitality 10, Wisdom 10):
Base = 8 + 1 = 9
DEF Total = 9 + (10 + 10) = 29 DEF
```

#### Velocidade (Speed)

```
Base Speed = 8 + Level
Speed Derivada = Base Speed + FLOOR(Dexterity * 1.5)

Exemplo (Level 1, Dexterity 10):
Base = 8 + 1 = 9
Speed Total = 9 + FLOOR(10 * 1.5) = 9 + 15 = 24 Speed
```

#### Chance Crítica

```
Critical Chance = Luck * 0.5%

Exemplo:
Luck 10 = 5% crit chance
Luck 20 = 10% crit chance
Luck 50 = 25% crit chance
```

#### Dano Crítico

```
Critical Damage = 1.5 + (Luck / 100)

Exemplo:
Luck 10 = 1.5 + 0.10 = 1.6x (160% damage)
Luck 50 = 1.5 + 0.50 = 2.0x (200% damage)
```

---

### Sistema de Maestrias (Skills)

#### Maestrias Disponíveis

```
- sword_mastery (Maestria com Espadas)
- axe_mastery (Maestria com Machados)
- blunt_mastery (Maestria com Armas de Concussão)
- defense_mastery (Maestria em Defesa)
- magic_mastery (Maestria em Magia)
```

#### Progressão de Maestrias

```
Level Inicial: 1
Level Máximo: 100
Fórmula XP: FLOOR(50 * POW(1.4, current_level - 1))

Exemplos:
Level 1→2: 50 XP
Level 2→3: 70 XP
Level 5→6: 136 XP
Level 10→11: 492 XP
Level 20→21: 7,689 XP
```

#### Requisitos de Maestria

```
Para equipar armas raras ou superiores (level_requirement >= 10):
Maestria Mínima Requerida: Level 10

Mapeamento:
- Espadas/Adagas → sword_mastery
- Machados → axe_mastery
- Maças/Martelos → blunt_mastery
- Cajados → magic_mastery
```

---

## Sistema de Combate e Monstros

### Escalamento de Monstros por Andar

#### Sistema Original (Versão Base)

```sql
Scaling Factor: 0.15 (15% por andar)
Floor Range: 5 andares

HP = base_hp + (floor - min_floor) * MAX(8, FLOOR(base_hp * 0.15))
ATK = base_atk + (floor - min_floor) * MAX(2, FLOOR(base_atk * 0.15))
DEF = base_def + (floor - min_floor) * MAX(1, FLOOR(base_def * 0.15))
Speed = base_speed + (floor - min_floor) * MAX(1, FLOOR(base_speed * 0.15 * 0.5))

Rewards:
XP = base_xp + (floor - min_floor) * MAX(3, FLOOR(base_xp * 0.15))
Gold = base_gold + (floor - min_floor) * MAX(4, FLOOR(base_gold * 0.15))
```

#### Sistema de Tiers (Versão Avançada)

```sql
Tier Calculation:
current_tier = CEIL(floor / 10.0)

Base Scaling Factor: 2.2 (220% por tier)
Boss Scaling Factor: 2.5 (250% por tier)

HP (Normal) = base_hp * POW(2.2, current_tier - 1)
HP (Boss) = base_hp * POW(2.5, current_tier - 1)

Exemplo Floor 20 (Tier 2):
Monstro Normal: HP * POW(2.2, 1) = HP * 2.2
Boss: HP * POW(2.5, 1) = HP * 2.5
```

### Caps de Combate

#### Chance Crítica de Monstros

```
Base: 5% (0.05)
Escalamento: +1.5% por tier
Cap Máximo: 40% (0.4)

Fórmula: MIN(base_crit * (1 + (tier - 1) * 0.15), 0.4)
```

#### Dano Crítico de Monstros

```
Base: 150% (1.5)
Escalamento: +5% por tier
Cap Máximo: 250% (2.5)

Fórmula: MIN(base_crit_dmg * (1 + (tier - 1) * 0.05), 2.5)
```

#### Resistências de Monstros

```
Resistência Física: Cap 75% (0.75)
Resistência Mágica: Cap 75% (0.75)
Resistência a Debuff: Cap 90% (0.9)
Resistência Crítica: Cap 80% (0.8)

Escalamento: +0.8% por andar (physical/magical)
            +1.0% por andar (debuff)
            +1.0% por andar (critical)
```

### Vulnerabilidades Padrão

```
Physical Vulnerability: 1.0 (100% damage - padrão)
Magical Vulnerability: 1.0 (100% damage - padrão)

Nota: Traits especiais podem modificar estes valores
```

---

## Sistema de Equipamentos

### Preços de Loja (Após Rebalanceamento)

#### Equipamentos Common (Nível 1)

```
Espada de Ferro: 100g (era 150g)
Adaga de Bronze: 80g (era 120g)
Varinha de Madeira: 90g (era 140g)
Armadura de Couro: 100g (era 150g)
Túnica de Aprendiz: 85g (era 130g)
Vestes Leves: 80g (era 120g)
Anel de Mana: 110g (era 160g)
Amuleto de Proteção: 100g (era 150g)
Botas Velozes: 90g (era 140g)
```

#### Equipamentos Uncommon (Nível 5-8)

```
Faixa de Preço: 330g - 390g
Exemplo: Espada de Aço: 350g
```

#### Equipamentos Rare (Nível 10-13)

```
Faixa de Preço: 780g - 900g
Exemplo: Lâmina do Dragão: 800g
```

#### Equipamentos Epic (Nível 15-18)

```
Faixa de Preço: 1,800g - 2,100g
Exemplo: Espada do Abismo: 1,800g
```

#### Equipamentos Legendary (Nível 20)

```
Preço Fixo: 5,000g
Exemplos:
- Excalibur: 5,000g
- Mjolnir: 5,000g
- Cajado de Merlin: 5,000g
```

---

### Preços de Venda (% do preço original)

```
Common: 25% (0.25)
Uncommon: 30% (0.30)
Rare: 35% (0.35)
Epic: 40% (0.40)
Legendary: 45% (0.45)

Nota: Sistema anti-exploit para evitar farming de gold
```

---

## Sistema de Consumíveis

### Preços de Loja (Após Rebalanceamento - Muito mais acessíveis)

#### Poções de Vida

```
Poção de Vida Pequena: 15g (efeito: +20 HP)  - Muito barata!
Poção de Vida Média: 60g (efeito: +50 HP)
Poção de Vida Grande: 200g (efeito: +100 HP)
```

#### Poções de Mana

```
Poção de Mana Pequena: 12g (efeito: +10 Mana)  - Incentiva uso de magias
Poção de Mana Média: 50g (efeito: +25 Mana)
Poção de Mana Grande: 160g (efeito: +50 Mana)
```

#### Utilitários

```
Antídoto: 40g (remove efeitos negativos) - Mais barato
Elixir de Força: 100g (+15 ATK temporário)
Elixir de Defesa: 80g (+12 DEF temporário)
```

### Preço de Venda de Consumíveis

```
Fixo: 30% do preço original (0.30)

Exemplo:
Poção de Vida Média (60g) → Venda por 18g
```

---

## Sistema de Progressão (XP e Níveis)

### XP para Próximo Nível (Personagem)

```
Fórmula: FLOOR(100 * POW(1.5, current_level - 1))

Tabela de Progressão:
Level 1→2: 100 XP
Level 2→3: 150 XP
Level 3→4: 225 XP
Level 4→5: 337 XP
Level 5→6: 506 XP
Level 10→11: 3,838 XP
Level 15→16: 29,127 XP
Level 20→21: 221,170 XP
```

### Recompensas de Monstros (Após Rebalanceamento - MUITO AUMENTADAS)

#### Monstros Iniciais (Andares 1-5)

```
Slime Verde (Floor 1): 35 XP, 30 Gold (era 20/10)
Slime Azul (Floor 1): 40 XP, 35 Gold (era 22/12)
Rato Gigante (Floor 1): 45 XP, 40 Gold (era 25/15)
Goblin (Floor 2): 55 XP, 50 Gold (era 30/20)
Kobold (Floor 3): 65 XP, 60 Gold (era 35/25)
Esqueleto (Floor 4): 75 XP, 70 Gold (era 40/30)
Lobo Selvagem (Floor 4): 80 XP, 75 Gold (era 42/28)
Aranha Venenosa (Floor 5): 85 XP, 80 Gold (era 45/32)

Impacto: Agora é possível comprar 2+ poções por combate!
```

#### Monstros Intermediários (Andares 6-10)

```
Orc (Floor 6): 110 XP, 100 Gold (era 60/40)
Zumbi (Floor 7): 125 XP, 115 Gold (era 70/45)
Harpia (Floor 8): 140 XP, 130 Gold (era 80/50)
Golem de Pedra (Floor 9): 155 XP, 145 Gold (era 90/55)
Mago Corrompido (Floor 10): 170 XP, 160 Gold (era 100/60)
```

#### Monstros Avançados (Andares 11-15)

```
Ogro (Floor 11): 220 XP, 200 Gold (era 150/70)
Quimera (Floor 12): 250 XP, 230 Gold (era 170/75)
Hidra (Floor 13): 280 XP, 260 Gold (era 190/80)
Dragão Jovem (Floor 14): 320 XP, 300 Gold (era 220/90)
Lich (Floor 15): 360 XP, 340 Gold (era 250/100)
```

#### Monstros End-Game (Andares 16-20)

```
Dragão Adulto (Floor 16): 450 XP, 400 Gold (era 300/120)
Titã de Pedra (Floor 17): 500 XP, 450 Gold (era 330/130)
Demônio Alado (Floor 18): 550 XP, 500 Gold (era 360/140)
Golem Ancestral (Floor 19): 600 XP, 550 Gold (era 390/150)
Dragão Ancião (Floor 20): 750 XP, 700 Gold (era 500/200)
Dragão Elemental (Floor 20): 800 XP, 800 Gold (era 550/250)
```

**Nota**: Recompensas foram dobradas ou triplicadas para tornar o jogo mais sustentável e menos grindy.

---

## Sistema de Economia (Gold e Preços)

### Economia Inicial

```
Gold Inicial: 0
Gold em Posse do Personagem: Sem limite
```

### Razão de Conversão Poção/Gold

```
Combate Early Game (Floor 1-5):
- Recompensa média: ~50 gold
- Poção pequena: 15 gold
- Razão: 3.3 poções por combate

Combate Mid Game (Floor 10):
- Recompensa média: ~160 gold
- Poção média: 60 gold
- Razão: 2.6 poções por combate

Combate Late Game (Floor 15):
- Recompensa média: ~340 gold
- Poção grande: 200 gold
- Razão: 1.7 poções por combate

Nota: Sistema balanceado para sustentabilidade sem grinding excessivo
```

---

## Sistema de Drops

### Valores de Drops de Monstros

#### Drops Common

```
Faixa de Valor: 4g - 9g
Exemplos:
- Dente de Rato: 4g
- Olho de Slime: 5g
- Fragmento de Osso: 6g
- Garra de Goblin: 7g
- Presa de Lobo: 8g
- Glândula Venenosa: 9g
```

#### Drops Uncommon

```
Faixa de Valor: 12g - 19g
Exemplos:
- Presa de Orc: 12g
- Carne Putrefata: 14g
- Pena de Harpia: 15g
- Orbe Mágico: 18g
```

#### Drops Rare

```
Faixa de Valor: 25g - 45g
Exemplos:
- Dente de Ogro: 25g
- Chifre de Quimera: 30g
- Escama de Hidra: 35g
- Escama de Dragão Jovem: 40g
- Essência de Lich: 45g
```

#### Drops Epic

```
Faixa de Valor: 70g - 105g
Exemplos:
- Escama de Dragão Adulto: 70g
- Núcleo de Pedra: 80g
- Coração de Demônio: 90g
- Núcleo Ancestral: 100g
- Cristal Glacial: 105g
```

#### Drops Legendary

```
Faixa de Valor: 200g - 300g
Exemplos:
- Lágrima de Dragão: 200g
- Pó de Estrela: 250g
- Essência Elemental Pura: 300g
```

---

### Chances de Drop

#### Por Raridade de Monstro

```
Early Game (Floors 1-5):
Drop Chance: 60-70%
Quantidade: 1-4 itens

Mid Game (Floors 6-10):
Drop Chance: 55-65%
Quantidade: 1-3 itens

Late Game (Floors 11-15):
Drop Chance: 45-50%
Quantidade: 1-3 itens

End Game (Floors 16-20):
Drop Chance: 25-35%
Quantidade: 1-2 itens

Bosses (Floor 20):
Drop Chance Lendário: 10-15%
Quantidade: 1 item
```

---

## Sistema de Auto-Heal

### Parâmetros de Cura Offline

```
Tempo Total de Cura: 2 horas (7200 segundos)
Range de Cura: 0.1% → 100%
Taxa de Cura: ~0.01387% por segundo

Fórmula:
heal_rate_per_second = (100% - 0.1%) / 7200s
heal_rate_per_second = 99.9% / 7200s
heal_rate_per_second ≈ 0.01387% por segundo

Aplica-se a: HP e Mana simultaneamente
```

### Exemplos de Cura

```
1 minuto offline (60s): ~0.83% de HP/Mana
5 minutos offline (300s): ~4.16% de HP/Mana
30 minutos offline (1800s): ~25% de HP/Mana
1 hora offline (3600s): ~50% de HP/Mana
2 horas offline (7200s): 100% de HP/Mana
```

---

## Sistema de Slots

### Configuração de Slots

```
Potion Slots: 3 slots (posições 1, 2, 3)
Spell Slots: 3 slots (posições 1, 2, 3)

Inicialização: Automática ao criar personagem
Valor Inicial: NULL (vazios)
```

---

## Sistema de Andares

### Sistema de Checkpoints

```
Checkpoint Base: Andar 1 (sempre disponível)
Checkpoints Adicionais: A cada 10 andares (10, 20, 30, 40...)

Desbloqueio: Automático ao alcançar o andar
Permite: Começar jogo de um checkpoint já alcançado
```

### Tipos de Andares (Geração Dinâmica)

```
Boss Floor: A cada 10 andares (10, 20, 30, 40...)
Elite Floor: A cada 5 andares não-boss (5, 15, 25, 35...)
Event Floor: A cada 7 andares (7, 14, 21, 28...)
Common Floor: Demais andares

Checkpoint: Apenas Boss Floors (múltiplos de 10)
```

---

## Sistema de Character Slots

### Slots Disponíveis

```
Slots Base (Gratuitos): 3 slots

Slots Desbloqueáveis: Baseado em Total Character Level
Fórmula: (slot_number - 3) * 15 níveis totais

Tabela de Desbloqueio:
Slot 4: 15 níveis totais
Slot 5: 30 níveis totais
Slot 6: 45 níveis totais
Slot 7: 60 níveis totais
Slot 8: 75 níveis totais
Slot 9: 90 níveis totais
Slot 10: 105 níveis totais
...
Slot 20 (Limite): 255 níveis totais

Exemplo:
3 personagens level 10 = 30 níveis totais = 5 slots disponíveis
```

---

## 📝 Histórico de Rebalanceamentos

### Principais Mudanças de Balanceamento

#### Dezembro 2024 - Rebalanceamento Sustentável

- **Recompensas de Monstros**: Dobradas/triplicadas
- **Preços de Consumíveis**: Reduzidos em 30-50%
- **Preços de Equipamentos Básicos**: Reduzidos em 20-40%
- **Objetivo**: Tornar o jogo menos grindy, mais sustentável

#### Dezembro 2024 - Sistema de Tiers

- **Escalamento de Monstros**: Mudado de linear para exponencial por tiers
- **Scaling Factor**: 1.5 → 1.8 → 2.0 → 2.2 (final)
- **Boss Scaling**: Fator separado de 2.5
- **Objetivo**: Aumentar dificuldade end-game

#### Dezembro 2024 - Rebalanceamento Crítico/Mágico

- **Critical Damage**: Fórmulas ajustadas
- **Magical Damage**: Escalamento melhorado
- **Resistências**: Caps ajustados

#### Dezembro 2024 - Early Game Balance

- **Fine-tuning**: Ajustes finos em stats de monstros iniciais
- **Equipment Prices**: Redução adicional para facilitar início
- **Starter Items**: Adicionadas poções e spell iniciais

---

## 🎯 Próximos Passos

- [ ] Definir estrutura de novas migrações consolidadas
- [ ] Criar seed otimizado com valores finais
- [ ] Implementar migrações v2
- [ ] Validar balanceamento em testes
