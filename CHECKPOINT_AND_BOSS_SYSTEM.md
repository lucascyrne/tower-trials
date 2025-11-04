# 🗺️ Sistema de Checkpoints e Andares de Boss

## 📋 Estrutura de Progressão

### Checkpoints Disponíveis

```
Andar 1  → Sempre desbloqueado (Início)
↓
Andar 5  → Introdução (1º desafio)
↓
Andares 20, 30, 40, 50, 60... → Pós-Boss (Múltiplos de 10 a partir de 20)
```

---

## 🎮 Progressão em Fases

### **Fase 1: Introdução (Andares 1-5)**

**Checkpoints:**
- ✅ Andar 1 - Início da Torre

**Monstros (Iniciais):**
- Slime Verde (50 HP, 10 ATK)
- Slime Azul (55 HP, 12 ATK)
- Rato Gigante (45 HP, 15 ATK)
- Goblin (60 HP, 12 ATK)
- Kobold (55 HP, 18 ATK)
- Esqueleto (70 HP, 14 ATK)
- Lobo Selvagem (65 HP, 20 ATK)
- Aranha Venenosa (60 HP, 16 ATK)

**Objetivo:** Alcançar andar 5 para desbloquear primeiro checkpoint

---

### **Fase 2: Primeiro Desafio (Andares 5-10)**

**Checkpoints:**
- ✅ Andar 5 - Primeiro Desafio

**Monstros (Intermediários):**
- Orc (100 HP, 25 ATK)
- Zumbi (120 HP, 20 ATK)
- Harpia (90 HP, 30 ATK)
- Golem de Pedra (150 HP, 15 ATK)
- Mago Corrompido (80 HP, 40 ATK)
- Lobo Alpha (110 HP, 35 ATK)
- Basilisco (130 HP, 20 ATK)
- Morcego Vampírico (85 HP, 30 ATK)
- Armadura Animada (140 HP, 25 ATK)
- Druida Corrompido (90 HP, 35 ATK)

**Objetivo:** Chegar ao andar 20 e derrotar o primeiro boss

---

### **Fase 3: Early Mid-Game (Andares 11-20)**

**Checkpoints:**
- ✅ Andar 20 - Checkpoint Pós-Boss (desbloqueado após vitória)

**Monstros (Avançados):**
- Ogro (200 HP, 40 ATK)
- Quimera (180 HP, 45 ATK)
- Hidra (250 HP, 35 ATK)
- Dragão Jovem (300 HP, 50 ATK)
- Lich (220 HP, 60 ATK)
- Troll da Montanha (230 HP, 50 ATK)
- Elemental de Fogo (190 HP, 55 ATK)
- Elemental de Gelo (200 HP, 45 ATK)
- Golem de Cristal (280 HP, 35 ATK)
- Necromante (200 HP, 70 ATK)

**Boss do Andar 20:**
- 🐉 **Dragão Ancião** (700 HP, 100 ATK, 80 DEF, 300 Mana)
  - Tipo: Balanced
  - Recompensa: 750 XP, 700 Gold
  - Drop especial: Lágrima de Dragão

**Objetivo:** Derrotar Dragão Ancião e desbloquear checkpoint 20

---

### **Fase 4: Mid-Game (Andares 21-30)**

**Checkpoints:**
- ✅ Andar 30 - Checkpoint Pós-Boss (desbloqueado após vitória)

**Monstros (End-Game):**
- Dragão Adulto (400 HP, 70 ATK)
- Titã de Pedra (500 HP, 50 ATK)
- Demônio Alado (350 HP, 80 ATK)
- Golem Ancestral (600 HP, 60 ATK)
- Imp (320 HP, 75 ATK)
- Golem de Lava (450 HP, 60 ATK)
- Cavaleiro da Morte (380 HP, 85 ATK)
- Wyrm Glacial (550 HP, 70 ATK)

**Boss do Andar 30:**
- 🐲 **Dragão Elemental** (750 HP, 110 ATK, 70 DEF, 350 Mana)
  - Tipo: Balanced
  - Recompensa: 800 XP, 800 Gold
  - Drop especial: Essência Elemental Pura

**Objetivo:** Derrotar Dragão Elemental e desbloquear checkpoint 30

---

### **Fases Posteriores (Andares 40+)**

O padrão continua: **a cada 10 andares há um boss e um novo checkpoint**

**Progressão:**
- Andar 40 → Checkpoint Pós-Boss
- Andar 50 → Checkpoint Pós-Boss
- Andar 60 → Checkpoint Pós-Boss
- ... e assim por diante até andar 100+

