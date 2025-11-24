# 🎮 Tower Trials - Quick Reference Guide

## 📍 Onde Estão as Novas Páginas?

### Landing Page (Home)
- **URL:** `/_public/` → redirects from `/`
- **Arquivo:** `src/routes/_public/index.tsx`
- **Tamanho:** ~450 linhas
- **Seções:** 8 (Hero + 7 conteúdo)

### Página Guia
- **URL:** `/_public/guide`
- **Arquivo:** `src/routes/_public/guide.tsx`
- **Tamanho:** ~600 linhas
- **Seções:** 8 (Header + índice + 8 temas)

---

## 🚀 Testar Localmente

```bash
# Instalar dependências (se necessário)
npm install

# Rodar development server
npm run dev

# Acessar
http://localhost:5173/          # Landing page
http://localhost:5173/guide     # Página guia
```

---

## 🎨 Componentes Reutilizados

### Section (Componente Base)
```typescript
<Section
  id="section-id"
  title="Título da Seção"
  expanded={true/false}
  onToggle={() => toggleSection()}
>
  {/* Conteúdo aqui */}
</Section>
```

### ActionCard (para Combate)
```typescript
<ActionCard
  title="Atacar"
  description="Causa dano"
  formula="Dano = ATK ± 20%"
  color="red"
/>
```

---

## 📊 Fórmulas Principais

### XP Necessário
```
50 × (Nível²)
```

### Dano em Combate
```
Dano = ATK ± 20% (variação)
Crítico: 30% chance, 1.5x-2.0x multiplier
```

### Venda de Itens
```
Consumível: Preço × 40%
Drop: Valor direto
Equipamento: Raridade × 30-50%
```

---

## 🎯 SEO Tags

### Landing Page
```html
<title>Tower Trials - Roguelike com Permadeath</title>
<meta name="description" content="...">
<h1>Tower Trials</h1>
```

### Guide Page
```html
<title>Guia Completo Tower Trials - Sistema & Estratégia</title>
<meta name="description" content="...">
<h1>Guia Completo</h1>
```

---

## 🎨 Paleta de Cores

```css
/* Primary */
--amber-400: #FBBF24
--orange-500: #F97316
--orange-600: #EA580C

/* Background */
--slate-950: #03030F
--slate-900: #0F172A
--slate-800: #1E293B

/* Text */
--slate-300: #CBD5E1
--slate-400: #94A3B8

/* Accents */
--red-400: #F87171
--blue-400: #60A5FA
--purple-400: #C084FC
--emerald-400: #4ADE80
--yellow-400: #FACC15
```

---

## 🔄 Fluxo de Usuário

```
Novo Visitante
    ↓
Landing Page (Hero → Engajamento)
    ↓
Explorar Seções (O que é? Progressão?)
    ↓
Ler Guia (Clica "Ler Guia" ou scroll footer)
    ↓
Guia Completo (Aprende sistema em detalhe)
    ↓
Voltar (Clica "Voltar" ou back button)
    ↓
CTA Final (Criar Conta / Entrar)
    ↓
Auth Page (/auth)
```

---

## 📝 Estrutura de Conteúdo

### Landing Page Outline
```
1. HERO
   - Logo + Tagline
   - CTA "Começar"
   - Stats Preview

2. O QUE É TOWER TRIALS
   - Roguelike Progressivo
   - Permadeath Real
   - Progressão Vertical
   - Sistema de Combate
   - 50+ Magias
   - Crafting & Economia

3. EXPLORE OS ANDARES
   - 1-5: Primeiros Passos
   - 6-10: Intermediário
   - 11-15: Avançado
   - 16-20: End-Game

4. SISTEMA DE PROGRESSÃO
   - Experiência & Níveis
   - Equipamento & Raridade
   - Gold & Economia
   - Atributos em Combate

5. PERMADEATH
   - A Morte é Final
   - Múltiplos Personagens

6. FEATURES ADICIONAIS
   - 50+ Spells
   - Crafting
   - Eventos
   - Estatísticas

7. CTA FINAL
   - "Você está pronto?"
   - Botões de Ação

8. FOOTER
   - Links + Copyright
```

