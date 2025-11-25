# Public Routes Structure

## 📂 Nova Estrutura de Rotas Públicas

```
src/routes/
├── _public.tsx                    # Layout wrapper
├── _public/
│   ├── index.tsx                 # Landing Page (/)
│   └── guide.tsx                 # Guia Completo (/guide)
```

---

## 🌐 Páginas Implementadas

### 1. Landing Page `/` 
**URL:** `/_public/` (root redirect to here)

#### Seções:
```
┌─────────────────────────────────────────┐
│ HERO SECTION                            │
│ - Logo + Tagline épico                  │
│ - CTA Principal "Começar Aventura"      │
│ - Stats Preview (20 andares, 100+ monstros, ∞ permadeath)
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ O QUE É TOWER TRIALS                    │
│ - Roguelike Progressivo                 │
│ - Permadeath Real                       │
│ - Sistema de Combate Profundo           │
│ - 50+ Magias                            │
│ - Crafting & Economia                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ EXPLORE OS ANDARES (Progresso Visual)    │
│ - Andares 1-5: Fácil                    │
│ - Andares 6-10: Médio                   │
│ - Andares 11-15: Difícil                │
│ - Andares 16-20: Extremo                │
│ (Com XP, Gold, Dificuldade por tier)    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ SISTEMA DE PROGRESSÃO                   │
│ - Experiência & Níveis (Fórmula)        │
│ - Equipamento & Raridade                │
│ - Gold & Economia                       │
│ - Atributos em Combate                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ PERMADEATH: O VERDADEIRO DESAFIO        │
│ - A Morte é Final                       │
│ - Múltiplos Personagens                 │
│ - Ciclo de Aprendizado                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ FEATURES ADICIONAIS                     │
│ - 50+ Spells                            │
│ - Sistema Crafting                      │
│ - Eventos Aleatórios                    │
│ - Estatísticas                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ CTA FINAL                               │
│ "Você está pronto?"                     │
│ - Botão: Criar Conta                    │
│ - Botão: Entrar                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ FOOTER                                  │
│ - Copyright + Links                     │
│ - Guia Completo, Status, Comunidade     │
└─────────────────────────────────────────┘
```

**Totaling:** ~8000 words de conteúdo
**Design:** Gradient Dark + Amber accents
**Responsividade:** Mobile-first, Desktop-optimized

---

### 2. Página Guia `/guide`

**URL:** `/_public/guide`

#### Seções (Expandíveis):
```
┌─────────────────────────────────────────┐
│ HEADER + ÍNDICE                         │
│ - Back button                           │
│ - Table of Contents interativa          │
│ - Links para seções                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ SISTEMA DE COMBATE [Expandível]         │
│ - Turno a Turno (4 ações)               │
│ - Action Cards (Atacar, Defender, etc)  │
│ - Cálculo de Dano com Fórmulas          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ PROGRESSÃO & NÍVEIS [Expandível]        │
│ - Fórmula XP Necessário                 │
│ - Tabela de Slots por Nível             │
│ - Grid de Desbloques                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ATRIBUTOS DETALHADOS                    │
│ - HP, ATK, DEF, MANA, SPD               │
│ - Descrição + Fontes                    │
│ - Impacto em Combate                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ SISTEMA DE EQUIPAMENTO                  │
│ - 8 Slots com bônus                     │
│ - 5 Raridades (Common-Legendary)        │
│ - Progressão por Andar                  │
│ - Dica: Build Equilibrado               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ SPELLS & MAGIAS                         │
│ - Tipos de Magias (6 tipos)             │
│ - 50+ Exemplos                          │
│ - Grid de Raridades                     │
│ - Progressão de Desbloques              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ BESTIARY & MONSTROS                     │
│ - 4 Tiers de Dificuldade                │
│ - Listas de Monstros por Tier           │
│ - Recompensas (XP, Gold, Dificuldade)   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ECONOMIA & GOLD                         │
│ - Fórmula de Venda (Consumíveis/Drops)  │
│ - Onde Gastar (Prioridades)             │
│ - Dica Econômica                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ DICAS & ESTRATÉGIA                      │
│ - 6 Estratégias Gerais                  │
│ - Objetivo Filosófico                   │
│ - Mindset de Permadeath                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ FOOTER                                  │
│ - Guia Completo © 2025                  │
│ - Última atualização                    │
└─────────────────────────────────────────┘
```