---

## 🎯 Sistema de Desbloqueio

### Como Funciona

```typescript
// Pseudo-código do sistema
const checkpointLogic = {
  floor: 1,      // Sempre desbloqueado
  floor: 5,      // Desbloqueado ao alcançar andar 5
  floor: 20,     // Desbloqueado ao derrotar boss no andar 20
  floor: 30,     // Desbloqueado ao derrotar boss no andar 30
  floor: 40,     // Desbloqueado ao derrotar boss no andar 40
  // ... e assim por diante
};
```

### Validação de Checkpoints

Um andar é considerado checkpoint válido se:
- É o andar **1** (sempre)
- É o andar **5** (introdução)
- É um múltiplo de **10 a partir de 20** (20, 30, 40, 50...)

```typescript
isValidCheckpoint(floor) = floor === 1 
                        || floor === 5 
                        || (floor >= 20 && floor % 10 === 0)
```

---

## ⚔️ Balanceamento de Dificuldade

### Escala de Dano por Fase

| Fase | Andares | ATK Médio | Evolução |
|------|---------|-----------|----------|
| Introdução | 1-5 | 10-20 | +100% baseline |
| 1º Desafio | 5-10 | 20-40 | +200% baseline |
| Early Mid | 11-20 | 40-70 | +400% baseline |
| Mid-Game | 21-30 | 70-110 | +700% baseline |
| Late Game | 31-40 | 110+ | +1000%+ baseline |

### Recompensas por Boss

```typescript
Boss Level 20 (Dragão Ancião)
├─ XP: 750 (progressão rápida)
├─ Gold: 700 (acessível para crafting)
└─ Drops: Lágrima de Dragão (rara)

Boss Level 30 (Dragão Elemental)
├─ XP: 800 (progressão balanceada)
├─ Gold: 800 (sustentável)
└─ Drops: Essência Elemental Pura (épica)
```

---

## 🗺️ Mapa Mental da Progressão

```
┌─────────────────────────────────────────────────────────────┐
│                    TORRE DE TRIALS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Andar 1      Andar 5          Andar 20        Andar 30    │
│  [=====]      [COROA]          [COROA]         [COROA]     │
│   START       1º Desafio    Boss Dragon 1   Boss Dragon 2  │
│               Intro         Ancião          Elemental       │
│                                                             │
│  Monstros     Monstros      Monstros       Monstros       │
│  Fracos    → Intermediários → Avançados  → End-Game       │
│  (10-20 ATK)  (20-40 ATK)    (40-70 ATK)  (70-110 ATK)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 💾 Persistência e Salvar

Quando um jogador:
1. **Derrota o boss do andar 20** → Checkpoint 20 é liberado automaticamente
2. **Alcança o checkpoint 20** → Pode iniciar daí com vida/mana completa
3. **Morre acima do checkpoint 20** → Pode regressar e continuar

---

## 📊 Estatísticas Atuais

### Total de Monstros
- Fase 1 (1-5): 8 monstros
- Fase 2 (5-10): 10 monstros
- Fase 3 (11-20): 10 monstros
- Fase 4 (21-30): 8 monstros
- **Total: 36 monstros únicos**

### Bosses Implementados
- Andar 20: Dragão Ancião ✅
- Andar 30: Dragão Elemental ✅
- Andares 40+: Pode ser expandido conforme necessário

---

## 🔄 Fluxo de Jogo Recomendado

```
Jogador iniciante
  │
  ├─→ Andar 1-5 (aprender mecânicas)
  │   └─→ Desbloqueia Checkpoint 5
  │
  ├─→ Andar 5-20 (progressão natural)
  │   └─→ Derrota Dragão Ancião
  │   └─→ Desbloqueia Checkpoint 20
  │
  ├─→ Andar 20-30 (desafio mid-game)
  │   └─→ Derrota Dragão Elemental
  │   └─→ Desbloqueia Checkpoint 30
  │
  └─→ Andares 30+ (late-game, expansível)
      └─→ Progressão contínua...
```

---

## ✅ Validação

- ✓ Checkpoints em posições corretas (1, 5, 20, 30, 40...)
- ✓ Monstros escalonados por dificuldade
- ✓ Bosses em andares múltiplos de 10 (20, 30, 40...)
- ✓ Recompensas balanceadas por fase
- ✓ Interface de mapa atualizada
- ✓ Validação de checkpoints otimizada