### Guide Page Outline
```
1. HEADER + ÍNDICE

2. SISTEMA DE COMBATE
   - Turno a Turno
   - Cálculo de Dano

3. PROGRESSÃO & NÍVEIS
   - Fórmula XP
   - Slots de Personagem

4. ATRIBUTOS DETALHADOS
   - HP, ATK, DEF, MANA, SPD

5. SISTEMA DE EQUIPAMENTO
   - 8 Slots
   - 5 Raridades

6. SPELLS & MAGIAS
   - 6 Tipos
   - 50+ Exemplos

7. BESTIARY
   - 4 Tiers de Monstros
   - Recompensas por Tier

8. ECONOMIA & GOLD
   - Fórmula de Venda
   - Onde Gastar

9. DICAS & ESTRATÉGIA
   - 6 Estratégias
   - Objetivo Filosófico

10. FOOTER
```

---

## 🔍 Checklist de Manutenção

- [ ] Revisar copy periodicamente
- [ ] Atualizar números quando game muda
- [ ] Adicionar novos spells/monstros ao guide
- [ ] Verificar links internos
- [ ] Testar responsividade
- [ ] Medir engagement (analytics)
- [ ] Coletar feedback (surveys)
- [ ] A/B test CTAs

---

## 🐛 Troubleshooting

### Página não carrega
```bash
# Verificar se rota está registrada
cat src/routes/_public/index.tsx

# Verificar imports
grep -r "_public/index" src/

# Limpar cache
rm -rf .next
npm run dev
```

### Styling quebrado
```bash
# Verificar Tailwind
npm run build

# Verificar cores
grep -E "(amber|orange|slate)" src/routes/_public/
```

### Expansão de seções não funciona
```bash
# Verificar useState
grep -n "useState" src/routes/_public/guide.tsx

# Verificar onClick handlers
grep -n "toggleSection" src/routes/_public/guide.tsx
```

---

## 📚 Documentação Relacionada

- `GAME_DESIGN_DOCUMENT.md` - Lore, mecânicas, números
- `LANDING_PAGE_SUMMARY.md` - Detalhes de implementação
- `PUBLIC_ROUTES_STRUCTURE.md` - Estrutura de rotas e design
- `IMPLEMENTATION_SUMMARY.pt-BR.md` - Resumo executivo

---

## 🎯 KPIs para Rastrear

| KPI | Ferramenta | Meta |
|-----|-----------|------|
| Bounce Rate | Google Analytics | < 40% |
| Time on Page | Google Analytics | > 2 min |
| Click-Through Rate | Tag Manager | > 5% |
| Guide Engagement | Analytics | > 60% scroll |
| Auth Conversion | Analytics | > 15% |
| Mobile Conversion | Device Data | > 80% desktop |

---

## 📞 Suporte Rápido

### Adicionar nova seção à landing
1. Copiar estrutura de section existente
2. Adicionar content
3. Testar responsividade
4. Commit com mensagem clara

### Adicionar novo item ao guide
1. Expandir section relevante
2. Criar novo Card/Grid
3. Adicionar ao índice
4. Testar link âncora

### Atualizar números do game
1. Editar em `GAME_DESIGN_DOCUMENT.md`
2. Atualizar landing/guide
3. Verificar todas as referências
4. Testar links cruzados

---

## 🚀 Deploy Checklist

- [ ] Build sem erros: `npm run build`
- [ ] Linting pass: `npm run lint`
- [ ] Links funcionam
- [ ] Mobile responsivo
- [ ] CTAs funcionam
- [ ] Images carregam
- [ ] Footer visível
- [ ] Sem console errors

---

**Última Atualização:** 2025
**Versão:** 1.0 - Production Ready