**Totaling:** ~6000 words de conteúdo
**Design:** Grid responsivo + Cards estruturados
**Interatividade:** Seções colapsáveis (ainda visível ao scroll)

---

## 🔗 Navigation Flow

```
          ┌─────────────┐
          │  Root (/)   │
          └──────┬──────┘
                 │
        redirect │
                 ▼
    ┌────────────────────────┐
    │   /_public/index       │
    │   (Landing Page)       │
    └────┬─────────┬──────┬──┘
         │         │      │
         │ "CTA"   │      │ "Guia"
         ▼         │      ▼
    ┌─────────┐    │   ┌────────────┐
    │  /auth  │    │   │ /_public/  │
    │(Sign Up)│    │   │  guide     │
    └─────────┘    │   └────────────┘
                   │        ▲
                   │ Back   │
                   └────────┘
```

---

## 🎨 Design System

### Colors
```
Primary:     Amber 400 (#FBBF24)
Secondary:   Orange 500/600
Background:  Slate 950/900/800
Text:        Slate 300/400
Accents:     Red, Blue, Purple, Emerald, Yellow
```

### Typography
```
Hero:        text-6xl md:text-7xl (font-black)
Titles:      text-5xl (font-black)
Subtitles:   text-2xl (font-bold)
Body:        text-base (default)
Small:       text-xs/text-sm
```

### Components
```
Buttons:     Gradient fill or Border style
Cards:       bg-slate-800/50 with border
Sections:    Alternating bg with padding
Tables:      Grid layout or flex
```

---

## 📱 Responsividade

### Breakpoints
```
Mobile:      < 640px  (single column, stacked)
Tablet:      640-1024px (2 columns)
Desktop:     > 1024px (full width optimized)
```

### Mobile Optimizations
```
- Single column layouts
- Larger touch targets
- Reduced padding
- Simplified tables
- Sticky header (guide)
```

---

## ✨ Features Especiais

1. **Gradient Hero** - Visual impact
2. **Scroll Indicator** - Guides user to more content
3. **Stats Preview** - Quick facts in hero
4. **Expandable Sections** - Content organization
5. **Interactive Indices** - Easy navigation
6. **Action Cards** - Visual consistency
7. **Color-Coded Lists** - Information hierarchy
8. **Responsive Tables** - Data-heavy info

---

## 🚀 Performance

- ✅ Lightweight (no heavy images on initial load)
- ✅ Text-based content (fast rendering)
- ✅ CSS Grid/Flex for layout
- ✅ No external fonts (system fonts)
- ✅ Minimal JavaScript (just toggle expand)

---

## 📊 SEO Considerations

```
Page 1 - Landing:
- H1: "Tower Trials"
- Meta: "Roguelike com Permadeath"
- Keywords: Tower, Roguelike, Permadeath, Game
- Structure: Clear hierarchy

Page 2 - Guide:
- H1: "Guia Completo Tower Trials"
- Meta: "Sistema Detalhado de Combate, Progressão, Economia"
- Keywords: Guide, Tutorial, Game System, Strategy
- Structure: Well-organized with headers
```

---

## 🔄 Maintenance

### Future Updates
1. Add video backgrounds
2. Add player testimonials
3. Add FAQ page
4. Add blog/patch notes
5. Add community showcase
6. Add leaderboard preview

### Content Updates
- Monthly: Update rebalancing information
- Quarterly: Add new features/spells
- Annually: Major system revisions

---

**Last Updated:** 2025
**Status:** ✅ COMPLETE & PRODUCTION-READY



